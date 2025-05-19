import React, { useEffect, useRef } from 'react';

const App: React.FC = () => {
  console.log('Inside the offscreen document');
  
  // Use refs to maintain state across message handling
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const dataRef = useRef<Blob[]>([]);
  
  useEffect(() => {
    console.log('Offscreen App.tsx useEffect initialized');
    
    const handleMessages = async (message: any, sender: any, sendResponse: (response?: any) => void) => {
      console.log('Offscreen received message:', message);
      
      if (message.target === 'offscreen') {
        console.log('Handling offscreen message:', message.type);
        
        switch (message.type) {
          case 'start-recording':
            try {
              console.log('Starting recording with stream ID:', message.data);
              await startRecording(message.data);
              sendResponse({ success: true });
            } catch (error) {
              console.error('Error starting recording:', error);
              chrome.runtime.sendMessage({
                action: 'recordingError',
                error: error instanceof Error ? error.message : 'Unknown error starting recording'
              });
              sendResponse({ success: false, error: String(error) });
            }
            break;
            
          case 'stop-recording':
            try {
              console.log('Stopping recording');
              stopRecording();
              sendResponse({ success: true });
            } catch (error) {
              console.error('Error stopping recording:', error);
              sendResponse({ success: false, error: String(error) });
            }
            break;
            
          default:
            console.error(`Unrecognized message: ${message.type}`);
            sendResponse({ success: false, error: 'Unrecognized message type' });
        }
        return true; // Keep the message channel open for async response
      }
      
      return false; // Not handling this message
    };

    chrome.runtime.onMessage.addListener(handleMessages);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessages);
      // Ensure recording is stopped when component unmounts
      if (recorderRef.current?.state === 'recording') {
        stopRecording();
      }
    };
  }, []);

  async function startRecording(streamId: string) {
    console.log('Starting recording with stream ID:', streamId);
    
    if (recorderRef.current?.state === 'recording') {
      console.log('Recording already in progress, stopping current recording first');
      stopRecording();
    }
    
    try {
      // Reset data array
      dataRef.current = [];
      
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
      }).catch(error => {
        console.warn('Could not get microphone access, continuing without it:', error);
        return null;
      });
      
      if (micMedia) {
        console.log('Microphone access granted');
      }

      // Create audio context and mix streams
      const output = new AudioContext();
      const source = output.createMediaStreamSource(media);
      const destination = output.createMediaStreamDestination();
      
      source.connect(output.destination);
      source.connect(destination);
      
      // Only connect microphone if available
      if (micMedia) {
        const micAudio = output.createMediaStreamSource(micMedia);
        micAudio.connect(destination);
        console.log('Microphone audio connected');
      }
      
      console.log('Audio streams connected and mixed');

      // Request at least 100ms of data every 100ms
      recorderRef.current = new MediaRecorder(destination.stream, { 
      mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      
      recorderRef.current.ondataavailable = (event: any) => {
        if (event.data.size > 0) {
          console.log('Data available event:', event.data.size);
          dataRef.current.push(event.data);
        }
      };
      
      recorderRef.current.onerror = (event: any) => {
        console.error('MediaRecorder error:', event);
        chrome.runtime.sendMessage({
          action: 'recordingError',
          error: 'MediaRecorder error: ' + (event.error?.message || 'Unknown error')
        });
      };
      
      recorderRef.current.onstop = async () => {
        console.log('Recording stopped, processing data chunks:', dataRef.current.length);
        try {
          if (dataRef.current.length > 0) {
            const blob = new Blob(dataRef.current, { type: 'audio/webm' });
            console.log('Created blob of size:', blob.size);

            chrome.runtime.sendMessage({
              action: 'set-recording',
              recording: false,
            });

            if (blob.size > 0) {
              window.open(URL.createObjectURL(blob), '_blank');
            } else {
              console.warn('Empty recording, not creating download');
            }
          } else {
            console.warn('No data recorded');
          }

          // Clear state
          recorderRef.current = undefined;
          dataRef.current = [];
        } catch (error) {
          console.error('Error in recorder.onstop:', error);
          chrome.runtime.sendMessage({
            action: 'recordingError',
            error: error instanceof Error ? error.message : 'Error handling recording data'
          });
        }
      };
      
      recorderRef.current.start(100);
      console.log('MediaRecorder started:', recorderRef.current.state);

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

  function stopRecording() {
    console.log('Stopping recording, recorder state:', recorderRef.current?.state);
    
    try {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
        console.log('Recorder stopped');
        
        if (recorderRef.current.stream) {
          recorderRef.current.stream.getTracks().forEach((t: MediaStreamTrack) => {
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