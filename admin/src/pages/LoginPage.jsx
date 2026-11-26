import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@spouzy.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      navigate(loggedUser?.landingRoute || '/');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FAF7F2',
      padding: '20px'
    }}>
      <div style={{
        background: '#FFF',
        border: '1px solid #E8E0D7',
        borderRadius: '12px',
        padding: '36px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 8px 30px rgba(75, 32, 48, 0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img 
            src="/image/spouzy.png" 
            alt="SPOUZY" 
            style={{ height: '52px', objectFit: 'contain', marginBottom: '12px' }} 
          />
          <h2 style={{ fontSize: '20px', color: '#4B2030', fontWeight: '700' }}>
            SPOUZY Management
          </h2>
          <p style={{ fontSize: '13px', color: '#6E5D57', marginTop: '4px' }}>
            Problem Solver Group (PSG) Administration
          </p>
        </div>

        {error && (
          <div style={{
            background: '#FFEBEE',
            borderLeft: '4px solid #C62828',
            color: '#B71C1C',
            padding: '10px 14px',
            borderRadius: '4px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            <i className="fa fa-exclamation-circle"></i> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="sp-form-group">
            <label className="sp-form-label" htmlFor="loginEmail">Email Address</label>
            <input 
              id="loginEmail"
              type="email" 
              className="sp-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@spouzy.com"
              required 
            />
          </div>

          <div className="sp-form-group" style={{ marginBottom: '24px' }}>
            <label className="sp-form-label" htmlFor="loginPassword">Password</label>
            <input 
              id="loginPassword"
              type="password" 
              className="sp-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required 
            />
          </div>

          <button 
            type="submit" 
            className="sp-btn sp-btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
            disabled={loading}
          >
            {loading ? <i className="fa fa-spinner fa-spin"></i> : <i className="fa fa-lock"></i>}
            <span>{loading ? 'Authenticating...' : 'Sign In to Console'}</span>
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '12px', color: '#888' }}>
          Confidential System &bull; Strict Medical &amp; Staff Access Only
        </div>
      </div>
    </div>
  );
}
