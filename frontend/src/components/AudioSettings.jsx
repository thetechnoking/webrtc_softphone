import React, { useState, useEffect, useRef, useCallback } from 'react';
import './AudioSettings.css'; // Assuming CSS is created

function AudioSettings() {
  const [microphones, setMicrophones] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');

  const [micStream, setMicStream] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [analyserNode, setAnalyserNode] = useState(null);
  const vuMeterAnimationRef = useRef(null);
  const vuMeterBarRef = useRef(null); // Ref for the visual bar element

  const testAudioRef = useRef(null); // For speaker test

  // Enumerate devices on mount
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn('enumerateDevices() not supported.');
        alert('Device enumeration is not supported by your browser.');
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');
      
      setMicrophones(audioInputDevices);
      setSpeakers(audioOutputDevices);

      // Set default selections if not already set (or if previous selection is no longer valid)
      if (audioInputDevices.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(audioInputDevices[0].deviceId);
      }
      if (audioOutputDevices.length > 0 && !selectedSpeaker) {
        setSelectedSpeaker(audioOutputDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating devices:', err);
      alert(`Error enumerating devices: ${err.message}`);
    }
  }, [selectedMicrophone, selectedSpeaker]); // Re-run if selections change to ensure they are valid? Or just on mount.

  useEffect(() => {
    enumerateDevices();
    // Listen for device changes
    navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', enumerateDevices);
      // Cleanup mic test if component unmounts
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      if (vuMeterAnimationRef.current) {
        cancelAnimationFrame(vuMeterAnimationRef.current);
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount and clean up

  const drawVuMeter = useCallback(() => {
    if (!analyserNode || !vuMeterBarRef.current) {
      vuMeterAnimationRef.current = requestAnimationFrame(drawVuMeter); // Keep trying if not ready
      return;
    }
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(dataArray);
    
    // Simple average or max value for VU meter
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const level = Math.min(100, Math.max(0, (average / 255) * 200)); // Scale factor, adjust as needed

    if (vuMeterBarRef.current) {
      vuMeterBarRef.current.style.width = `${level}%`;
    }
    vuMeterAnimationRef.current = requestAnimationFrame(drawVuMeter);
  }, [analyserNode]);

  const startMicTest = async () => {
    if (micStream) { // Stop existing stream first
      micStream.getTracks().forEach(track => track.stop());
      if (vuMeterAnimationRef.current) cancelAnimationFrame(vuMeterAnimationRef.current);
      if (audioContext && audioContext.state !== 'closed') await audioContext.close();
      setMicStream(null);
      setAudioContext(null);
      setAnalyserNode(null);
      if (vuMeterBarRef.current) vuMeterBarRef.current.style.width = '0%';
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined }
      });
      setMicStream(stream);

      const newAudioContext = new AudioContext();
      setAudioContext(newAudioContext);

      const newAnalyserNode = newAudioContext.createAnalyser();
      newAnalyserNode.fftSize = 256; // Adjust for sensitivity
      setAnalyserNode(newAnalyserNode);

      const source = newAudioContext.createMediaStreamSource(stream);
      source.connect(newAnalyserNode);

      drawVuMeter(); // Start animation loop
    } catch (err) {
      console.error('Error starting mic test:', err);
      alert(`Could not start microphone test: ${err.message}`);
    }
  };

  const stopMicTest = () => {
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }
    if (vuMeterAnimationRef.current) {
      cancelAnimationFrame(vuMeterAnimationRef.current);
      vuMeterAnimationRef.current = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }
    setMicStream(null);
    setAudioContext(null);
    setAnalyserNode(null);
    if (vuMeterBarRef.current) {
      vuMeterBarRef.current.style.width = '0%';
    }
  };

  const playTestSound = async () => {
    if (!testAudioRef.current) {
      testAudioRef.current = new Audio('/sounds/test-sound.mp3');
    }
    const audio = testAudioRef.current;

    if (selectedSpeaker && typeof audio.setSinkId === 'function') {
      try {
        await audio.setSinkId(selectedSpeaker);
        console.log(`Speaker test sound outputting to device: ${selectedSpeaker}`);
      } catch (err) {
        console.error(`Error setting sink ID ${selectedSpeaker}: ${err.message}`);
        alert(`Could not set speaker to selected device. Error: ${err.message}. Playing on default.`);
      }
    } else if (selectedSpeaker) {
      alert('Your browser does not support selecting audio output devices for this test. Playing on default.');
    }
    
    audio.play().catch(err => {
        console.error('Error playing test sound:', err);
        alert(`Could not play test sound: ${err.message}`);
    });
  };

  return (
    <div className="audio-settings-panel">
      <h4>Audio Settings</h4>

      <div className="device-selection-group">
        <label htmlFor="microphone-select">Microphone:</label>
        <select
          id="microphone-select"
          value={selectedMicrophone}
          onChange={(e) => setSelectedMicrophone(e.target.value)}
          disabled={!!micStream} // Disable while mic test is running
        >
          {microphones.map(mic => (
            <option key={mic.deviceId} value={mic.deviceId}>{mic.label || `Microphone ${mic.deviceId.substring(0,8)}`}</option>
          ))}
          {microphones.length === 0 && <option value="">No microphones found</option>}
        </select>
      </div>

      <div className="test-section">
        <h5>Microphone Test</h5>
        {!micStream ? (
          <button onClick={startMicTest} disabled={microphones.length === 0}>Test Mic</button>
        ) : (
          <button onClick={stopMicTest}>Stop Mic Test</button>
        )}
        <div className="vu-meter-container">
          <div ref={vuMeterBarRef} className="vu-meter-bar"></div>
        </div>
      </div>

      <div className="device-selection-group">
        <label htmlFor="speaker-select">Speaker:</label>
        <select
          id="speaker-select"
          value={selectedSpeaker}
          onChange={(e) => setSelectedSpeaker(e.target.value)}
        >
          {speakers.map(spk => (
            <option key={spk.deviceId} value={spk.deviceId}>{spk.label || `Speaker ${spk.deviceId.substring(0,8)}`}</option>
          ))}
          {speakers.length === 0 && <option value="">No speakers found</option>}
        </select>
      </div>
      
      <div className="test-section">
        <h5>Speaker Test</h5>
        <button onClick={playTestSound} disabled={speakers.length === 0}>Test Speaker</button>
        <p className="speaker-test-info">
          Note: Speaker selection for test sound has limited browser support. May play on default.
        </p>
      </div>
    </div>
  );
}

export default AudioSettings;
