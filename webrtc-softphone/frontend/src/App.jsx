import React, { useEffect, useRef } from 'react';
import useAuthStore from './store/authStore';
import useSipStore from './store/sipStore'; // Import the new SIP store
import LoginForm from './components/LoginForm';
import Dialer from './components/Dialer'; // Import the Dialer component
import './App.css';

function App() {
  // Auth store
  const { initializeAuth, token, user, webRTCConfig, logout: authLogout, isLoading: authIsLoading, error: authError } = useAuthStore(
    (state) => ({
      initializeAuth: state.initializeAuth,
      token: state.token,
      user: state.user,
      webRTCConfig: state.webRTCConfig,
      logout: state.logout,
      isLoading: state.isLoading,
      error: state.error,
    })
  );

  // SIP store
  const {
    sipUA,
    isRegistered,
    registrationError,
    callState,
    currentCall,
    incomingCallInfo,
    initializeSipUA,
    shutdownSipUA,
    makeCall,
    answerCall,
    terminateCall,
    setRemoteAudioElement,
    // setLocalAudioElement, // If you need to manage a local audio element ref
  } = useSipStore();

  const remoteAudioRef = useRef(null);
  // const localAudioRef = useRef(null); // If you have a local audio element

  // Initialize auth state on component mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Initialize SIP UA when webRTCConfig is available and user is logged in
  useEffect(() => {
    if (token && webRTCConfig && !sipUA) { // Check !sipUA to prevent re-initialization
      console.log('App.jsx: webRTCConfig available, initializing SIP UA.');
      initializeSipUA(webRTCConfig);
    }
  }, [token, webRTCConfig, initializeSipUA, sipUA]);

  // Set audio elements in SIP store once refs are available
  useEffect(() => {
    if (remoteAudioRef.current) {
      setRemoteAudioElement(remoteAudioRef.current);
    }
    // if (localAudioRef.current) {
    //   setLocalAudioElement(localAudioRef.current);
    // }
  }, [setRemoteAudioElement /*, setLocalAudioElement */]);


  const handleLogout = () => {
    shutdownSipUA(); // Shut down SIP before logging out from auth
    authLogout();
  };

  // --- Minimal Call Control UI Example ---
  const [targetUri, setTargetUri] = React.useState('');

  const handleMakeCall = () => {
    if (targetUri) {
      makeCall(targetUri);
    } else {
      alert('Please enter a target URI (e.g., sip:user@example.com)');
    }
  };
  // --- End Minimal Call Control UI Example ---

  return (
    <div className="App">
      <header className="App-header">
        <h1>WebRTC Softphone</h1>
        {user && <p style={{ fontSize: 'small' }}>Logged in as: {user.username}</p>}
      </header>
      <main>
        {authIsLoading && <p>Loading application state...</p>}
        {authError && <p style={{ color: 'red' }}>Authentication Error: {authError}</p>}
        
        {!token ? (
          <LoginForm />
        ) : (
          <div>
            <h2>Welcome, {user?.username || 'User'}!</h2>
            <p>You are logged in.</p>

            {/* SIP Status Display */}
            <div>
              <h3>SIP Status</h3>
              {sipUA ? (
                isRegistered ? (
                  <p style={{ color: 'green' }}>Registered to SIP Server</p>
                ) : (
                  <p style={{ color: 'orange' }}>
                    {registrationError 
                      ? `Registration Failed: ${registrationError}` 
                      : 'Registering... (or not connected)'}
                  </p>
                )
              ) : (
                <p>SIP User Agent not initialized yet.</p>
              )}
            </div>

            {/* WebRTC Config Display (from authStore) */}
            {webRTCConfig && (
              <div>
                <h4>Your WebRTC Configuration (from Auth):</h4>
                <pre style={{ textAlign: 'left', backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px', overflowX: 'auto', maxHeight: '100px' }}>
                  {JSON.stringify(webRTCConfig, null, 2)}
                </pre>
              </div>
            )}

            {/* Minimal Call Controls */}
            {isRegistered && (
              <div style={{ border: '1px solid #eee', padding: '10px', margin: '10px 0' }}>
                <h3>Call Controls</h3>
                <p>Call State: <strong style={{color: callState === 'active' ? 'green' : (callState === 'incoming' ? 'blue' : 'black')}}>{callState}</strong></p>
                
                {callState === 'idle' && (
                  <div>
                    <input 
                      type="text" 
                      value={targetUri} 
                      onChange={(e) => setTargetUri(e.target.value)} 
                      placeholder="sip:user@example.com"
                      style={{marginRight: '10px', padding: '5px'}}
                    />
                    <button onClick={handleMakeCall} style={{padding: '5px 10px'}}>Call</button>
                  </div>
                )}

                {callState === 'incoming' && (
                  <div>
                    <p>Incoming call from: {incomingCallInfo?.displayName || incomingCallInfo?.uri || 'Unknown'}</p>
                    <button onClick={answerCall} style={{padding: '5px 10px', backgroundColor: 'green', color: 'white', marginRight: '10px'}}>Answer</button>
                    <button onClick={terminateCall} style={{padding: '5px 10px', backgroundColor: 'red', color: 'white'}}>Decline</button>
                  </div>
                )}

                {(callState === 'active' || callState === 'outgoing' || callState === 'outgoing_progress') && currentCall && (
                  <div>
                    <p>Call with: {currentCall.remote_identity?.uri?.toString() || 'Unknown'}</p>
                    <button onClick={terminateCall} style={{padding: '5px 10px', backgroundColor: 'red', color: 'white'}}>Hang Up</button>
                  </div>
                )}
              </div>
            )}
            
            <button 
              onClick={handleLogout} 
              style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              Logout & Disconnect SIP
            </button>
            
            {/* Conditionally render Dialer if logged in */}
            <Dialer /> 

          </div>
        )}

        {/* Audio elements - can be hidden if no controls are needed */}
        {/* Remote audio should ideally auto-play if the browser allows after user interaction */}
        <audio ref={remoteAudioRef} autoPlay playsInline controls={false} style={{display: 'none'}} />
        {/* <audio ref={localAudioRef} muted playsInline controls /> */} {/* For local mic test or self-view, if needed */}

      </main>
    </div>
  );
}

export default App;
