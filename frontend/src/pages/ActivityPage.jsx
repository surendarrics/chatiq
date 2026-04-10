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
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, marginBottom: 6 }}>
          Activity
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Real-time log of all automation triggers, replies and DMs.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['all', 'success', 'failed'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13,
              fontWeight: 500, cursor: 'pointer', border: 'none',
              background: filter === f ? 'var(--accent)' : 'var(--bg-elevated)',
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center' }}>
          {filtered.length} events
        </span>
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 140px 100px 100px 120px',
            padding: '12px 24px', background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
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
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 140px 100px 100px 120px',
      padding: '14px 24px', alignItems: 'center',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
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
  const color = ok ? 'var(--success)' : error ? 'var(--danger)' : 'var(--text-muted)';
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
      textAlign: 'center', padding: '80px 40px',
      background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No activity yet</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
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
