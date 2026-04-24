import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from "firebase/auth"; 
import { auth } from "./firebase"; 
import GlobalSearchWithResults from './components/GlobalSearchWithResults';
import { setupCloudBackup } from './services/cloudBackupService';
import { startSession, endSession, updateSession } from './services/screenTimeService'; 
import { fmtDate } from './utils/dateFormat';
import SoundService from './services/soundService';
import { useLanguage } from './i18n';
import LanguageToggle from './components/LanguageToggle';
import { processAutoRentPayments, isAutoRentEnabled } from './services/autoRentService';
import { TenantLogin, TenantDashboard } from './components/TenantPortal';

// Components
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav.tsx';
import MobileMenu from './components/MobileMenu.tsx';
import MobileTabStrip from './components/MobileTabStrip.tsx';
import MobileHeader from './components/MobileHeader';
import Login from './components/Login'; // <--- IMPORTED LOGIN COMPONENT
import { Dashboard } from './components/Dashboard';
import EntryForm from './components/EntryForm';
import History from './components/History';
import CustomerManager from './components/CustomerManager';
import EmployeeManager from './components/EmployeeManager';
import ContractForm from './components/ContractForm';
import Monitoring from './components/Monitoring';
import BuildingManager from './components/BuildingManager';
import BuildingDirectory from './components/BuildingDirectory';
import CalendarView from './components/CalendarView';
import VendorManager from './components/VendorManager';
import ServiceAgreements from './components/ServiceAgreements';
import TaskManager from './components/TaskManager';
import Reports from './components/Reports';
import Settings from './components/Settings';
import About from './components/About';
import CarRegistry from './components/CarRegistry'; 
import StockManager from './components/StockManager';
import TransferManager from './components/TransferManager';
import VATReport from './components/VATReport';
import Invoice from './components/Invoice';
import BulkImportCustomers from './components/BulkImportCustomers';
import BulkRentEntry from './components/BulkRentEntry';
import Help from './components/Help';
import BackupManager from './components/BackupManager';
import CloudBackupManager from './components/CloudBackupManager';
import BorrowingTracker from './components/BorrowingTracker';
import StaffPortfolio from './components/StaffPortfolio';
import OwnerPortal from './components/OwnerPortal';
import ArchetypeCard from './components/ArchetypeCard';
import ApprovalCenter from './components/ApprovalCenter';
import ImmersiveLanding from '@/components/landing/ImmersiveLanding';
import ReportBugButton from './components/ReportBugButton';
import AdminBugDashboard from './components/AdminBugDashboard';

import { NotificationBell, NotificationPanel, useNotifications } from './components/Notifications';
import QuickActions, { QuickActionButton, QuickActionFAB } from './components/QuickActions';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import VoiceAssistant from './components/VoiceAssistant';
import StaffChat from './components/StaffChat';
import ChatBubble from './components/ChatBubble';
import AIAssistant from './components/AIAssistant';
import FloatingToolsDock from './components/FloatingToolsDock';
import OfflineBanner from './components/OfflineBanner';
import { UserRole } from './types';
import { setUserScope } from './services/firestoreService';
import { BookProvider, useBook } from './contexts/BookContext';
import BookManager from './components/BookManager';
import SadadBillManager from './components/SadadBillManager';
import EjarIntegration from './components/EjarIntegration';
import UtilitiesTracker from './components/UtilitiesTracker';
import SecurityDeposits from './components/SecurityDeposits';
import WhatsAppIntegration from './components/WhatsAppIntegration';
import BankReconciliation from './components/BankReconciliation';
import AccountingModule from './components/AccountingModule';
import MunicipalityLicenseTracker from './components/MunicipalityLicenseTracker';
import CivilDefenseCompliance from './components/CivilDefenseCompliance';
import AbsherIntegration from './components/AbsherIntegration';
import { isTenantMode } from './services/tenantPortalService';

SoundService.init();

const TAB_UI_STATE_PREFIX = 'tab-ui-state:';

const getRouteFromHash = (hash: string): string => {
  const normalized = hash || '#/';
  const withoutHash = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  const [path] = withoutHash.split('?');
  return path || '/';
};

const getPersistableControls = (): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> => {
  return Array.from(document.querySelectorAll('main input, main select, main textarea')).filter((el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return false;
    if (el.disabled) return false;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'password' || el.type === 'file' || el.type === 'hidden') return false;
    }
    return true;
  });
};

const getControlKey = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, index: number): string => {
  const key =
    el.getAttribute('data-persist-key') ||
    el.id ||
    el.getAttribute('name') ||
    el.getAttribute('aria-label') ||
    el.getAttribute('placeholder') ||
    `${el.tagName.toLowerCase()}:${index}`;
  return key.trim();
};

const persistCurrentTabUiState = (route: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const controls = getPersistableControls();
    const snapshot: Record<string, string | boolean> = {};
    controls.forEach((el, index) => {
      const key = getControlKey(el, index);
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        snapshot[key] = el.checked;
      } else {
        snapshot[key] = el.value;
      }
    });
    sessionStorage.setItem(`${TAB_UI_STATE_PREFIX}${route}`, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence failures; app should continue normally.
  }
};

const restoreTabUiState = (route: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(`${TAB_UI_STATE_PREFIX}${route}`);
    if (!raw) return;
    const snapshot = JSON.parse(raw) as Record<string, string | boolean>;
    const controls = getPersistableControls();
    controls.forEach((el, index) => {
      const key = getControlKey(el, index);
      if (!(key in snapshot)) return;
      const stored = snapshot[key];
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
        const checked = Boolean(stored);
        if (el.checked !== checked) {
          el.checked = checked;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }
      const value = String(stored ?? '');
      if (el.value !== value) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  } catch {
    // Ignore restore failures; app should continue normally.
  }
};

const AppContent: React.FC = () => {
  const { activeBookId, switchBook } = useBook();
  // Dark mode persistence — apply class to <html> immediately so every
  // CSS selector (.dark .foo) works, including portals and modals.
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('amlak_dark_mode') === 'true';
      // Apply synchronously before first paint to prevent flash
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light', !isDark);
      return isDark;
    }
    return false;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('amlak_dark_mode', darkMode ? 'true' : 'false');
      // Keep <html> class in sync so all .dark / .light CSS rules fire
      document.documentElement.classList.toggle('dark', darkMode);
      document.documentElement.classList.toggle('light', !darkMode);
      // Force body background directly — bypasses all CSS cascade issues
      document.body.style.backgroundColor = darkMode ? '#111827' : '';
      document.body.style.color = darkMode ? '#f1f5f9' : '';
      document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    }
  }, [darkMode]);
  const toggleDarkMode = () => setDarkMode(d => !d);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // ...existing code...
  const { t, language, isRTL } = useLanguage(); 
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [isTenantMode, setIsTenantMode] = useState(false);
  const [tenantUser, setTenantUser] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const notif = useNotifications();

  // Track current route for full-screen chat (must be before any conditional returns)
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  useEffect(() => {
    const handler = () => setCurrentHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    // Also sync on popstate for edge cases
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('hashchange', handler);
      window.removeEventListener('popstate', handler);
    };
  }, []);
  const isOnChatPage = currentHash.replace(/\/$/, '') === '#/chat';

  // Keep tab inputs (filters/search/forms) when switching routes.
  useEffect(() => {
    const route = getRouteFromHash(currentHash);
    const timer = window.setTimeout(() => {
      restoreTabUiState(route);
    }, 80);

    return () => {
      window.clearTimeout(timer);
      persistCurrentTabUiState(route);
    };
  }, [currentHash]);

  // Check for tenant portal mode (hash-based)
  useEffect(() => {
    const checkTenantMode = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/tenant')) {
        setIsTenantMode(true);
        // Restore tenant session
        const saved = localStorage.getItem('tenantSession');
        if (saved) {
          try { setTenantUser(JSON.parse(saved)); } catch {}
        }
      }
    };
    checkTenantMode();
    window.addEventListener('hashchange', checkTenantMode);
    return () => window.removeEventListener('hashchange', checkTenantMode);
  }, []);

  // Auto Rent Payment processing
  useEffect(() => {
    if (user && isAutoRentEnabled()) {
      const userId = user.id || user.uid || 'system';
      const userName = user.name || user.displayName || 'System';
      processAutoRentPayments(userId, userName).then(count => {
        if (count > 0) console.log(`Auto rent: ${count} transaction(s) generated`);
      }).catch(e => console.log('Auto rent check skipped:', e?.message));
    }
  }, [user]);

  // Global click sound: any <button> or <a> click that isn't already handled plays a subtle click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], [role="tab"], .clickable');
      if (clickable) {
        // NavLink & specific components already play their own sounds —
        // only fire the generic click for elements without a dedicated sound.
        const tag = clickable.tagName.toLowerCase();
        // Skip if it's a NavLink (handled in Sidebar/BottomNav) — NavLinks are <a> tags with class nav-item or inside <nav>
        if (tag === 'a' && clickable.closest('.app-sidebar, nav')) return;
        SoundService.play('click');
      }
    };
    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, []);

  // 1. Firebase Auth Listener
  useEffect(() => {
    // Restore saved session (mock-login users that don't go through Firebase Auth)
    const savedSession = localStorage.getItem('savedUserSession');
    if (savedSession && !user) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed && parsed.id && parsed.role) {
          setUser(parsed);
          setLoading(false);
          return;
        }
      } catch { /* corrupt data, ignore */ }
    }

    // Fallback: if Firebase auth doesn't resolve within 5s, stop loading anyway
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsub = onAuthStateChanged(auth, (u) => {
      clearTimeout(timeout);
      if (u) {
        setUser(u);
      } else if (!savedSession) {
        setUser(null);
      }
      setLoading(false);
    });
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  // Keep Firestore scope aligned with the logged-in user (building-level access - supports multiple buildings)
  useEffect(() => {
    setUserScope(user ? { role: (user as any).role, buildingId: (user as any).buildingId, buildingIds: (user as any).buildingIds } : null);

    // Non-admin users are locked to their assigned book
    const role = (user as any)?.role;
    const userBookId = (user as any)?.bookId;
    if (role && role !== UserRole.ADMIN) switchBook(userBookId || 'default');
    
    // Start screen time tracking
    if (user) {
      startSession(user.uid, (user as any).name || (user as any).email || 'User');
      
      // Update session every minute
      const interval = setInterval(() => {
        updateSession();
      }, 60000);
      
      // End session when component unmounts or user changes
      return () => {
        clearInterval(interval);
        endSession();
      };
    }
  }, [user]);

  // Initialize push notifications for ALL users (so admin tokens are registered from all devices)
  useEffect(() => {
    if (!user) return;
    let refreshInterval: any = null;

    const setupPush = async () => {
      try {
        const { registerDeviceForPush, listenForForegroundMessages } = await import('./services/pushNotificationService');
        const role = (user as any).role || 'EMPLOYEE';
        await registerDeviceForPush(user.id || user.uid || 'unknown', user.name || user.displayName || 'User', role);
        
        // Only admins/managers need to listen for foreground approval messages
        const isAdmin = role === 'ADMIN' || role === UserRole.ADMIN || role === 'MANAGER';
        if (isAdmin) {
          // Await foreground listener setup to ensure it initializes properly
          await listenForForegroundMessages((payload: any) => {
            // Refresh approval count on incoming message
            import('./services/firestoreService').then(svc => {
              if (svc.listenApprovals) {
                // The existing real-time listener will auto-update
              }
            });
          }).catch((err) => {
            console.log('Push: Foreground message listener setup completed with status:', err?.message || 'initialized');
          });

          // Re-register token every 6 hours to keep it fresh in Firestore
          refreshInterval = setInterval(async () => {
            try {
              const { registerDeviceForPush: reReg } = await import('./services/pushNotificationService');
              await reReg(user.id || user.uid || 'unknown', user.name || user.displayName || 'User', role);
            } catch (e) { /* silent */ }
          }, 6 * 60 * 60 * 1000);
        }
      } catch (e) {
        console.log('Push notification setup skipped:', (e as any)?.message);
      }
    };

    setupPush();

    // Also re-register when the app comes back to foreground (e.g. phone unlocked)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setupPush();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  // Initialize cloud backup (auto-restore on first load)
  useEffect(() => {
    if (user) {
      const accessToken = localStorage.getItem('gdrive_access_token');
      if (accessToken) {
        setupCloudBackup(user.id, user.name || user.displayName || 'Unknown', accessToken);
      }
    }
  }, [user]);

  // Listen for pending approvals + show browser notification to admins on new requests
  const prevApprovalCountRef = React.useRef<number | null>(null);
  const lastNotifiedApprovalRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const isAdmin = (user as any).role === 'ADMIN' || (user as any).role === UserRole.ADMIN || (user as any).role === 'MANAGER';
    let unsub: any = null;
    (async () => {
      try {
        const svc = await import('./services/firestoreService');
        if (svc && svc.listenApprovals) {
          unsub = svc.listenApprovals((arr: any[]) => {
            const count = (arr || []).length;
            setPendingApprovals(count);

            // Track the latest approval ID so badge count updates correctly.
            // NOTE: Browser notification removed here — the FCM push notification
            // (via notifyAdminsOfRequest → push-server → onBackgroundMessage) already
            // shows the notification. Having both caused duplicate notifications.
            if (isAdmin && arr && arr.length > 0) {
              const newest = arr[0];
              if (newest) lastNotifiedApprovalRef.current = newest.id;
            }
            prevApprovalCountRef.current = count;
          });
        }
      } catch (e) {
        console.error('App approvals listener failed', e);
      }
    })();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [user, activeBookId]);

  // Global service worker message handler for approval actions (works even when ApprovalCenter isn't mounted)
  useEffect(() => {
    if (!user) return;
    const isAdmin = (user as any).role === UserRole.ADMIN || (user as any).role === 'MANAGER';
    if (!isAdmin) return;
    const handleSWMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'APPROVAL_ACTION' && event.data.approvalId) {
        const isApprove = event.data.action === 'approve';
        try {
          const svc = await import('./services/firestoreService');
          await svc.approveRequest(event.data.approvalId, user.id || user.uid || 'admin', isApprove);
        } catch (e) {
          console.error('Approval from notification failed:', e);
        }
        // Navigate to approvals page
        window.location.hash = '#/approvals';
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => { navigator.serviceWorker?.removeEventListener('message', handleSWMessage); };
  }, [user]);

  // 2. Keyboard Listeners
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { (document.activeElement as HTMLElement)?.blur(); }
    };
    const handleQuickAction = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setQuickActionsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('keydown', handleQuickAction);
    
    // Save session before page unload
    const handleBeforeUnload = () => {
      endSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('keydown', handleQuickAction);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 3. Helper to logout
  const handleLogout = () => {
    auth.signOut();
    // Clear saved session
    localStorage.removeItem('savedUserSession');
    // also clear local user state for mock-login flows
    setUser(null);
    setUserScope(null);
  };

  // --- CONDITIONAL RENDERING ---

  // --- TENANT PORTAL MODE ---
  if (isTenantMode) {
    if (tenantUser) {
      return (
        <TenantDashboard
          tenant={tenantUser}
          onLogout={() => {
            localStorage.removeItem('tenantSession');
            setTenantUser(null);
          }}
        />
      );
    }
    return (
      <TenantLogin
        onLogin={(tenant: any) => setTenantUser(tenant)}
        onSwitchToStaff={() => {
          setIsTenantMode(false);
          window.location.hash = '#/';
        }}
      />
    );
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500 font-medium">{t('app.loadingApp')}</div>;
  }

  // If no user is logged in, show the styled Login component
  if (!user) {
    return <Login onLogin={(u: any) => {
      // Save session to localStorage so login persists across page reloads
      try {
        const sessionData = { id: u.id || u.uid, name: u.name || u.displayName, email: u.email, role: u.role, buildingId: u.buildingId, buildingIds: u.buildingIds, hasSystemAccess: u.hasSystemAccess, status: u.status, bookId: u.bookId };
        localStorage.setItem('savedUserSession', JSON.stringify(sessionData));
      } catch { /* ignore */ }
      setUser(u);
    }} onSwitchToTenant={() => {
      setIsTenantMode(true);
      window.location.hash = '#/tenant';
    }} />;
  }

  // --- MAIN APP UI ---

  const appLayout = (
    <div className={`${darkMode ? 'dark' : 'light'} app-theme`} dir={isRTL ? 'rtl' : 'ltr'}>
      <OfflineBanner />
      <div className={`app-shell flex min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 dark:bg-none font-sans text-emerald-900 dark:text-slate-100 transition-colors duration-300 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Sidebar user={user} onLogout={handleLogout} onToggleCollapse={setSidebarCollapsed} />
        {/* Dedicated mobile top bar (hidden on desktop) */}
        {!isOnChatPage && (
          <MobileHeader
            user={user}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
            notifCount={notif.unreadCount}
            onNotifClick={() => setNotifOpen(true)}
            onMenuClick={() => setMobileMenuOpen(true)}
            pendingApprovals={pendingApprovals}
          />
        )}
        <main className={`app-main flex-1 ${sidebarCollapsed ? (isRTL ? 'md:mr-20' : 'md:ml-20') : (isRTL ? 'md:mr-72' : 'md:ml-72')} ${isRTL ? 'mr-0' : 'ml-0'} ${isOnChatPage ? 'overflow-hidden h-screen' : 'md:p-8 p-3 pb-28 mobile-main-top-pad overflow-y-auto'} transition-all duration-300`}>
          {!isOnChatPage && (
            <GlobalSearchWithResults searching={searching} searchResults={searchResults} setSearching={setSearching} setSearchResults={setSearchResults} />
          )}

          <div className={isOnChatPage ? 'h-full' : 'max-w-7xl mx-auto page-transition mobile-main-container'}>
            {!isOnChatPage && (
              <header className="app-page-header mb-6 md:mb-8 hidden md:flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
                <div>
                  <h1 className="text-3xl font-black text-emerald-800 dark:text-emerald-400 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-900 to-green-700 dark:from-emerald-400 dark:to-green-400">
                    {t('app.welcome')}, {user?.displayName ? user.displayName.split(' ')[0] : (user?.email?.split('@')[0] || 'User')}
                  </h1>
                  <p className="text-emerald-600 dark:text-emerald-500 font-medium mt-1">{t('app.overview')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="hidden md:block">
                    <QuickActionButton onClick={() => setQuickActionsOpen(true)} />
                  </div>
                  <NotificationBell onClick={() => setNotifOpen(true)} count={notif.unreadCount} />
                  <LanguageToggle compact />
                  <button
                    className={`theme-toggle-btn mobile-theme-toggle ${darkMode ? 'is-light' : 'is-dark'}`}
                    onClick={toggleDarkMode}
                    title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    type="button"
                  >
                    {darkMode ? (
                      <>
                        <span className="hidden sm:inline">🌙 Dark Mode</span>
                        <span className="sm:hidden">🌙</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">☀️ Light Mode</span>
                        <span className="sm:hidden">☀️</span>
                      </>
                    )}
                  </button>
                  <div className="hidden sm:inline-block text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 rounded-full uppercase tracking-wider">
                    {fmtDate(new Date())}
                  </div>
                </div>
              </header>
            )}

            <ErrorBoundary>
              <Routes>
                {user?.role === UserRole.ENGINEER && user.role !== UserRole.ADMIN ? (
                  <>
                    <Route path="/stocks" element={<StockManager currentUser={user} />} />
                    <Route path="/settings" element={<Settings currentUser={user} />} />
                    <Route path="*" element={<Navigate to="/stocks" />} />
                  </>
                ) : (
                  <>
                    <Route path="/" element={<Dashboard currentUser={user} />} />
                    <Route path="/calendar" element={<CalendarView />} />
                    {/* ... other routes remain the same ... */}
                    <Route path="/entry" element={<EntryForm currentUser={user} />} />
                    <Route path="/bulk-rent" element={<BulkRentEntry currentUser={user} />} />
                    <Route path="/contracts" element={<ContractForm currentUser={user} />} />
                    <Route path="/history" element={<History currentUser={user} />} />
                    <Route path="/monitoring" element={<Monitoring />} />
                    <Route path="/customers" element={<CustomerManager />} />
                    <Route path="/directory" element={<BuildingDirectory />} />
                    {(user?.role === UserRole.ADMIN || user?.role === 'MANAGER') && (
                      <Route path="/approvals" element={<ApprovalCenter currentUser={user} />} />
                    )}
                    <Route path="/registry" element={<CarRegistry />} />
                    <Route path="/properties" element={<BuildingManager />} />
                    <Route path="/vendors" element={<VendorManager />} />
                    <Route path="/service-agreements" element={<ServiceAgreements />} />
                    <Route path="/tasks" element={<TaskManager currentUser={user} />} />
                    <Route path="/stocks" element={<StockManager currentUser={user} />} />
                    <Route path="/transfers" element={<TransferManager currentUser={user} />} />
                    <Route path="/borrowings" element={<BorrowingTracker currentUser={user} />} />
                    <Route path="/owner-expense" element={<EntryForm currentUser={user} prefillCategory="Owner Expense" />} />
                    <Route path="/owner-portal" element={<OwnerPortal />} />
                    <Route path="/staff" element={(user?.role === 'ADMIN' || user?.role === 'MANAGER') ? <StaffPortfolio currentUser={user} /> : <Navigate to="/dashboard" replace />} />
                    <Route path="/chat" element={<StaffChat currentUser={user} fullScreen />} />
                    <Route path="/sadad" element={<SadadBillManager />} />
                    <Route path="/ejar" element={<EjarIntegration />} />
                    <Route path="/utilities" element={<UtilitiesTracker />} />
                    <Route path="/security-deposits" element={<SecurityDeposits />} />
                    <Route path="/whatsapp" element={<WhatsAppIntegration />} />
                    <Route path="/bank-reconciliation" element={<BankReconciliation />} />
                    <Route path="/municipality-licenses" element={<MunicipalityLicenseTracker />} />
                    <Route path="/civil-defense" element={<CivilDefenseCompliance />} />
                    <Route path="/absher" element={<AbsherIntegration />} />
                    <Route path="/vat-report" element={<VATReport />} />
                    <Route path="/accounting" element={<AccountingModule />} />
                    <Route path="/accounting/:tab" element={<AccountingModule />} />
                    <Route path="/invoice/:invoiceId" element={<Invoice />} />
                    <Route path="/reports" element={<Reports currentUser={user} />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/archetype" element={<ArchetypeCard title="The Strategic Visionary" identityStatement="You lead with clarity, turning vision into measurable outcomes." description="..." percentage={19.1} year={2025} />} />
                    <Route path="/settings" element={<Settings currentUser={user} />} />
                    {user?.role === UserRole.ADMIN && (
                      <>
                        <Route path="/admin/employees" element={<EmployeeManager />} />
                        <Route path="/admin/settings" element={<Settings currentUser={user} />} />
                        <Route path="/admin/backup" element={<BackupManager />} />
                        <Route path="/admin/cloud-backup" element={<CloudBackupManager currentUser={user} accessToken={localStorage.getItem('gdrive_access_token') || undefined} />} />
                        <Route path="/admin/bulk-import" element={<BulkImportCustomers />} />
                        <Route path="/admin/books" element={<BookManager currentUser={user} />} />
                      </>
                    )}
                    <Route path="*" element={<Navigate to="/" />} />
                  </>
                )}
              </Routes>
            </ErrorBoundary>
          </div>
        </main>
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 mobile-bottom-nav-wrap">
          <BottomNav user={user} onMenuClick={() => setMobileMenuOpen(true)} pendingApprovals={pendingApprovals} />
        </div>
        <MobileMenu user={user} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} onLogout={handleLogout} pendingApprovals={pendingApprovals} />
        <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} notifications={notif.notifications} onMarkRead={notif.markRead} onMarkAllRead={notif.markAllRead} onDismiss={notif.dismiss} onDismissAll={notif.dismissAll} />
        <QuickActions user={user} isOpen={quickActionsOpen} onClose={() => setQuickActionsOpen(false)} />
        <FloatingToolsDock user={user} />
      </div>
    </div>
  );

  // Add the bug report button to always show on main app UI
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/landing" element={<ImmersiveLanding />} />
          <Route path="/tenant" element={
            tenantUser ? <TenantDashboard tenant={tenantUser} onLogout={() => { localStorage.removeItem('tenantSession'); setTenantUser(null); }} /> : 
            <TenantLogin onLogin={(tenant: any) => setTenantUser(tenant)} onSwitchToStaff={() => { setIsTenantMode(false); window.location.hash = '#/'; }} />
          } />
          <Route path="*" element={
            !user ? (
              <Login onLogin={(u: any) => {
                try {
                  const sessionData = { id: u.id || u.uid, name: u.name || u.displayName, email: u.email, role: u.role, buildingId: u.buildingId, buildingIds: u.buildingIds, hasSystemAccess: u.hasSystemAccess, status: u.status, bookId: u.bookId };
                  localStorage.setItem('savedUserSession', JSON.stringify(sessionData));
                } catch { }
                setUser(u);
              }} onSwitchToTenant={() => navigateToTenant()} />
            ) : appLayout
          } />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
};

const navigateToTenant = () => {
  window.location.hash = '#/tenant';
};

// Thin wrapper that provides the BookContext to the entire app
const App: React.FC = () => (
  <BookProvider>
    <AppContent />
  </BookProvider>
);

export default App;