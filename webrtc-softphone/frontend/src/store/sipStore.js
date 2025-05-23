import { create } from 'zustand';
import JsSIP from 'jssip';
import axios from 'axios'; // For submitting stats

// Helper to parse STUN/TURN server strings (remains unchanged)
const parseIceServers = (stunServersStr, turnServersStr) => {
  const iceServers = [];
  if (stunServersStr) {
    stunServersStr.split(',').forEach(url => {
      if (url.trim()) iceServers.push({ urls: url.trim() });
    });
  }
  if (turnServersStr) {
    turnServersStr.split(',').forEach(entry => {
      entry = entry.trim();
      if (!entry) return;
      const parts = entry.split('@');
      let urls = entry;
      let username = null;
      let credential = null;
      if (parts.length > 1) { 
        const credParts = parts[0].substring(parts[0].indexOf(':') + 1).split(':');
        if (credParts.length === 2) {
          username = credParts[0];
          credential = credParts[1];
          urls = `turn:${parts[1]}`; 
        } else { 
            username = credParts[0];
            urls = `turn:${parts[1]}`;
        }
      }
      if (username && credential) iceServers.push({ urls, username, credential });
      else if (username) iceServers.push({ urls, username });
      else iceServers.push({ urls });
    });
  }
  return iceServers.length > 0 ? iceServers : undefined; 
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const useSipStore = create((set, get) => ({
  sipUA: null,
  isRegistered: false,
  registrationError: null,
  callState: 'idle', 
  currentCall: null,
  remoteAudioElement: null,
  localAudioElement: null, 
  incomingCallInfo: null,
  autoAnswer: false,
  isMuted: false,
  isOnHold: false,
  ringtoneAudio: null,
  autoAnswerTimer: null,

  // New state for call statistics
  callStartTime: null,
  currentCallId: null,
  getTokenFunc: null, // Function to get JWT token from authStore
  getUserIdFunc: null, // Function to get user ID from authStore

  // --- Actions ---
  setRemoteAudioElement: (element) => set({ remoteAudioElement: element }),
  setLocalAudioElement: (element) => set({ localAudioElement: element }),

  playRingtone: () => { /* ... (implementation from previous step, unchanged) ... */ 
    let audio = get().ringtoneAudio;
    if (!audio) {
      audio = new Audio('/sounds/ringtone.mp3'); 
      audio.loop = true;
      set({ ringtoneAudio: audio });
    }
    audio.play().catch(error => console.warn("Ringtone play failed:", error));
  },
  stopRingtone: () => { /* ... (implementation from previous step, unchanged) ... */ 
    const { ringtoneAudio, autoAnswerTimer } = get();
    if (ringtoneAudio) {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
    }
    if (autoAnswerTimer) {
      clearTimeout(autoAnswerTimer);
      set({ autoAnswerTimer: null });
    }
  },

  initializeSipUA: (webRTCConfig, getTokenFunc, getUserIdFunc) => {
    if (get().sipUA) {
      console.warn('SIP UA already initialized. Shutting down existing one first.');
      get().shutdownSipUA();
    }
    if (!webRTCConfig || !webRTCConfig.sip_username || !webRTCConfig.realm || !webRTCConfig.websocket_uri) {
      console.error('SIP UA initialization failed: Missing critical WebRTC configuration.');
      set({ registrationError: 'Missing critical WebRTC configuration.' });
      return;
    }
    if (typeof getTokenFunc !== 'function' || typeof getUserIdFunc !== 'function') {
        console.error('SIP UA initialization failed: getTokenFunc and getUserIdFunc must be provided.');
        set({ registrationError: 'Internal error: Auth callbacks not provided for SIP initialization.' });
        return;
    }
    
    set({ getTokenFunc, getUserIdFunc }); // Store the getter functions
    console.log('Initializing SIP UA with config:', webRTCConfig);

    const socket = new JsSIP.WebSocketInterface(webRTCConfig.websocket_uri);
    const iceServers = parseIceServers(webRTCConfig.stun_servers, webRTCConfig.turn_servers);
    const configuration = { /* ... (rest of configuration as before) ... */ 
        sockets: [socket],
        uri: `sip:${webRTCConfig.sip_username}@${webRTCConfig.realm}`,
        password: webRTCConfig.sip_password,
        registrar_server: webRTCConfig.realm,
        contact_uri: undefined, 
        authorization_user: webRTCConfig.sip_username,
        display_name: webRTCConfig.display_name || webRTCConfig.sip_username,
        ha1: webRTCConfig.ha1_password, 
        use_preloaded_route: false,
        pcConfig: {
            iceServers: iceServers || [{ urls: 'stun:stun.l.google.com:19302' }], 
            rtcpMuxPolicy: 'require', 
        },
    };

    try {
      const ua = new JsSIP.UA(configuration);
      set({ sipUA: ua });
      // --- UA Event Handlers (connected, disconnected, registered, etc. as before) ---
      ua.on('connected', () => console.log('SIP UA: Connected to WebSocket server'));
      ua.on('disconnected', () => {
        console.warn('SIP UA: Disconnected from WebSocket server');
        set({ isRegistered: false, sipUA: null, getTokenFunc: null, getUserIdFunc: null }); // Clear getters on full disconnect
      });
      ua.on('registered', () => {
        console.log('SIP UA: Registered successfully');
        set({ isRegistered: true, registrationError: null });
      });
      ua.on('unregistered', () => {
        console.warn('SIP UA: Unregistered');
        set({ isRegistered: false });
      });
      ua.on('registrationFailed', (data) => {
        console.error('SIP UA: Registration failed', data);
        set({ isRegistered: false, registrationError: data?.cause || 'Unknown registration error' });
      });

      ua.on('newRTCSession', (data) => {
        console.log('SIP UA: Incoming call event');
        const session = data.session;
        const shouldAutoAnswer = session.request?.hasHeader('Auto-Answer') || false;
        set({
          currentCall: session,
          callState: 'incoming',
          incomingCallInfo: { uri: session.remote_identity?.uri?.toString() || 'Unknown caller', displayName: session.remote_identity?.display_name || '' },
          autoAnswer: shouldAutoAnswer, isMuted: false, isOnHold: false,
        });
        get()._attachSessionEventHandlers(session);
        get().playRingtone();
        if (shouldAutoAnswer) {
          console.log('Auto-answering call in 2 seconds due to Auto-Answer header');
          const timerId = setTimeout(() => get().answerCall(), 2000);
          set({ autoAnswerTimer: timerId });
        }
      });
      ua.start();
    } catch (e) {
      console.error('Error creating or starting JsSIP.UA:', e);
      set({ registrationError: `Failed to initialize JsSIP: ${e.message}` });
    }
  },

  _submitCallStatistics: async (session, startTime, endTime) => {
    const { getTokenFunc, getUserIdFunc, currentCallId } = get(); // currentCallId should be set when call starts
    if (!getTokenFunc || !getUserIdFunc) {
      console.error('Cannot submit stats: Auth getter functions not available.');
      return;
    }
    if (!session || !currentCallId || !startTime) {
      console.error('Cannot submit stats: Missing session, call ID, or start time.');
      return;
    }

    const token = getTokenFunc();
    const userId = getUserIdFunc();

    if (!token || !userId) {
      console.error('Cannot submit stats: Missing token or user ID.');
      return;
    }

    const duration_seconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    let statsObject = {};

    try {
      if (session.connection && typeof session.connection.getStats === 'function') {
        const statsReport = await session.connection.getStats();
        statsReport.forEach((report, id) => {
          statsObject[id] = report;
        });
      } else {
        console.warn('WebRTC getStats() not available on this session connection.');
      }
    } catch (statsError) {
      console.error('Error getting WebRTC stats:', statsError);
      // Optionally, send stats_blob as empty or with an error indicator
      statsObject = { error: `Failed to retrieve WebRTC stats: ${statsError.message}` };
    }

    const payload = {
      call_id: currentCallId,
      user_id: userId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_seconds,
      stats_blob: statsObject,
    };

    console.log('Submitting call statistics:', payload);
    try {
      await axios.post(`${API_BASE_URL}/callstats`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Call statistics submitted successfully.');
    } catch (apiError) {
      console.error('Error submitting call statistics:', apiError.response?.data || apiError.message);
    }
  },

  _handleCallEndEvent: (session) => {
    const { callStartTime } = get();
    const endTime = new Date();
    
    get().stopRingtone();
    if (callStartTime && session) { // Ensure call was active and session exists
      get()._submitCallStatistics(session, callStartTime, endTime);
    }
    set({ 
        callState: 'idle', 
        currentCall: null, 
        incomingCallInfo: null, 
        isMuted: false, 
        isOnHold: false,
        callStartTime: null, // Reset call start time
        currentCallId: null, // Reset current call ID
    });
    if (get().remoteAudioElement) get().remoteAudioElement.srcObject = null; 
  },

  _attachSessionEventHandlers: (session) => {
    session.on('progress', (data) => { /* ... (as before) ... */ 
        console.log('Call progress:', data);
        if (session.direction === 'outgoing') set({ callState: 'outgoing_progress' }); 
    });
    session.on('accepted', (data) => { 
      console.log('Call accepted:', data);
      get().stopRingtone(); 
      set({ 
        callState: 'active', 
        isMuted: false, 
        isOnHold: false,
        callStartTime: new Date(), // Record call start time
        currentCallId: session.id || self.crypto.randomUUID(), // Use session ID or generate UUID
      });
      if (data.originator === 'remote') get()._handleStream(session);
    });
    session.on('confirmed', (data) => { 
      console.log('Call confirmed:', data);
      get().stopRingtone(); 
      if (get().callState !== 'active') { // Avoid overwriting if already set by 'accepted'
         set({ 
           callState: 'active', 
           isMuted: false, 
           isOnHold: false,
           callStartTime: new Date(), // Record call start time
           currentCallId: session.id || self.crypto.randomUUID(), // Use session ID or generate UUID
         }); 
      }
       get()._handleStream(session); 
    });
    session.on('ended', (data) => {
      console.log('Call ended:', data);
      get()._handleCallEndEvent(session); // Use the new handler
    });
    session.on('failed', (data) => {
      console.error('Call failed:', data);
      get()._handleCallEndEvent(session); // Use the new handler
    });
    
    if (session.connection) { /* ... (ontrack/onaddstream as before) ... */ 
        session.connection.ontrack = (event) => {
            if (event.streams && event.streams[0] && get().remoteAudioElement) {
                get().remoteAudioElement.srcObject = event.streams[0];
            }
        };
        session.connection.onaddstream = (event) => { // Fallback
            if (get().remoteAudioElement && event.stream) {
                get().remoteAudioElement.srcObject = event.stream;
            }
        };
    }
  },
  
  _handleStream: (session) => { /* ... (as before) ... */ 
    if (session && session.connection) {
        const remoteStreams = session.connection.getRemoteStreams();
        if (remoteStreams && remoteStreams.length > 0 && get().remoteAudioElement) {
            get().remoteAudioElement.srcObject = remoteStreams[0];
        }
    }
  },

  makeCall: (targetURI) => { /* ... (as before, ensure isMuted/isOnHold/callStartTime/currentCallId are reset/set) ... */ 
    const { sipUA, isRegistered } = get();
    if (!sipUA || !isRegistered) { /* ... error handling ... */ return; }
    if (!targetURI) { /* ... error handling ... */ return; }
    const options = { mediaConstraints: { audio: true, video: false } };
    try {
      const session = sipUA.call(targetURI, options);
      set({ 
          currentCall: session, 
          callState: 'outgoing', 
          incomingCallInfo: null, 
          isMuted: false, 
          isOnHold: false,
          // callStartTime and currentCallId will be set on 'accepted' or 'confirmed'
      });
      get()._attachSessionEventHandlers(session);
    } catch (e) { /* ... error handling ... */ }
  },
  answerCall: () => { /* ... (as before, ensure stopRingtone is called) ... */ 
    const { currentCall, callState } = get();
    if (currentCall && callState === 'incoming') {
      get().stopRingtone(); 
      currentCall.answer({ mediaConstraints: { audio: true, video: false } });
    }
  },
  terminateCall: () => {
    const { currentCall } = get();
    if (currentCall) {
      console.log('Terminating call via action...');
      // stopRingtone() is called by _handleCallEndEvent
      // _handleCallEndEvent will also handle stats submission
      currentCall.terminate(); 
      // Note: If the call hasn't reached a state where 'ended' or 'failed' would fire
      // (e.g. terminating an 'outgoing' call that hasn't been accepted),
      // stats might not be submitted by those events.
      // However, JsSIP's terminate() should trigger 'ended' or 'failed'.
    } else {
      console.warn('No active call to terminate.');
    }
  },
  toggleMute: () => { /* ... (as before) ... */ 
    const { currentCall, isMuted, callState } = get();
    if (currentCall && callState === 'active') {
      if (isMuted) currentCall.unmute({ audio: true }); else currentCall.mute({ audio: true });
      set({ isMuted: !isMuted });
    }
  },
  toggleHold: () => { /* ... (as before) ... */ 
    const { currentCall, isOnHold, callState } = get();
    if (currentCall && callState === 'active') {
      if (isOnHold) currentCall.unhold(err => !err && set({ isOnHold: false }));
      else currentCall.hold(err => !err && set({ isOnHold: true }));
    }
  },
  shutdownSipUA: () => { /* ... (as before, ensure getters are cleared) ... */ 
    const { sipUA } = get();
    if (sipUA) {
      get().stopRingtone(); 
      if (get().currentCall) get().currentCall.terminate();
      sipUA.stop(); 
      set({
        sipUA: null, isRegistered: false, registrationError: null,
        callState: 'idle', currentCall: null, incomingCallInfo: null,
        autoAnswer: false, isMuted: false, isOnHold: false,
        callStartTime: null, currentCallId: null,
        getTokenFunc: null, getUserIdFunc: null, // Clear stored functions
      });
    }
  },
}));

// JsSIP.debug.enable('JsSIP:*');
export default useSipStore;
