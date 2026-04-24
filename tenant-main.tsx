import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './i18n';
import { TenantLogin, TenantDashboard } from './components/TenantPortal';

// Defined strict types for better safety than 'any'
interface TenantProfile {
  id: string | number;
  name: string;
  email?: string;
  isTenant: boolean;
  token?: string; 
}

const TenantApp: React.FC = () => {
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const saved = localStorage.getItem('tenantSession');
        if (saved) {
          const parsed = JSON.parse(saved);
          
          // Safety Check: Ensure the parsed data actually looks like a tenant
          if (parsed && parsed.isTenant) {
            setTenant(parsed);
          } else {
            // If data exists but is invalid, clear it so we don't loop errors
            localStorage.removeItem('tenantSession');
          }
        }
      } catch (error) {
        console.error("Failed to parse session:", error);
        localStorage.removeItem('tenantSession');
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
  }, []);

  const handleLogin = (tenantData: TenantProfile) => {
    setTenant(tenantData);
    localStorage.setItem('tenantSession', JSON.stringify(tenantData));
  };

  const handleLogout = () => {
    setTenant(null);
    localStorage.removeItem('tenantSession');
  };

  const handleSwitchToStaff = () => {
    // Navigate to main staff portal
    window.location.href = '/';
  };

  if (loading) {
    // You can replace this with your own LoadingComponent if you have one
    return null;
  }

  return (
    <LanguageProvider>
      {tenant ? (
        <TenantDashboard tenant={tenant} onLogout={handleLogout} />
      ) : (
        <TenantLogin 
          onLogin={handleLogin} 
          onSwitchToStaff={handleSwitchToStaff} 
        />
      )}
    </LanguageProvider>
  );
};

// Safe DOM rendering
const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(<TenantApp />);
} else {
  console.error("Root element not found. Unable to render TenantApp.");
}