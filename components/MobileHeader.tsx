import React from 'react';
import { Bell, Moon, Sun, Search, Menu } from 'lucide-react';
import logo from '../images/logo.png';
import { useLanguage } from '../i18n';
import { User } from '../types';
import HapticService from '../services/hapticService';
import SoundService from '../services/soundService';

interface MobileHeaderProps {
  user: User;
  darkMode: boolean;
  toggleDarkMode: () => void;
  notifCount: number;
  onNotifClick: () => void;
  onMenuClick: () => void;
  pendingApprovals?: number;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  user,
  darkMode,
  toggleDarkMode,
  notifCount,
  onNotifClick,
  onMenuClick,
  pendingApprovals = 0,
}) => {
  const { t, isRTL } = useLanguage();

  const displayName =
    (user as any)?.displayName?.split(' ')[0] ||
    user?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'User';

  const totalBadge = notifCount + pendingApprovals;

  return (
    <header
      className="mobile-app-header md:hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Left: Hamburger + Brand */}
      <div className="mobile-header-left">
        <button
          className="mobile-header-icon-btn"
          onClick={() => {
            SoundService.play('open');
            HapticService.medium();
            onMenuClick();
          }}
          aria-label="Menu"
        >
          <Menu size={22} strokeWidth={2.2} />
          {pendingApprovals > 0 && (
            <span className="mobile-header-badge">{pendingApprovals}</span>
          )}
        </button>

        <div className="mobile-header-brand">
          <div className="mobile-header-logo">
            <img
              src={logo}
              alt="Amlak"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/logo.png';
              }}
            />
          </div>
          <div className="mobile-header-title-wrap">
            <span className="mobile-header-title">{t('app.title')}</span>
            <span className="mobile-header-greeting">
              {t('app.welcome')}, {displayName}
            </span>
          </div>
        </div>
      </div>

      {/* Right: actions */}
      <div className="mobile-header-right">
        <button
          className="mobile-header-icon-btn"
          onClick={() => {
            HapticService.light();
            toggleDarkMode();
          }}
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun size={19} strokeWidth={2} /> : <Moon size={19} strokeWidth={2} />}
        </button>

        <button
          className="mobile-header-icon-btn"
          onClick={() => {
            SoundService.play('notification');
            HapticService.light();
            onNotifClick();
          }}
          aria-label="Notifications"
        >
          <Bell size={19} strokeWidth={2} />
          {totalBadge > 0 && (
            <span className="mobile-header-badge">{totalBadge > 99 ? '99+' : totalBadge}</span>
          )}
        </button>

        <div className="mobile-header-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
