import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardApi, instagramApi } from '../utils/api';
import toast from 'react-hot-toast';
import { MessageAccessBanner } from '../components/MessageAccessModal';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Show success toast after OAuth redirect
  useEffect(() => {
    if (sessionStorage.getItem('chatiq_auth_success')) {
      sessionStorage.removeItem('chatiq_auth_success');
      toast.success('Instagram connected successfully! 🎉');
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, actRes, accRes] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getActivity(),
          instagramApi.getAccounts(),
        ]);
        setStats(statsRes.data);
        setActivity(actRes.data.activity || []);
        setAccounts(accRes.data.accounts || []);
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) return <PageLoader />;

  const hasAccounts = accounts.length > 0;

  return (
    <div style={{ maxWidth: 1100, animation: 'fadeUp 0.4s ease both' }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700,
          marginBottom: 6,
        }}>
          {greeting()}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          {hasAccounts
            ? `You have ${stats?.active_automations || 0} active automation${stats?.active_automations !== 1 ? 's' : ''} running.`
            : 'Connect your Instagram account to get started.'}
        </p>
      </div>

      {/* Message access warning banner */}
      <MessageAccessBanner
        accounts={accounts}
        onFix={async (accountId) => {
          try {
            await instagramApi.updateMessageAccess(accountId, true);
            setAccounts(prev => prev.map(a =>
              a.id === accountId ? { ...a, message_access_enabled: true } : a
            ));
            toast.success('Message access confirmed!');
          } catch {
            toast.error('Failed to update');
          }
        }}
      />

      {/* Connect prompt if no accounts */}
      {!hasAccounts && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(232,67,147,0.08), rgba(124,92,252,0.08))',
          border: '1px solid rgba(232,67,147,0.2)',
          borderRadius: 'var(--radius-lg)', padding: '40px',
          textAlign: 'center', marginBottom: 40,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📸</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 10 }}>
            No Instagram account connected
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            Connect your Instagram Business account to start automating comments.
          </p>
          <Link to="/connect" style={btnStyle}>
            Connect Instagram Account
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      {hasAccounts && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
          {[
            { label: 'Total Automations', value: stats.total_automations, color: 'var(--accent-2)', icon: '⚡' },
            { label: 'Active Now', value: stats.active_automations, color: 'var(--success)', icon: '●' },
            { label: 'Total Triggers', value: stats.total_triggers, color: 'var(--accent)', icon: '🎯' },
            { label: 'This Week', value: stats.this_week?.triggers || 0, color: 'var(--warning)', icon: '📈' },
          ].map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: hasAccounts ? '1fr 340px' : '1fr', gap: 24 }}>
        {/* Activity Feed */}
        <div style={cardStyle}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Recent Activity</h2>
            <Link to="/activity" style={{ fontSize: 13, color: 'var(--accent)' }}>View all →</Link>
          </div>
          {activity.length === 0 ? (
            <EmptyState icon="◎" message="No activity yet. Create an automation to get started." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.slice(0, 8).map((log) => (
                <ActivityRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>

        {/* Connected Accounts */}
        <div style={cardStyle}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Connected Accounts</h2>
            <Link to="/connect" style={{ fontSize: 13, color: 'var(--accent)' }}>+ Add</Link>
          </div>
          {accounts.length === 0 ? (
            <EmptyState icon="📷" message="No accounts connected" />
          ) : (
            accounts.map((acc) => <AccountRow key={acc.id} account={acc} />)
          )}

          {/* Quick actions */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to="/automations/new" style={quickActionStyle}>
                <span>⚡</span> Create new automation
              </Link>
              <Link to="/automations" style={quickActionStyle}>
                <span>☰</span> Manage automations
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '24px',
      transition: 'border-color 0.2s, transform 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ fontSize: 20, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-display)', color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function ActivityRow({ log }) {
  const ok = log.status === 'completed';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
        background: ok ? 'var(--success)' : log.status === 'failed' ? 'var(--danger)' : 'var(--warning)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.comment_text || 'Comment received'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {log.reply_sent && <span style={{ color: 'var(--success)' }}>✓ Reply sent</span>}
          {log.dm_sent && <span style={{ color: 'var(--accent)' }}>✓ DM sent</span>}
          {log.reply_error && <span style={{ color: 'var(--danger)' }}>✗ Reply failed</span>}
          <span>{timeAgo(log.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function AccountRow({ account }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, overflow: 'hidden',
      }}>
        {account.profile_picture_url
          ? <img src={account.profile_picture_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : '📷'}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>@{account.username || account.page_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {account.followers_count?.toLocaleString() || '—'} followers
        </div>
      </div>
      <div style={{
        marginLeft: 'auto', fontSize: 11, padding: '3px 10px',
        borderRadius: 20, background: 'rgba(34,211,165,0.1)',
        color: 'var(--success)', border: '1px solid rgba(34,211,165,0.2)',
      }}>Connected</div>
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid var(--bg-elevated)', borderTop: '3px solid var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const cardStyle = {
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)', padding: 28,
};
const cardHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 20,
};
const cardTitle = {
  fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
};
const btnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 8,
  background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
  border: 'none', color: '#fff', padding: '12px 24px',
  borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 4px 20px var(--accent-glow)',
};
const quickActionStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 14px', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none',
  transition: 'border-color 0.15s, color 0.15s',
};
