/**
 * Push Notification Service
 * Handles FCM token management, browser notifications, and push notification sending.
 * Admin users receive push notifications when staff create approval requests.
 * Notifications include Approve / Reject action buttons.
 * 
 * BACKGROUND PUSH ARCHITECTURE:
 * 1. Admin devices register their FCM token in Firestore (userTokens collection)
 * 2. When a staff member creates an approval request, we:
 *    a) Write a notification doc to Firestore (pushNotifications collection) — this acts
 *       as a relay queue that Firestore Cloud Functions (or the push-server) can pick up.
 *    b) Try sending via the FCM push-server (if configured and running)
 *    c) Fall back to local browser notification (only works if tab is open)
 * 3. The service worker (sw.js) imports Firebase Messaging SDK and handles
 *    onBackgroundMessage for when the app is fully closed or minimized.
 */

import { db } from '../firebase';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

// ─── VAPID key (Web Push certificate from Firebase Console) ───
// Intentionally empty by default. A valid public VAPID key must be configured in Settings.
const DEFAULT_VAPID_KEY = '';
let hasLoggedInvalidVapidKey = false;

const isValidVapidKey = (value: string | null | undefined): value is string => {
  if (!value) return false;
  const normalized = value.trim();
  // Firebase Web Push public keys are base64url strings and are typically much longer than 44 chars.
  return normalized.length >= 80 && /^[A-Za-z0-9_-]+$/.test(normalized);
};

const getVapidKey = (): string | null => {
  const storedKey = localStorage.getItem('fcm_vapid_key');
  const vapidKey = storedKey || DEFAULT_VAPID_KEY;

  if (!vapidKey) return null;
  if (isValidVapidKey(vapidKey)) return vapidKey.trim();

  if (!hasLoggedInvalidVapidKey) {
    console.log('Push: Skipping FCM setup because the configured VAPID key is invalid. Add a valid key in Settings to enable background push.');
    hasLoggedInvalidVapidKey = true;
  }
  return null;
};

// FCM Server URL – the companion Express server that sends push notifications.
const getFcmServerUrl = () => localStorage.getItem('fcm_server_url') || '';

// ─── Browser Notification Permission ───

export const isNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  return permission;
};

// ─── FCM Token Management ───

let cachedToken: string | null = null;
let tokenTimestamp: number = 0;
const TOKEN_MAX_AGE = 1000 * 60 * 60 * 12; // Refresh FCM token every 12 hours

/**
 * Get or refresh the FCM token using Firebase Messaging.
 * Requires VAPID key to be configured.
 * Waits for service worker to be ready before requesting token.
 * Automatically refreshes if the cached token is older than 12 hours.
 */
export const getFcmToken = async (): Promise<string | null> => {
  // Use cached token only if it's fresh
  if (cachedToken && (Date.now() - tokenTimestamp) < TOKEN_MAX_AGE) return cachedToken;
  cachedToken = null; // Force re-acquire
  const vapidKey = getVapidKey();
  if (!vapidKey) {
    console.log('Push: VAPID key not configured or invalid; skipping FCM token registration.');
    return null;
  }
  try {
    // Ensure service worker is ready
    if (!('serviceWorker' in navigator)) {
      console.warn('Push: Service workers not supported');
      return null;
    }

    const swReg = await navigator.serviceWorker.ready;
    if (!swReg) {
      console.warn('Push: Service worker did not become ready');
      return null;
    }

    const { getMessaging, getToken } = await import('firebase/messaging');
    const { app } = await import('../firebase');
    
    let messaging;
    try {
      messaging = getMessaging(app);
    } catch (err: any) {
      console.warn('Push: Firebase Messaging service unavailable', err?.message);
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: swReg,
    });
    
    if (token) {
      cachedToken = token;
      tokenTimestamp = Date.now();
      console.log('Push: FCM token acquired successfully');
    } else {
      console.log('Push: getToken returned empty token');
    }
    return token;
  } catch (err: any) {
    // FCM token failures are non-critical — Firestore real-time listener handles notifications
    const msg = err?.message || '';
    if (msg.includes('applicationServerKey is not valid')) {
      console.log('Push: The configured VAPID key is invalid. Update the FCM VAPID key in Settings to enable background push.');
    } else if (msg.includes('authentication credential') || msg.includes('token-subscribe-failed')) {
      console.log('Push: FCM token unavailable (credentials may need updating). Using Firestore real-time notifications instead.');
    } else if (msg.includes('Service') || msg.includes('not available')) {
      console.log('Push: FCM service not available in this context.');
    } else {
      console.warn('Push: FCM token error:', msg);
    }
    return null;
  }
};

/**
 * Save a user's FCM token to Firestore so the server can send them pushes.
 * Stores the user's role so we can filter tokens by role when sending notifications.
 * Always re-registers to handle token refresh and keep lastActive updated.
 */
export const registerDeviceForPush = async (userId: string, userName: string, role?: string): Promise<boolean> => {
  try {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('Push: Notification permission not granted');
      return false;
    }

    const token = await getFcmToken();
    if (!token) {
      // Browser notifications work fine without FCM token
      return true;
    }

    // Save token to Firestore under userTokens/{token}
    // Always update to keep lastActive fresh and handle token changes
    await setDoc(doc(db, 'userTokens', token), {
      userId,
      userName,
      role: role || 'ADMIN',
      token,
      createdAt: Date.now(),
      lastActive: Date.now(),
      platform: navigator.userAgent,
    });

    // Clean up any old tokens for this user on this device (different token IDs)
    try {
      const oldTokenKey = `fcm_prev_token_${userId}`;
      const prevToken = localStorage.getItem(oldTokenKey);
      if (prevToken && prevToken !== token) {
        // Old token is stale, remove it from Firestore
        await deleteDoc(doc(db, 'userTokens', prevToken)).catch(() => {});
      }
      localStorage.setItem(oldTokenKey, token);
    } catch (e) { /* non-critical */ }

    console.log('Push: Device registered for push notifications');
    return true;
  } catch (err) {
    console.warn('Push: Registration failed', err);
    return false;
  }
};

/**
 * Remove device token when logging out.
 * Does NOT delete the token from Firestore — we keep it so push notifications
 * still reach this device even when the user is not actively using the app.
 * The service worker handles background pushes independently.
 */
export const unregisterDevice = async (): Promise<void> => {
  cachedToken = null;
};

/**
 * Fetch all registered admin/manager FCM tokens from Firestore.
 * Only returns tokens for users with ADMIN or MANAGER role.
 * Filters out tokens older than 30 days to avoid sending to stale devices.
 */
export const getAdminTokens = async (): Promise<string[]> => {
  try {
    const snap = await getDocs(collection(db, 'userTokens'));
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return snap.docs
      .map(d => d.data())
      .filter(d => d.token && (d.role === 'ADMIN' || d.role === 'MANAGER') && (d.lastActive || d.createdAt || 0) > thirtyDaysAgo)
      .map(d => d.token);
  } catch (err) {
    console.error('Push: Failed to fetch admin tokens', err);
    return [];
  }
};

// ─── Send Push Notification (via FCM server or browser fallback) ───

interface ApprovalNotificationData {
  approvalId: string;
  type: string;          // 'transaction_delete' | 'transaction_edit' | 'contract_finalize'
  requestedBy: string;   // user name
  targetId: string;      // transaction/contract ID
  details?: string;      // extra info
}

/**
 * Notify all admin devices about a new approval request.
 * Uses three delivery channels for maximum reliability:
 *   1. Firestore pushNotifications queue (for Cloud Functions / external processor)
 *   2. FCM push-server HTTP call (for self-hosted server)
 *   3. Local browser notification fallback (for current tab only)
 */
export const notifyAdminsOfRequest = async (data: ApprovalNotificationData): Promise<void> => {
  const typeLabels: Record<string, { emoji: string; label: string }> = {
    transaction_delete: { emoji: '🗑️', label: 'Delete Transaction' },
    transaction_edit:   { emoji: '✏️', label: 'Edit Transaction' },
    contract_finalize:  { emoji: '📋', label: 'Finalize Contract' },
    contract_delete:    { emoji: '🗑️', label: 'Delete Contract' },
  };

  const meta = typeLabels[data.type] || { emoji: '📋', label: data.type };
  const title = `${meta.emoji} New Approval Request`;
  const body = data.details
    ? `${meta.label}\nFrom: ${data.requestedBy}\n${data.details}`
    : `${meta.label}\nFrom: ${data.requestedBy}\nTarget: #${data.targetId?.slice(0, 8) || 'N/A'}`;
  const tokens = await getAdminTokens();

  // Use ONLY ONE notification channel to avoid duplicates
  let notificationSent = false;

  // ─── Channel 1: Try FCM push-server first (best for cross-device) ───
  try {
    const serverUrl = getFcmServerUrl();
    if (tokens.length > 0 && serverUrl) {
      const res = await fetch(`${serverUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          title,
          body,
          data: {
            approvalId: data.approvalId,
            type: data.type,
            targetId: data.targetId,
            requestedBy: data.requestedBy,
            url: `/#/approvals`,
          },
        }),
      });
      if (res.ok) {
        notificationSent = true;
      }
    }
  } catch (e) {
    /* FCM server not available – fall through to browser notification */
  }

  // ─── Channel 2: Local browser notification fallback (only if FCM failed) ───
  if (!notificationSent) {
    showBrowserNotification(title, body, {
      approvalId: data.approvalId,
      type: data.type,
      targetId: data.targetId,
      requestedBy: data.requestedBy,
    });
  }
};

// ─── Browser / Local Notifications ───

/**
 * Show a browser notification (Notification API).
 * Works when the tab is open but might not be focused.
 */
export const showBrowserNotification = (
  title: string,
  body: string,
  data?: Record<string, string>
): void => {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        reg.showNotification(title, {
          body,
          icon: '/images/logo-192.png',
          badge: '/images/logo-192.png',
          vibrate: [200, 100, 200],
          tag: data?.approvalId || 'approval-notification',
          renotify: true,
          requireInteraction: true,
          silent: false,
          timestamp: Date.now(),
          actions: [
            { action: 'approve', title: '✅ Approve' },
            { action: 'reject', title: '❌ Reject' },
          ],
          data: {
            ...data,
            url: `${self.location?.origin || ''}/#/approvals`,
          },
        } as any);
      }
    });
  } catch (err) {
    // Fallback to basic Notification API (no actions)
    try {
      new Notification(title, {
        body,
        icon: '/images/logo-192.png',
        badge: '/images/logo-192.png',
        silent: false,
      } as any);
    } catch (e) { /* ignore */ }
  }
};

// ─── Listen for foreground FCM messages ───

let foregroundListenerActive = false;
let foregroundListenerRetries = 0;
const MAX_FOREGROUND_RETRIES = 3;

/**
 * Listen for FCM messages while the app is in the foreground.
 * Shows a browser notification when a message arrives.
 * Guard ensures only one listener is registered per session.
 * Retries with exponential backoff if messaging service is not immediately available.
 */
export const listenForForegroundMessages = async (
  callback?: (payload: any) => void
): Promise<void> => {
  if (foregroundListenerActive) return;
  foregroundListenerActive = true; // Set guard immediately, not inside callback
  if (!getVapidKey()) {
    foregroundListenerActive = false;
    return;
  }

  const attemptSetupListener = async (retryCount: number): Promise<void> => {
    try {
      // Ensure service worker is fully ready before attempting messaging initialization
      if ('serviceWorker' in navigator) {
        const swReg = await navigator.serviceWorker.ready;
        if (!swReg) {
          throw new Error('Service worker not ready for messaging');
        }
      }

      const { getMessaging, onMessage } = await import('firebase/messaging');
      const { app } = await import('../firebase');
      
      let messaging;
      try {
        messaging = getMessaging(app);
      } catch (err: any) {
        // Messaging service may fail if called too early; retry with backoff
        if (retryCount < MAX_FOREGROUND_RETRIES && err?.message?.includes('messaging')) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`Push: Messaging service not ready, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_FOREGROUND_RETRIES})`);
          setTimeout(() => attemptSetupListener(retryCount + 1), delay);
          return;
        }
        throw err;
      }

      onMessage(messaging, (payload) => {
        console.log('Push: Foreground message received', payload);
        const title = payload.notification?.title || 'Approval Request';
        const body = payload.notification?.body || 'A staff member needs your approval';

        showBrowserNotification(title, body, payload.data as any);

        if (callback) callback(payload);
      });

      console.log('Push: Foreground message listener active');
    } catch (err: any) {
      const msg = err?.message || String(err);
      
      // Don't treat all errors as failures — some environments don't support FCM
      if (msg.includes('messaging') || msg.includes('not available')) {
        console.log('Push: Foreground messaging unavailable in this context (browser/network may not support FCM)');
      } else {
        console.warn('Push: Failed to set up foreground listener', err);
      }

      foregroundListenerActive = false; // Reset so it can retry if user re-initiates
    }
  };

  // Start with first attempt
  await attemptSetupListener(0);
};
