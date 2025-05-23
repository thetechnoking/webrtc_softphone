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
      const { token, user } = response.data;

      localStorage.setItem('authToken', token);
      // Optionally store user and webRTCConfig in localStorage if needed for persistence across sessions beyond token
      // localStorage.setItem('authUser', JSON.stringify(user)); 

      set({ token, user, isLoading: false });
      await get().fetchWebRTCConfig(token); // Call fetchWebRTCConfig after successful login
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      console.error('Login error:', error);
      set({ error: errorMessage, isLoading: false, token: null, user: null });
      localStorage.removeItem('authToken');
      // localStorage.removeItem('authUser');
    }
  },

  fetchWebRTCConfig: async (token) => {
    if (!token) {
      set({ error: 'No token provided to fetch WebRTC config.', isLoading: false });
      return;
    }
    set({ isLoading: true, error: null }); // Keep error null for this specific action initially
    try {
      const response = await axios.get(`${API_BASE_URL}/webrtc/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ webRTCConfig: response.data, isLoading: false });
      // localStorage.setItem('webRTCConfig', JSON.stringify(response.data));
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to fetch WebRTC configuration.';
      console.error('Fetch WebRTC config error:', error);
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
      // Optional: Retrieve user and webRTCConfig from localStorage if you decide to store them
      // const storedUser = localStorage.getItem('authUser');
      // if (storedUser) set({ user: JSON.parse(storedUser) });
      // const storedWebRTCConfig = localStorage.getItem('webRTCConfig');
      // if (storedWebRTCConfig) set({ webRTCConfig: JSON.parse(storedWebRTCConfig) });

      // Fetch fresh config on auth initialization if token exists.
      // This ensures data is up-to-date and handles cases where user/config might not be in localStorage.
      get().fetchWebRTCConfig(storedToken);
    }
  },
}));

export default useAuthStore;
