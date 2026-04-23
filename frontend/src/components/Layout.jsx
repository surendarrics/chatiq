import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/automations', label: 'Automations' },
  { path: '/activity', label: 'Activity' },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 900);
  useEffect(() => {
    const on = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return isMobile;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [isMobile]);

  useEffect(() => {
    if (drawerOpen) document.body.classList.add('no-scroll');
    else document.body.classList.remove('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/');
  };

  const sidebarWidth = 240;

  const sidebar = (
    <aside
      style={{
        width: sidebarWidth,
        background: '#000',
        borderRight: '1px solid #141414',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        overflow: 'hidden',
        transform: isMobile ? (drawerOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
        transition: 'transform 0.25s ease',
      }}
    >
      <div
        style={{
          padding: '20px 22px',
          borderBottom: '1px solid #141414',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: '#fff',
              color: '#000',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            C
          </div>
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>ChatIQ</span>
        </div>
        {isMobile && (
          <button
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            style={{
              width: 36,
              height: 36,
              color: '#fff',
              fontSize: 22,
              lineHeight: 1,
              borderRadius: 6,
            }}
          >
            ×
          </button>
        )}
      </div>

      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ path, label }) => (
          <NavLink
            key={path}
            to={path}
            onClick={() => setDrawerOpen(false)}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              padding: '11px 14px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              color: isActive ? '#000' : '#a0a0a0',
              background: isActive ? '#fff' : 'transparent',
              transition: 'background 0.15s, color 0.15s',
            })}
          >
            {label}
          </NavLink>
        ))}

        <NavLink
          to="/automations/new"
          onClick={() => setDrawerOpen(false)}
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '11px 14px',
            borderRadius: 8,
            border: '1px solid #2a2a2a',
            background: 'transparent',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          + New Automation
        </NavLink>
      </nav>

      <div style={{ padding: '14px 12px', borderTop: '1px solid #141414' }}>
        {user && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0a0a0a', border: '1px solid #141414' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#555',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 2,
              }}
            >
              {user.email}
            </div>
            <button
              onClick={handleLogout}
              style={{
                marginTop: 10,
                fontSize: 12,
                color: '#a0a0a0',
                padding: 0,
              }}
            >
              Sign out →
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      {isMobile && (
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: '#000',
            borderBottom: '1px solid #141414',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: '#fff',
                color: '#000',
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              C
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>ChatIQ</span>
          </div>
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              border: '1px solid #1a1a1a',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </header>
      )}

      {sidebar}

      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      <main
        style={{
          marginLeft: isMobile ? 0 : sidebarWidth,
          minHeight: '100vh',
          padding: isMobile ? '20px 16px 48px' : '40px 48px',
          maxWidth: '100%',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
