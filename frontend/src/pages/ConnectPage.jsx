import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, instagramApi } from '../utils/api';
import toast from 'react-hot-toast';
import MessageAccessModal from '../components/MessageAccessModal';

export default function ConnectPage() {
  const navigate = useNavigate();

  // Connected accounts (from DB)
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Message access modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [modalAccount, setModalAccount] = useState(null);

  // Load connected accounts (only if authenticated)
  useEffect(() => {
    const token = localStorage.getItem('chatiq_token');
    if (!token) { setLoadingAccounts(false); return; }
    instagramApi.getAccounts()
      .then(res => setConnectedAccounts(res.data.accounts || []))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));
  }, []);

  // Check if we just came back from auth (flag set by AuthCallback → Dashboard)
  useEffect(() => {
    const justConnected = sessionStorage.getItem('chatiq_show_connect_modal');
    if (justConnected) {
      sessionStorage.removeItem('chatiq_show_connect_modal');
      // Reload accounts to show the newly connected one
      instagramApi.getAccounts()
        .then(res => {
          const accounts = res.data.accounts || [];
          setConnectedAccounts(accounts);
          // Show message access modal for the most recently connected account
          const latest = accounts[accounts.length - 1];
          if (latest && !latest.message_access_enabled) {
            setModalAccount(latest);
            setShowMessageModal(true);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleConnect = () => {
    window.location.href = authApi.getInstagramAuthUrl();
  };

  const handleDisconnect = async (id) => {
    if (!window.confirm('Disconnect this account? All its automations will be deleted.')) return;
    try {
      await instagramApi.deleteAccount(id);
      setConnectedAccounts(prev => prev.filter(a => a.id !== id));
      toast.success('Account disconnected');
    } catch { toast.error('Failed to disconnect'); }
  };

  const handleEnableMessageAccess = async (account) => {
    setModalAccount(account);
    setShowMessageModal(true);
  };

  return (
    <>
      {/* Message Access Modal */}
      {showMessageModal && modalAccount && (
        <MessageAccessModal
          account={{
            id: modalAccount.ig_account_id || modalAccount.id,
            username: modalAccount.username,
            pageName: modalAccount.page_name || modalAccount.username,
          }}
          onConfirm={async () => {
            try {
              await instagramApi.updateMessageAccess(modalAccount.id, true);
              setConnectedAccounts(prev => prev.map(a =>
                a.id === modalAccount.id ? { ...a, message_access_enabled: true } : a
              ));
              toast.success('Message access confirmed! 🎉');
            } catch (e) { console.error(e); }
            setShowMessageModal(false);
          }}
          onClose={() => {
            setShowMessageModal(false);
            toast('DM automation won\'t work until you enable message access.', { icon: '⚠️' });
          }}
        />
      )}

      <div style={pageStyle}>
        <div style={{ width: '100%', maxWidth: 560 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
            <Logo />
            {connectedAccounts.length > 0 && (
              <button onClick={() => navigate('/dashboard')} style={ghostBtn}>
                Go to Dashboard →
              </button>
            )}
          </div>

          <h1 style={titleStyle}>Connect Instagram</h1>
          <p style={subtitleStyle}>
            Link your Instagram account to start automating comments and DMs.
          </p>

          {/* ═══ Connected Accounts ═══ */}
          {!loadingAccounts && connectedAccounts.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={sectionLabel}>Connected Accounts</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {connectedAccounts.map(acc => (
                  <div key={acc.id} style={accountCard}>
                    <AccountAvatar url={acc.profile_picture_url} username={acc.username} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 3 }}>@{acc.username}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {acc.followers_count?.toLocaleString() || '—'} followers
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Badge type="success">✓ Connected</Badge>
                      {acc.message_access_enabled ? (
                        <Badge type="success">✓ DM enabled</Badge>
                      ) : (
                        <button
                          onClick={() => handleEnableMessageAccess(acc)}
                          style={enableDmBtn}
                        >
                          Enable DM →
                        </button>
                      )}
                      <button
                        onClick={() => handleDisconnect(acc.id)}
                        style={disconnectStyle}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >Disconnect</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Connect Instagram Button ═══ */}
          <div style={connectPanel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={igIconWrapper}>
                <InstagramIcon size={28} />
              </div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, margin: 0 }}>
                  {connectedAccounts.length > 0 ? 'Add another account' : 'Connect Instagram'}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Log in directly with your Instagram account
                </p>
              </div>
            </div>

            <div style={stepsContainer}>
              <Step num={1} text="Click 'Connect via Instagram' below" />
              <Step num={2} text="Log in with your Instagram credentials" />
              <Step num={3} text="Authorize ChatIQ to manage messages and comments" />
              <Step num={4} text="Enable message access when prompted" />
            </div>

            <button onClick={handleConnect} style={connectBtn}>
              <InstagramIcon size={20} />
              Connect via Instagram
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 14 }}>
              <MetaIcon />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Powered by Meta Business Tools
              </span>
            </div>
          </div>

          {/* ═══ Requirements ═══ */}
          <div style={requirementsBox}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-secondary)' }}>
              Requirements
            </h4>
            {REQUIREMENTS.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <span style={{ color: 'var(--success)', flexShrink: 0, fontSize: 14 }}>✓</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>

          {/* ═══ FAQ ═══ */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-secondary)' }}>
              Common Questions
            </h4>
            {FAQ.map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══ Sub-components ══════════════════════════════════════════════════════════

function Step({ num, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={stepDot}>{num}</div>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{text}</span>
    </div>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', color: 'var(--text-primary)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
          fontFamily: 'var(--font-body)', textAlign: 'left', width: '100%',
        }}
      >
        {open ? '▼' : '▶'} {question}
      </button>
      {open && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0 20px', lineHeight: 1.6 }}>
          {answer}
        </p>
      )}
    </div>
  );
}

function Badge({ type, children }) {
  return (
    <span style={{
      fontSize: 11, padding: '3px 10px', borderRadius: 20,
      background: 'transparent', color: '#fff',
      border: '1px solid #2a2a2a', fontWeight: 500,
    }}>{children}</span>
  );
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, background: '#fff', color: '#000',
        borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 16,
      }}>C</div>
      <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>ChatIQ</span>
    </div>
  );
}

function AccountAvatar({ url, username }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
      background: '#0a0a0a', border: '1px solid #1a1a1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, overflow: 'hidden', color: '#fff', fontWeight: 700,
    }}>
      {url ? (
        <img src={url} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        (username || '?')[0].toUpperCase()
      )}
    </div>
  );
}

function InstagramIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function MetaIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 36 36" fill="none">
      <path d="M6.1 16.5c0-2.4.7-4.6 1.8-5.9 1-1.1 2.2-1.7 3.5-1.7 1.7 0 2.9.7 4 2.3l.7 1 .7-1c1-1.5 2.3-2.3 4-2.3 1.3 0 2.5.6 3.5 1.7 1.2 1.3 1.8 3.5 1.8 5.9 0 5.8-5.5 11.4-10 14.2-4.5-2.8-10-8.4-10-14.2z" fill="var(--text-muted)" fillOpacity="0.5"/>
    </svg>
  );
}

// ═══ Constants ═══════════════════════════════════════════════════════════════

const REQUIREMENTS = [
  'Instagram Business or Creator account (not personal)',
  'You\'ll log in directly with your Instagram — no Facebook Page needed',
  'Allow message access in Instagram settings when prompted',
];

const FAQ = [
  {
    q: 'Do I need a Facebook Page?',
    a: 'No! With Instagram Login, you connect directly with your Instagram account. No Facebook Page is required.',
  },
  {
    q: 'What if I have a personal Instagram account?',
    a: 'You\'ll need to switch to a Business or Creator account first. Go to Instagram → Settings → Account type and tools → Switch to Professional account.',
  },
  {
    q: 'What permissions does ChatIQ need?',
    a: 'ChatIQ needs permission to read comments, manage messages, and view your basic profile info. You\'ll authorize these during the Instagram login.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. ChatIQ only accesses the permissions you explicitly grant. We never post on your behalf without your setup.',
  },
];

// ═══ Styles ══════════════════════════════════════════════════════════════════

const pageStyle = {
  minHeight: '100vh', background: '#000', color: '#fff',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: 'clamp(24px, 5vw, 60px) 16px',
};

const titleStyle = {
  fontSize: 'clamp(26px, 6vw, 36px)', fontWeight: 800, marginBottom: 10,
  color: '#fff', letterSpacing: '-0.03em',
};

const subtitleStyle = {
  color: '#a0a0a0', fontSize: 15, marginBottom: 36, lineHeight: 1.55,
};

const sectionLabel = {
  fontSize: 12, fontWeight: 600, color: '#777',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
};

const accountCard = {
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  padding: '14px 16px', borderRadius: 10,
  background: '#0a0a0a', border: '1px solid #1a1a1a',
};

const connectPanel = {
  background: '#0a0a0a', border: '1px solid #1a1a1a',
  borderRadius: 12, padding: 'clamp(18px, 4vw, 28px)', marginBottom: 20,
};

const igIconWrapper = {
  width: 48, height: 48, borderRadius: 12, flexShrink: 0,
  background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
};

const stepsContainer = {
  display: 'flex', flexDirection: 'column', gap: 10,
  marginBottom: 18, padding: '14px 16px',
  background: '#000', border: '1px solid #141414', borderRadius: 8,
};

const stepDot = {
  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
  background: '#fff', color: '#000',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, fontWeight: 700,
};

const connectBtn = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  background: 'linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)', border: 'none', color: '#fff',
  padding: '14px 24px', borderRadius: 10, fontSize: 15, fontWeight: 600,
  cursor: 'pointer', minHeight: 48, transition: 'opacity 0.15s',
};

const enableDmBtn = {
  fontSize: 11, padding: '4px 10px', borderRadius: 20,
  background: '#fff', color: '#000', border: '1px solid #fff',
  cursor: 'pointer', fontWeight: 600,
};

const ghostBtn = {
  background: 'transparent', border: '1px solid #2a2a2a',
  color: '#fff', padding: '9px 16px',
  borderRadius: 8, fontSize: 13, cursor: 'pointer',
};

const disconnectStyle = {
  background: 'none', border: 'none', color: '#555',
  fontSize: 12, cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
  transition: 'color 0.15s',
};

const requirementsBox = {
  background: '#0a0a0a', border: '1px solid #1a1a1a',
  borderRadius: 10, padding: 22,
};
