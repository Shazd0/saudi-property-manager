import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n';
import PermissionGate from './components/PermissionGate';

// Polyfill: Ensure crypto.randomUUID exists across browsers
(function ensureRandomUUID() {
  const globalCrypto: any = (globalThis as any).crypto;

  const genV4 = () => {
    const c: any = (globalThis as any).crypto;
    const bytes = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  if (!globalCrypto) {
    (globalThis as any).crypto = {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
      randomUUID: genV4,
    };
    return;
  }

  if (typeof globalCrypto.randomUUID !== 'function') {
    globalCrypto.randomUUID = genV4;
  }
})();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <PermissionGate>
        <App />
      </PermissionGate>
    </LanguageProvider>
  </React.StrictMode>
);

// Register service worker for offline support & PWA install prompt.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[App] Service worker registered, scope:', reg.scope);
      
      // Check for updates every 30 minutes
      setInterval(() => { reg.update(); }, 30 * 60 * 1000);
      
      // When a new SW is found, notify user
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // New version available — show a subtle refresh prompt
            console.log('[App] New service worker activated, refresh recommended');
          }
        });
      });
    }).catch((err) => {
      console.warn('Service worker registration failed', err);
    });
  });
}

// ── Global PWA Install Prompt Capture ──
// The beforeinstallprompt event can fire before any React component mounts.
// Store it globally so Dashboard (or any component) can use it on button click.
(window as any).__pwaInstallPrompt = null;
(window as any).__pwaInstalled = false;

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault(); // Prevent the mini-infobar
  (window as any).__pwaInstallPrompt = e;
  // Note: The "Banner not shown" message is expected when preventDefault() is called.
  // This is normal behavior and doesn't indicate an error.
});

window.addEventListener('appinstalled', () => {
  (window as any).__pwaInstalled = true;
  (window as any).__pwaInstallPrompt = null;
});
