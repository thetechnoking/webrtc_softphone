import React, { useState } from 'react';
import useAuthStore from '../store/authStore'; // Assuming store is in ../store/authStore.js

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Select actions and state from the store
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      // Basic local validation, though store's error will also catch backend errors
      useAuthStore.setState({ error: 'Username and password are required.' });
      return;
    }
    await login(username, password);
    // No redirection needed here, App.jsx handles UI changes based on token
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto', 
      padding: '30px', 
      border: '1px solid #e0e0e0', 
      borderRadius: '8px', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)' 
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '25px', color: '#333' }}>User Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label 
            htmlFor="username" 
            style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#555' }}
          >
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '12px', 
              boxSizing: 'border-box', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              fontSize: '1em'
            }}
          />
        </div>
        <div style={{ marginBottom: '25px' }}>
          <label 
            htmlFor="password" 
            style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#555' }}
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '12px', 
              boxSizing: 'border-box', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              fontSize: '1em'
            }}
          />
        </div>
        
        {error && (
          <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px', fontSize: '0.9em' }}>
            Error: {error}
          </p>
        )}
        
        <button 
          type="submit" 
          disabled={isLoading} 
          style={{ 
            width: '100%', 
            padding: '12px', 
            backgroundColor: isLoading ? '#b0bec5' : '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1.1em',
            fontWeight: 'bold',
            transition: 'background-color 0.2s ease'
          }}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default LoginForm;
