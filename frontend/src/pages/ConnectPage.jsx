import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, instagramApi } from '../utils/api';
import toast from 'react-hot-toast';
import MessageAccessModal from '../components/MessageAccessModal';

export default function ConnectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processed = useRef(false);

  // Existing connected accounts
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Account picker (after OAuth)
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [sessionToken, setSessionToken] = useState(null);
  const [selected, setSelected] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // Message access modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [justConnectedAccount, setJustConnectedAccount] = useState(null);

  // Load connected accounts
  useEffect(() => {
    instagramApi.getAccounts()
      .then(res => setConnectedAccounts(res.data.accounts || []))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));
  }, []);

  // Parse session from URL (redirected from OAuth callback)
  useEffect(() => {
    if (processed.current) return;
    const session = searchParams.get('session');
    if (!session) return;
    processed.current = true;

    try {
      // Decode the JWT payload (without verification — backend will verify)
      const payload = JSON.parse(atob(session.split('.')[1]));
      if (payload.accounts && payload.accounts.length > 0) {
        setAvailableAccounts(payload.accounts);
        setSessionToken(session);
        // Auto-select if only one account
        if (payload.accounts.length === 1) {
          setSelected(payload.accounts[0]);
        }
      }
    } catch (e) {
      console.error('Failed to parse session token:', e);
      toast.error('Invalid session. Please try connecting again.');
    }
  }, [searchParams]);

  // Start OAuth flow
  const handleStartOAuth = () => {
    window.location.href = authApi.getInstagramAuthUrl();
  };

  // Connect the selected account
  const handleConnectSelected = async () => {
    if (!selected || !sessionToken) return;

    setConnecting(true);
    try {
      const res = await authApi.selectAccount(
        sessionToken,
        selected.pageId,
        selected.instagramId
      );

      // Store auth token
      if (res.data.token) {
        localStorage.setItem('chatiq_token', res.data.token);
      }

      toast.success(`@${res.data.account.username} connected!`);

      // Clear picker state
      setAvailableAccounts([]);
      setSessionToken(null);
      setSelected(null);

      // Refresh connected accounts list
      const accRes = await instagramApi.getAccounts();
      setConnectedAccounts(accRes.data.accounts || []);

      // Show message access modal
      setJustConnectedAccount(res.data.account);
      setShowMessageModal(true);

    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to connect. Please try again.';
      toast.error(msg);
      if (err.response?.status === 401) {
        // Session expired
        setAvailableAccounts([]);
        setSessionToken(null);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm('Disconnect this account? All its automations will be deleted.')) return;
    try {
      await instagramApi.deleteAccount(id);
      setConnectedAccounts(prev => prev.filter(a => a.id !== id));
      toast.success('Account disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  const showPicker = availableAccounts.length > 0;

  return (
    <>
      {showMessageModal && justConnectedAccount && (
        <MessageAccessModal
          account={{
            id: justConnectedAccount.instagramId,
            username: justConnectedAccount.username,
            pageName: justConnectedAccount.pageName,
          }}
          onConfirm={async () => {
            try {
              const accRes = await instagramApi.getAccounts();
              const acc = (accRes.data.accounts || []).find(a =>
                a.ig_account_id === justConnectedAccount.instagramId
              );
              if (acc) {
                await instagramApi.updateMessageAccess(acc.id, true);
                setConnectedAccounts(prev => prev.map(a =>
                  a.id === acc.id ? { ...a, message_access_enabled: true } : a
                ));
                toast.success('Message access confirmed! 🎉');
              }
            } catch (e) {
              console.error(e);
            }
            setShowMessageModal(false);
            navigate('/dashboard');
          }}
          onClose={() => {
            setShowMessageModal(false);
            toast('DM automation may fail until you enable message access.', { icon: '⚠️' });
            navigate('/dashboard');
          }}
        />
      )}

      <div style={{
        minHeight: '100vh', background: 'var(--bg-base)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          {/* Logo + back */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
            <Logo />
            {connectedAccounts.length > 0 && (
              <button onClick={() => navigate('/dashboard')} style={ghostBtn}>
                Go to Dashboard →
              </button>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, marginBottom: 10 }}>
            {showPicker ? 'Select Account' : 'Connect Instagram'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 40, lineHeight: 1.6 }}>
            {showPicker
              ? 'Choose which Instagram account to connect to ChatIQ.'
              : 'Link your Instagram Business account to start automating comments and DMs.'}
          </p>

          {/* ═══ Account Picker (after OAuth) ═══ */}
          {showPicker && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
              }}>
                Available Accounts
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {availableAccounts.map(acc => {
                  const isSelected = selected?.instagramId === acc.instagramId;
                  return (
                    <button
                      key={acc.instagramId}
                      onClick={() => setSelected(acc)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                        padding: '16px 20px', borderRadius: 'var(--radius)',
                        background: isSelected ? 'rgba(232,67,147,0.08)' : 'var(--bg-surface)',
                        border: isSelected
                          ? '2px solid var(--accent)'
                          : '1px solid var(--border)',
                        cursor: 'pointer', width: '100%', textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, overflow: 'hidden',
                      }}>
                        {acc.profilePictureUrl
                          ? <img src={acc.profilePictureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : '📷'}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--text-primary)' }}>
                          @{acc.username || 'unknown'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Page: {acc.pageName} · {(acc.followersCount || 0).toLocaleString()} followers
                        </div>
                      </div>

                      {/* Radio indicator */}
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {isSelected && (
                          <div style={{
                            width: 12, height: 12, borderRadius: '50%',
                            background: 'var(--accent)',
                          }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Connect selected button */}
              <button
                onClick={handleConnectSelected}
                disabled={!selected || connecting}
                style={{
                  marginTop: 20, width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: selected
                    ? 'linear-gradient(135deg, #e1306c, #833ab4)'
                    : 'var(--bg-elevated)',
                  border: selected ? 'none' : '1px solid var(--border)',
                  color: selected ? '#fff' : 'var(--text-muted)',
                  padding: '14px 28px', borderRadius: 'var(--radius)',
                  fontSize: 15, fontWeight: 600,
                  cursor: !selected || connecting ? 'default' : 'pointer',
                  opacity: !selected || connecting ? 0.6 : 1,
                  fontFamily: 'var(--font-body)',
                  transition: 'all 0.2s',
                }}
              >
                <InstagramIcon />
                {connecting
                  ? 'Connecting…'
                  : selected
                    ? `Connect @${selected.username}`
                    : 'Select an account'}
              </button>

              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                This session expires in 5 minutes. If it expires, click "Connect with Instagram" again.
              </p>
            </div>
          )}

          {/* ═══ Connected accounts ═══ */}
          {!loadingAccounts && connectedAccounts.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
              }}>
                Connected Accounts
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {connectedAccounts.map(acc => (
                  <div key={acc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '16px 20px', borderRadius: 'var(--radius)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, overflow: 'hidden',
                    }}>
                      {acc.profile_picture_url
                        ? <img src={acc.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '📷'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>@{acc.username || acc.page_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {acc.followers_count?.toLocaleString() || '—'} followers
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(34,211,165,0.1)', color: 'var(--success)',
                        border: '1px solid rgba(34,211,165,0.2)',
                      }}>✓ Connected</span>
                      {!acc.message_access_enabled && (
                        <span style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 20,
                          background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                          border: '1px solid rgba(245,158,11,0.2)',
                        }}>⚠ DM disabled</span>
                      )}
                      <button
                        onClick={() => handleDisconnect(acc.id)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text-muted)',
                          fontSize: 12, cursor: 'pointer', padding: '4px 8px',
                          borderRadius: 6, transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Connect new account (show when NOT in picker mode) ═══ */}
          {!showPicker && (
            <div style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', padding: 32, marginBottom: 28,
            }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                {connectedAccounts.length > 0 ? 'Add another account' : 'Link your Instagram Business account'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                You'll be redirected to Meta to authorize access. Then you'll choose which account to connect.
              </p>
              <button
                onClick={handleStartOAuth}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'linear-gradient(135deg, #e1306c, #833ab4)',
                  border: 'none', color: '#fff', padding: '14px 28px',
                  borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                  width: '100%', justifyContent: 'center',
                }}
              >
                <InstagramIcon />
                Connect with Instagram
              </button>
            </div>
          )}

          {/* Requirements */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 24,
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-secondary)' }}>
              Requirements
            </h4>
            {REQUIREMENTS.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <span style={{ color: 'var(--success)', flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', fontSize: 16,
      }}>C</div>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>ChatIQ</span>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

const REQUIREMENTS = [
  'Instagram Business or Creator account (not personal)',
  'Facebook Page connected to your Instagram account',
  'Admin access to the Facebook Page',
  'App must be approved for instagram_manage_comments and instagram_manage_messages permissions in production',
];

const ghostBtn = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  color: 'var(--text-secondary)', padding: '10px 18px',
  borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer',
  fontFamily: 'var(--font-body)',
};
