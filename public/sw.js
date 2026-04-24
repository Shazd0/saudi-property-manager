// ─── Amlak Offline-First Service Worker ───
// Handles: caching, offline support, background sync, AND Firebase Cloud Messaging

// ─── Cache Configuration ───
const CACHE_VERSION = 'v2';
const STATIC_CACHE  = `amlak-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `amlak-dynamic-${CACHE_VERSION}`;
const CDN_CACHE     = `amlak-cdn-${CACHE_VERSION}`;
const IMG_CACHE     = `amlak-images-${CACHE_VERSION}`;
const FONT_CACHE    = `amlak-fonts-${CACHE_VERSION}`;
const API_CACHE     = `amlak-api-${CACHE_VERSION}`;

const MAX_DYNAMIC_CACHE = 100;
const MAX_IMG_CACHE = 60;

// App shell files that are precached on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/owner.html',
  '/tenant.html',
  '/manifest.webmanifest',
  '/index.css',
  '/images/logo.png',
  '/images/logo-192.png',
  '/images/logo-512.png',
  '/images/cologo.png',
];

// CDN origins that should be cached
const CACHEABLE_CDN = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'aistudiocdn.com',
];

// Origins that should NOT be cached (Firestore, auth, analytics)
const NO_CACHE_ORIGINS = [
  'firestore.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebase.googleapis.com',
  'www.googleapis.com',
  'fcm.googleapis.com',
  'firebaselogging-pa.googleapis.com',
  'google-analytics.com',
  'googletagmanager.com',
];

// ─── Firebase Cloud Messaging SDK for background push ───
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBovPiw_bjCnrd-6le5mPoOBME-N-6aPbs",
  authDomain: "saudi-property-manager.firebaseapp.com",
  projectId: "saudi-property-manager",
  storageBucket: "saudi-property-manager.firebasestorage.app",
  messagingSenderId: "854165833434",
  appId: "1:854165833434:web:bc550b5c79266bd1fb07e3"
});

const firestoreDb = firebase.firestore();

let messaging = null;
try {
  messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);
    const data = payload.data || {};
    const title = payload.notification?.title || data.title || '📬 Approval Required';
    const body = payload.notification?.body || data.body || 'A staff member needs your approval';
    const typeMeta = TYPE_META[data.type] || { emoji: '📋', label: data.type || 'Request', urgency: 'normal' };
    const requestedBy = data.requestedBy || '';
    const targetId = data.targetId || '';
    const time = formatTime();
    const richBody = requestedBy
      ? `${typeMeta.emoji} ${typeMeta.label}\n👤 ${requestedBy}${targetId ? ` · #${targetId.slice(0, 8)}` : ''}\n🕐 ${time}`
      : body;
    const options = {
      body: richBody,
      icon: '/images/logo-192.png',
      badge: '/images/logo-192.png',
      vibrate: typeMeta.urgency === 'high' ? [300, 100, 300, 100, 300] : [200, 100, 200],
      tag: data.approvalId || 'approval-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      silent: false,
      timestamp: Date.now(),
      actions: [
        { action: 'approve', title: '✅ Approve', icon: '/images/logo-192.png' },
        { action: 'reject',  title: '❌ Reject',  icon: '/images/logo-192.png' },
      ],
      data: { ...data, url: data.url || '/#/approvals', openedAt: Date.now() },
    };
    return self.registration.showNotification(title, options);
  });
} catch (e) {
  console.warn('[SW] Firebase Messaging init failed:', e);
}

// ═══════════════════════════════════════════
// ═══ CACHING & OFFLINE SUPPORT ═══════════
// ═══════════════════════════════════════════

// ─── Install: precache app shell ───
self.addEventListener('install', (event) => {
  console.log('[SW] Installing with cache', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[SW] Some app shell files could not be precached:', err);
        // Still install even if some files fail
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches ───
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating, cleaning old caches');
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, CDN_CACHE, IMG_CACHE, FONT_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (!currentCaches.includes(key)) {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

// ─── Helper: Trim cache to max entries ───
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    // Delete oldest entries (first in, first out)
    const excess = keys.length - maxItems;
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// ─── Helper: check if URL is from a cacheable CDN ───
function isCacheableCDN(url) {
  return CACHEABLE_CDN.some(cdn => url.hostname.includes(cdn));
}

// ─── Helper: should skip caching entirely ───
function shouldSkipCache(url) {
  return NO_CACHE_ORIGINS.some(origin => url.hostname.includes(origin));
}

// ─── Helper: is image request ───
function isImageRequest(url, request) {
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif'];
  return imageExts.includes(ext) || (request.destination === 'image');
}

// ─── Helper: is font request ───
function isFontRequest(url, request) {
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  return ext === 'woff' || ext === 'woff2' || ext === 'ttf' || ext === 'otf' || request.destination === 'font';
}

// ─── Offline fallback HTML ───
const OFFLINE_HTML = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Amlak - Offline</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Inter,-apple-system,sans-serif;background:linear-gradient(160deg,#ecfdf5,#f0fdf4,#fff,#f0fdfa);padding:24px}
.card{background:rgba(255,255,255,0.85);backdrop-filter:blur(20px);border:1px solid rgba(16,185,129,0.2);border-radius:24px;padding:48px 32px;max-width:400px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.08)}
.icon{width:80px;height:80px;border-radius:20px;background:linear-gradient(135deg,#10b981,#059669);display:inline-flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 8px 24px rgba(16,185,129,0.3)}
.icon svg{width:40px;height:40px;color:#fff}
h1{font-size:22px;font-weight:800;color:#064e3b;margin-bottom:8px}
p{color:#047857;font-size:14px;line-height:1.6;margin-bottom:24px}
button{background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(16,185,129,0.3);transition:all 0.2s}
button:active{transform:scale(0.96)}
.sub{color:#6ee7b7;font-size:11px;margin-top:16px;font-weight:500}
</style></head><body>
<div class="card">
<div class="icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01"/></svg></div>
<h1>You're Offline</h1>
<p>No internet connection detected. Your data is saved locally and will sync automatically when you're back online.</p>
<button onclick="location.reload()">Try Again</button>
<div class="sub">Amlak Premium Manager</div>
</div></body></html>`;

// ─── Fetch Handler: routing strategy per request type ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, chrome extensions, and firebase/analytics API calls
  if (event.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  // Skip Vite dev server HMR & internal requests
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/__') || url.pathname.includes('?token=')) return;
  if (shouldSkipCache(url)) return;

  // Strategy 1: Fonts → Cache First (rarely change)
  if (isFontRequest(url, event.request)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached || new Response('', { status: 408 }));
        })
      )
    );
    return;
  }

  // Strategy 2: Images → Cache First with fallback
  if (isImageRequest(url, event.request)) {
    event.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response && response.ok) {
              cache.put(event.request, response.clone());
              trimCache(IMG_CACHE, MAX_IMG_CACHE);
            }
            return response;
          }).catch(() => null);
          return cached || fetchPromise || new Response('', { status: 408 });
        })
      )
    );
    return;
  }

  // Strategy 3: CDN resources (Tailwind, Google Fonts CSS, importmap libs) → Stale While Revalidate
  if (isCacheableCDN(url)) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response && response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => null);
          return cached || fetchPromise || new Response('', { status: 408 });
        })
      )
    );
    return;
  }

  // Strategy 4: Same-origin navigation → Network First, fall back to cache, then offline page
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          return caches.match('/index.html').then(idx =>
            idx || new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html' } })
          );
        })
      )
    );
    return;
  }

  // Strategy 5: JS/CSS app assets (same-origin) → Stale While Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          const fetchPromise = fetch(event.request).then(response => {
            if (response && response.ok) {
              cache.put(event.request, response.clone());
              trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE);
            }
            return response;
          }).catch(() => null);
          return cached || fetchPromise || new Response('', { status: 408 });
        })
      )
    );
    return;
  }
});

// ═══════════════════════════════════════════
// ═══ BACKGROUND SYNC ═════════════════════
// ═══════════════════════════════════════════

self.addEventListener('sync', (event) => {
  if (event.tag === 'amlak-offline-sync') {
    event.waitUntil(processOfflineQueue());
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'amlak-periodic-sync') {
    event.waitUntil(processOfflineQueue());
  }
});

async function processOfflineQueue() {
  // Open IndexedDB and process queued operations
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('offlineQueue', 'readonly');
    const store = tx.objectStore('offlineQueue');
    const allOps = await idbGetAll(store);
    
    if (!allOps || allOps.length === 0) return;
    console.log(`[SW] Processing ${allOps.length} offline operations`);
    
    for (const op of allOps) {
      try {
        await executeOfflineOp(op);
        // Remove from queue on success
        const delTx = db.transaction('offlineQueue', 'readwrite');
        delTx.objectStore('offlineQueue').delete(op.id);
        await idbTxComplete(delTx);
      } catch (err) {
        console.warn('[SW] Failed to sync op:', op.id, err);
        // Leave in queue for next sync attempt
      }
    }
    
    // Notify open clients that sync is complete
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'OFFLINE_SYNC_COMPLETE', count: allOps.length });
    }
  } catch (err) {
    console.error('[SW] Offline sync error:', err);
  }
}

async function executeOfflineOp(op) {
  const { collection: colName, docId, action, data } = op;
  if (action === 'set' && docId) {
    await firestoreDb.collection(colName).doc(docId).set(data, { merge: true });
  } else if (action === 'add') {
    await firestoreDb.collection(colName).add(data);
  } else if (action === 'delete' && docId) {
    await firestoreDb.collection(colName).doc(docId).delete();
  }
}

// ─── IDB helpers for SW context ───
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('AmlakOfflineDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('offlineQueue')) db.createObjectStore('offlineQueue', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('dataCache')) db.createObjectStore('dataCache', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTxComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Type Config for rich notifications ───
const TYPE_META = {
  transaction_delete: { emoji: '🗑️', label: 'Delete Transaction', urgency: 'high' },
  transaction_edit:   { emoji: '✏️', label: 'Edit Transaction',   urgency: 'normal' },
  contract_finalize:  { emoji: '📋', label: 'Finalize Contract',  urgency: 'normal' },
  salary_payment:     { emoji: '💰', label: 'Salary Payment',     urgency: 'normal' },
  borrowing:          { emoji: '🏦', label: 'Borrowing Request',  urgency: 'normal' },
};

const formatTime = () => {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

// ─── Push Notification Handler ───
// NOTE: Removed duplicate 'push' event listener.
// Firebase Messaging SDK's onBackgroundMessage (above) already handles
// incoming FCM pushes and shows notifications. Having both caused
// duplicate notifications for each approval request.

// ─── Direct Approval Handler (runs in SW without opening app) ───
async function handleApprovalDirect(approvalId, action) {
  const approve = action === 'approve';
  try {
    const docRef = firestoreDb.collection('approvals').doc(approvalId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error('Approval not found');
    const ap = { id: snap.id, ...snap.data() };

    if (!approve) {
      // REJECT: update status and delete
      await docRef.update({ handledBy: 'admin-sw', handledAt: Date.now(), status: 'REJECTED' });
      await firestoreDb.collection('audit').add({ action: 'REJECT_REQUEST', details: 'Rejected from notification for ' + approvalId, userId: 'admin-sw', timestamp: Date.now() });
      await docRef.delete().catch(() => {});
      return { success: true, label: 'Rejected' };
    }

    // APPROVE: Execute the action, then mark as approved
    if (ap.type === 'transaction_delete' && ap.targetCollection === 'transactions' && ap.targetId) {
      await firestoreDb.collection('transactions').doc(ap.targetId).delete();
    } else if (ap.payload && ap.targetCollection && ap.targetId) {
      // Clean undefined values from payload
      const cleanPayload = {};
      Object.entries(ap.payload || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) cleanPayload[k] = v; });
      await firestoreDb.collection(ap.targetCollection).doc(ap.targetId).set(cleanPayload, { merge: true });
    }

    await docRef.update({ handledBy: 'admin-sw', handledAt: Date.now(), status: 'APPROVED' });
    await firestoreDb.collection('audit').add({ action: 'APPROVE_REQUEST', details: 'Approved from notification for ' + approvalId, userId: 'admin-sw', timestamp: Date.now() });
    await docRef.delete().catch(() => {});
    return { success: true, label: 'Approved' };
  } catch (err) {
    console.error('[SW] Direct approval failed:', err);
    return { success: false, label: 'Failed: ' + (err.message || 'Unknown error') };
  }
}

// ─── Notification Click Handler ───
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // If an action button was clicked AND we have an approvalId, handle directly without opening app
  if (action && data.approvalId && (action === 'approve' || action === 'reject')) {
    event.waitUntil(
      handleApprovalDirect(data.approvalId, action).then((result) => {
        const emoji = result.success ? (action === 'approve' ? '✅' : '❌') : '⚠️';
        const title = result.success ? `${emoji} ${result.label}` : `${emoji} Action Failed`;
        const typeMeta = TYPE_META[data.type] || { emoji: '📋', label: data.type || 'Request' };
        const body = result.success
          ? `${typeMeta.emoji} ${typeMeta.label} · #${(data.targetId || '').slice(0, 8)}`
          : result.label;

        return self.registration.showNotification(title, {
          body,
          icon: '/images/logo-192.png',
          badge: '/images/logo-192.png',
          vibrate: result.success ? [100, 50, 100] : [300, 100, 300],
          tag: 'approval-result-' + data.approvalId,
          renotify: true,
          requireInteraction: false,
          silent: false,
          timestamp: Date.now(),
        }).then(() => {
          // Also notify any open clients to refresh
          return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
              client.postMessage({
                type: 'APPROVAL_HANDLED',
                action: action,
                approvalId: data.approvalId,
                success: result.success,
              });
            }
          });
        });
      })
    );
    return;
  }

  // Default: clicking notification body opens the app
  let url = data.url || '/#/approvals';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.registration.scope) || client.url.includes(self.location.origin)) {
          client.focus();
          return;
        }
      }
      return clients.openWindow(self.location.origin + '/' + url);
    })
  );
});

// ─── Message handler for FCM ───
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
