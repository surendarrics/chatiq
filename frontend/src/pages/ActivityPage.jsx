import React, { useEffect, useState } from 'react';
import { dashboardApi } from '../utils/api';
import toast from 'react-hot-toast';

export default function ActivityPage() {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    dashboardApi.getActivity()
      .then(res => setActivity(res.data.activity || []))
      .catch(() => toast.error('Failed to load activity'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? activity
    : filter === 'success' ? activity.filter(a => a.status === 'completed')
    : activity.filter(a => a.status === 'failed');

  return (
    <div style={{ maxWidth: 900, animation: 'fadeUp 0.4s ease both' }}>
      <style>{`
        .activity-row { display: grid; grid-template-columns: 1fr 140px 100px 100px 120px; }
        .activity-head { display: grid; grid-template-columns: 1fr 140px 100px 100px 120px; }
        @media (max-width: 720px) {
          .activity-head { display: none !important; }
          .activity-row { grid-template-columns: 1fr; gap: 6px; padding: 14px 16px !important; }
        }
      `}</style>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 'clamp(26px, 5vw, 32px)', fontWeight: 800, marginBottom: 4, color: '#fff', letterSpacing: '-0.03em' }}>
          Activity
        </h1>
        <p style={{ color: '#a0a0a0', fontSize: 14 }}>
          Real-time log of all automation triggers, replies and DMs.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {['all', 'success', 'failed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 13,
              fontWeight: 500, cursor: 'pointer',
              border: '1px solid ' + (filter === f ? '#fff' : '#1a1a1a'),
              background: filter === f ? '#fff' : 'transparent',
              color: filter === f ? '#000' : '#a0a0a0',
              transition: 'all 0.15s',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#555', fontSize: 12 }}>
          {filtered.length} events
        </span>
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{
          background: '#0a0a0a', border: '1px solid #1a1a1a',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div className="activity-head" style={{
            padding: '12px 20px', background: '#000',
            borderBottom: '1px solid #1a1a1a',
            fontSize: 11, fontWeight: 600, color: '#555',
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            <span>Comment</span>
            <span>Automation</span>
            <span>Reply</span>
            <span>DM</span>
            <span>Time</span>
          </div>

          {filtered.map((log, i) => (
            <ActivityRow key={log.id} log={log} isLast={i === filtered.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ log, isLast }) {
  const replyOk = log.reply_sent;
  const dmOk = log.dm_sent;

  return (
    <div className="activity-row" style={{
      padding: '14px 20px', alignItems: 'center',
      borderBottom: isLast ? 'none' : '1px solid #1a1a1a',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#141414'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Comment text */}
      <div>
        <div style={{
          fontSize: 13, color: 'var(--text-primary)', marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 340,
        }}>
          {log.comment_text || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No text</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          User: {log.commenter_ig_id?.slice(0, 12) || '—'}
        </div>
      </div>

      {/* Automation name */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.automations?.name || '—'}
      </div>

      {/* Reply status */}
      <div>
        <StatusDot ok={replyOk} error={log.reply_error} label={replyOk ? 'Sent' : log.reply_error ? 'Failed' : '—'} />
      </div>

      {/* DM status */}
      <div>
        <StatusDot ok={dmOk} error={log.dm_error} label={dmOk ? 'Sent' : log.dm_error ? 'Failed' : '—'} />
      </div>

      {/* Time */}
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {timeAgo(log.created_at)}
      </div>
    </div>
  );
}

function StatusDot({ ok, error, label }) {
  const color = ok ? '#fff' : error ? '#ff5555' : '#555';
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color }}>
      <span style={{ fontSize: 8 }}>●</span>
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: 'clamp(40px, 8vw, 72px) 24px',
      background: '#0a0a0a', borderRadius: 14,
      border: '1px solid #1a1a1a',
    }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#fff', letterSpacing: '-0.02em' }}>No activity yet</h3>
      <p style={{ color: '#a0a0a0', fontSize: 14 }}>
        Activity will appear here as your automations trigger.
      </p>
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

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString();
}
