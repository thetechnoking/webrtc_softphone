import React, { useEffect, useRef } from 'react';
import useAuthStore from './store/authStore';
import useSipStore from './store/sipStore'; 
import LoginForm from './components/LoginForm';
import Dialer from './components/Dialer'; 
import './App.css';

function App() {
  // Auth store
  const { 
    initializeAuth: authInit, // Renamed to avoid conflict
    token: authToken, 
    user: authUser, 
    webRTCConfig: authWebRTCConfig, 
    logout: authLogout, 
    isLoading: authIsLoading, 
    error: authError 
  } = useAuthStore(
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
  } = useSipStore();

  const remoteAudioRef = useRef(null);

  // Initialize auth state on component mount
  useEffect(() => {
    authInit();
  }, [authInit]);

  // Initialize SIP UA when webRTCConfig is available and user is logged in
  useEffect(() => {
    if (authToken && authWebRTCConfig && !sipUA) { 
      console.log('App.jsx: webRTCConfig available, initializing SIP UA.');
      
      const getTokenFunc = () => useAuthStore.getState().token;
      const getUserIdFunc = () => useAuthStore.getState().user?.id; 

      initializeSipUA(authWebRTCConfig, getTokenFunc, getUserIdFunc);
    }
  }, [authToken, authWebRTCConfig, initializeSipUA, sipUA]); 

  // Set audio elements in SIP store once refs are available
  useEffect(() => {
    if (remoteAudioRef.current) {
      setRemoteAudioElement(remoteAudioRef.current);
    }
  }, [setRemoteAudioElement]);


  const handleLogout = () => {
    shutdownSipUA(); 
    authLogout();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>WebRTC Softphone</h1>
        {authUser && <p style={{ fontSize: 'small' }}>Logged in as: {authUser.username}</p>}
      </header>
      <main>
        {authIsLoading && <p>Loading application state...</p>}
        {authError && <p style={{ color: 'red' }}>Authentication Error: {authError}</p>}
        
        {!authToken ? (
          <LoginForm />
        ) : (
          <div>
            <h2>Welcome, {authUser?.username || 'User'}!</h2>
            <p>You are logged in.</p>

            <div>
              <h3>SIP Status (from App.jsx)</h3>
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

            {authWebRTCConfig && (
              <div>
                <h4>Your WebRTC Configuration (from Auth):</h4>
                <pre style={{ textAlign: 'left', backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px', overflowX: 'auto', maxHeight: '100px' }}>
                  {JSON.stringify(authWebRTCConfig, null, 2)}
                </pre>
              </div>
            )}
            
            <Dialer /> 

            <button 
              onClick={handleLogout} 
              style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              Logout & Disconnect SIP
            </button>
          </div>
        )}

        <audio ref={remoteAudioRef} autoPlay playsInline controls={false} style={{display: 'none'}} />
      </main>
    </div>
  );
}

export default App;
