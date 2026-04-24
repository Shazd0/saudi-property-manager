import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  FileSignature,
  Users,
  Building2,
  Calculator,
  Briefcase,
} from 'lucide-react';
import SoundService from '../services/soundService';
import HapticService from '../services/hapticService';
import { User, UserRole } from '../types';
import { useLanguage } from '../i18n';

interface MobileTabStripProps {
  user: User;
}

const MobileTabStrip: React.FC<MobileTabStripProps> = ({ user }) => {
  const { t } = useLanguage();
  const isAdmin = user.role === UserRole.ADMIN;
  const isEngineer = user.role === UserRole.ENGINEER;
  const engineerOnly = isEngineer && !isAdmin;

  const tabs = engineerOnly
    ? [
        { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
        { to: '/stocks', icon: Briefcase, label: t('nav.stockManagement') },
        { to: '/contracts', icon: FileSignature, label: t('nav.contracts') },
        { to: '/history', icon: History, label: t('nav.transactions') },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
        { to: '/entry', icon: PlusCircle, label: t('nav.addEntry') },
        { to: '/contracts', icon: FileSignature, label: t('nav.contracts') },
        { to: '/history', icon: History, label: t('nav.transactions') },
        { to: '/customers', icon: Users, label: t('nav.customers') },
        { to: '/properties', icon: Building2, label: t('nav.properties') },
        { to: '/accounting', icon: Calculator, label: t('nav.accounting') },
      ];

  return (
    <div className="mobile-tab-strip md:hidden">
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => {
            SoundService.play('nav');
            HapticService.light();
          }}
          className={({ isActive }) =>
            `mobile-tab-pill ${isActive ? 'is-active' : ''}`
          }
        >
          <Icon size={14} className="shrink-0" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
};

export default MobileTabStrip;
