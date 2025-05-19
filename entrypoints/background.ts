export default defineBackground({
  main() {
    let recordingStartTime: number = 0;
    let isRecording: boolean = false;
    let pendingOperation: boolean = false; // Add this to prevent multiple concurrent operations

    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    }

    const startRecording = async (tabId: number) => {
      // Prevent multiple concurrent start operations
      if (pendingOperation) {
        console.log('Operation already in progress, ignoring request');
        return;
      }
      
      try {
        pendingOperation = true;
        console.log('Starting recording process:', tabId);
        
        // Check if already recording
        if (isRecording) {
          console.log('Already recording, cannot start new recording');
          return;
        }
        
        // Check for existing offscreen document
        const existingContexts = await chrome.runtime.getContexts({});
        const offscreenDocument = existingContexts.find(c => c.contextType === 'OFFSCREEN_DOCUMENT');
        console.log("Existing contexts:", offscreenDocument);
        
        // If there's an existing document, close it first to ensure clean state
        if (offscreenDocument) {
          try {
            await chrome.offscreen.closeDocument();
            console.log('Closed existing offscreen document');
          } catch (error) {
            console.error('Error closing existing document:', error);
            // Continue anyway, as we'll try to create a new one
          }
        }
        
        // Create new offscreen document
        console.log('Creating offscreen document');
        try {
          await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
            justification: 'Recording from chrome.tabCapture API',
          });
          console.log('Offscreen document created successfully');
        } catch (error) {
          console.error('Failed to create offscreen document:', error);
          chrome.runtime.sendMessage({ 
            action: "recordingError",
            error: "Failed to create offscreen document"
          });
          return;
        }
        
        // Wait a moment to ensure offscreen document is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Get tab media stream ID
        console.log('Getting tab media stream ID');
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
        
        // Send message to offscreen document to start recording
        chrome.runtime.sendMessage({
          type: 'start-recording',
          target: 'offscreen',
          data: streamId,
        }, (response) => {
          console.log('Offscreen start-recording response:', response);
        });
        
        // Notify content script
        chrome.tabs.sendMessage(tabId, { action: "startRecording" }, (response) => {
          console.log('Content script start notification response:', response || 'No response');
        });
        
        // Update recording state
        isRecording = true;
        recordingStartTime = Date.now();
        chrome.storage.session.set({ recording: true, recordingStartTime });
        
      } catch (error) {
        console.error('Error starting recording:', error);
        chrome.runtime.sendMessage({ 
          action: "recordingError",
          error: "Failed to start recording: " + (error instanceof Error ? error.message : String(error))
        });
        
        // Reset state
        isRecording = false;
        
      } finally {
        pendingOperation = false;
      }
    };

    const stopRecording = async (tabId: number) => {
      // Prevent multiple concurrent stop operations
      if (pendingOperation) {
        console.log('Operation already in progress, ignoring request');
        return;
      }
      
      try {
        pendingOperation = true;
        console.log('Stopping recording process:', tabId);
        
        if (!isRecording) {
          console.log('Not currently recording, nothing to stop');
          return;
        }
        
        // Check if offscreen document exists
        const existingContexts = await chrome.runtime.getContexts({});
        const offscreenDocument = existingContexts.find(c => c.contextType === 'OFFSCREEN_DOCUMENT');
        
        if (offscreenDocument) {
          console.log('Sending stop-recording message to offscreen document');
          // Tell offscreen document to stop recording
          chrome.runtime.sendMessage({
            type: 'stop-recording',
            target: 'offscreen',
          }, (response) => {
            console.log('Offscreen stop-recording response:', response || 'No response');
          });
        } else {
          console.log('No offscreen document found to stop recording');
        }
        
        // Update icon
        chrome.action.setIcon({ path: 'icons/not-recording.png' });
        
        // Notify content script
        chrome.tabs.sendMessage(tabId, { action: "stopRecording" }, (response) => {
          console.log('Content script stop notification response:', response || 'No response');
        });
        
        // Update recording state
        isRecording = false;
        chrome.storage.session.set({ recording: false });
        
      } catch (error) {
        console.error('Error stopping recording:', error);
      } finally {
        pendingOperation = false;
      }
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Background received message:', message);
      
      if (message.action === 'startRecording') {
        if (sender.tab?.id) {
          // Handle asynchronously but acknowledge receipt immediately
          sendResponse({ received: true });
          startRecording(sender.tab.id);
        } else {
          sendResponse({ error: 'No tab ID found' });
        }
        return false; // We're responding synchronously
      } 
      else if (message.action === 'stopRecording') {
        if (sender.tab?.id) {
          // Handle asynchronously but acknowledge receipt immediately
          sendResponse({ received: true });
          stopRecording(sender.tab.id);
        } else {
          sendResponse({ error: 'No tab ID found' });
        }
        return false; // We're responding synchronously
      } 
      else if (message.action === 'set-recording') {
        console.log('Set recording state:', message.recording);
        chrome.storage.session.set({ recording: message.recording });
        sendResponse({ success: true });
        return false;
      } 
      else if (message.action === 'get-recording-status') {
        sendResponse({ isRecording, recordingStartTime });
        return false;
      }
      
      return false; // Not handling this message
    });
  }
})