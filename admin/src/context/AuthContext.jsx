import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { normalizeUser } from '../services/authAdapter';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await api.get('/auth/me');
      if (res.success && res.user) {
        setUser(normalizeUser(res.user));
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    if (res.success && res.user) {
      const normalized = normalizeUser(res.user);
      setUser(normalized);
      return normalized;
    }
    throw new Error(res.message || 'Login failed');
  }

  async function logout() {
    try {
      await api.post('/auth/logout', {});
    } catch (e) {
      // Continue anyway
    }
    setUser(null);
    window.location.hash = '#/login';
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
