import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (processed.current) return;
    processed.current = true;

    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      const messages = {
        oauth_denied: 'Instagram connection was denied.',
        no_pages: 'No Facebook Pages found. Please connect a Page with an Instagram Business account.',
        auth_failed: 'Authentication failed. Please try again.',
        db_error: 'A server error occurred. Please try again.',
      };
      toast.error(messages[error] || 'Connection failed.');
      navigate('/', { replace: true });
      return;
    }

    if (token) {
      // Store token in localStorage, then do a FULL page redirect.
      // This avoids the React state race condition where navigate('/dashboard')
      // fires before setUser() is committed, causing ProtectedRoute to
      // see user=null and redirect back to '/'.
      localStorage.setItem('chatiq_token', token);
      // Flag so Dashboard can show a success toast after reload
      sessionStorage.setItem('chatiq_auth_success', '1');
      // Full page redirect — AuthProvider will load user from token on mount
      window.location.replace('/dashboard');
    } else {
      navigate('/', { replace: true });
    }
  }, [params, navigate]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-base)', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        border: '3px solid var(--bg-elevated)', borderTop: '3px solid var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
        Connecting your Instagram account…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
