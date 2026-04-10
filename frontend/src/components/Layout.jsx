import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: '⬡' },
  { path: '/automations', label: 'Automations', icon: '⚡' },
  { path: '/activity', label: 'Activity', icon: '◎' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 64 : 220,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        transition: 'width 0.25s ease', zIndex: 100, overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '20px 16px' : '20px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fff', fontSize: 16,
          }}>C</div>
          {!collapsed && (
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
              ChatIQ
            </span>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center',
                gap: 12, padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none', fontSize: 14, fontWeight: 500,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(232,67,147,0.08)' : 'transparent',
                border: isActive ? '1px solid rgba(232,67,147,0.2)' : '1px solid transparent',
                transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
                whiteSpace: 'nowrap',
              })}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              {!collapsed && label}
            </NavLink>
          ))}

          <div style={{ marginTop: 8 }}>
            <NavLink
              to="/automations/new"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
                color: '#fff', fontSize: 13, fontWeight: 600,
                textDecoration: 'none', justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'opacity 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>+</span>
              {!collapsed && 'New Automation'}
            </NavLink>
          </div>
        </nav>

        {/* Bottom: user + collapse */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 8, marginBottom: 8, transition: 'border-color 0.15s',
            }}
          >
            <span>{collapsed ? '→' : '←'}</span>
            {!collapsed && 'Collapse'}
          </button>

          {!collapsed && user && (
            <div style={{
              padding: '10px 12px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  marginTop: 8, fontSize: 12, color: 'var(--text-muted)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Sign out →
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        marginLeft: collapsed ? 64 : 220,
        transition: 'margin-left 0.25s ease',
        minHeight: '100vh',
        padding: '40px',
        maxWidth: '100%',
      }}>
        <Outlet />
      </main>
    </div>
  );
}
