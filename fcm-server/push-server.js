/**
 * FCM Push Notification Server
 * 
 * Receives push notification requests from the Amlak web app and sends them
 * to admin devices via Firebase Cloud Messaging (FCM).
 * 
 * Setup:
 * 1. Download your Firebase service account key from:
 *    Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 * 2. Save it as `fcm-service-account.json` in this folder
 * 3. Run: npm run push
 * 
 * Environment variables (optional):
 *   PORT=3200                    - HTTP port (default 3200)
 *   GOOGLE_APPLICATION_CREDENTIALS=./fcm-service-account.json
 */

import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'fs';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3200;

// ─── Firebase Admin SDK ───
let admin = null;
let messaging = null;

async function initFirebase() {
  try {
    const firebaseAdmin = await import('firebase-admin');
    admin = firebaseAdmin.default || firebaseAdmin;

    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './fcm-service-account.json';
    
    if (existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      messaging = admin.messaging();
      console.log('✅ Firebase Admin initialized with service account');
    } else {
      console.warn('⚠️  No service account file found at:', serviceAccountPath);
      console.warn('   Push notifications will be queued but not delivered.');
      console.warn('   Download from: Firebase Console → Project Settings → Service Accounts');
    }
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
}

// ─── POST /send ───
// Sends push notification to specified FCM tokens
app.post('/send', async (req, res) => {
  const { tokens, title, body, data } = req.body;

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: 'No tokens provided' });
  }
  if (!title) {
    return res.status(400).json({ error: 'Missing title' });
  }

  console.log(`📤 Sending push to ${tokens.length} device(s): "${title}"`);

  if (!messaging) {
    console.warn('⚠️  Firebase Messaging not initialized – notification not sent');
    return res.json({ success: false, reason: 'Firebase not configured', queued: true });
  }

  try {
    // Send to each token (multicast)
    const message = {
      notification: {
        title: title,
        body: body || '',
      },
      data: {
        ...(data || {}),
        requestedBy: data?.requestedBy || '',
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400',
        },
        notification: {
          title: title,
          body: body || '',
          icon: '/images/logo-192.png',
          badge: '/images/logo-192.png',
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: 'true',
          renotify: 'true',
          silent: 'false',
          timestamp: String(Date.now()),
          actions: [
            { action: 'approve', title: '✅ Approve' },
            { action: 'reject',  title: '❌ Reject' },
          ],
        },
        fcmOptions: {
          link: data?.url || '/#/approvals',
        },
      },
      tokens: tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    
    console.log(`✅ Sent: ${response.successCount} success, ${response.failureCount} failed`);
    
    // Log failures
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.warn(`   Token ${idx} failed:`, resp.error?.code || resp.error?.message);
        }
      });
    }

    res.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err) {
    console.error('❌ Send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /health ───
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    firebase: !!messaging,
    uptime: process.uptime(),
  });
});

// ─── Firestore Queue Processor ───
// Polls the pushNotifications collection for pending docs and sends them.
// This enables push even without Cloud Functions deployed.
let firestoreDb = null;

async function initFirestoreListener() {
  if (!admin) return;
  try {
    firestoreDb = admin.firestore();
    console.log('📡 Listening for pushNotifications in Firestore...');
    
    // Real-time listener on pending notifications
    firestoreDb.collection('pushNotifications')
      .where('status', '==', 'pending')
      .onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== 'added') continue;
          const docRef = change.doc.ref;
          const data = change.doc.data();
          
          if (!data.tokens || data.tokens.length === 0 || !messaging) {
            await docRef.update({ status: 'skipped', processedAt: Date.now() });
            continue;
          }

          console.log(`📤 Processing queued notification: "${data.title}" → ${data.tokens.length} device(s)`);
          
          try {
            const message = {
              notification: { title: data.title, body: (data.body || '').replace(/\n/g, ' ') },
              data: {
                ...(data.data || {}),
                approvalId: String(data.data?.approvalId || ''),
                type: String(data.data?.type || ''),
                targetId: String(data.data?.targetId || ''),
                requestedBy: String(data.data?.requestedBy || ''),
                url: String(data.data?.url || '/#/approvals'),
              },
              webpush: {
                headers: { Urgency: 'high', TTL: '86400' },
                notification: {
                  title: data.title,
                  body: (data.body || '').replace(/\n/g, ' '),
                  icon: '/images/logo-192.png',
                  badge: '/images/logo-192.png',
                  vibrate: [300, 100, 300, 100, 300],
                  requireInteraction: 'true',
                  renotify: 'true',
                  actions: [
                    { action: 'approve', title: '✅ Approve' },
                    { action: 'reject', title: '❌ Reject' },
                  ],
                },
                fcmOptions: { link: data.data?.url || '/#/approvals' },
              },
              tokens: data.tokens.filter(Boolean),
            };

            const response = await messaging.sendEachForMulticast(message);
            console.log(`✅ Queue: ${response.successCount} success, ${response.failureCount} failed`);
            
            // Remove stale tokens
            if (response.failureCount > 0) {
              response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                  firestoreDb.collection('userTokens').doc(data.tokens[idx]).delete().catch(() => {});
                }
              });
            }
            
            await docRef.update({ status: 'sent', processedAt: Date.now(), successCount: response.successCount, failureCount: response.failureCount });
          } catch (err) {
            console.error('❌ Queue send error:', err.message);
            await docRef.update({ status: 'error', error: err.message, processedAt: Date.now() });
          }
        }
      }, (err) => {
        console.error('Firestore listener error:', err);
      });
  } catch (e) {
    console.warn('⚠️  Firestore queue listener not started:', e.message);
  }
}

// ─── Start ───
await initFirebase();
await initFirestoreListener();

app.listen(PORT, () => {
  console.log(`\n🚀 FCM Push Server running on http://localhost:${PORT}`);
  console.log(`   POST /send   — Send push notifications`);
  console.log(`   GET  /health — Health check\n`);
});
