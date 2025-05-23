import { create } from 'zustand';
import JsSIP from 'jssip';
import axios from 'axios';

// Helper to parse STUN/TURN server strings
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
  // State variables
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
  callStartTime: null,
  currentCallId: null,
  getTokenFunc: null,
  getUserIdFunc: null,

  // --- Actions ---
  setRemoteAudioElement: (element) => set({ remoteAudioElement: element }),
  setLocalAudioElement: (element) => set({ localAudioElement: element }),

  playRingtone: () => {
    let audio = get().ringtoneAudio;
    if (!audio) {
      audio = new Audio('/sounds/ringtone.mp3'); 
      audio.loop = true;
      set({ ringtoneAudio: audio });
    }
    audio.play().catch(error => console.warn("Ringtone play failed (browser policy):", error));
  },

  stopRingtone: () => {
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
      console.error('SIP UA init failed: Missing critical WebRTC config.');
      set({ registrationError: 'Missing critical WebRTC config.' });
      return;
    }
    if (typeof getTokenFunc !== 'function' || typeof getUserIdFunc !== 'function') {
        console.error('SIP UA init failed: Auth callbacks not provided.');
        set({ registrationError: 'Internal error: Auth callbacks missing.' });
        return;
    }
    
    set({ getTokenFunc, getUserIdFunc });
    console.log('Initializing SIP UA with config:', webRTCConfig);

    const socket = new JsSIP.WebSocketInterface(webRTCConfig.websocket_uri);
    const iceServersList = parseIceServers(webRTCConfig.stun_servers, webRTCConfig.turn_servers);

    const configuration = {
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
        iceServers: iceServersList || [{ urls: 'stun:stun.l.google.com:19302' }], 
        rtcpMuxPolicy: 'require', 
      },
      // register_expires: 300, // Example: Shorter registration interval
    };

    try {
      const ua = new JsSIP.UA(configuration);
      set({ sipUA: ua });

      ua.on('connected', () => console.log('SIP UA: Connected to WebSocket server'));
      ua.on('disconnected', () => {
        console.warn('SIP UA: Disconnected from WebSocket server');
        set({ isRegistered: false, sipUA: null, getTokenFunc: null, getUserIdFunc: null });
      });
      ua.on('registered', () => {
        console.log('SIP UA: Registered successfully');
        set({ isRegistered: true, registrationError: null });
      });
      ua.on('unregistered', (data) => { // data might contain response and cause
        console.warn('SIP UA: Unregistered', data?.cause);
        set({ isRegistered: false });
      });
      ua.on('registrationFailed', (data) => {
        console.error('SIP UA: Registration failed', data?.cause);
        set({ isRegistered: false, registrationError: data?.cause || 'Unknown registration error' });
      });

      ua.on('newRTCSession', (data) => {
        console.log('SIP UA: Incoming call event');
        const session = data.session;
        const shouldAutoAnswer = session.request?.hasHeader('Auto-Answer') || false;
        
        set({
          currentCall: session,
          callState: 'incoming',
          incomingCallInfo: { 
            uri: session.remote_identity?.uri?.toString() || 'Unknown caller', 
            displayName: session.remote_identity?.display_name || '' 
          },
          autoAnswer: shouldAutoAnswer, 
          isMuted: false, 
          isOnHold: false,
        });
        
        get()._attachSessionEventHandlers(session);
        get().playRingtone();

        if (shouldAutoAnswer && get().callState === 'incoming') { // Check callState to avoid race conditions
          console.log('Auto-answering call in 2 seconds due to Auto-Answer header');
          const timerId = setTimeout(() => {
            if (get().currentCall === session && get().callState === 'incoming') { // Double check still this call
                get().answerCall();
            }
          }, 2000);
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
    const { getTokenFunc, getUserIdFunc, currentCallId } = get();
    if (!getTokenFunc || !getUserIdFunc) {
      console.error('Stats: Auth getter functions not available.'); return;
    }
    if (!session || !currentCallId || !startTime) {
      console.error('Stats: Missing session, call ID, or start time.'); return;
    }

    const token = getTokenFunc();
    const userId = getUserIdFunc();
    if (!token || !userId) {
      console.error('Stats: Missing token or user ID.'); return;
    }

    const duration_seconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    let statsObject = {};

    try {
      if (session.connection && typeof session.connection.getStats === 'function') {
        const statsReport = await session.connection.getStats();
        statsReport.forEach(report => {
          // Create a simpler key if report.id is too complex or not ideal
          const reportKey = `${report.type}_${report.id.substring(0,10)}`; 
          statsObject[reportKey] = report;
        });
      } else {
        console.warn('Stats: WebRTC getStats() not available.');
        statsObject = { note: 'getStats() not available' };
      }
    } catch (statsError) {
      console.error('Stats: Error getting WebRTC stats:', statsError);
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
    if (callStartTime && session) {
      get()._submitCallStatistics(session, callStartTime, endTime);
    }
    set({ 
        callState: 'idle', 
        currentCall: null, 
        incomingCallInfo: null, 
        isMuted: false, 
        isOnHold: false,
        callStartTime: null,
        currentCallId: null,
    });
    if (get().remoteAudioElement) get().remoteAudioElement.srcObject = null; 
  },

  _attachSessionEventHandlers: (session) => {
    session.on('progress', () => {
      if (session.direction === 'outgoing') set({ callState: 'outgoing_progress' }); 
    });
    session.on('accepted', (data) => { 
      get().stopRingtone(); 
      set({ 
        callState: 'active', isMuted: false, isOnHold: false,
        callStartTime: new Date(), 
        currentCallId: session.id || self.crypto.randomUUID(),
      });
      if (data.originator === 'remote') get()._handleStream(session);
    });
    session.on('confirmed', () => { // Often for local actions like answer
      get().stopRingtone(); 
      if (get().callState !== 'active') { // Avoid overwriting if 'accepted' already set it
         set({ 
           callState: 'active', isMuted: false, isOnHold: false,
           callStartTime: new Date(), 
           currentCallId: session.id || self.crypto.randomUUID(),
         }); 
      }
       get()._handleStream(session); 
    });
    session.on('ended', () => get()._handleCallEndEvent(session));
    session.on('failed', () => get()._handleCallEndEvent(session));
    
    if (session.connection) { 
        session.connection.ontrack = (event) => {
            if (event.streams && event.streams[0] && get().remoteAudioElement) {
                get().remoteAudioElement.srcObject = event.streams[0];
            }
        };
        // Fallback for older browsers
        session.connection.onaddstream = (event) => {
            if (get().remoteAudioElement && event.stream) {
                get().remoteAudioElement.srcObject = event.stream;
            }
        };
    }
  },
  
  _handleStream: (session) => {
    if (session && session.connection) {
        const remoteStreams = session.connection.getRemoteStreams();
        if (remoteStreams && remoteStreams.length > 0 && get().remoteAudioElement) {
            get().remoteAudioElement.srcObject = remoteStreams[0];
        }
    }
  },

  makeCall: (targetURI) => {
    const { sipUA, isRegistered } = get();
    if (!sipUA || !isRegistered) { set({ error: 'SIP UA not available/registered.' }); return; }
    if (!targetURI) { set({ error: 'Target URI is required.' }); return; }
    const options = { mediaConstraints: { audio: true, video: false } };
    try {
      const session = sipUA.call(targetURI, options);
      set({ 
          currentCall: session, callState: 'outgoing', incomingCallInfo: null, 
          isMuted: false, isOnHold: false,
          // callStartTime & currentCallId set on 'accepted'/'confirmed'
      });
      get()._attachSessionEventHandlers(session);
    } catch (e) { set({ error: `Failed to initiate call: ${e.message}` }); }
  },

  answerCall: () => {
    const { currentCall, callState } = get();
    if (currentCall && callState === 'incoming') {
      get().stopRingtone(); 
      currentCall.answer({ mediaConstraints: { audio: true, video: false } });
      // Call state updated by session events
    }
  },

  terminateCall: () => {
    const { currentCall } = get();
    if (currentCall) {
      currentCall.terminate(); // Triggers 'ended' or 'failed' for cleanup & stats
    }
  },

  toggleMute: () => {
    const { currentCall, isMuted, callState } = get();
    if (currentCall && callState === 'active') {
      if (isMuted) currentCall.unmute({ audio: true }); else currentCall.mute({ audio: true });
      set({ isMuted: !isMuted });
    }
  },

  toggleHold: () => {
    const { currentCall, isOnHold, callState } = get();
    if (currentCall && callState === 'active') {
      if (isOnHold) currentCall.unhold(err => { if (!err) set({ isOnHold: false }); else console.error("Unhold failed", err);});
      else currentCall.hold(err => { if (!err) set({ isOnHold: true }); else console.error("Hold failed", err);});
    }
  },
  
  shutdownSipUA: () => {
    const { sipUA } = get();
    if (sipUA) {
      get().stopRingtone(); 
      if (get().currentCall) {
         // If call is active, terminating it will trigger _handleCallEndEvent for stats.
         // If it's already ended, currentCall would be null.
        get().currentCall.terminate();
      }
      sipUA.stop(); 
      set({
        sipUA: null, isRegistered: false, registrationError: null,
        callState: 'idle', currentCall: null, incomingCallInfo: null,
        autoAnswer: false, isMuted: false, isOnHold: false,
        callStartTime: null, currentCallId: null,
        getTokenFunc: null, getUserIdFunc: null,
      });
    }
  },
}));

// For debugging:
// JsSIP.debug.enable('JsSIP:*'); 

export default useSipStore;
