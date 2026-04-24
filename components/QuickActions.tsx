import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, PlusCircle, History, Users, Building, UserCheck, FileSignature, CalendarDays, Briefcase, ClipboardList, PieChart, Car, Bell, ArrowRightLeft, Receipt, FolderOpen, Info, Upload, Settings, Zap, Command, ArrowRight, X, Shield, CreditCard } from 'lucide-react';
import SoundService from '../services/soundService';
import { User, UserRole } from '../types';
import { useLanguage } from '../i18n';

// ─── Types ───────────────────────────────────────────────────

interface QuickAction {
  id: string;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  icon: React.ElementType;
  route: string;
  keywords: string[];
  category: string;
  categoryAr: string;
  adminOnly?: boolean;
  engineerOnly?: boolean;
  managerOrAdmin?: boolean;
}

// ─── All Actions ─────────────────────────────────────────────

const ALL_ACTIONS: QuickAction[] = [
  // Menu
  { id: 'dashboard', label: 'Dashboard', labelAr: 'لوحة التحكم', description: 'View overview and KPIs', descriptionAr: 'عرض النظرة العامة والمؤشرات', icon: LayoutDashboard, route: '/', keywords: ['home', 'overview', 'kpi', 'الرئيسية'], category: 'Menu', categoryAr: 'القائمة' },
  { id: 'tasks', label: 'Tasks & Kanban', labelAr: 'المهام', description: 'Manage tasks and to-do items', descriptionAr: 'إدارة المهام والأعمال', icon: ClipboardList, route: '/tasks', keywords: ['todo', 'kanban', 'board', 'مهام'], category: 'Menu', categoryAr: 'القائمة' },
  { id: 'calendar', label: 'Calendar', labelAr: 'التقويم', description: 'View calendar events', descriptionAr: 'عرض أحداث التقويم', icon: CalendarDays, route: '/calendar', keywords: ['events', 'schedule', 'date', 'تقويم'], category: 'Menu', categoryAr: 'القائمة' },
  { id: 'contracts', label: 'Contracts', labelAr: 'العقود', description: 'Manage lease contracts', descriptionAr: 'إدارة عقود الإيجار', icon: FileSignature, route: '/contracts', keywords: ['lease', 'agreement', 'rental', 'عقد', 'إيجار'], category: 'Menu', categoryAr: 'القائمة' },
  { id: 'entry', label: 'Add Income/Expense', labelAr: 'إضافة إيراد/مصروف', description: 'Record new transaction', descriptionAr: 'تسجيل معاملة جديدة', icon: PlusCircle, route: '/entry', keywords: ['income', 'expense', 'payment', 'record', 'collect', 'rent', 'إيراد', 'مصروف', 'دفع'], category: 'Menu', categoryAr: 'القائمة' },
  { id: 'bulk-rent', label: 'Bulk Rent Collection', labelAr: 'تحصيل إيجارات جماعي', description: 'Collect rent from multiple units at once', descriptionAr: 'تحصيل الإيجار من عدة وحدات دفعة واحدة', icon: Upload, route: '/bulk-rent', keywords: ['bulk', 'rent', 'collect', 'multiple', 'batch', 'تحصيل', 'جماعي', 'إيجار'], category: 'Menu', categoryAr: 'القائمة' },
  { id: 'history', label: 'Transactions', labelAr: 'المعاملات', description: 'View transaction history', descriptionAr: 'عرض سجل المعاملات', icon: History, route: '/history', keywords: ['transactions', 'records', 'ledger', 'سجل', 'معاملات'], category: 'Menu', categoryAr: 'القائمة' },
  { id: 'approvals', label: 'Approvals', labelAr: 'الموافقات', description: 'Review pending approvals', descriptionAr: 'مراجعة الموافقات المعلقة', icon: Bell, route: '/approvals', keywords: ['approve', 'reject', 'pending', 'review', 'موافقة'], category: 'Menu', categoryAr: 'القائمة', managerOrAdmin: true },

  // Database
  { id: 'customers', label: 'Customers', labelAr: 'العملاء', description: 'Manage tenants and customers', descriptionAr: 'إدارة المستأجرين والعملاء', icon: Users, route: '/customers', keywords: ['tenant', 'customer', 'person', 'عميل', 'مستأجر'], category: 'Database', categoryAr: 'قاعدة البيانات' },
  { id: 'directory', label: 'Building Directory', labelAr: 'دليل المباني', description: 'View building and unit directory', descriptionAr: 'عرض دليل المباني والوحدات', icon: FolderOpen, route: '/directory', keywords: ['directory', 'units', 'rooms', 'دليل', 'وحدات'], category: 'Database', categoryAr: 'قاعدة البيانات' },
  { id: 'registry', label: 'Car Registry', labelAr: 'سجل السيارات', description: 'Track vehicle plates', descriptionAr: 'تتبع لوحات السيارات', icon: Car, route: '/registry', keywords: ['car', 'vehicle', 'plate', 'سيارة', 'لوحة'], category: 'Database', categoryAr: 'قاعدة البيانات' },
  { id: 'properties', label: 'Properties', labelAr: 'العقارات', description: 'Manage buildings and units', descriptionAr: 'إدارة المباني والوحدات', icon: Building, route: '/properties', keywords: ['building', 'property', 'unit', 'real estate', 'عقار', 'مبنى'], category: 'Database', categoryAr: 'قاعدة البيانات' },
  { id: 'vendors', label: 'Vendors', labelAr: 'الموردين', description: 'Manage vendors and suppliers', descriptionAr: 'إدارة الموردين والمزودين', icon: Briefcase, route: '/vendors', keywords: ['vendor', 'supplier', 'contractor', 'مورد'], category: 'Database', categoryAr: 'قاعدة البيانات' },

  // Analytics
  { id: 'monitoring', label: 'Monitoring', labelAr: 'المراقبة', description: 'Operational monitoring dashboard', descriptionAr: 'لوحة المراقبة التشغيلية', icon: PieChart, route: '/monitoring', keywords: ['monitor', 'analytics', 'stats', 'chart', 'مراقبة', 'تحليلات'], category: 'Analytics', categoryAr: 'التحليلات' },
  { id: 'vat', label: 'VAT Report', labelAr: 'تقرير الضريبة', description: 'Saudi VAT reporting', descriptionAr: 'تقرير ضريبة القيمة المضافة', icon: Receipt, route: '/vat-report', keywords: ['vat', 'tax', 'zatca', 'ضريبة', 'زاتكا'], category: 'Analytics', categoryAr: 'التحليلات' },
  { id: 'reports', label: 'Reports', labelAr: 'التقارير', description: 'P&L, Zakat, expense reports', descriptionAr: 'الأرباح والخسائر والزكاة والتقارير', icon: PieChart, route: '/reports', keywords: ['report', 'pnl', 'profit', 'loss', 'zakat', 'تقرير', 'ربح'], category: 'Analytics', categoryAr: 'التحليلات' },

  // Operations
  { id: 'transfers', label: 'Treasury', labelAr: 'الخزينة', description: 'Fund transfers between accounts', descriptionAr: 'تحويلات مالية بين الحسابات', icon: ArrowRightLeft, route: '/transfers', keywords: ['transfer', 'treasury', 'fund', 'تحويل', 'خزينة'], category: 'Operations', categoryAr: 'العمليات' },
  { id: 'borrowings', label: 'Borrowings', labelAr: 'الاقتراض', description: 'Employee borrowing tracker', descriptionAr: 'تتبع اقتراض الموظفين', icon: Briefcase, route: '/borrowings', keywords: ['borrow', 'loan', 'repay', 'salary', 'قرض', 'اقتراض'], category: 'Operations', categoryAr: 'العمليات' },
  { id: 'staff-portfolio', label: 'Staff Portfolio', labelAr: 'ملف الموظفين', description: 'Staff directory and profiles', descriptionAr: 'دليل وملفات الموظفين', icon: Users, route: '/staff', keywords: ['staff', 'employee', 'portfolio', 'موظف', 'ملف'], category: 'Operations', categoryAr: 'العمليات' },
  { id: 'stocks', label: 'Stock Management', labelAr: 'إدارة المخزون', description: 'Inventory and supplies', descriptionAr: 'المخزون والمستلزمات', icon: Briefcase, route: '/stocks', keywords: ['stock', 'inventory', 'supply', 'مخزون'], category: 'Operations', categoryAr: 'العمليات' },

  // Settings
  { id: 'settings', label: 'Profile & Settings', labelAr: 'الملف الشخصي والإعدادات', description: 'Your profile and preferences', descriptionAr: 'ملفك الشخصي وتفضيلاتك', icon: Settings, route: '/settings', keywords: ['settings', 'profile', 'preference', 'إعدادات', 'ملف'], category: 'Settings', categoryAr: 'الإعدادات' },
  { id: 'employees', label: 'Staff Management', labelAr: 'إدارة الموظفين', description: 'Manage employees and roles', descriptionAr: 'إدارة الموظفين والأدوار', icon: UserCheck, route: '/admin/employees', keywords: ['employee', 'staff', 'role', 'admin', 'موظف', 'إدارة'], category: 'Admin', categoryAr: 'المسؤول', adminOnly: true },
  { id: 'sys-settings', label: 'System Settings', labelAr: 'إعدادات النظام', description: 'Company and system configuration', descriptionAr: 'إعدادات الشركة والنظام', icon: Settings, route: '/admin/settings', keywords: ['system', 'config', 'company', 'نظام', 'شركة'], category: 'Admin', categoryAr: 'المسؤول', adminOnly: true },
  { id: 'bulk-import', label: 'Bulk Import', labelAr: 'استيراد جماعي', description: 'Import customers in bulk', descriptionAr: 'استيراد العملاء بكميات كبيرة', icon: Upload, route: '/admin/bulk-import', keywords: ['import', 'bulk', 'csv', 'excel', 'استيراد'], category: 'Admin', categoryAr: 'المسؤول', adminOnly: true },
  { id: 'backup', label: 'Local Backup', labelAr: 'نسخ احتياطي محلي', description: 'Backup and restore data', descriptionAr: 'نسخ احتياطي واستعادة البيانات', icon: FolderOpen, route: '/admin/backup', keywords: ['backup', 'restore', 'export', 'نسخ احتياطي'], category: 'Admin', categoryAr: 'المسؤول', adminOnly: true },
  { id: 'cloud-backup', label: 'Cloud Backup', labelAr: 'نسخ احتياطي سحابي', description: 'Google Drive cloud backup', descriptionAr: 'نسخ احتياطي سحابي في جوجل درايف', icon: FolderOpen, route: '/admin/cloud-backup', keywords: ['cloud', 'google', 'drive', 'سحابي'], category: 'Admin', categoryAr: 'المسؤول', adminOnly: true },

  // Info
  { id: 'help', label: 'Help & Guide', labelAr: 'المساعدة والدليل', description: 'User guide and FAQ', descriptionAr: 'دليل المستخدم والأسئلة الشائعة', icon: Info, route: '/help', keywords: ['help', 'guide', 'faq', 'مساعدة', 'دليل'], category: 'Info', categoryAr: 'معلومات' },
  { id: 'about', label: 'About', labelAr: 'حول', description: 'About Amlak', descriptionAr: 'حول أملاك', icon: Info, route: '/about', keywords: ['about', 'version', 'حول'], category: 'Info', categoryAr: 'معلومات' },
];

// ─── Component ───────────────────────────────────────────────

interface QuickActionsProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ user, isOpen, onClose }) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isAr = language === 'ar';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isAdmin = user.role === UserRole.ADMIN;
  const isEngineer = user.role === UserRole.ENGINEER;
  const isManager = user.role === ('MANAGER' as UserRole);

  // Filter actions based on user role
  const availableActions = useMemo(() => {
    return ALL_ACTIONS.filter(action => {
      if (action.adminOnly && !isAdmin) return false;
      if (action.managerOrAdmin && !isAdmin && !isManager) return false;
      if (isEngineer && !isAdmin) {
        // Engineers only see stocks, settings, contracts
        return ['stocks', 'settings', 'contracts', 'transfers', 'help', 'about'].includes(action.id);
      }
      return true;
    });
  }, [isAdmin, isEngineer, isManager]);

  // Search filtering
  const results = useMemo(() => {
    if (!query.trim()) return availableActions;
    const q = query.toLowerCase();
    return availableActions.filter(action => {
      const label = isAr ? action.labelAr : action.label;
      const desc = isAr ? action.descriptionAr : action.description;
      return (
        label.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q) ||
        action.keywords.some(kw => kw.toLowerCase().includes(q))
      );
    });
  }, [query, availableActions, isAr]);

  // Group results by category
  const grouped = useMemo(() => {
    const groups: Record<string, QuickAction[]> = {};
    results.forEach(action => {
      const cat = isAr ? action.categoryAr : action.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(action);
    });
    return groups;
  }, [results, isAr]);

  // Flat list for keyboard navigation
  const flatResults = useMemo(() => {
    const flat: QuickAction[] = [];
    Object.values(grouped).forEach(actions => flat.push(...(actions as QuickAction[])));
    return flat;
  }, [grouped]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            handleSelect(flatResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          SoundService.play('close');
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatResults, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Clamp selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (action: QuickAction) => {
    SoundService.play('nav');
    navigate(action.route);
    onClose();
  };

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
        onClick={() => { SoundService.play('close'); onClose(); }}
      />

      {/* Palette */}
      <div className="fixed inset-0 flex items-start justify-center pt-[12vh] sm:pt-[15vh] z-[71] px-4 quick-actions-enter">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-emerald-200/50 overflow-hidden flex flex-col max-h-[65vh]">
          {/* Search input */}
          <div className="px-4 py-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white flex items-center gap-3">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <Zap size={16} className="text-emerald-600" />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isAr ? 'اكتب للبحث عن صفحة أو إجراء...' : 'Type to search pages & actions...'}
              className="flex-1 bg-transparent text-sm text-emerald-900 placeholder-emerald-400 outline-none font-medium"
              autoComplete="off"
            />
            <div className="flex items-center gap-1">
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-emerald-500 bg-emerald-50 rounded border border-emerald-200">ESC</kbd>
            </div>
          </div>

          {/* Results */}
          <div ref={listRef} className="flex-1 overflow-y-auto py-2">
            {flatResults.length === 0 ? (
              <div className="text-center py-8 px-4">
                <Search size={32} className="text-emerald-200 mx-auto mb-3" />
                <p className="text-emerald-700 font-bold text-sm">{isAr ? 'لا توجد نتائج' : 'No results found'}</p>
                <p className="text-emerald-500 text-xs mt-1">{isAr ? 'حاول بكلمات مختلفة' : 'Try different keywords'}</p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, actions]) => (
                <div key={category}>
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-500">{category}</span>
                  </div>
                  {(actions as QuickAction[]).map(action => {
                    const idx = flatIndex++;
                    const isSelected = idx === selectedIndex;
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        data-index={idx}
                        onClick={() => handleSelect(action)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100 ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'text-slate-700 hover:bg-emerald-50/50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl transition-colors ${
                          isSelected ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">{isAr ? action.labelAr : action.label}</div>
                          <div className="text-xs text-slate-500 truncate">{isAr ? action.descriptionAr : action.description}</div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 text-emerald-500 flex-shrink-0">
                            <ArrowRight size={14} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-emerald-500 font-semibold">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-emerald-600">↑↓</kbd> {isAr ? 'تنقل' : 'Navigate'}</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-emerald-600">↵</kbd> {isAr ? 'فتح' : 'Open'}</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-emerald-600">Esc</kbd> {isAr ? 'إغلاق' : 'Close'}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">{flatResults.length} {isAr ? 'نتيجة' : 'results'}</span>
          </div>
        </div>
      </div>

      <style>{`
        .quick-actions-enter { animation: qaFadeIn 0.15s ease-out; }
        @keyframes qaFadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  );
};

// ─── Trigger Button (for header) ────────────────────────────

interface QuickActionButtonProps {
  onClick: () => void;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({ onClick }) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  return (
    <button
      onClick={() => { SoundService.play('open'); onClick(); }}
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 transition-all duration-200 group"
      title={isAr ? 'إجراءات سريعة (Ctrl+K)' : 'Quick Actions (Ctrl+K)'}
    >
      <Zap size={14} className="text-emerald-500 group-hover:text-emerald-700 transition-colors" />
      <span className="text-xs font-bold">{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</span>
      <kbd className="ml-1 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 bg-white rounded border border-emerald-200">⌘K</kbd>
    </button>
  );
};

// ─── Mobile Quick Action Button ─────────────────────────────

export const QuickActionFAB: React.FC<QuickActionButtonProps> = ({ onClick }) => {
  const { t } = useLanguage();
  return (
  <button
    onClick={() => { SoundService.play('open'); onClick(); }}
    className="sm:hidden p-2 rounded-xl hover:bg-emerald-100 transition-all text-emerald-700"
    title={t('dashboard.quickActions')}
  >
    <Zap size={20} />
  </button>
  );
};

export default QuickActions;
