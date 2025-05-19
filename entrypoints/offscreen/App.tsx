import React, { useEffect } from 'react';

const App: React.FC = () => {
  console.log('Inside the offscreen document')
  
  useEffect(() => {
    console.log('Offscreen App.tsx useEffect initialized')
    
    const handleMessages = async (message: any) => {
      if (message.target === 'offscreen') {
        console.log('Received message in offscreen:', message.type)
        switch (message.type) {
          case 'start-recording':
            try {
              console.log('Starting recording with stream ID:', message.data)
              await startRecording(message.data, message.orgId, message.micStreamId);
            } catch (error) {
              console.error('Error starting recording:', error)
              // Send error back to background script
              chrome.runtime.sendMessage({
                action: 'recordingError',
                error: error instanceof Error ? error.message : 'Unknown error starting recording'
              });
            }
            break;
          case 'stop-recording':
            console.log('Stopping recording')
            stopRecording();
            break;
          default:
            console.error(`Unrecognized message: ${message.type}`);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessages);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessages);
    };
  }, []);

  let recorder: MediaRecorder | undefined;
  let data: Blob[] = [];

  async function startRecording(streamId: string, orgId: string, micStreamId: string) {
    console.log('Starting recording with stream ID:', streamId)
    
    if (recorder?.state === 'recording') {
      throw new Error('Called startRecording while recording is in progress.');
    }
    
    try {
      const mediaOptions = {
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
          },
          includeSelf: true
        },
        video: false,
      } as any;
      
      console.log('Requesting tab media with options:', JSON.stringify(mediaOptions));
      const media = await navigator.mediaDevices.getUserMedia(mediaOptions);
      console.log('Tab media stream obtained successfully');

      // Request microphone with error handling
      console.log('Requesting microphone access');
      const micMedia = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      console.log('Microphone access granted');

      // Create audio context and mix streams
      const output = new AudioContext();
      const source = output.createMediaStreamSource(media);
      const micAudio = output.createMediaStreamSource(micMedia);

      const destination = output.createMediaStreamDestination();
      source.connect(output.destination);
      source.connect(destination);
      micAudio.connect(destination);
      console.log('Audio streams connected and mixed');

      // Start recording with error handling
      recorder = new MediaRecorder(destination.stream, { mimeType: 'video/webm' });
      
      recorder.ondataavailable = (event: any) => {
        console.log('Data available event:', event.data.size);
        data.push(event.data);
      };
      
      recorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event);
        chrome.runtime.sendMessage({
          action: 'recordingError',
          error: 'MediaRecorder error: ' + (event.error?.message || 'Unknown error')
        });
      };
      
      recorder.onstop = async () => {
        console.log('Recording stopped');
        try {
          const blob = new Blob(data, { type: 'video/webm' });
          console.log('Created blob of size:', blob.size);

          // Delete local state of recording
          chrome.runtime.sendMessage({
            action: 'set-recording',
            recording: false,
          });

          // Open the recording in a new tab
          window.open(URL.createObjectURL(blob), '_blank');

          recorder = undefined;
          data = [];
        } catch (error) {
          console.error('Error in recorder.onstop:', error);
          chrome.runtime.sendMessage({
            action: 'recordingError',
            error: error instanceof Error ? error.message : 'Error handling recording data'
          });
        }
      };
      
      // Start the recording
      recorder.start();
      console.log('MediaRecorder started:', recorder.state);

      // Notify background that recording has started
      chrome.runtime.sendMessage({
        action: 'set-recording',
        recording: true,
      });
      
      window.location.hash = 'recording';
    } catch (error) {
      console.error('Error in startRecording:', error);
      throw new Error(`Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function stopRecording() {
    console.log('Stopping recording, recorder state:', recorder?.state);
    
    try {
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
        console.log('Recorder stopped');
        
        if (recorder.stream) {
          recorder.stream.getTracks().forEach((t: MediaStreamTrack) => {
            console.log('Stopping track:', t.kind, t.label);
            t.stop();
          });
        }
      } else {
        console.log('No active recorder to stop');
      }
      
      window.location.hash = '';
    } catch (error) {
      console.error('Error stopping recording:', error);
      chrome.runtime.sendMessage({
        action: 'recordingError',
        error: error instanceof Error ? error.message : 'Error stopping recording'
      });
    }
  }

  return <div>Offscreen Recording Document</div>;
};

export default App;