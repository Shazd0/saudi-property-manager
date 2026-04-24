import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './i18n';
import OwnerLogin from './components/OwnerLogin';
import OwnerPortal from './components/OwnerPortal';
import { setUserScope, setCurrentBook } from './services/firestoreService';

interface OwnerProfile {
  id: string;
  name: string;
  isOwner: boolean;
  sharePercentage?: number;
  ownerBuildingIds?: string[];
  phone?: string;
}

const OwnerApp: React.FC = () => {
  const [owner, setOwner] = useState<OwnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const saved = localStorage.getItem('ownerSession');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.isOwner) {
            // Restore scope so data queries work
            setUserScope({ role: 'ADMIN', buildingIds: parsed.ownerBuildingIds || [] });
            setCurrentBook(parsed.bookId || 'default');
            setOwner(parsed);
          } else {
            localStorage.removeItem('ownerSession');
          }
        }
      } catch (error) {
        console.error('Failed to parse owner session:', error);
        localStorage.removeItem('ownerSession');
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
  }, []);

  const handleLogin = (ownerData: OwnerProfile) => {
    // Set scope to ADMIN so all data loads for the owner dashboard
    setUserScope({ role: 'ADMIN', buildingIds: ownerData.ownerBuildingIds || [] });
    setCurrentBook((ownerData as any).bookId || 'default');
    setOwner(ownerData);
    localStorage.setItem('ownerSession', JSON.stringify(ownerData));
  };

  const handleLogout = () => {
    setOwner(null);
    localStorage.removeItem('ownerSession');
  };

  const handleSwitchToStaff = () => {
    window.location.href = '/';
  };

  if (loading) {
    return null;
  }

  return (
    <LanguageProvider>
      {owner ? (
        <div className="min-h-screen" style={{ background: '#f8fafc' }}>
          {/* ── Clean Owner Header ── */}
          <div className="sticky top-0 z-50" style={{ 
            background: 'rgba(255,255,255,0.85)', 
            backdropFilter: 'blur(20px) saturate(180%)', 
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div className="max-w-7xl mx-auto px-3 sm:px-6">
              <div className="flex items-center justify-between h-[52px] sm:h-[56px]">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center bg-blue-50 border border-blue-100 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
                  </div>
                  <div className="leading-none min-w-0">
                    <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[2px] text-blue-500">AMLAK</p>
                    <p className="text-slate-800 font-black text-xs sm:text-sm tracking-tight truncate">{owner.name}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-bold transition-all duration-200 hover:bg-slate-100 bg-slate-50 border border-slate-100 text-slate-500 flex-shrink-0"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Dashboard */}
          <OwnerPortal currentUser={owner} />
        </div>
      ) : (
        <OwnerLogin onLogin={handleLogin} onSwitchToStaff={handleSwitchToStaff} />
      )}
    </LanguageProvider>
  );
};

// Safe DOM rendering
const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(<OwnerApp />);
} else {
  console.error('Root element not found. Unable to render OwnerApp.');
}
