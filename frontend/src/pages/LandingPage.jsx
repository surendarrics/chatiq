import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { instagramApi } from '../utils/api';
import toast from 'react-hot-toast';
import MessageAccessModal from '../components/MessageAccessModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState(null);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleConnect = () => {
    if (typeof window.FB === 'undefined') {
      toast.error('Facebook SDK not loaded yet. Please wait a moment and try again.');
      return;
    }

    setConnecting(true);
    setConnectionStatus(null);

    window.FB.login(
      (response) => {
        if (response.authResponse) {
          const accessToken = response.authResponse.accessToken;
          console.log('✅ FB Login success, token:', accessToken.substring(0, 20) + '...');

          // Send token to backend to complete the connection
          api.post('/auth/instagram/connect', { accessToken })
            .then((res) => {
              console.log('✅ Backend connect response:', res.data);
              setConnectionStatus({
                success: true,
                message: `Successfully connected ${res.data.accounts.length} Instagram account(s)!`,
                accounts: res.data.accounts,
              });
              toast.success('Instagram connected successfully!');

              if (res.data.token) {
                localStorage.setItem('chatiq_token', res.data.token);
              }

              // Show message access modal instead of auto-redirect
              if (res.data.accounts?.length > 0) {
                setConnectedAccount({
                  id: res.data.accounts[0].igAccountId,
                  username: res.data.accounts[0].username,
                  pageName: res.data.accounts[0].pageName,
                });
                setShowMessageModal(true);
              }
            })
            .catch((err) => {
              console.error('❌ Backend connect error:', err.response?.data || err.message);
              setConnectionStatus({
                success: false,
                message: err.response?.data?.error || 'Failed to connect Instagram account.',
              });
              toast.error('Connection failed. See details below.');
            })
            .finally(() => setConnecting(false));
        } else {
          console.log('❌ FB Login cancelled');
          setConnecting(false);
          toast.error('Login was cancelled.');
        }
      },
      {
        scope: [
          'instagram_basic',
          'instagram_manage_comments',
          'instagram_manage_messages',
          'pages_show_list',
          'pages_read_engagement',
          'pages_manage_metadata',
        ].join(','),
      }
    );
  };

  const handleMessageAccessConfirm = async () => {
    try {
      const accRes = await instagramApi.getAccounts();
      const acc = (accRes.data.accounts || []).find(a =>
        a.ig_account_id === connectedAccount?.id || a.username === connectedAccount?.username
      );
      if (acc) {
        await instagramApi.updateMessageAccess(acc.id, true);
        toast.success('Message access confirmed! 🎉');
      }
    } catch (e) {
      console.error('Failed to update message access:', e);
    }
    setShowMessageModal(false);
    navigate('/dashboard');
  };

  const handleMessageAccessSkip = () => {
    setShowMessageModal(false);
    toast('DM automation may fail until you enable message access.', { icon: '⚠️' });
    navigate('/dashboard');
  };

  return (
    <>
      {showMessageModal && connectedAccount && (
        <MessageAccessModal
          account={connectedAccount}
          onConfirm={handleMessageAccessConfirm}
          onClose={handleMessageAccessSkip}
        />
      )}
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Background mesh */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,67,147,0.08) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(124,92,252,0.08) 0%, transparent 60%)
        `,
      }} />

      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 48px', position: 'relative', zIndex: 10,
      }}>
        <Logo />
        <button onClick={handleConnect} style={styles.navBtn}>
          Get started free
        </button>
      </nav>

      {/* Hero */}
      <section style={{
        maxWidth: 900, margin: '0 auto', padding: '80px 24px 60px',
        textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        <div style={styles.badge}>
          <span style={{ color: 'var(--accent)' }}>✦</span>
          &nbsp;Instagram Automation Platform
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(48px, 8vw, 84px)',
          fontWeight: 800,
          lineHeight: 1.05,
          marginBottom: 28,
          letterSpacing: '-2px',
        }}>
          Turn comments<br />
          into <span className="gradient-text">conversations</span>
        </h1>

        <p style={{
          fontSize: 20, color: 'var(--text-secondary)',
          maxWidth: 560, margin: '0 auto 48px',
          lineHeight: 1.7,
        }}>
          ChatIQ automatically replies to Instagram comments and sends DMs when your keywords are triggered — like ManyChat, but sharper.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleConnect} disabled={connecting} style={{
            ...styles.primaryBtn,
            opacity: connecting ? 0.7 : 1,
            cursor: connecting ? 'wait' : 'pointer',
          }}>
            <InstagramIcon />
            {connecting ? 'Connecting...' : 'Connect Instagram — it\'s free'}
          </button>
          <a href="#how-it-works" style={styles.ghostBtn}>See how it works →</a>
        </div>

        {/* Connection status banner */}
        {connectionStatus && (
          <div style={{
            marginTop: 24,
            padding: '16px 24px',
            borderRadius: 12,
            background: connectionStatus.success
              ? 'rgba(34,211,165,0.1)'
              : 'rgba(239,68,68,0.1)',
            border: `1px solid ${connectionStatus.success
              ? 'rgba(34,211,165,0.3)'
              : 'rgba(239,68,68,0.3)'}`,
            textAlign: 'left',
            maxWidth: 560,
            margin: '24px auto 0',
          }}>
            <div style={{
              fontSize: 15, fontWeight: 600, marginBottom: 8,
              color: connectionStatus.success ? 'var(--success)' : '#ef4444',
            }}>
              {connectionStatus.success ? '✅ Connected!' : '❌ Connection Failed'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {connectionStatus.message}
            </div>
            {connectionStatus.accounts?.map((acc, i) => (
              <div key={i} style={{
                marginTop: 8, padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 8, fontSize: 13,
                color: 'var(--text-primary)',
              }}>
                📸 @{acc.username} — Page: {acc.pageName}
              </div>
            ))}
          </div>
        )}

        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          No credit card required · Official Meta API · GDPR compliant
        </p>
      </section>

      {/* Dashboard Preview */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px', position: 'relative', zIndex: 1 }}>
        <DashboardPreview />
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, textAlign: 'center', marginBottom: 16 }}>
          How ChatIQ works
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 60, fontSize: 17 }}>
          Set it up once, let it run forever.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {STEPS.map((step, i) => (
            <StepCard key={i} step={step} index={i + 1} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} feature={f} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        maxWidth: 700, margin: '0 auto 100px', padding: '60px 24px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(232,67,147,0.08), rgba(124,92,252,0.08))',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
      }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, marginBottom: 16 }}>
          Ready to automate?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          Connect your Instagram account and create your first automation in 2 minutes.
        </p>
        <button onClick={handleConnect} style={styles.primaryBtn}>
          <InstagramIcon />
          Start for free
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '32px 48px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: 'var(--text-muted)', fontSize: 13,
      }}>
        <Logo small />
        <p>© 2025 ChatIQ. Built with the official Meta Instagram API.</p>
      </footer>
    </div>
    </>
  );
}

function Logo({ small }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: small ? 28 : 36, height: small ? 28 : 36,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: small ? 14 : 18, fontWeight: 800, color: '#fff',
        fontFamily: 'var(--font-display)',
      }}>C</div>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: small ? 16 : 20, color: 'var(--text-primary)',
      }}>ChatIQ</span>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div style={{
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--bg-surface)',
      overflow: 'hidden',
      boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px var(--border)',
      position: 'relative',
    }}>
      {/* Fake browser bar */}
      <div style={{
        background: 'var(--bg-elevated)', padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--border)',
      }}>
        {['#ef4444', '#f59e0b', '#22d3a5'].map(c => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
        ))}
        <div style={{
          marginLeft: 12, background: 'var(--bg-hover)', borderRadius: 6,
          padding: '4px 16px', fontSize: 12, color: 'var(--text-muted)', flex: 1, maxWidth: 300,
        }}>
          app.chatiq.io/dashboard
        </div>
      </div>
      {/* Preview content */}
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, minHeight: 320 }}>
        {/* Fake sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Dashboard', 'Automations', 'Activity', 'Settings'].map((item, i) => (
            <div key={item} style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: i === 0 ? 'var(--accent-glow)' : 'transparent',
              color: i === 0 ? 'var(--accent)' : 'var(--text-secondary)',
              border: i === 0 ? '1px solid rgba(232,67,147,0.3)' : '1px solid transparent',
            }}>{item}</div>
          ))}
        </div>
        {/* Fake main */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Active Automations', value: '4' },
              { label: 'Triggers Today', value: '127' },
              { label: 'DMs Sent', value: '89' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg-elevated)', borderRadius: 10,
                padding: 16, border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Recent Automations</div>
            {['Summer Sale Post — "price" keyword', 'Course Launch — "link" keyword', 'Giveaway Post — "join" keyword'].map((a, i) => (
              <div key={a} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{a}</span>
                <div style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(34,211,165,0.1)', color: 'var(--success)',
                  border: '1px solid rgba(34,211,165,0.2)',
                }}>Active</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, index }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 32,
      transition: 'border-color 0.2s, transform 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, marginBottom: 20,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#fff',
      }}>{index}</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{step.title}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>{step.desc}</p>
    </div>
  );
}

function FeatureCard({ feature }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: 28,
      display: 'flex', gap: 20, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      }}>{feature.icon}</div>
      <div>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{feature.title}</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{feature.desc}</p>
      </div>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

const STEPS = [
  { title: 'Connect Instagram', desc: 'Link your Instagram Business account via the official Meta OAuth flow in one click.' },
  { title: 'Choose a post', desc: 'Pick any post from your feed that you want to monitor for comments.' },
  { title: 'Set your keywords', desc: 'Define words like "price", "link", or "info" that trigger your automation.' },
  { title: 'Automate replies & DMs', desc: 'ChatIQ instantly replies to comments and sends a DM to the commenter — hands free.' },
];

const FEATURES = [
  { icon: '🎯', title: 'Keyword Triggers', desc: 'Trigger automations only when specific keywords appear in comments.' },
  { icon: '💬', title: 'Auto Comment Reply', desc: 'Reply to comments instantly with a custom message like "Check your DMs! 👀"' },
  { icon: '📩', title: 'Auto DM Sender', desc: 'Send personalized DMs with links, info, or any message to engaged commenters.' },
  { icon: '🔌', title: 'Official Meta API', desc: 'No scraping. Uses the official Instagram Graph API — safe and compliant.' },
  { icon: '📊', title: 'Activity Logs', desc: 'See every trigger, reply, and DM in a real-time activity feed.' },
  { icon: '⚡', title: 'Webhook-Powered', desc: 'Real-time processing via Meta webhooks — no polling, no delays.' },
];

const styles = {
  navBtn: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '10px 20px',
    borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', transition: 'border-color 0.2s',
  },
  primaryBtn: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
    border: 'none', color: '#fff',
    padding: '14px 28px', borderRadius: 'var(--radius)',
    fontSize: 15, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 10,
    boxShadow: '0 4px 24px var(--accent-glow)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    fontFamily: 'var(--font-body)',
  },
  ghostBtn: {
    background: 'transparent', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', padding: '14px 28px',
    borderRadius: 'var(--radius)', fontSize: 15, fontWeight: 500,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    transition: 'border-color 0.2s, color 0.2s',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.25)',
    color: 'var(--text-secondary)', padding: '6px 16px',
    borderRadius: 100, fontSize: 13, fontWeight: 500, marginBottom: 28,
  },
};
