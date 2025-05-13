import React, { useEffect } from 'react';

const App: React.FC = () => {

  console.log('inside the offscreen')
  useEffect(() => {
    console.log('inside app.tsx offscreen is this even called')
    chrome.runtime.onMessage.addListener((message) => {
      if (message.target === 'offscreen') {
        switch (message.type) {
          case 'start-recording':
            console.error('OFFSCREEN start-recording');
            startRecording(message.data, message.orgId, message.micStreamId);
            break;
          case 'stop-recording':
            console.error('OFFSCREEN stop-recording');
            stopRecording();
            break;
          default:
            throw new Error(`Unrecognized message: ${message.type}`);
        }
      }
    });
  }, []);

  let recorder: MediaRecorder | undefined;
  let data: Blob[] = [];


  async function startRecording(streamId: string, orgId: string, micStreamId: string) {
    console.log('called offscreen',streamId)
    if (recorder?.state === 'recording') {
      throw new Error('Called startRecording while recording is in progress.');
    }
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
        includeSelf:true
      },
      video: false,
    } as any);
    console.error('OFFSCREEN media', media);

    const MicMedia=await navigator.mediaDevices.getUserMedia({
      audio:true,
      video:false
    })
    console.log('Offscreen mic media',MicMedia);

    const output = new AudioContext();
    const source = output.createMediaStreamSource(media);
    const micAudio=output.createMediaStreamSource(MicMedia);

    const destination = output.createMediaStreamDestination();
    source.connect(output.destination);
    source.connect(destination);
    micAudio.connect(destination);
    console.error('OFFSCREEN output', output);

    // Start recording.
    recorder = new MediaRecorder(destination.stream, { mimeType: 'video/webm' });
    recorder.ondataavailable = (event: any) => data.push(event.data);
    recorder.onstop = async () => {
      const blob = new Blob(data, { type: 'video/webm' });

      // delete local state of recording
      chrome.runtime.sendMessage({
        action: 'set-recording',
        recording: false,
      });

      window.open(URL.createObjectURL(blob), '_blank');

      recorder = undefined;
      data = [];
    };
    recorder.start();

    console.error('OFFSCREEN recorder started', recorder);

    chrome.runtime.sendMessage({
      action: 'set-recording',
      recording: true,
    });
    window.location.hash = 'recording';
  }

  async function stopRecording() {
    recorder?.stop();
    recorder?.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    window.location.hash = '';
  }

  return <div></div>;
};

export default App;
