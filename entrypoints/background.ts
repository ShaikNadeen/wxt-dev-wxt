export default defineBackground({
  main() {
    let recordingStartTime: number = 0;
    let isRecording: boolean = false;

    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    }


    // Request the necessary permissions
    const requestPermissions = async (): Promise<boolean> => {
      try {
        const granted = await chrome.permissions.request({
          permissions: ['activeTab', 'tabCapture', 'tabs', 'storage','offscreen','audio']
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
      console.log("Existing contexts:", offscreenDocument);
      
      if (offscreenDocument) {
        recording = offscreenDocument.documentUrl?.endsWith('#recording') ?? false;
        console.log('Currently recording:', recording);
        
      }

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


      if (!offscreenDocument) {
        console.log('Creating offscreen document');
        try {
          await chrome.offscreen.createDocument({
            url: 'offscreen.html',
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

      try {
        const streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
            if (chrome.runtime.lastError) {
              console.error('tabCapture error:', chrome.runtime.lastError.message);
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(streamId);
          });
        });
        console.log('Stream ID received:', streamId);

        const micStreamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(streamId);
          });
        });
        console.log('Mic stream ID received:', micStreamId);

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
        console.log('sender',sender.tab?.id);
        if (sender.tab?.id) {
          startRecordingOffscreen(sender.tab.id);
        }
        return true;
      } else if (message.action === 'stopRecording') {
        console.log('Stop recording request received');
        if(sender.tab?.id){
          startRecordingOffscreen(sender.tab?.id);
        }
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