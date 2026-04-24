import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, History, Briefcase, MoreHorizontal, FileSignature, Users, Grid3X3 } from 'lucide-react';
import SoundService from '../services/soundService';
import HapticService from '../services/hapticService';
import { User, UserRole } from '../types';
import { useLanguage } from '../i18n';

interface BottomNavProps {
  user: User;
  onMenuClick: () => void;
  pendingApprovals?: number;
}

const BottomNav: React.FC<BottomNavProps> = ({ user, onMenuClick, pendingApprovals = 0 }) => {
  const { t, isRTL } = useLanguage();
  const isAdmin = user.role === UserRole.ADMIN;
  const isEngineer = user.role === UserRole.ENGINEER;
  const engineerOnly = isEngineer && !isAdmin;

  const items = engineerOnly
    ? [
        { to: '/', icon: LayoutDashboard, label: t('nav.home') },
        { to: '/stocks', icon: Briefcase, label: t('nav.stocks'), primary: true },
        { to: '/contracts', icon: FileSignature, label: t('nav.contracts') },
        { to: '/history', icon: History, label: t('nav.history') },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: t('nav.home') },
        { to: '/history', icon: History, label: t('nav.history') },
        { to: '/entry', icon: PlusCircle, label: t('nav.entry'), primary: true },
        { to: '/contracts', icon: FileSignature, label: t('nav.contracts') },
        { to: '/customers', icon: Users, label: t('nav.customers') },
      ];

  return (
    <nav
      className="bnav-wrap"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-label="Main navigation"
    >
      <ul className="bnav-list">
        {items.map(({ to, icon: Icon, label, primary }) =>
          primary ? (
            <li key={to} className="bnav-item bnav-item--fab">
              <NavLink
                to={to}
                onClick={() => { SoundService.play('nav'); HapticService.medium(); }}
                className={({ isActive }) => `bnav-fab${isActive ? ' is-active' : ''}`}
                aria-label={label}
              >
                <Icon size={26} strokeWidth={2.5} />
                <span className="bnav-fab-label">{label}</span>
              </NavLink>
            </li>
          ) : (
            <li key={to} className="bnav-item">
              <NavLink
                to={to}
                end={to === '/'}
                onClick={() => { SoundService.play('nav'); HapticService.light(); }}
                className={({ isActive }) => `bnav-link${isActive ? ' is-active' : ''}`}
              >
                {({ isActive }) => (
                  <>
                    <span className="bnav-icon-wrap">
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                      {isActive && <span className="bnav-active-dot" />}
                    </span>
                    <span className="bnav-label">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        )}

        {/* More / Menu */}
        <li className="bnav-item">
          <button
            onClick={() => { SoundService.play('open'); HapticService.medium(); onMenuClick(); }}
            className="bnav-link bnav-menu-btn"
            aria-label={t('nav.menu')}
          >
            <span className="bnav-icon-wrap" style={{ position: 'relative' }}>
              <Grid3X3 size={22} strokeWidth={2} />
              {pendingApprovals > 0 && (
                <span className="bnav-badge">{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>
              )}
            </span>
            <span className="bnav-label">{t('nav.menu')}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default BottomNav;
