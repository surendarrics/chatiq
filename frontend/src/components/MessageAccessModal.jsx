import React, { useState } from 'react';

/**
 * MessageAccessModal — Blocking modal shown after Instagram connects.
 * Forces user to manually enable "Allow access to messages" in Instagram settings.
 *
 * Props:
 *  - account: { id, username, pageName }
 *  - onConfirm: (accountId) => void  — called when user confirms they enabled it
 *  - onClose: () => void
 */
export default function MessageAccessModal({ account, onConfirm, onClose }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    await onConfirm(account.id);
    setSaving(false);
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <div style={iconWrap}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e84393" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 style={title}>Enable Instagram Message Access</h2>
          <p style={subtitle}>
            To send automated DMs, you must enable message access in your Instagram app settings.
            This cannot be done automatically — it's a one-time manual step.
          </p>
        </div>

        {/* Account info */}
        <div style={accountBadge}>
          <span style={{ fontSize: 18 }}>📸</span>
          <span style={{ fontWeight: 600 }}>@{account?.username || 'your account'}</span>
          {account?.pageName && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({account.pageName})</span>
          )}
        </div>

        {/* Steps */}
        <div style={stepsContainer}>
          <h3 style={stepsTitle}>Follow these steps on your phone:</h3>

          <div style={step}>
            <div style={stepNum}>1</div>
            <div style={stepText}>
              <strong>Open the Instagram app</strong> and go to your profile
            </div>
          </div>

          <div style={step}>
            <div style={stepNum}>2</div>
            <div style={stepText}>
              <strong>Tap ≡ (menu)</strong> → <strong>Settings and privacy</strong>
            </div>
          </div>

          <div style={step}>
            <div style={stepNum}>3</div>
            <div style={stepText}>
              <strong>Messages and story replies</strong> → scroll down to <strong>Message controls</strong>
            </div>
          </div>

          <div style={step}>
            <div style={stepNum}>4</div>
            <div style={stepText}>
              Find <strong>"Allow access to messages"</strong> under <strong>Connected tools</strong> and <strong style={{ color: 'var(--success)' }}>turn it ON</strong>
            </div>
          </div>

          <div style={altPath}>
            💡 <strong>Alternative path:</strong> Settings → Account type and tools → Connected experiences → Allow access to messages
          </div>
        </div>

        {/* Warning */}
        <div style={warningBox}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>If this is not enabled, DM automation will fail silently. Comment replies will still work.</span>
        </div>

        {/* Checkbox */}
        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: '#e84393', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 14 }}>
            I have enabled <strong>"Allow access to messages"</strong> in my Instagram settings
          </span>
        </label>

        {/* Buttons */}
        <div style={buttonRow}>
          <button onClick={onClose} style={skipBtn}>
            Skip for now
          </button>
          <button
            onClick={handleContinue}
            disabled={!checked || saving}
            style={{
              ...confirmBtn,
              opacity: (!checked || saving) ? 0.5 : 1,
              cursor: (!checked || saving) ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : '✓ Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * MessageAccessBanner — Warning banner shown on Dashboard / pages when message access is not enabled.
 * Props:
 *  - accounts: array of accounts with message_access_enabled field
 *  - onFix: (accountId) => void
 */
export function MessageAccessBanner({ accounts, onFix }) {
  const disabledAccounts = (accounts || []).filter(a => !a.message_access_enabled);
  if (disabledAccounts.length === 0) return null;

  return (
    <div style={bannerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Instagram message access is disabled
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {disabledAccounts.map(a => `@${a.username}`).join(', ')} — DM automation will fail until you enable "Allow access to messages" in Instagram settings.
          </div>
        </div>
      </div>
      {disabledAccounts.length === 1 && onFix && (
        <button onClick={() => onFix(disabledAccounts[0].id)} style={fixBtn}>
          I've enabled it
        </button>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24, animation: 'fadeIn 0.2s ease',
};

const modal = {
  width: '100%', maxWidth: 540,
  background: 'var(--bg-surface, #1a1a2e)',
  border: '1px solid var(--border, #2a2a3e)',
  borderRadius: 16, padding: 32,
  maxHeight: '90vh', overflowY: 'auto',
};

const header = { textAlign: 'center', marginBottom: 24 };

const iconWrap = {
  width: 56, height: 56, borderRadius: 14,
  background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  margin: '0 auto 16px',
};

const title = {
  fontFamily: 'var(--font-display, Inter)', fontSize: 22, fontWeight: 700,
  marginBottom: 8,
};

const subtitle = {
  color: 'var(--text-secondary, #999)', fontSize: 14, lineHeight: 1.6, margin: 0,
};

const accountBadge = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 16px', borderRadius: 10,
  background: 'var(--bg-elevated, #12121e)', border: '1px solid var(--border, #2a2a3e)',
  marginBottom: 20, fontSize: 14,
};

const stepsContainer = {
  background: 'var(--bg-elevated, #12121e)',
  border: '1px solid var(--border, #2a2a3e)',
  borderRadius: 12, padding: 20, marginBottom: 16,
};

const stepsTitle = { fontSize: 14, fontWeight: 600, marginBottom: 16 };

const step = {
  display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14,
};

const stepNum = {
  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
  background: 'linear-gradient(135deg, #e84393, #6c5ce7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, fontWeight: 700, color: '#fff',
};

const stepText = { fontSize: 14, color: 'var(--text-secondary, #bbb)', lineHeight: 1.5 };

const altPath = {
  marginTop: 12, padding: '10px 14px', borderRadius: 8,
  background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.15)',
  fontSize: 12, color: 'var(--text-secondary, #aaa)', lineHeight: 1.5,
};

const warningBox = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 16px', borderRadius: 10,
  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
  fontSize: 13, color: 'var(--text-secondary, #bbb)', marginBottom: 20, lineHeight: 1.5,
};

const checkboxRow = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '14px 16px', borderRadius: 10,
  background: 'var(--bg-elevated, #12121e)', border: '1px solid var(--border, #2a2a3e)',
  cursor: 'pointer', marginBottom: 20,
};

const buttonRow = {
  display: 'flex', gap: 12, justifyContent: 'flex-end',
};

const skipBtn = {
  background: 'transparent', border: '1px solid var(--border, #2a2a3e)',
  color: 'var(--text-muted, #666)', padding: '12px 20px',
  borderRadius: 10, fontSize: 14, cursor: 'pointer', fontWeight: 500,
};

const confirmBtn = {
  background: 'linear-gradient(135deg, #e84393, #6c5ce7)',
  border: 'none', color: '#fff', padding: '12px 28px',
  borderRadius: 10, fontSize: 14, fontWeight: 600,
  boxShadow: '0 4px 20px rgba(232,67,147,0.3)',
};

const bannerStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 16, padding: '14px 20px', borderRadius: 12,
  background: 'rgba(245,158,11,0.08)',
  border: '1px solid rgba(245,158,11,0.25)',
  marginBottom: 20,
};

const fixBtn = {
  background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
  color: '#f59e0b', padding: '8px 16px', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
