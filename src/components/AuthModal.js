import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import './Auth.css';

const AuthModal = ({ onClose }) => {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        // Validation
        if (!formData.username || !formData.email || !formData.password) {
          setError('All fields are required');
          setLoading(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const result = await register(formData.username, formData.email, formData.password);
        
        if (result.success) {
          onClose(); // Close modal on success
        } else {
          setError(result.error);
        }
      } else {
        // Login
        if (!formData.username || !formData.password) {
          setError('Username/email and password are required');
          setLoading(false);
          return;
        }

        const result = await login(formData.username, formData.password);
        
        if (result.success) {
          onClose(); // Close modal on success
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn-auth" onClick={onClose}>×</button>
        
        <h2>{mode === 'login' ? 'Login' : 'Create Account'}</h2>

        <div className="auth-tabs">
          <button 
            className={mode === 'login' ? 'active' : ''} 
            onClick={() => { setMode('login'); setError(''); }}
          >
            Login
          </button>
          <button 
            className={mode === 'register' ? 'active' : ''} 
            onClick={() => { setMode('register'); setError(''); }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          {mode === 'register' && (
            <div className="form-field">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username (3-20 characters)"
                minLength="3"
                maxLength="20"
                required
              />
            </div>
          )}

          {mode === 'login' && (
            <div className="form-field">
              <label htmlFor="username">Username or Email</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter username or email"
                required
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email address"
                required
              />
            </div>
          )}

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter password'}
              minLength="6"
              required
            />
          </div>

          {mode === 'register' && (
            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
              />
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Create Account')}
          </button>
        </form>

        {mode === 'login' && (
          <p className="auth-footer">
            Don't have an account? <button className="link-btn" onClick={() => { setMode('register'); setError(''); }}>Register</button>
          </p>
        )}
        {mode === 'register' && (
          <p className="auth-footer">
            Already have an account? <button className="link-btn" onClick={() => { setMode('login'); setError(''); }}>Login</button>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
