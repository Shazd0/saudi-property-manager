import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  X, LayoutDashboard, PlusCircle, History, Users, Building, UserCheck,
  FileSignature, CalendarDays, Briefcase, ClipboardList, PieChart,
  Car, Bell, ArrowRightLeft, Receipt, FolderOpen, Info, Upload, Settings,
  MessageCircle, Calculator, ChevronRight, Home, Search, BookOpen,
  LogOut, Package, Landmark, ClipboardCheck, BarChart3, FileText,
  Crown, Fingerprint, ShieldAlert, MapPin, Zap, Shield, MessageSquare,
  Banknote, CreditCard, FileCheck, BookMarked, Layers, Scale,
  TrendingUp, TrendingDown, DollarSign, Globe,
} from 'lucide-react';
import SoundService from '../services/soundService';
import HapticService from '../services/hapticService';
import logo from '../images/logo.png';
import { User, UserRole } from '../types';
import { useLanguage } from '../i18n';
import { useBook } from '../contexts/BookContext';

interface MobileMenuProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
  pendingApprovals?: number;
}

const LOGO_URL = logo || '/images/logo.png';

const MobileMenu: React.FC<MobileMenuProps> = ({ user, isOpen, onClose, onLogout, pendingApprovals = 0 }) => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({
    main: true, data: false, analytics: false, accounting: false,
    ops: false, compliance: false, integrations: false, settings: false,
  }));

  const toggleSection = (key: string) => {
    HapticService.selection();
    SoundService.play('toggle');
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const storedPhoto = localStorage.getItem(`profilePhoto_${user.id}`);
    if (storedPhoto) {
      setUserPhotoURL(storedPhoto);
    } else if (user.photoURL && !user.photoURL.startsWith('localStorage:')) {
      setUserPhotoURL(user.photoURL);
    }
    const handlePhotoUpdate = (event: any) => {
      if (event.detail.userId === user.id) {
        setUserPhotoURL(event.detail.photoURL);
      }
    };
    window.addEventListener('profilePhotoUpdated', handlePhotoUpdate);
    return () => window.removeEventListener('profilePhotoUpdated', handlePhotoUpdate);
  }, [user.id]);

  const isAdmin = user.role === UserRole.ADMIN;
  const isEngineer = user.role === UserRole.ENGINEER;
  const isManager = user.role === UserRole.MANAGER;
  const engineerOnly = isEngineer && !isAdmin;
  const { books, activeBook, switchBook } = useBook();

  const go = (to: string) => {
    SoundService.play('nav');
    HapticService.light();
    navigate(to);
    onClose();
  };

  // Search-filtered routes
  const allRoutes = useMemo(() => {
    const base = [
      { to: '/', icon: Home, label: t('nav.dashboard'), section: 'main' },
      { to: '/tasks', icon: ClipboardList, label: t('nav.tasks'), section: 'main' },
      { to: '/calendar', icon: CalendarDays, label: t('nav.calendar'), section: 'main' },
      { to: '/entry', icon: PlusCircle, label: t('nav.addEntry'), section: 'main' },
      { to: '/bulk-rent', icon: Upload, label: t('nav.bulkRent'), section: 'main' },
      { to: '/history', icon: History, label: t('nav.transactions'), section: 'main' },
      { to: '/contracts', icon: FileSignature, label: t('nav.contracts'), section: 'main' },
      { to: '/customers', icon: Users, label: t('nav.customers'), section: 'data' },
      { to: '/properties', icon: Building, label: t('nav.properties'), section: 'data' },
      { to: '/vendors', icon: Briefcase, label: t('nav.vendors'), section: 'data' },
      { to: '/directory', icon: FolderOpen, label: t('nav.directory'), section: 'data' },
      { to: '/registry', icon: Car, label: t('nav.carRegistry'), section: 'data' },
      { to: '/service-agreements', icon: FileText, label: t('nav.agreements'), section: 'data' },
      { to: '/monitoring', icon: PieChart, label: t('nav.monitoring'), section: 'analytics' },
      { to: '/reports', icon: BarChart3, label: t('nav.reports'), section: 'analytics' },
      { to: '/vat-report', icon: Receipt, label: t('nav.vatReport'), section: 'analytics' },
      { to: '/accounting', icon: Calculator, label: t('nav.accountingOverview'), section: 'accounting' },
      { to: '/accounting/chart', icon: BookMarked, label: t('nav.chartOfAccounts'), section: 'accounting' },
      { to: '/accounting/journal', icon: BookOpen, label: t('nav.journalEntries'), section: 'accounting' },
      { to: '/accounting/ledger', icon: Layers, label: t('nav.generalLedger'), section: 'accounting' },
      { to: '/accounting/trial', icon: Scale, label: t('nav.trialBalance'), section: 'accounting' },
      { to: '/accounting/income', icon: TrendingUp, label: t('nav.incomeStatement'), section: 'accounting' },
      { to: '/accounting/balance', icon: Landmark, label: t('nav.balanceSheet'), section: 'accounting' },
      { to: '/accounting/cashflow', icon: DollarSign, label: t('nav.cashFlow'), section: 'accounting' },
      { to: '/accounting/payables', icon: TrendingDown, label: t('nav.accountsPayable'), section: 'accounting' },
      { to: '/accounting/receivables', icon: TrendingUp, label: t('nav.accountsReceivable'), section: 'accounting' },
      { to: '/accounting/aging', icon: CalendarDays, label: t('nav.agingReport'), section: 'accounting' },
      { to: '/accounting/budget', icon: BarChart3, label: t('nav.budgetVsActual'), section: 'accounting' },
      { to: '/transfers', icon: ArrowRightLeft, label: t('nav.treasury'), section: 'ops' },
      { to: '/borrowings', icon: Landmark, label: t('nav.borrowings'), section: 'ops' },
      { to: '/stocks', icon: Package, label: t('nav.stockManagement'), section: 'ops' },
      { to: '/chat', icon: MessageCircle, label: t('nav.staffChat'), section: 'ops' },
      { to: '/ejar', icon: FileCheck, label: t('nav.ejarPlatform'), section: 'compliance' },
      { to: '/municipality-licenses', icon: Landmark, label: t('nav.municipality'), section: 'compliance' },
      { to: '/civil-defense', icon: ShieldAlert, label: t('nav.civilDefense'), section: 'compliance' },
      { to: '/absher', icon: MapPin, label: t('nav.absher'), section: 'compliance' },
      { to: '/sadad', icon: CreditCard, label: t('nav.sadadBills'), section: 'integrations' },
      { to: '/utilities', icon: Zap, label: t('nav.utilities'), section: 'integrations' },
      { to: '/security-deposits', icon: Shield, label: t('nav.deposits'), section: 'integrations' },
      { to: '/whatsapp', icon: MessageSquare, label: t('nav.whatsapp'), section: 'integrations' },
      { to: '/bank-reconciliation', icon: Banknote, label: t('nav.bankRecon'), section: 'integrations' },
      { to: '/settings', icon: Settings, label: t('nav.profileSettings'), section: 'settings' },
      { to: '/help', icon: Info, label: t('nav.helpGuide'), section: 'settings' },
      { to: '/about', icon: Info, label: t('nav.about'), section: 'settings' },
    ];
    if (isAdmin || isManager) {
      base.push(
        { to: '/approvals', icon: ClipboardCheck, label: t('nav.approvals'), section: 'main' },
        { to: '/owner-portal', icon: Crown, label: t('nav.ownerPortal'), section: 'ops' },
        { to: '/staff', icon: UserCheck, label: t('nav.staffPortfolio'), section: 'ops' },
      );
    }
    if (isAdmin) {
      base.push(
        { to: '/admin/employees', icon: UserCheck, label: t('nav.staff'), section: 'settings' },
        { to: '/admin/settings', icon: Settings, label: t('nav.systemSettings'), section: 'settings' },
        { to: '/admin/bulk-import', icon: Upload, label: t('nav.bulkImport'), section: 'settings' },
        { to: '/admin/backup', icon: FolderOpen, label: t('nav.localBackup'), section: 'settings' },
        { to: '/admin/cloud-backup', icon: BookOpen, label: t('nav.cloudBackup'), section: 'settings' },
        { to: '/admin/books', icon: BookOpen, label: t('nav.booksPartitions'), section: 'settings' },
      );
    }
    return base;
  }, [isAdmin, isManager, t]);

  const filteredRoutes = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return allRoutes;
    return allRoutes.filter(r => r.label.toLowerCase().includes(q));
  }, [menuSearch, allRoutes]);

  // Quick access tiles (top row)
  const quickTiles = engineerOnly
    ? [
        { to: '/', icon: Home, label: t('nav.home'), color: 'emerald' },
        { to: '/stocks', icon: Package, label: t('nav.stocks'), color: 'blue' },
        { to: '/contracts', icon: FileSignature, label: t('nav.contracts'), color: 'violet' },
        { to: '/history', icon: History, label: t('nav.history'), color: 'amber' },
      ]
    : [
        { to: '/', icon: Home, label: t('nav.home'), color: 'emerald' },
        { to: '/entry', icon: PlusCircle, label: t('nav.entry'), color: 'blue' },
        { to: '/contracts', icon: FileSignature, label: t('nav.contracts'), color: 'violet' },
        { to: '/history', icon: History, label: t('nav.history'), color: 'amber' },
        { to: '/customers', icon: Users, label: t('nav.customers'), color: 'rose' },
        { to: '/accounting', icon: Calculator, label: t('nav.accounting'), color: 'teal' },
      ];

  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    violet: 'from-violet-500 to-violet-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    teal: 'from-teal-500 to-teal-600',
  };

  type SectionKey = 'main' | 'data' | 'analytics' | 'accounting' | 'ops' | 'compliance' | 'integrations' | 'settings';
  const sections: { key: SectionKey; label: string; icon: any }[] = [
    { key: 'main', label: t('nav.menu'), icon: Home },
    { key: 'data', label: t('nav.database'), icon: FolderOpen },
    { key: 'analytics', label: t('nav.analytics'), icon: PieChart },
    { key: 'accounting', label: t('nav.accounting'), icon: Calculator },
    { key: 'ops', label: t('nav.operations'), icon: ArrowRightLeft },
    { key: 'compliance', label: t('nav.compliance') || 'Compliance', icon: ShieldAlert },
    { key: 'integrations', label: t('nav.integrations') || 'Integrations', icon: Zap },
    { key: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const NavRow = ({ route }: { route: typeof allRoutes[0] }) => {
    const Icon = route.icon;
    return (
      <NavLink
        to={route.to}
        onClick={() => { SoundService.play('nav'); HapticService.light(); onClose(); }}
        className={({ isActive }) =>
          `mmenu-row${isActive ? ' is-active' : ''}`
        }
        end={route.to === '/'}
      >
        {({ isActive }) => (
          <>
            <span className={`mmenu-row-icon${isActive ? ' is-active' : ''}`}>
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            </span>
            <span className="mmenu-row-label">{route.label}</span>
            {isActive && <span className="mmenu-row-active-pip" />}
          </>
        )}
      </NavLink>
    );
  };

  if (!isOpen) return null;

  const searchActive = menuSearch.trim().length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="mmenu-backdrop"
        onClick={() => { SoundService.play('close'); HapticService.light(); onClose(); }}
      />

      {/* Drawer */}
      <div
        className={`mmenu-drawer${isRTL ? ' is-rtl' : ''}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Top drag handle */}
        <div className="mmenu-handle" />

        {/* Header: user profile */}
        <div className="mmenu-header">
          {/* Brand bar */}
          <div className="mmenu-brand-bar">
            <img
              src={LOGO_URL}
              alt=""
              className="mmenu-brand-logo"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span className="mmenu-brand-name">AMLAK</span>
            <button
              onClick={() => { SoundService.play('close'); HapticService.light(); onClose(); }}
              className="mmenu-close-btn"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* User card */}
          <div className="mmenu-user-card">
            {userPhotoURL ? (
              <img src={userPhotoURL} alt={user.name} className="mmenu-avatar-img" />
            ) : (
              <div className="mmenu-avatar-placeholder">
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="mmenu-user-info">
              <p className="mmenu-user-name">{user?.name || user?.email || 'User'}</p>
              <p className="mmenu-user-role">{user.role}</p>
            </div>
          </div>

          {/* Search */}
          <div className="mmenu-search-wrap">
            <Search size={15} className="mmenu-search-icon" />
            <input
              type="search"
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              placeholder={t('common.search') || 'Search...'}
              className="mmenu-search-input"
            />
          </div>
        </div>

        {/* Quick tiles */}
        {!searchActive && (
          <div className="mmenu-quick-section">
            <p className="mmenu-section-label">{t('nav.quickAccess') || 'Quick Access'}</p>
            <div className="mmenu-tiles">
              {quickTiles.map(tile => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.to}
                    type="button"
                    onClick={() => go(tile.to)}
                    className="mmenu-tile"
                  >
                    <span className={`mmenu-tile-icon bg-gradient-to-br ${colorMap[tile.color]}`}>
                      <Icon size={18} strokeWidth={2.2} />
                    </span>
                    <span className="mmenu-tile-label">{tile.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Books selection */}
        {!searchActive && isAdmin && (
          <div className="mmenu-books-section">
            <p className="mmenu-section-label">{t('nav.booksPartitions') || 'Books'}</p>
            {books.length > 1 && (
              <select
                value={activeBook.id}
                onChange={e => { switchBook(e.target.value); SoundService.play('toggle'); HapticService.selection(); }}
                className="mmenu-books-select"
              >
                {books.map(book => (
                  <option key={book.id} value={book.id}>{book.name}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => go('/admin/books')}
              className="mmenu-row mt-1"
            >
              <span className="mmenu-row-icon"><BookOpen size={16} /></span>
              <span className="mmenu-row-label">{t('nav.booksPartitions') || 'Manage Books'}</span>
            </button>
          </div>
        )}

        {/* Search results OR sectioned nav */}
        <div className="mmenu-nav">
          {searchActive ? (
            <div className="mmenu-section">
              <p className="mmenu-section-label">{t('common.results') || 'Results'}</p>
              {filteredRoutes.length === 0 ? (
                <p className="mmenu-no-results">{t('common.noResults') || 'No results found'}</p>
              ) : (
                filteredRoutes.map(r => <NavRow key={r.to} route={r} />)
              )}
            </div>
          ) : (
            sections.map(sec => {
              const sectionRoutes = allRoutes.filter(r => r.section === sec.key);
              if (sectionRoutes.length === 0) return null;
              const SecIcon = sec.icon;
              const isExpanded = expandedSections[sec.key];
              return (
                <div key={sec.key} className={`mmenu-section${isExpanded ? ' is-expanded' : ''}`}>
                  <button
                    className="mmenu-section-toggle"
                    onClick={() => toggleSection(sec.key)}
                  >
                    <span className="mmenu-section-icon">
                      <SecIcon size={18} strokeWidth={2} />
                    </span>
                    <span className="mmenu-section-title">{sec.label}</span>
                    <ChevronRight
                      size={16}
                      className={`mmenu-chevron${isExpanded ? ' is-open' : ''}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="mmenu-section-rows">
                      {sectionRoutes.map(r => <NavRow key={r.to} route={r} />)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pending approvals notice */}
        {pendingApprovals > 0 && (
          <button
            type="button"
            onClick={() => go('/approvals')}
            className="mmenu-approvals-banner"
          >
            <Bell size={16} />
            <span>
              {pendingApprovals} {t('nav.pendingApprovals') || 'pending approval(s)'}
            </span>
            <ChevronRight size={14} className="ml-auto" />
          </button>
        )}

        {/* Footer: language toggle + logout */}
        <div className="mmenu-footer">
          <button
            type="button"
            onClick={() => { SoundService.play('toggle'); HapticService.medium(); }}
            className="mmenu-footer-btn"
          >
            <Globe size={16} />
            <span>{t('common.language') || 'Language'}</span>
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={() => { SoundService.play('swoosh'); HapticService.heavy(); onClose(); onLogout(); }}
              className="mmenu-footer-btn mmenu-footer-btn--danger"
            >
              <LogOut size={16} />
              <span>{t('common.logout') || 'Logout'}</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
