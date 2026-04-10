import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('chatiq_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await authApi.getMe();
      const userData = res.data.user;
      setUser(userData);
      setLoading(false);
      return userData;
    } catch (err) {
      console.error('loadUser failed:', err);
      localStorage.removeItem('chatiq_token');
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  // Load user on mount (page refresh)
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  /**
   * Store token and load user. Returns a promise that resolves
   * with the user object so callers can await before navigating.
   */
  const setToken = useCallback(async (token) => {
    localStorage.setItem('chatiq_token', token);
    setLoading(true);
    const userData = await loadUser();
    return userData;
  }, [loadUser]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout API errors
    }
    localStorage.removeItem('chatiq_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setToken, logout, refetch: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
