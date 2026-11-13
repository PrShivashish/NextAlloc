import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  History,
  FlaskConical,
  RefreshCcw,
  ScrollText,
  Compass,
  Cpu,
  User,
  Briefcase,
  Building2,
  LogOut,
  Gauge,
  ShieldCheck,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { LogoMark } from './Logo';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', end: true, label: 'Command center', icon: LayoutDashboard },
  { to: '/admin/verification', label: 'Verification & NOCs', icon: ShieldCheck },
  { to: '/admin/scenarios', label: 'Scenarios & dataset', icon: Database },
  { to: '/admin/runs', label: 'Allocation runs', icon: History },
  { to: '/admin/whatif', label: 'Policy lab (What-if)', icon: FlaskConical },
  { to: '/admin/reallocation', label: 'Reallocation', icon: RefreshCcw },
  { to: '/admin/audit', label: 'Audit trail', icon: ScrollText },
  { to: '/admin/judge', label: 'Judge walkthrough', icon: Compass },
  { to: '/admin/technical', label: 'System health', icon: Cpu },
];

const CAND_NAV: NavItem[] = [
  { to: '/candidate', end: true, label: 'My dashboard', icon: LayoutDashboard },
  { to: '/candidate/explore', label: 'Explore opportunities', icon: Briefcase },
  { to: '/candidate/analytics', label: 'My fit analytics', icon: Gauge },
  { to: '/candidate/profile', label: 'My profile', icon: User },
];

const PROV_NAV: NavItem[] = [
  { to: '/provider', end: true, label: 'Provider overview', icon: LayoutDashboard },
  { to: '/provider/opportunities', label: 'My opportunities', icon: Building2 },
];

export default function Shell() {
  const { me, logout } = useAuth();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const nav: NavItem[] =
    me?.role === 'ADMIN' ? ADMIN_NAV : me?.role === 'PROVIDER' ? PROV_NAV : CAND_NAV;
  const homePath =
    me?.role === 'ADMIN' ? '/admin' : me?.role === 'PROVIDER' ? '/provider' : '/candidate';
  const roleLabel =
    me?.role === 'ADMIN' ? 'Admin' : me?.role === 'PROVIDER' ? 'Provider' : 'Candidate';
  const sectionLabel =
    me?.role === 'ADMIN'
      ? 'Administration'
      : me?.role === 'PROVIDER'
        ? 'Organization'
        : 'Workspace';

  const displayName = me?.name || me?.email || 'Account';
  const initial = displayName.slice(0, 1).toUpperCase();

  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const closeDrawer = () => {
    setMobileOpen(false);
    hamburgerRef.current?.focus();
  };

  return (
    <div className="na-shell">
      <header className="na-mobile-header">
        <div className="na-mobile-header-left">
          <button
            ref={hamburgerRef}
            type="button"
            className="na-hamburger"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="na-sidebar"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <NavLink to={homePath} className="na-brand-link" aria-label="NextAlloc home">
            <LogoMark height={28} />
          </NavLink>
        </div>
        <span className="na-role-pill">{roleLabel}</span>
      </header>

      <aside
        id="na-sidebar"
        className={`na-sidebar${mobileOpen ? ' is-open' : ''}`}
        aria-label="Sidebar navigation"
      >
        <div className="na-sidebar-header">
          <NavLink to={homePath} className="na-brand-link" aria-label="NextAlloc home">
            <span className="na-brand-full">
              <LogoMark height={30} />
            </span>
            <span className="na-brand-compact" aria-hidden="true">
              NA
            </span>
          </NavLink>
          <button
            type="button"
            className="na-sidebar-close"
            aria-label="Close navigation menu"
            onClick={closeDrawer}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="na-sidebar-nav" aria-label="Primary navigation">
          <div className="na-nav-section-label">{sectionLabel}</div>
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                aria-label={item.label}
                className={({ isActive }) => `na-nav-item${isActive ? ' is-active' : ''}`}
              >
                <Icon className="na-nav-icon" aria-hidden="true" />
                <span className="na-nav-label">{item.label}</span>
                <span className="na-nav-tooltip" role="tooltip">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="na-sidebar-footer">
          <div className="na-user-row">
            <div className="na-avatar" aria-hidden="true">
              {initial}
            </div>
            <div className="na-user-meta">
              <div className="na-user-name" title={me?.email || me?.name || ''}>
                {displayName}
              </div>
              <span className="na-role-pill">{roleLabel}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="na-icon-btn"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`na-sidebar-backdrop${mobileOpen ? ' is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <main className="na-main">
        <div className="na-container na-main-content">
          <Outlet />
        </div>
        <footer className="na-container na-main-footer">
          <span>Smart India Hackathon 2026 (SIH25033)</span>
          <span>Demonstration build with synthetic data</span>
        </footer>
      </main>
    </div>
  );
}
