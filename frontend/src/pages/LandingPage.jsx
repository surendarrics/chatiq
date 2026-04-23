import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../utils/api';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleConnect = () => {
    window.location.href = authApi.getInstagramAuthUrl();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      <style>{mediaCSS}</style>

      {/* Nav */}
      <nav className="landing-nav">
        <Logo />
        <button onClick={handleConnect} className="btn btn-ghost landing-nav-btn">
          Get started
        </button>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-badge">Instagram Automation</div>

        <h1 className="landing-h1">
          Turn comments<br />into conversations
        </h1>

        <p className="landing-sub">
          ChatIQ automatically replies to Instagram comments and sends DMs when your keywords are triggered.
        </p>

        <div className="landing-cta">
          <button onClick={handleConnect} className="btn btn-primary landing-primary">
            <InstagramIcon /> Connect Instagram
          </button>
          <a href="#how-it-works" className="btn btn-ghost">
            How it works →
          </a>
        </div>

        <p className="landing-fineprint">
          No credit card · Official Meta API · GDPR compliant
        </p>
      </section>

      {/* Dashboard preview */}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <DashboardPreview />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="landing-section">
        <h2 className="landing-h2">How ChatIQ works</h2>
        <p className="landing-section-sub">Set it up once, let it run forever.</p>
        <div className="landing-grid">
          {STEPS.map((step, i) => (
            <StepCard key={i} step={step} index={i + 1} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <div className="landing-grid features">
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} feature={f} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-box">
        <h2 className="landing-h2">Ready to automate?</h2>
        <p className="landing-section-sub">
          Connect your Instagram account and create your first automation in 2 minutes.
        </p>
        <button onClick={handleConnect} className="btn btn-primary landing-primary">
          <InstagramIcon /> Start for free
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <Logo small />
        <p style={{ color: '#555', fontSize: 12 }}>© 2026 ChatIQ</p>
      </footer>
    </div>
  );
}

function Logo({ small }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: small ? 26 : 32,
          height: small ? 26 : 32,
          background: '#fff',
          color: '#000',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: small ? 13 : 16,
          fontWeight: 800,
        }}
      >
        C
      </div>
      <span style={{ fontWeight: 700, fontSize: small ? 15 : 18, letterSpacing: '-0.02em' }}>ChatIQ</span>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid #1a1a1a',
        background: '#000',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(255,255,255,0.03)',
      }}
    >
      <div
        style={{
          background: '#0a0a0a',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid #1a1a1a',
        }}
      >
        {['#555', '#555', '#555'].map((c, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
        ))}
        <div
          style={{
            marginLeft: 10,
            background: '#141414',
            borderRadius: 5,
            padding: '3px 12px',
            fontSize: 11,
            color: '#777',
            flex: 1,
            maxWidth: 260,
          }}
        >
          app.chatiq.io/dashboard
        </div>
      </div>

      <div className="preview-body">
        <div className="preview-sidebar">
          {['Dashboard', 'Automations', 'Activity', 'Settings'].map((item, i) => (
            <div
              key={item}
              style={{
                padding: '9px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                background: i === 0 ? '#fff' : 'transparent',
                color: i === 0 ? '#000' : '#777',
              }}
            >
              {item}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="preview-stats">
            {[
              { label: 'Active Automations', value: '4' },
              { label: 'Triggers Today', value: '127' },
              { label: 'DMs Sent', value: '89' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: '#0a0a0a',
                  borderRadius: 8,
                  padding: 14,
                  border: '1px solid #1a1a1a',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 14, border: '1px solid #1a1a1a' }}>
            <div
              style={{
                fontSize: 10,
                color: '#777',
                marginBottom: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Recent Automations
            </div>
            {['Summer Sale — "price"', 'Course Launch — "link"', 'Giveaway — "join"'].map((a, i) => (
              <div
                key={a}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: i < 2 ? '1px solid #1a1a1a' : 'none',
                  fontSize: 12,
                }}
              >
                <span style={{ color: '#a0a0a0' }}>{a}</span>
                <div
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 20,
                    border: '1px solid #2a2a2a',
                    color: '#fff',
                  }}
                >
                  Active
                </div>
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
    <div
      style={{
        background: '#000',
        border: '1px solid #1a1a1a',
        borderRadius: 12,
        padding: 28,
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#1a1a1a';
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          marginBottom: 18,
          background: '#fff',
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 800,
        }}
      >
        {index}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#fff', letterSpacing: '-0.01em' }}>{step.title}</h3>
      <p style={{ color: '#a0a0a0', fontSize: 14, lineHeight: 1.55 }}>{step.desc}</p>
    </div>
  );
}

function FeatureCard({ feature }) {
  return (
    <div
      style={{
        background: '#000',
        border: '1px solid #1a1a1a',
        borderRadius: 10,
        padding: 24,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          flexShrink: 0,
          background: '#0a0a0a',
          border: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        {feature.icon}
      </div>
      <div>
        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: '#fff' }}>{feature.title}</h4>
        <p style={{ color: '#a0a0a0', fontSize: 13, lineHeight: 1.55 }}>{feature.desc}</p>
      </div>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

const STEPS = [
  { title: 'Connect Instagram', desc: 'Link your Instagram Business account via the official Meta OAuth flow in one click.' },
  { title: 'Choose a post', desc: 'Pick any post from your feed that you want to monitor for comments.' },
  { title: 'Set your keywords', desc: 'Define words like "price", "link", or "info" that trigger your automation.' },
  { title: 'Automate replies & DMs', desc: 'ChatIQ replies to comments and sends a DM to the commenter — hands free.' },
];

const FEATURES = [
  { icon: '◆', title: 'Keyword Triggers', desc: 'Trigger automations only when specific keywords appear in comments.' },
  { icon: '◈', title: 'Auto Comment Reply', desc: 'Reply to comments instantly with a custom message like "Check your DMs!"' },
  { icon: '▲', title: 'Auto DM Sender', desc: 'Send personalized DMs with links, info, or any message to commenters.' },
  { icon: '●', title: 'Official Meta API', desc: 'No scraping. Uses the official Instagram Graph API — safe and compliant.' },
  { icon: '◉', title: 'Activity Logs', desc: 'See every trigger, reply, and DM in a real-time activity feed.' },
  { icon: '▸', title: 'Webhook-Powered', desc: 'Real-time processing via Meta webhooks — no polling, no delays.' },
];

const mediaCSS = `
.landing-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px;
  max-width: 1200px; margin: 0 auto;
}
.landing-nav-btn { padding: 8px 16px; min-height: auto; font-size: 13px; }

.landing-hero {
  max-width: 820px; margin: 0 auto;
  padding: 48px 24px 40px;
  text-align: center;
}
.landing-badge {
  display: inline-block;
  border: 1px solid #1a1a1a;
  color: #a0a0a0;
  padding: 5px 12px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 24px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.landing-h1 {
  font-size: clamp(40px, 9vw, 76px);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.035em;
  margin-bottom: 20px;
  color: #fff;
}
.landing-sub {
  font-size: clamp(15px, 2.4vw, 18px);
  color: #a0a0a0;
  max-width: 540px;
  margin: 0 auto 32px;
  line-height: 1.55;
}
.landing-cta {
  display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
}
.landing-primary { padding: 14px 24px; font-size: 15px; }
.landing-fineprint {
  margin-top: 20px; font-size: 12px; color: #555;
}

.landing-section {
  max-width: 1100px; margin: 0 auto; padding: 56px 24px;
}
.landing-h2 {
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 800;
  text-align: center;
  margin-bottom: 12px;
  letter-spacing: -0.03em;
  color: #fff;
}
.landing-section-sub {
  text-align: center; color: #a0a0a0;
  margin-bottom: 40px; font-size: 15px;
  max-width: 480px; margin-left: auto; margin-right: auto;
}
.landing-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}
@media (min-width: 640px) {
  .landing-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 960px) {
  .landing-grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .landing-grid.features { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
}

.landing-cta-box {
  max-width: 680px;
  margin: 40px auto 80px;
  padding: 48px 24px;
  text-align: center;
  background: #0a0a0a;
  border-radius: 14px;
  border: 1px solid #1a1a1a;
}
.landing-cta-box .landing-section-sub { margin-bottom: 24px; }

.landing-footer {
  border-top: 1px solid #141414;
  padding: 24px;
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 12px;
  max-width: 1200px; margin: 0 auto;
}

/* Preview body layout */
.preview-body {
  padding: 20px;
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 16px;
  min-height: 280px;
}
.preview-sidebar {
  display: flex; flex-direction: column; gap: 6px;
}
.preview-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
@media (max-width: 640px) {
  .preview-body { grid-template-columns: 1fr; }
  .preview-sidebar { display: none; }
  .preview-stats { grid-template-columns: repeat(3, 1fr); gap: 8px; }
}
`;
