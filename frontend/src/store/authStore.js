import { create } from 'zustand';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const useAuthStore = create((set, get) => ({
  token: null,
  user: null,
  webRTCConfig: null,
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, { username, password });
      const { token, user } = response.data; // Assuming backend sends { token, user: { id, username, ... } }

      localStorage.setItem('authToken', token);
      // Optionally store user object if it's simple and not sensitive, or just refetch on init
      // localStorage.setItem('authUser', JSON.stringify(user)); 

      set({ token, user, isLoading: false });
      // After successful login, fetch the WebRTC config for this user
      await get().fetchWebRTCConfig(token); 
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials or server status.';
      console.error('Login error:', error);
      set({ error: errorMessage, isLoading: false, token: null, user: null });
      localStorage.removeItem('authToken');
      // localStorage.removeItem('authUser');
    }
  },

  fetchWebRTCConfig: async (tokenToUse) => {
    // Ensure tokenToUse is passed, otherwise try to get from current state (e.g., during initializeAuth)
    const currentToken = tokenToUse || get().token; 
    if (!currentToken) {
      set({ error: 'No token available to fetch WebRTC config.', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null }); // Clear previous errors for this specific action
    try {
      const response = await axios.get(`${API_BASE_URL}/webrtc/config`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      set({ webRTCConfig: response.data, isLoading: false });
      // Optionally store webRTCConfig in localStorage if it's not too large and changes infrequently
      // localStorage.setItem('webRTCConfig', JSON.stringify(response.data));
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch WebRTC configuration.';
      console.error('Fetch WebRTC config error:', error);
      // Do not clear token/user here, as auth might still be valid, just config fetch failed
      set({ error: errorMessage, isLoading: false, webRTCConfig: null }); 
      // localStorage.removeItem('webRTCConfig');
    }
  },

  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser'); // If you stored user
    localStorage.removeItem('webRTCConfig'); // If you stored config
    set({ token: null, user: null, webRTCConfig: null, error: null, isLoading: false });
  },

  initializeAuth: () => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      set({ token: storedToken });
      // Optional: Retrieve user from localStorage. For security/freshness, often better to re-verify token with backend or fetch user details.
      // const storedUser = localStorage.getItem('authUser');
      // if (storedUser) {
      //   try {
      //     set({ user: JSON.parse(storedUser) });
      //   } catch (e) {
      //     console.error("Error parsing stored user:", e);
      //     localStorage.removeItem('authUser'); // Clear corrupted data
      //   }
      // }
      
      // Fetch WebRTC config using the stored token
      // This also implicitly verifies the token if the backend checks it for this endpoint
      get().fetchWebRTCConfig(storedToken);
    }
  },
}));

export default useAuthStore;
