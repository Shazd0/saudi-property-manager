import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, History, Users, Settings, LogOut, Building, UserCheck, FileSignature, CalendarDays, Briefcase, ClipboardList, PieChart, Search, Car, Bell, ArrowRightLeft, Receipt, ChevronLeft, ChevronRight, FolderOpen, Info, ChevronDown, ChevronUp, Upload, MessageCircle, FileText, DollarSign, BarChart3, Crown, BookOpen, Fingerprint, Landmark, ShieldAlert, MapPin, Zap, Shield, MessageSquare, Banknote, CreditCard, FileCheck, Star, GripVertical, Pencil, Check, Plus, X, Calculator, Layers, Scale, TrendingDown, TrendingUp, BookMarked } from 'lucide-react';
import SoundService from '../services/soundService';
import { db } from '../firebase';
import logo from '../images/logo.png';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { User, UserRole } from '../types';
import { useLanguage } from '../i18n';
import LanguageToggle from './LanguageToggle';
import { useBook } from '../contexts/BookContext';

// Fallback logo URL if import fails
const LOGO_URL = logo || '/images/logo.png';

// ── Quick Access: all pinnable nav items ──────────────────────────────────
const ALL_QA_DEFS: { to: string; labelKey: string; icon: any }[] = [
  { to: '/',                  labelKey: 'nav.dashboard',    icon: LayoutDashboard },
  { to: '/properties',        labelKey: 'nav.properties',   icon: Building },
  { to: '/admin/employees',   labelKey: 'nav.staff',        icon: UserCheck },
  { to: '/customers',         labelKey: 'nav.customers',    icon: Users },
  { to: '/contracts',         labelKey: 'nav.contracts',    icon: FileSignature },
  { to: '/entry',             labelKey: 'nav.addEntry',     icon: PlusCircle },
  { to: '/history',           labelKey: 'nav.transactions', icon: History },
  { to: '/monitoring',        labelKey: 'nav.monitoring',   icon: PieChart },
  { to: '/tasks',             labelKey: 'nav.tasks',        icon: ClipboardList },
  { to: '/calendar',          labelKey: 'nav.calendar',     icon: CalendarDays },
  { to: '/transfers',         labelKey: 'nav.treasury',     icon: ArrowRightLeft },
  { to: '/reports',           labelKey: 'nav.reports',      icon: BarChart3 },
  { to: '/vat-report',        labelKey: 'nav.vatReport',    icon: Receipt },
  { to: '/accounting',        labelKey: 'nav.accounting',   icon: Calculator },
  { to: '/chat',              labelKey: 'nav.staffChat',    icon: MessageCircle },
  { to: '/sadad',             labelKey: 'nav.sadadBills',   icon: CreditCard },
  { to: '/approvals',         labelKey: 'nav.approvals',    icon: Bell },
  { to: '/bulk-rent',         labelKey: 'nav.bulkRent',     icon: Upload },
];

const DEFAULT_QA_ROUTES = [
  '/', '/properties', '/admin/employees', '/customers',
  '/contracts', '/entry', '/history', '/monitoring',
];

// ── All nav items for sidebar search ─────────────────────────────────────
const ALL_NAV_ITEMS: { to: string; labelKey: string; icon: any }[] = [
  { to: '/',                          labelKey: 'nav.dashboard',          icon: LayoutDashboard },
  { to: '/tasks',                     labelKey: 'nav.tasks',              icon: ClipboardList },
  { to: '/calendar',                  labelKey: 'nav.calendar',           icon: CalendarDays },
  { to: '/contracts',                 labelKey: 'nav.contracts',          icon: FileSignature },
  { to: '/entry',                     labelKey: 'nav.addEntry',           icon: PlusCircle },
  { to: '/bulk-rent',                 labelKey: 'nav.bulkRent',           icon: Upload },
  { to: '/history',                   labelKey: 'nav.transactions',       icon: History },
  { to: '/approvals',                 labelKey: 'nav.approvals',          icon: Bell },
  { to: '/customers',                 labelKey: 'nav.customers',          icon: Users },
  { to: '/directory',                 labelKey: 'nav.directory',          icon: FolderOpen },
  { to: '/registry',                  labelKey: 'nav.carRegistry',        icon: Car },
  { to: '/properties',                labelKey: 'nav.properties',         icon: Building },
  { to: '/vendors',                   labelKey: 'nav.vendors',            icon: Briefcase },
  { to: '/service-agreements',        labelKey: 'nav.agreements',         icon: FileText },
  { to: '/monitoring',                labelKey: 'nav.monitoring',         icon: PieChart },
  { to: '/reports',                   labelKey: 'nav.reports',            icon: BarChart3 },
  { to: '/vat-report',                labelKey: 'nav.vatReport',          icon: Receipt },
  { to: '/accounting',                labelKey: 'nav.accountingOverview', icon: Calculator },
  { to: '/accounting/chart',          labelKey: 'nav.chartOfAccounts',    icon: BookMarked },
  { to: '/accounting/journal',        labelKey: 'nav.journalEntries',     icon: BookOpen },
  { to: '/accounting/ledger',         labelKey: 'nav.generalLedger',      icon: Layers },
  { to: '/accounting/trial',          labelKey: 'nav.trialBalance',       icon: Scale },
  { to: '/accounting/income',         labelKey: 'nav.incomeStatement',    icon: TrendingUp },
  { to: '/accounting/balance',        labelKey: 'nav.balanceSheet',       icon: Landmark },
  { to: '/accounting/cashflow',       labelKey: 'nav.cashFlow',           icon: DollarSign },
  { to: '/accounting/payables',       labelKey: 'nav.accountsPayable',    icon: TrendingDown },
  { to: '/accounting/receivables',    labelKey: 'nav.accountsReceivable', icon: TrendingUp },
  { to: '/accounting/aging',          labelKey: 'nav.agingReport',        icon: CalendarDays },
  { to: '/accounting/budget',         labelKey: 'nav.budgetVsActual',     icon: BarChart3 },
  { to: '/transfers',                 labelKey: 'nav.treasury',           icon: ArrowRightLeft },
  { to: '/borrowings',                labelKey: 'nav.borrowings',         icon: Briefcase },
  { to: '/owner-portal',              labelKey: 'nav.ownerPortal',        icon: Crown },
  { to: '/staff',                     labelKey: 'nav.staffPortfolio',     icon: Users },
  { to: '/chat',                      labelKey: 'nav.staffChat',          icon: MessageCircle },
  { to: '/stocks',                    labelKey: 'nav.stockManagement',    icon: Briefcase },
  { to: '/ejar',                      labelKey: 'nav.ejarPlatform',       icon: FileCheck },
  { to: '/municipality-licenses',     labelKey: 'nav.municipality',       icon: Landmark },
  { to: '/civil-defense',             labelKey: 'nav.civilDefense',       icon: ShieldAlert },
  { to: '/absher',                    labelKey: 'nav.absher',             icon: MapPin },
  { to: '/sadad',                     labelKey: 'nav.sadadBills',         icon: CreditCard },
  { to: '/utilities',                 labelKey: 'nav.utilities',          icon: Zap },
  { to: '/security-deposits',         labelKey: 'nav.deposits',           icon: Shield },
  { to: '/whatsapp',                  labelKey: 'nav.whatsapp',           icon: MessageSquare },
  { to: '/bank-reconciliation',       labelKey: 'nav.bankRecon',          icon: Banknote },
  { to: '/settings',                  labelKey: 'nav.profileSettings',    icon: Settings },
  { to: '/admin/employees',           labelKey: 'nav.staff',              icon: UserCheck },
  { to: '/admin/settings',            labelKey: 'nav.systemSettings',     icon: Settings },
  { to: '/admin/bulk-import',         labelKey: 'nav.bulkImport',         icon: Upload },
  { to: '/admin/backup',              labelKey: 'nav.localBackup',        icon: FolderOpen },
  { to: '/admin/cloud-backup',        labelKey: 'nav.cloudBackup',        icon: FolderOpen },
  { to: '/admin/books',               labelKey: 'nav.booksPartitions',    icon: BookOpen },
  { to: '/help',                      labelKey: 'nav.helpGuide',          icon: Info },
  { to: '/about',                     labelKey: 'nav.about',              icon: Info },
];

// ── QuickAccessSection component ──────────────────────────────────────────
const QuickAccessSection: React.FC<{ userId: string; isCollapsed: boolean }> = ({
  userId,
  isCollapsed,
}) => {
  const { t } = useLanguage();
  const [qaRoutes, setQaRoutes] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(`qa_${userId}`);
      return s ? JSON.parse(s) : DEFAULT_QA_ROUTES;
    } catch {
      return DEFAULT_QA_ROUTES;
    }
  });
  const [minimized, setMinimized] = useState(() => {
    try { return localStorage.getItem(`qa_min_${userId}`) === '1'; } catch { return false; }
  });
  const [editMode, setEditMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(`qa_${userId}`, JSON.stringify(qaRoutes));
  }, [qaRoutes, userId]);

  useEffect(() => {
    localStorage.setItem(`qa_min_${userId}`, minimized ? '1' : '0');
  }, [minimized, userId]);

  const activeItems = qaRoutes
    .map(r => ALL_QA_DEFS.find(d => d.to === r))
    .filter((d): d is (typeof ALL_QA_DEFS)[0] => !!d);

  const removeRoute = (to: string) => setQaRoutes(prev => prev.filter(r => r !== to));
  const toggleRoute = (to: string) =>
    setQaRoutes(prev => prev.includes(to) ? prev.filter(r => r !== to) : [...prev, to]);

  const onDragStart = (idx: number) => { dragIdx.current = idx; };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setQaRoutes(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx.current!, 1);
      arr.splice(idx, 0, moved);
      dragIdx.current = idx;
      return arr;
    });
  };

  // Long-press activates edit mode on mobile
  const onTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setEditMode(true);
      try { navigator.vibrate(50); } catch {}
    }, 600);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  // ── Collapsed sidebar: icons only ────────────────────────────────────────
  if (isCollapsed) {
    return (
      <>
        <button
          type="button"
          onClick={() => { setMinimized(p => !p); SoundService.play('toggle'); }}
          className="flex justify-center w-full py-1 text-amber-400 hover:text-amber-500 transition-colors"
          title={minimized ? 'Expand Quick Access' : 'Minimize Quick Access'}
        >
          <Star size={12} className={minimized ? 'opacity-30' : 'fill-amber-300 opacity-80'} />
        </button>
        {!minimized && activeItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => SoundService.play('nav')}
            className={({ isActive }) =>
              `flex items-center justify-center px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-200/50'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
              }`
            }
            title={t(item.labelKey)}
          >
            <item.icon size={16} />
          </NavLink>
        ))}
        <div className="border-b border-emerald-100/60 my-2" />
      </>
    );
  }

  // ── Expanded sidebar ─────────────────────────────────────────────────────
  return (
    <div className="mb-1">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 mb-0.5">
        <button
          type="button"
          onClick={() => { setMinimized(p => !p); if (!minimized) { setEditMode(false); setPickerOpen(false); } SoundService.play('toggle'); }}
          title={minimized ? 'Expand Quick Access' : 'Minimize Quick Access'}
          className="flex items-center gap-1.5 flex-1 group min-w-0"
        >
          <Star size={12} className={`flex-shrink-0 transition-all ${ minimized ? 'text-amber-300 opacity-50' : 'text-amber-500 fill-amber-400'}`} />
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase group-hover:text-slate-500 transition-colors">
            Quick Access
          </span>
          <ChevronDown
            size={11}
            className={`ml-0.5 text-slate-300 group-hover:text-slate-400 transition-transform duration-200 flex-shrink-0 ${
              minimized ? '-rotate-90' : ''
            }`}
          />
        </button>
        {!minimized && (
          <button
            type="button"
            onClick={() => {
              const next = !editMode;
              setEditMode(next);
              if (!next) setPickerOpen(false);
              SoundService.play('toggle');
            }}
            title={editMode ? 'Done' : 'Customize Quick Access (long-press on mobile)'}
            className={`p-1 rounded transition-colors flex-shrink-0 ${
              editMode
                ? 'bg-amber-100 text-amber-600'
                : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'
            }`}
          >
            {editMode ? <Check size={12} /> : <Pencil size={12} />}
          </button>
        )}
      </div>

      {/* Items + edit controls — hidden when minimized */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: minimized ? 0 : 9999, opacity: minimized ? 0 : 1 }}
      >
      <div onTouchStart={onTouchStart} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress}>
        {activeItems.map((item, idx) => (
          <div
            key={item.to}
            draggable={editMode}
            onDragStart={() => onDragStart(idx)}
            onDragOver={e => onDragOver(e, idx)}
            onDragEnd={() => { dragIdx.current = null; }}
            className={`flex items-center rounded-lg mb-0.5 transition-all ${
              editMode ? 'bg-amber-50/70 ring-1 ring-amber-100/80' : ''
            }`}
          >
            {editMode && (
              <span className="pl-2 pr-0.5 cursor-grab text-slate-300 hover:text-slate-500 flex-shrink-0 select-none">
                <GripVertical size={13} />
              </span>
            )}
            {editMode ? (
              <div className="flex-1 flex items-center gap-3 px-3 py-2 text-slate-500 select-none">
                <item.icon size={15} className="flex-shrink-0 text-slate-400" />
                <span className="text-sm">{t(item.labelKey)}</span>
              </div>
            ) : (
              <NavLink
                to={item.to}
                onClick={() => SoundService.play('nav')}
                className={({ isActive }) =>
                  `flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-200/50 font-semibold'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                  }`
                }
              >
                <item.icon size={15} className="flex-shrink-0 transition-transform group-hover:scale-110" />
                <span className="text-sm">{t(item.labelKey)}</span>
              </NavLink>
            )}
            {editMode && (
              <button
                type="button"
                onClick={() => removeRoute(item.to)}
                title="Remove"
                className="pr-2 pl-1 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {activeItems.length === 0 && (
          <p className="text-xs text-slate-400 px-4 py-2 italic">No shortcuts pinned yet.</p>
        )}
      </div>

      {/* Edit-mode controls */}
      {editMode && (
        <div className="mt-1.5 space-y-1.5 px-0.5">
          <button
            type="button"
            onClick={() => { setPickerOpen(p => !p); SoundService.play('open'); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-600 hover:bg-amber-50 border border-dashed border-amber-200 transition-all"
          >
            <Plus size={12} />
            <span>Add shortcut</span>
            <ChevronDown
              size={11}
              className={`ml-auto transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {pickerOpen && (
            <div className="rounded-xl border border-amber-100 bg-white shadow-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">All pages</p>
              </div>
              <div className="max-h-52 overflow-y-auto scrollbar-hide divide-y divide-slate-50">
                {ALL_QA_DEFS.map(item => {
                  const pinned = qaRoutes.includes(item.to);
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => { toggleRoute(item.to); SoundService.play('toggle'); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs transition-colors ${
                        pinned
                          ? 'bg-amber-50/80 text-amber-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon size={13} className={pinned ? 'text-amber-500' : 'text-slate-400'} />
                      <span className="flex-1 text-left">{t(item.labelKey)}</span>
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                          pinned ? 'bg-amber-400 border-amber-400' : 'border-slate-200 bg-white'
                        }`}
                      >
                        {pinned && <Check size={9} className="text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => { setEditMode(false); setPickerOpen(false); SoundService.play('toggle'); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 shadow-sm transition-all"
          >
            <Check size={12} />{t('task.done')}</button>
        </div>
      )}

      </div>{/* end minimized wrapper */}

      <div className="border-b border-emerald-100/60 mt-2 mb-1" />
    </div>
  );
};

interface SidebarProps {
  user: User;
  onLogout: () => void;
  onToggleCollapse?: (isCollapsed: boolean) => void;
}

// NavItem component moved outside to prevent re-creation
const NavItem = ({ to, icon: Icon, label, badge, isCollapsed }: { to: string, icon: any, label: string, badge?: number, isCollapsed: boolean }) => (
  <NavLink
    to={to}
    onClick={() => SoundService.play('nav')}
    className={({ isActive }) =>
      `nav-item flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all mb-0.5 duration-200 group ${
        isActive ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-md shadow-emerald-200/50 font-semibold' : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-gray-800 hover:text-emerald-600 dark:hover:text-emerald-400'
      } ${isCollapsed ? 'px-3 justify-center' : 'ml-2'}`}
    title={isCollapsed ? label : ''}>
    <Icon size={16} className="flex-shrink-0 transition-transform group-hover:scale-110" />
    {!isCollapsed && <span className="text-sm">{label}</span>}
    {!isCollapsed && badge !== undefined && badge > 0 && (
      <span className="ml-auto text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-2 py-0.5 rounded-full shadow-lg">{badge}</span>
    )}
  </NavLink>
);

// MenuGroup component moved outside to prevent re-creation
const MenuGroup = ({ 
  menuKey, 
  label, 
  icon: Icon, 
  children,
  isExpanded,
  isCollapsed,
  onToggle
}: { 
  menuKey: string; 
  label: string; 
  icon: any; 
  children: React.ReactNode;
  isExpanded: boolean;
  isCollapsed: boolean;
  onToggle: (key: string) => void;
}) => {
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); SoundService.play('toggle'); onToggle(menuKey); }}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group
          ${isExpanded ? 'bg-emerald-100/70 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-gray-800 hover:text-emerald-600 dark:hover:text-emerald-400'}
          ${isCollapsed ? 'px-3 justify-center' : ''}`}
        title={isCollapsed ? label : ''}>
        <Icon size={16} className="flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="text-sm font-semibold flex-1 text-left">{label}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </>
        )}
      </button>
      {!isCollapsed && isExpanded && (
        <div className="mt-1 border-l-2 border-emerald-200 dark:border-emerald-800/60 ml-4 pl-1">
          {children}
        </div>
      )}
      {isCollapsed && isExpanded && (
        <div className="mt-1">
          {children}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, onToggleCollapse }) => {
  const navigate = useNavigate();
  const { t, isRTL } = useLanguage();
  const isAdmin = user.role === UserRole.ADMIN;
  const isEngineer = user.role === UserRole.ENGINEER;
  const isManager = user.role === UserRole.MANAGER;
  const engineerOnly = isEngineer && !isAdmin; // engineers see only stock
  const [globalSearch, setGlobalSearch] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false);
  const { activeBook, books, switchBook, activeBookId } = useBook();

  // Close book dropdown when clicking outside
  useEffect(() => {
    if (!bookDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-book-dropdown]')) setBookDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bookDropdownOpen]);
  
  // Load profile photo from localStorage
  useEffect(() => {
    // Always try to load from localStorage using user ID
    const storedPhoto = localStorage.getItem(`profilePhoto_${user.id}`);
    if (storedPhoto) {
      setUserPhotoURL(storedPhoto);
    } else if (user.photoURL && !user.photoURL.startsWith('localStorage:')) {
      setUserPhotoURL(user.photoURL);
    }
    
    // Listen for profile photo updates
    const handlePhotoUpdate = (event: any) => {
      if (event.detail.userId === user.id) {
        setUserPhotoURL(event.detail.photoURL);
      }
    };
    
    window.addEventListener('profilePhotoUpdated', handlePhotoUpdate);
    return () => window.removeEventListener('profilePhotoUpdated', handlePhotoUpdate);
  }, [user.id]);
  
  // Collapsible menu states
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    menu: true,
    database: false,
    analytics: false,
    accounting: false,
    operations: false,
    compliance: false,
    integrations: false,
    info: false,
    admin: false,
  });

  const searchResults = globalSearch.trim()
    ? ALL_NAV_ITEMS.filter(item =>
        t(item.labelKey).toLowerCase().includes(globalSearch.trim().toLowerCase()) ||
        item.to.toLowerCase().includes(globalSearch.trim().toLowerCase())
      )
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      SoundService.play('nav');
      navigate(searchResults[0].to);
      setGlobalSearch('');
    }
  };

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    onToggleCollapse?.(newState);
    SoundService.play('toggle');
  };

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  // Notifications removed: no unread count or snapshot listeners

  useEffect(() => {
    let unsub: any = null;
    (async () => {
      try {
        const svc = await import('../services/firestoreService');
        if (svc && svc.listenApprovals) {
          unsub = svc.listenApprovals((arr: any[]) => setPendingApprovals((arr || []).length));
        }
      } catch (e) {
        console.error('Sidebar approvals listener failed', e);
      }
    })();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [activeBookId]);

  const getInitials = (u: any) => {
    const name = u?.name || u?.email || u?.id || 'U';
    return name.split(' ').map((s:any)=>s.charAt(0)).slice(0,2).join('').toUpperCase();
  };

  return (
    <div className={`app-sidebar ${isCollapsed ? 'w-20' : 'w-72'} h-screen hidden md:flex flex-col fixed ${isRTL ? 'right-0' : 'left-0'} top-0 z-40 border-${isRTL ? 'l' : 'r'} bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100 border-emerald-200/50 dark:border-gray-700/50 transition-all duration-300 shadow-xl dark:shadow-gray-950/50`}>
      <div className={`${isCollapsed ? 'p-3' : 'p-6 pb-3'} transition-all duration-300 border-b border-emerald-100/50 dark:border-gray-700/50`}>
        {!isCollapsed && (
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center shadow-lg">
              <img 
                src={LOGO_URL} 
                alt="logo" 
                className="h-10 w-10 object-contain" 
                onError={(e) => {
                  // Fallback if the logo fails to load
                  (e.target as HTMLImageElement).src = '/images/logo.png';
                }}
              />
            </div>
            <div>
              <div className="flex items-end gap-2">
                <h1 className="text-xl font-black text-emerald-700 tracking-tight leading-none">{t('app.title')}</h1>
              </div>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">{t('app.subtitle')}</p>
              <p className="text-[9px] font-bold text-slate-400 tracking-wider mt-0.5">{t('app.poweredBy')}</p>
            </div>
          </div>
        )}

        <button 
          onClick={toggleCollapse}
          className="w-full flex items-center justify-center px-2 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-gray-800 transition-all mb-2 text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 group"
          title={isCollapsed ? t('nav.expand') : t('nav.collapse')}>
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        {!isCollapsed && (
          <div className="mb-2">
            <form onSubmit={handleSearch} className="relative form-with-icon group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={16} />
                <input 
                  type="text" 
                  placeholder={t('common.search')} 
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  className="w-full pr-3 pl-10 py-2 bg-emerald-50/50 dark:bg-gray-800 border border-emerald-200 dark:border-gray-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-gray-750 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all"
                />
            </form>
          </div>
        )}

        {/* Book (Partition) Switcher — admin only */}
        {isAdmin && <div className="relative mb-2" data-book-dropdown>
          <button
            type="button"
            onClick={() => setBookDropdownOpen(o => !o)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all bg-emerald-100/60 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? activeBook.name : ''}
          >
            <BookOpen size={14} className="flex-shrink-0 text-emerald-600" />
            {!isCollapsed && (
              <>
                <span className="text-xs font-semibold flex-1 text-left truncate">{activeBook.name}</span>
                <ChevronDown size={12} className={`transition-transform ${bookDropdownOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
          {bookDropdownOpen && (
            <div className={`absolute top-full mt-1 ${isCollapsed ? 'left-full ml-2 w-52' : 'left-0 right-0'} z-50 bg-white rounded-xl shadow-xl border border-emerald-200 py-1 overflow-hidden`}>
              {books.map(book => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => { switchBook(book.id); setBookDropdownOpen(false); SoundService.play('toggle'); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-emerald-50 transition-all ${
                    activeBookId === book.id ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-700'
                  }`}
                >
                  <BookOpen size={13} className={activeBookId === book.id ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="text-xs truncate flex-1">{book.name}</span>
                  {activeBookId === book.id && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">{t('common.active')}</span>}
                </button>
              ))}
              {isAdmin && (
                <>
                  <div className="border-t border-emerald-100 dark:border-gray-700 my-1" />
                  <button
                    type="button"
                    onClick={() => { navigate('/admin/books'); setBookDropdownOpen(false); SoundService.play('nav'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-emerald-600 hover:bg-emerald-50 transition-all font-semibold"
                  >
                    <BookOpen size={13} />
                    Manage Books
                  </button>
                </>
              )}
            </div>
          )}
        </div>}

      </div>

      <div className="flex-1 overflow-y-auto px-3 scrollbar-hide pb-4 pt-3">

        {/* Search results panel */}
        {!isCollapsed && globalSearch.trim() && (
          <div className="mb-3">
            {searchResults.length > 0 ? (
              <div className="rounded-xl border border-emerald-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-100 dark:border-gray-700 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => setGlobalSearch('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto scrollbar-hide divide-y divide-slate-50 dark:divide-gray-800">
                  {searchResults.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => { setGlobalSearch(''); SoundService.play('nav'); }}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-gray-800 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`
                      }
                    >
                      <item.icon size={14} className="flex-shrink-0" />
                      <span>{t(item.labelKey)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('common.noResults') || 'No results found'}</p>
              </div>
            )}
          </div>
        )}

        {engineerOnly ? (
          <NavItem to="/stocks" icon={Briefcase} label={t('nav.stockManagement')} isCollapsed={isCollapsed} />
        ) : (
          <>
            {/* Quick Access */}
            <QuickAccessSection userId={user.id} isCollapsed={isCollapsed} />

            {/* Menu Group */}
            <MenuGroup menuKey="menu" label={t('nav.menu')} icon={LayoutDashboard} isExpanded={expandedMenus.menu} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/" icon={LayoutDashboard} label={t('nav.dashboard')} isCollapsed={isCollapsed} />
              <NavItem to="/tasks" icon={ClipboardList} label={t('nav.tasks')} isCollapsed={isCollapsed} />
              <NavItem to="/calendar" icon={CalendarDays} label={t('nav.calendar')} isCollapsed={isCollapsed} />
              <NavItem to="/contracts" icon={FileSignature} label={t('nav.contracts')} isCollapsed={isCollapsed} />
              <NavItem to="/entry" icon={PlusCircle} label={t('nav.addEntry')} isCollapsed={isCollapsed} />
              <NavItem to="/bulk-rent" icon={Upload} label={isCollapsed ? '' : t('nav.bulkRent')} isCollapsed={isCollapsed} />
              <NavItem to="/history" icon={History} label={t('nav.transactions')} isCollapsed={isCollapsed} />
              {(isAdmin || user.role === 'MANAGER') && (
                <NavItem to="/approvals" icon={Bell} label={t('nav.approvals')} badge={pendingApprovals} isCollapsed={isCollapsed} />
              )}
            </MenuGroup>

            {/* Database Group */}
            <MenuGroup menuKey="database" label={t('nav.database')} icon={FolderOpen} isExpanded={expandedMenus.database} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/customers" icon={Users} label={t('nav.customers')} isCollapsed={isCollapsed} />
              <NavItem to="/directory" icon={FolderOpen} label={t('nav.directory')} isCollapsed={isCollapsed} />
              <NavItem to="/registry" icon={Car} label={t('nav.carRegistry')} isCollapsed={isCollapsed} /> 
              <NavItem to="/properties" icon={Building} label={t('nav.properties')} isCollapsed={isCollapsed} />
              <NavItem to="/vendors" icon={Briefcase} label={t('nav.vendors')} isCollapsed={isCollapsed} />
              <NavItem to="/service-agreements" icon={FileText} label={t('nav.agreements')} isCollapsed={isCollapsed} />
            </MenuGroup>
            
            {/* Analytics Group */}
            <MenuGroup menuKey="analytics" label={t('nav.analytics')} icon={PieChart} isExpanded={expandedMenus.analytics} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/monitoring" icon={PieChart} label={t('nav.monitoring')} isCollapsed={isCollapsed} />
              <NavItem to="/reports" icon={BarChart3} label={t('nav.reports')} isCollapsed={isCollapsed} />
              <NavItem to="/vat-report" icon={Receipt} label={t('nav.vatReport')} isCollapsed={isCollapsed} />
            </MenuGroup>

            {/* Accounting Group — top-level */}
            <MenuGroup menuKey="accounting" label={t('nav.accounting')} icon={Calculator} isExpanded={expandedMenus.accounting || false} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/accounting" icon={Calculator} label={t('nav.accountingOverview')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/chart"    icon={BookMarked}    label={t('nav.chartOfAccounts')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/journal"  icon={BookOpen}      label={t('nav.journalEntries')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/ledger"   icon={Layers}        label={t('nav.generalLedger')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/trial"    icon={Scale}         label={t('nav.trialBalance')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/income"   icon={TrendingUp}    label={t('nav.incomeStatement')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/balance"  icon={Landmark}      label={t('nav.balanceSheet')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/cashflow" icon={DollarSign}    label={t('nav.cashFlow')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/payables"     icon={TrendingDown}  label={t('nav.accountsPayable')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/receivables"  icon={TrendingUp}    label={t('nav.accountsReceivable')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/aging"    icon={CalendarDays}  label={t('nav.agingReport')} isCollapsed={isCollapsed} />
              <NavItem to="/accounting/budget"   icon={BarChart3}     label={t('nav.budgetVsActual')} isCollapsed={isCollapsed} />
            </MenuGroup>

            {/* Operations Group */}
            <MenuGroup menuKey="operations" label={t('nav.operations')} icon={ArrowRightLeft} isExpanded={expandedMenus.operations} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/transfers" icon={ArrowRightLeft} label={t('nav.treasury')} isCollapsed={isCollapsed} />
              <NavItem to="/borrowings" icon={Briefcase} label={t('nav.borrowings')} isCollapsed={isCollapsed} />
              {(isAdmin || isManager) && (
                <NavItem to="/owner-portal" icon={Crown} label={t('nav.ownerPortal')} isCollapsed={isCollapsed} />
              )}
              {(isAdmin || isManager) && (
                <NavItem to="/staff" icon={Users} label={t('nav.staffPortfolio')} isCollapsed={isCollapsed} />
              )}
              <NavItem to="/chat" icon={MessageCircle} label={t('nav.staffChat')} isCollapsed={isCollapsed} />
              {(isEngineer || isAdmin) && (
                <NavItem to="/stocks" icon={Briefcase} label={t('nav.stockManagement')} isCollapsed={isCollapsed} />
              )}
            </MenuGroup>

            {/* Saudi Compliance */}
            <MenuGroup menuKey="compliance" label={t('nav.compliance')} icon={ShieldAlert} isExpanded={expandedMenus.compliance || false} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/ejar" icon={FileCheck} label={t('nav.ejarPlatform')} isCollapsed={isCollapsed} />
              <NavItem to="/municipality-licenses" icon={Landmark} label={t('nav.municipality')} isCollapsed={isCollapsed} />
              <NavItem to="/civil-defense" icon={ShieldAlert} label={t('nav.civilDefense')} isCollapsed={isCollapsed} />
              <NavItem to="/absher" icon={MapPin} label={t('nav.absher')} isCollapsed={isCollapsed} />
            </MenuGroup>

            {/* Integrations */}
            <MenuGroup menuKey="integrations" label={t('nav.integrations')} icon={Zap} isExpanded={expandedMenus.integrations || false} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/sadad" icon={CreditCard} label={t('nav.sadadBills')} isCollapsed={isCollapsed} />
              <NavItem to="/utilities" icon={Zap} label={t('nav.utilities')} isCollapsed={isCollapsed} />
              <NavItem to="/security-deposits" icon={Shield} label={t('nav.deposits')} isCollapsed={isCollapsed} />
              <NavItem to="/whatsapp" icon={MessageSquare} label={t('nav.whatsapp')} isCollapsed={isCollapsed} />
              <NavItem to="/bank-reconciliation" icon={Banknote} label={t('nav.bankRecon')} isCollapsed={isCollapsed} />
            </MenuGroup>

            {/* Settings for all users */}
            <MenuGroup menuKey="settings" label={t('nav.settings')} icon={Settings} isExpanded={expandedMenus.settings || false} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/settings" icon={Settings} label={t('nav.profileSettings')} isCollapsed={isCollapsed} />
              {isAdmin && (
                <>
                  <NavItem to="/admin/employees" icon={UserCheck} label={t('nav.staff')} isCollapsed={isCollapsed} />
                  <NavItem to="/admin/settings" icon={Settings} label={t('nav.systemSettings')} isCollapsed={isCollapsed} />
                  <NavItem to="/admin/bulk-import" icon={Upload} label={t('nav.bulkImport')} isCollapsed={isCollapsed} />
                  <NavItem to="/admin/backup" icon={FolderOpen} label={t('nav.localBackup')} isCollapsed={isCollapsed} />
                  <NavItem to="/admin/cloud-backup" icon={FolderOpen} label={t('nav.cloudBackup')} isCollapsed={isCollapsed} />
                  <NavItem to="/admin/books" icon={BookOpen} label={t('nav.booksPartitions')} isCollapsed={isCollapsed} />
                </>
              )}
            </MenuGroup>

            {/* Footer Group */}
            <MenuGroup menuKey="info" label={t('nav.info')} icon={Info} isExpanded={expandedMenus.info} isCollapsed={isCollapsed} onToggle={toggleMenu}>
              <NavItem to="/help" icon={Info} label={t('nav.helpGuide')} isCollapsed={isCollapsed} />
              <NavItem to="/about" icon={Info} label={t('nav.about')} isCollapsed={isCollapsed} />
            </MenuGroup>
          </>
        )}
      </div>

        <div className="p-4 border-t border-emerald-100/50 dark:border-gray-700/50 bg-gradient-to-b from-white dark:from-gray-900 to-emerald-50/30 dark:to-gray-900 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {userPhotoURL ? (
            <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-emerald-200">
              <img src={userPhotoURL} alt={user.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-500 text-white flex items-center justify-center font-bold shadow-lg flex-shrink-0 text-sm">
              {getInitials(user)}
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name || user?.email || user?.id || 'User'}</p>
              <button onClick={() => { SoundService.play('swoosh'); onLogout(); }} className="text-[10px] text-emerald-600 hover:text-emerald-700 transition-colors font-medium">{t('common.logout')}</button>
            </div>
          )}
        </div>
        </div>
    </div>
  );
};

export default Sidebar;
