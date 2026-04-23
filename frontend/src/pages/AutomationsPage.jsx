import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { automationsApi } from '../utils/api';
import toast from 'react-hot-toast';

export default function AutomationsPage() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await automationsApi.list();
      setAutomations(res.data.automations || []);
    } catch {
      toast.error('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (id) => {
    try {
      const res = await automationsApi.toggle(id);
      setAutomations(prev => prev.map(a => a.id === id ? res.data.automation : a));
      toast.success('Automation updated');
    } catch {
      toast.error('Failed to update automation');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this automation? This cannot be undone.')) return;
    try {
      await automationsApi.delete(id);
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast.success('Automation deleted');
    } catch {
      toast.error('Failed to delete automation');
    }
  };

  return (
    <div style={{ maxWidth: 1000, animation: 'fadeUp 0.4s ease both' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 32,
      }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(26px, 5vw, 32px)', fontWeight: 800, marginBottom: 4, color: '#fff', letterSpacing: '-0.03em' }}>
            Automations
          </h1>
          <p style={{ color: '#a0a0a0', fontSize: 14 }}>
            {automations.length} automation{automations.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Link to="/automations/new" style={primaryBtn}>
          + New Automation
        </Link>
      </div>

      {loading ? (
        <Loader />
      ) : automations.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {automations.map(a => (
            <AutomationCard
              key={a.id}
              automation={a}
              onToggle={() => handleToggle(a.id)}
              onDelete={() => handleDelete(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationCard({ automation, onToggle, onDelete }) {
  const isActive = automation.status === 'active';
  const account = automation.instagram_accounts;

  return (
    <div style={{
      background: '#0a0a0a', border: '1px solid #1a1a1a',
      borderRadius: 12, padding: 'clamp(16px, 3vw, 22px)',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a2a'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a1a'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        {/* Post thumbnail */}
        <div style={{
          width: 72, height: 72, borderRadius: 12, flexShrink: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          {automation.post_thumbnail
            ? <img src={automation.post_thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '📸'}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
              {automation.name}
            </h3>
            <StatusBadge status={automation.status} />
          </div>

          {account && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              @{account.username} · Post ID: {automation.post_id.slice(-8)}…
            </p>
          )}

          {/* Keywords */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {automation.match_all_comments ? (
              <Chip label="All comments" color="var(--accent-2)" />
            ) : (
              (automation.keywords || []).map(kw => (
                <Chip key={kw} label={kw} />
              ))
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
            {automation.reply_text && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: 'var(--success)' }}>💬</span> Auto-reply set
              </span>
            )}
            {automation.dm_text && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: 'var(--accent)' }}>📩</span> DM set
              </span>
            )}
            <span>🎯 {automation.trigger_count || 0} triggers</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0 }}>
          <Toggle active={isActive} onToggle={onToggle} />
          <button
            onClick={onDelete}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13, padding: '4px 8px',
              borderRadius: 6, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 48, height: 26, borderRadius: 13, border: 'none',
        background: active ? 'var(--accent)' : 'var(--border-bright)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
        flexShrink: 0,
      }}
      title={active ? 'Pause automation' : 'Activate automation'}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: active ? 25 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: { bg: '#fff', color: '#000', border: '#fff', label: 'Active' },
    paused: { bg: 'transparent', color: '#fff', border: '#2a2a2a', label: 'Paused' },
    archived: { bg: 'transparent', color: '#555', border: '#1a1a1a', label: 'Archived' },
  };
  const s = map[status] || map.paused;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>{s.label}</span>
  );
}

function Chip({ label, color }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, padding: '3px 10px',
      borderRadius: 6, background: 'var(--bg-elevated)',
      border: '1px solid var(--border)', color: color || 'var(--text-secondary)',
    }}>{label}</span>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: 'clamp(40px, 8vw, 72px) 24px',
      background: '#0a0a0a', borderRadius: 14,
      border: '1px dashed #1a1a1a',
    }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#fff', letterSpacing: '-0.02em' }}>
        No automations yet
      </h3>
      <p style={{ color: '#a0a0a0', marginBottom: 24, fontSize: 14 }}>
        Create your first automation to start replying to comments and sending DMs.
      </p>
      <Link to="/automations/new" style={primaryBtn}>
        Create your first automation
      </Link>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid var(--bg-elevated)', borderTop: '3px solid var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: '#fff', color: '#000',
  padding: '11px 20px', borderRadius: 10,
  fontSize: 14, fontWeight: 600, textDecoration: 'none',
};
