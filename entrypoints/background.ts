export default defineBackground({
  main() {
    let speakerSegments: { speaker: string; startTime: number; endTime: number; }[] = [];
    let currentSpeaker: string | null = null;
    let speakerStartTime: number = 0;
    let recordingStartTime: number = 0;
    let isRecording: boolean = false;

    // Check if we have all required permissions
    const checkPermissions = async (): Promise<boolean> => {
      try {
        const permissions = await chrome.permissions.getAll();
        const requiredPermissions: chrome.runtime.ManifestPermissions[] = ['activeTab', 'tabCapture', 'tabs', 'storage'];
        
        // Check if all required permissions are present
        const hasAllPermissions = requiredPermissions.every(
          permission => permissions.permissions?.includes(permission as chrome.runtime.ManifestPermissions)
        );
        
        return hasAllPermissions;
      } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
      }
    };

    // Request the necessary permissions
    const requestPermissions = async (): Promise<boolean> => {
      try {
        const granted = await chrome.permissions.request({
          permissions: ['activeTab', 'tabCapture', 'tabs', 'storage']
        });
        return granted;
      } catch (error) {
        console.error('Error requesting permissions:', error);
        return false;
      }
    };

    const startRecordingOffscreen = async (tabId: number) => {
      console.log('Starting recording process:', tabId);
      
      // Check if already recording, if so, stop recording
      const existingContexts = await chrome.runtime.getContexts({});
      let recording = false;

      const offscreenDocument = existingContexts.find((c) => c.contextType === 'OFFSCREEN_DOCUMENT');
      console.log("Existing contexts:", existingContexts, offscreenDocument);
      
      if (offscreenDocument) {
        recording = offscreenDocument.documentUrl?.endsWith('#recording') ?? false;
        console.log('Currently recording:', recording);
      }

      // If already recording, stop it
      if (recording) {
        console.log('Already recording, stopping current recording');
        chrome.runtime.sendMessage({
          type: 'stop-recording',
          target: 'offscreen',
        });
        chrome.action.setIcon({ path: 'icons/not-recording.png' });
        
        chrome.tabs.sendMessage(tabId, { action: "stopRecording" });
        
        isRecording = false;
        chrome.storage.session.set({ recording: false });
        return;
      }

      // Check for permissions
      const hasPermissions = await checkPermissions();
      if (!hasPermissions) {
        console.log('Requesting permissions');
        // Send message to popup to show permission request dialog
        chrome.runtime.sendMessage({ 
          action: "needPermissions",
          requiredPermissions: ['activeTab', 'tabCapture', 'tabs', 'storage']
        });
        return;
      }

      // Create offscreen document if it doesn't exist
      if (!offscreenDocument) {
        console.log('Creating offscreen document');
        try {
          await chrome.offscreen.createDocument({
            url: '/offscreen.html',
            reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
            justification: 'Recording from chrome.tabCapture API',
          });
        } catch (error) {
          console.error('Failed to create offscreen document:', error);
          chrome.runtime.sendMessage({ 
            action: "recordingError",
            error: "Failed to create offscreen document"
          });
          return;
        }
      }

      // Get a MediaStream for the active tab
      console.log('Getting media stream ID');
      try {
        const streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(streamId);
          });
        });
        console.log('Stream ID received:', streamId);

        const micStreamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ consumerTabId: tabId }, (streamId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(streamId);
          });
        });
        console.log('Mic stream ID received:', micStreamId);

        // Send the stream ID to the offscreen document to start recording
        chrome.runtime.sendMessage({
          type: 'start-recording',
          target: 'offscreen',
          data: streamId,
          micStreamId,
        });
        chrome.tabs.sendMessage(tabId, { action: "startRecording" });
        isRecording = true;
        recordingStartTime = Date.now();
        chrome.storage.session.set({ recording: true });
      } catch (error) {
        console.error('Error getting media stream:', error);
        chrome.runtime.sendMessage({ 
          action: "recordingError",
          error: "Failed to capture tab - make sure you've granted all required permissions"
        });
      }
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'startRecording') {
        console.log('Start recording request received:', JSON.stringify(message));
        startRecordingOffscreen(message.tabId);
        return true;
      } else if (message.action === 'stopRecording') {
        console.log('Stop recording request received');
        startRecordingOffscreen(message.tabId);
        return true;
      } else if (message.action === 'set-recording') {
        console.log('Set recording state:', message.recording);
        chrome.storage.session.set({ recording: message.recording });
      } else if (message.action === 'get-recording-status') {
        sendResponse({ isRecording, recordingStartTime });
        return true;
      } else if (message.action === 'requestPermissions') {
        requestPermissions().then(granted => {
          console.log('Permissions granted:', granted);
          if (granted) {
            chrome.runtime.sendMessage({ action: "permissionsGranted" });
            if (message.tabId) {
              startRecordingOffscreen(message.tabId);
            }
          } else {
            chrome.runtime.sendMessage({ action: "permissionsDenied" });
          }
        });
        return true;
      }
    });
  }
})