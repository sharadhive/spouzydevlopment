import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import ChangePasswordModal from './ChangePasswordModal';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const mustChange = !!user?.must_change_password;
  const location = useLocation();

  // Desktop: full menu at the top of the page; after scrolling down it shrinks to icons only
  // (the page gets the extra width). Pointing at the icons opens the full menu over the page.
  const [rail, setRail] = useState(false);
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef(null);

  useEffect(() => {
    let queued = false;
    const update = () => {
      queued = false;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      // collapse after 80px, open again near the top; short pages never collapse (no flicker)
      setRail(prev => (prev ? y > 16 : y > 80 && room > 240));
    };
    const onScroll = () => { if (!queued) { queued = true; window.requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  // A new section opens at the top (and the full menu comes back)
  useEffect(() => {
    setPeek(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => { if (!rail) setPeek(false); }, [rail]);
  useEffect(() => () => clearTimeout(peekTimer.current), []);

  const openPeek = () => {
    if (!rail) return;
    clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => setPeek(true), 90);
  };
  const closePeek = () => {
    clearTimeout(peekTimer.current);
    setPeek(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const closeMobileMenu = () => { setMobileMenuOpen(false); closePeek(); };

  // Safely format role name using validated string from normalization adapter
  const displayRole = (user?.role?.name || user?.roleName || 'Staff').toUpperCase();

  // Role permissions checking helpers
  const canSeeOperationalDashboard = user && (user.isAdmin || ['enquiries:view', 'clinical_apps:view', 'careers:view', 'appointments:view'].some(p => user.can(p)));
  const canSeeContentDashboard = user && (user.isAdmin || user.can('content:view') || user.can('blogs:view') || user.can('moderation:view'));
  const canSeeEnquiries = user && user.can('enquiries:view');
  const canSeeClinical = user && user.can('clinical_apps:view');
  const canSeeCareers = user && user.can('careers:view');
  const canSeeAppointments = user && user.can('appointments:view');
  const canSeeShop = user && (user.can('orders:view') || user.can('packages:view') || user.can('offers:view'));
  const canSeeContent = user && (user.can('content:view') || user.can('blogs:view') || user.can('moderation:view'));
  const canSeeSettings = user && (user.can('settings:content') || user.can('settings:gateway'));
  const canSeeUsers = user && (user.isAdmin || user.can('users:manage'));
  const canSeeVerifications = user && user.can('verifications:view');

  return (
    <div className={`sp-admin-layout ${mobileMenuOpen ? 'mobile-nav-open' : ''} ${rail ? 'is-rail' : ''} ${peek ? 'is-peek' : ''}`}>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="sp-sidebar-backdrop" 
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sp-admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}
        onMouseEnter={openPeek}
        onMouseLeave={closePeek}
        onFocus={openPeek}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) closePeek(); }}
      >
        <div className="sp-sidebar-brand">
          <img src="/image/spouzy.png" alt="SPOUZY" />
          <div className="sp-brand-text">
            <h1>SPOUZY</h1>
            <span>MANAGEMENT CONSOLE</span>
          </div>
          <button 
            type="button" 
            className="sp-mobile-close-btn"
            onClick={closeMobileMenu}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>

        <nav className="sp-sidebar-nav">
          {/* Main Dashboard / Content Hub Link */}
          {canSeeOperationalDashboard && (
            <NavLink to="/" end onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-th-large" aria-hidden="true"></i><span className="sp-nav-label">Dashboard</span></span>
            </NavLink>
          )}

          {canSeeContentDashboard && (!canSeeOperationalDashboard || user?.isAdmin) && (
            <NavLink to="/content-dashboard" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-dashboard" aria-hidden="true"></i><span className="sp-nav-label">Content Hub</span></span>
            </NavLink>
          )}

          {/* Operational Modules */}
          {canSeeEnquiries && (
            <NavLink to="/enquiries" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-envelope-open-o" aria-hidden="true"></i><span className="sp-nav-label">Enquiries CRM</span></span>
            </NavLink>
          )}

          {canSeeClinical && (
            <NavLink to="/clinical" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-user-md" aria-hidden="true"></i><span className="sp-nav-label">Clinical Staff</span></span>
            </NavLink>
          )}

          {canSeeCareers && (
            <NavLink to="/careers" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-briefcase" aria-hidden="true"></i><span className="sp-nav-label">Careers Desk</span></span>
            </NavLink>
          )}

          {canSeeAppointments && (
            <NavLink to="/appointments" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-calendar-check-o" aria-hidden="true"></i><span className="sp-nav-label">Appointments</span></span>
            </NavLink>
          )}

          {canSeeEnquiries && (
            <NavLink to="/chats" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-comments" aria-hidden="true"></i><span className="sp-nav-label">Website Chat</span></span>
            </NavLink>
          )}

          {canSeeShop && (
            <NavLink to="/shop" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-shopping-bag" aria-hidden="true"></i><span className="sp-nav-label">Packages, Bills &amp; Orders</span></span>
            </NavLink>
          )}

          {canSeeVerifications && (
            <NavLink to="/verifications" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-id-card-o" aria-hidden="true"></i><span className="sp-nav-label">Student &amp; Ex-servicemen IDs</span></span>
            </NavLink>
          )}

          {/* Content & Settings Modules */}
          {canSeeContent && (
            <NavLink to="/content" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-newspaper-o" aria-hidden="true"></i><span className="sp-nav-label">Content &amp; Media</span></span>
            </NavLink>
          )}

          {canSeeSettings && (
            <NavLink to="/settings" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-sliders" aria-hidden="true"></i><span className="sp-nav-label">{user?.can('settings:gateway') ? 'Settings & Gateway' : 'Site Settings'}</span></span>
            </NavLink>
          )}

          {/* Administration & Staff Logs */}
          {canSeeUsers && (
            <NavLink to="/users" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
              <span className="sp-nav-inner"><i className="fa fa-users" aria-hidden="true"></i><span className="sp-nav-label">Staff &amp; Audit Logs</span></span>
            </NavLink>
          )}

          {/* Notifications for everyone (each person sees what their role allows) */}
          <NavLink to="/notifications" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
            <span className="sp-nav-inner"><i className="fa fa-bell-o" aria-hidden="true"></i><span className="sp-nav-label">Notifications</span></span>
          </NavLink>

          {/* Help for everyone */}
          <NavLink to="/guide" onClick={closeMobileMenu} className={({ isActive }) => `sp-nav-item ${isActive ? 'active' : ''}`}>
            <span className="sp-nav-inner"><i className="fa fa-book" aria-hidden="true"></i><span className="sp-nav-label">Admin Guide</span></span>
          </NavLink>
        </nav>
      </aside>

      {/* Main Area */}
      <div className="sp-admin-main">
        <header className="sp-admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              type="button" 
              className="sp-mobile-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              <i className="fa fa-bars"></i>
            </button>
            <div className="sp-header-title">
              Problem Solver Group (PSG) &middot; SPOUZY Clinical Panel
            </div>
          </div>

          <div className="sp-user-badge">
            <NotificationBell />
            <span className="sp-role-pill">{displayRole}</span>
            <div className="sp-avatar">
              {(user?.name ? user.name.charAt(0) : 'U').toUpperCase()}
            </div>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>
              {user?.name || 'Staff User'}
            </span>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="sp-btn sp-btn-secondary"
              style={{ padding: '5px 10px', fontSize: '12px' }}
              title="Change password"
            >
              <i className="fa fa-key"></i>
            </button>
            <button 
              type="button" 
              onClick={handleLogout} 
              className="sp-btn sp-btn-secondary" 
              style={{ padding: '5px 10px', fontSize: '12px' }}
              title="Sign out"
            >
              <i className="fa fa-sign-out"></i>
            </button>
          </div>
        </header>

        <main className="sp-admin-content">
          {mustChange && (
            <div className="sp-inline-alert info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <span><i className="fa fa-lock"></i> You are using a temporary password. Please set your own password now.</span>
              <button type="button" className="sp-btn sp-btn-primary sp-btn-sm" onClick={() => setPasswordOpen(true)}>Change password</button>
            </div>
          )}
          <ChangePasswordModal isOpen={passwordOpen || false} forced={false} onClose={() => setPasswordOpen(false)} />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
