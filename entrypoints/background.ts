
export default defineBackground({
  main() {
    let speakerSegments: { speaker: string; startTime: number; endTime: number; }[] = [];
    let currentSpeaker: string | null = null;
    let speakerStartTime: number = 0;
    let recordingStartTime: number = 0;
    let isRecording: boolean = false;

    const startRecordingOffscreen = async (tabId: number) => {
      console.log('this is called',tabId);
      const existingContexts = await chrome.runtime.getContexts({});
      let recording = false;

      const offscreenDocument = existingContexts.find((c) => c.contextType === 'OFFSCREEN_DOCUMENT');
      console.log("existingContents",existingContexts,offscreenDocument)
      if (!offscreenDocument) {
        console.error('OFFSCREEN no offscreen document');
        await chrome.offscreen.createDocument({
          url:'/offscreen.html',
          reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
          justification: 'Recording from chrome.tabCapture API',
        });
      } else {
        recording = offscreenDocument.documentUrl?.endsWith('#recording') ?? false;
        console.log('recording',recording)
      }

      if (recording) {
        console.log('inside recording')
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

      // Get a MediaStream for the active tab.
      console.error('BACKGROUND getMediaStreamId');

      const streamId = await new Promise<string>((resolve) => {
        // chrome.tabCapture.getMediaStreamId({ consumerTabId: tabId }, (streamId) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
          resolve(streamId);
        });
      });
      console.error('BACKGROUND streamId', streamId);

      const micStreamId = await new Promise<string>((resolve) => {
        chrome.tabCapture.getMediaStreamId({ consumerTabId: tabId }, (streamId) => {
          resolve(streamId);
        });
      });
      console.error('BACKGROUND micStreamId', micStreamId);

      // Send the stream ID to the offscreen document to start recording.
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
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'startRecording') {
        console.error('startRecording in background', JSON.stringify(message));
        startRecordingOffscreen(message.tabId);
        return true;
      } else if (message.action === 'stopRecording') {
        console.error('stopRecording in background');
        startRecordingOffscreen(message.tabId);
        return true;
      } else if (message.action === 'set-recording') {
        console.error('set-recording in background', message.recording);
        chrome.storage.session.set({ recording: message.recording });
      } else if (message.action === 'get-recording-status') {
        sendResponse({ isRecording, recordingStartTime });
        return true;
      }
    });
  }
})