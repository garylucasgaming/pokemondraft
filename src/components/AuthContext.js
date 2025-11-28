import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { getDeviceInfo } from '../utils/deviceFingerprint';

const AuthContext = createContext(null);

const API_BASE = process.env.REACT_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : 'http://localhost:4000');

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const tryDeviceLogin = useCallback(async () => {
    try {
      const deviceInfo = getDeviceInfo();
      const response = await fetch(`${API_BASE}/api/auth/device-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fingerprint: deviceInfo.fingerprint })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth_token', data.token);
        setToken(data.token);
        setUser(data.user);
      } else {
        // Device not recognized, user needs to login manually
        setLoading(false);
      }
    } catch (error) {
      console.error('Device auto-login failed:', error);
      setLoading(false);
    }
  }, []);

  const verifyToken = useCallback(async (tokenToVerify) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setToken(tokenToVerify);
        setUser(data.user);
      } else {
        // Token invalid, clear it and try device login
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        tryDeviceLogin();
        return;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [tryDeviceLogin]);

  // Load token from localStorage on mount or try device auto-login
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      // Verify token is still valid
      verifyToken(storedToken);
    } else {
      // Try device-based auto-login
      tryDeviceLogin();
    }
  }, [verifyToken, tryDeviceLogin]);

  const registerDevice = async (authToken) => {
    try {
      const deviceInfo = getDeviceInfo();
      await fetch(`${API_BASE}/api/auth/register-device`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(deviceInfo)
      });
    } catch (error) {
      console.error('Failed to register device:', error);
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store token
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);

      // Register this device for future auto-login
      await registerDevice(data.token);

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const login = async (usernameOrEmail, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ usernameOrEmail, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token
      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);

      // Register this device for future auto-login
      await registerDevice(data.token);

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (updates) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Update failed');
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
