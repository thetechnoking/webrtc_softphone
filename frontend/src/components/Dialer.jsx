import React, { useState } from 'react';
import Draggable from 'react-draggable';
import useSipStore from '../store/sipStore';
import AudioSettings from './AudioSettings';
// Import new tab components
import CallScriptTab from './tabs/CallScriptTab';
import CallLogsTab from './tabs/CallLogsTab';
import CustomerDetailTab from './tabs/CustomerDetailTab';
import DispositionFormTab from './tabs/DispositionFormTab';
import './Dialer.css'; 
import './tabs/Tabs.css'; // Import common tab styling

function Dialer() {
  const [dialValue, setDialValue] = useState('');
  // Extend activeTab to include new tab identifiers
  const [activeTab, setActiveTab] = useState('dialpad'); 
  // 'dialpad', 'audioSettings', 'callScript', 'callLogs', 'customerDetail', 'dispositionForm'

  const {
    sipUA, 
    isRegistered,
    registrationError,
    callState,
    currentCall, 
    incomingCallInfo,
    isMuted,
    isOnHold,
    makeCall,
    answerCall,
    terminateCall,
    toggleMute,
    toggleHold,
  } = useSipStore(state => ({ /* ... (sipStore selectors as before) ... */ 
    sipUA: state.sipUA, isRegistered: state.isRegistered, registrationError: state.registrationError,
    callState: state.callState, currentCall: state.currentCall, incomingCallInfo: state.incomingCallInfo,
    isMuted: state.isMuted, isOnHold: state.isOnHold, makeCall: state.makeCall,
    answerCall: state.answerCall, terminateCall: state.terminateCall,
    toggleMute: state.toggleMute, toggleHold: state.toggleHold,
  }));

  // --- Event Handlers (handleButtonClick, handleClear, etc. as before) ---
  const handleButtonClick = (value) => setDialValue((prev) => prev + value);
  const handleClear = () => setDialValue('');
  const handleBackspace = () => setDialValue((prev) => prev.slice(0, -1));
  const handleCallAction = () => {
    if (callState === 'idle' && dialValue && isRegistered) makeCall(dialValue);
    else if (callState === 'incoming') answerCall();
  };
  const handleHangupAction = () => terminateCall();

  const dialpadButtons = ['1','2','3','4','5','6','7','8','9','*','0','#'];

  // --- Status Message Logic (sipRegistrationStatusMessage, callActivityStatusMessage, getSipStatusClass as before) ---
  let sipRegistrationStatusMessage = 'SIP: Unknown';
  const getSipStatusClass = () => {
    if (registrationError) return 'sip-status-error';
    if (isRegistered) return 'sip-status-registered';
    if (sipUA && sipUA.isConnecting()) return 'sip-status-registering';
    if (sipUA && !sipUA.isRegistered() && !sipUA.isConnecting()) return 'sip-status-unregistered';
    if (!sipUA) return 'sip-status-disconnected';
    return 'sip-status-unknown';
  };
  if (registrationError) sipRegistrationStatusMessage = `SIP Error: ${registrationError.message || registrationError}`;
  else if (isRegistered) sipRegistrationStatusMessage = 'SIP: Registered';
  else if (sipUA && sipUA.isConnecting()) sipRegistrationStatusMessage = 'SIP: Registering...';
  else if (sipUA && !sipUA.isRegistered() && !sipUA.isConnecting()) sipRegistrationStatusMessage = 'SIP: Unregistered / Disconnected';
  else if (!sipUA) sipRegistrationStatusMessage = 'SIP: Disconnected';

  let callActivityStatusMessage = '';
  switch (callState) {
    case 'idle': callActivityStatusMessage = isRegistered ? 'Ready to call' : ''; break;
    case 'incoming': callActivityStatusMessage = `Incoming: ${incomingCallInfo?.displayName || incomingCallInfo?.uri}... Ringing...`; break;
    case 'outgoing': case 'outgoing_progress':
      const remotePartyOutgoing = currentCall?.remote_identity?.uri?.toString() || dialValue;
      callActivityStatusMessage = `Calling ${remotePartyOutgoing}...`; break;
    case 'active':
      const remotePartyActive = currentCall?.remote_identity?.uri?.toString() || 'Unknown';
      callActivityStatusMessage = `Active: ${remotePartyActive}`;
      if (isMuted) callActivityStatusMessage += ' (Muted)';
      if (isOnHold) callActivityStatusMessage += ' (On Hold)'; break;
    default: if (callState !== 'idle') callActivityStatusMessage = `Call: ${callState}`;
  }
  
  // --- Button Display Logic (callButtonText, etc. as before) ---
  let callButtonText = 'Call'; let callButtonDisabled = true; let callButtonClass = 'call-button';
  if (callState === 'idle' && isRegistered && dialValue) callButtonDisabled = false;
  else if (callState === 'incoming') { callButtonText = 'Answer'; callButtonDisabled = false; callButtonClass = 'answer-button'; }
  else if (['outgoing', 'outgoing_progress', 'active'].includes(callState)) { callButtonText = callState === 'active' ? 'Active' : 'Calling...'; callButtonDisabled = true; }
  else if (!isRegistered) { callButtonText = 'Call'; callButtonDisabled = true; }
  const showHangupButton = ['incoming', 'outgoing', 'outgoing_progress', 'active'].includes(callState);
  const hangupButtonText = callState === 'incoming' ? 'Reject' : 'Hang Up';
  const hangupButtonClass = callState === 'incoming' ? 'reject-button' : 'hangup-button';

  // Tab definitions
  const tabs = [
    { id: 'dialpad', label: 'Dialpad' },
    { id: 'audioSettings', label: 'Audio' },
    { id: 'callScript', label: 'Script' },
    { id: 'callLogs', label: 'Logs' },
    { id: 'customerDetail', label: 'Customer' },
    { id: 'dispositionForm', label: 'Disposition' },
  ];

  return (
    <Draggable handle=".dialer-handle" bounds="parent">
      <div className="dialer-container">
        <div className="dialer-handle">Drag Dialer</div>
        
        <div className="dialer-tabs">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="tab-content"> {/* Common class for content area */}
          {activeTab === 'dialpad' && (
            <div className="dialer-content"> {/* Specific content for dialpad if needed, or remove if .tab-content is enough */}
              <input
                type="text"
                className="dialpad-display"
                value={dialValue}
                onChange={(e) => setDialValue(e.target.value)} 
                placeholder="Enter SIP URI or number"
              />
              <div className="dialpad-buttons">
                {dialpadButtons.map((btn) => (
                  <button key={btn} onClick={() => handleButtonClick(btn)}>{btn}</button>
                ))}
                <button onClick={handleBackspace} className="clear-button" style={{gridColumn: 'span 1.5'}}>Bksp</button>
                <button onClick={handleClear} className="clear-button" style={{gridColumn: 'span 1.5'}}>Clear</button>
              </div>
              
              {callState === 'active' && (
                <div className="dialpad-actions" style={{marginTop: '10px', marginBottom: '10px'}}>
                  <button onClick={toggleMute} style={{backgroundColor: isMuted ? '#ffc107' : '#6c757d', color: isMuted? 'black':'white'}}>
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  <button onClick={toggleHold} style={{backgroundColor: isOnHold ? '#ffc107' : '#6c757d', color: isOnHold? 'black':'white'}}>
                    {isOnHold ? 'Unhold' : 'Hold'}
                  </button>
                </div>
              )}

              <div className="dialpad-actions">
                <button onClick={handleCallAction} className={callButtonClass} disabled={callButtonDisabled}>
                  {callButtonText}
                </button>
                {showHangupButton && (
                  <button onClick={handleHangupAction} className={hangupButtonClass}>
                    {hangupButtonText}
                  </button>
                )}
              </div>
              
              <div className="dialer-status-area">
                <div className={`sip-status ${getSipStatusClass()}`}>{sipRegistrationStatusMessage}</div>
                <div className="call-activity-status">{callActivityStatusMessage || (isRegistered && callState === 'idle' ? 'Ready' : '')}</div>
              </div>
            </div>
          )}

          {activeTab === 'audioSettings' && <AudioSettings />}
          {activeTab === 'callScript' && <CallScriptTab />}
          {activeTab === 'callLogs' && <CallLogsTab />}
          {activeTab === 'customerDetail' && <CustomerDetailTab />}
          {activeTab === 'dispositionForm' && <DispositionFormTab />}
        </div>
      </div>
    </Draggable>
  );
}

export default Dialer;
