/**
 * Firebase Cloud Functions — Push Notification Processor
 * 
 * Listens to the Firestore `pushNotifications` collection and sends
 * FCM push notifications to all registered admin devices.
 * 
 * This is what makes notifications work even when the app is CLOSED:
 * - The web app writes a doc to `pushNotifications` when staff creates an approval
 * - This Cloud Function picks it up and sends real FCM push to all admin tokens
 * - The service worker on each device receives it and shows a native notification
 * 
 * DEPLOYMENT:
 *   cd fcm-server/functions
 *   npm install
 *   firebase deploy --only functions
 * 
 * PREREQUISITES:
 *   - Firebase Blaze (pay-as-you-go) plan (required for Cloud Functions)
 *   - firebase-tools CLI installed: npm install -g firebase-tools
 *   - Logged in: firebase login
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

/**
 * Triggered when a new document is created in pushNotifications collection.
 * Sends the notification to all specified FCM tokens.
 */
exports.sendPushNotification = onDocumentCreated("pushNotifications/{docId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const payload = snap.data();
  const { tokens, title, body, data } = payload;

  if (!tokens || tokens.length === 0) {
    console.log("No tokens to send to");
    await snap.ref.update({ status: "skipped", processedAt: Date.now() });
    return;
  }

  const messaging = getMessaging();
  const db = getFirestore();

  try {
    const message = {
      notification: { title, body: (body || "").replace(/\n/g, " ") },
      data: {
        ...(data || {}),
        // Ensure all values are strings (FCM requirement)
        approvalId: String(data?.approvalId || ""),
        type: String(data?.type || ""),
        targetId: String(data?.targetId || ""),
        requestedBy: String(data?.requestedBy || ""),
        url: String(data?.url || "/#/approvals"),
      },
      webpush: {
        headers: { Urgency: "high", TTL: "86400" },
        notification: {
          title,
          body: (body || "").replace(/\n/g, " "),
          icon: "/images/logo-192.png",
          badge: "/images/logo-192.png",
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: true,
          renotify: true,
          tag: data?.approvalId || "approval-" + Date.now(),
          actions: [
            { action: "approve", title: "✅ Approve" },
            { action: "reject", title: "❌ Reject" },
          ],
        },
        fcmOptions: { link: data?.url || "/#/approvals" },
      },
      tokens: tokens.filter(Boolean),
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log(`Push sent: ${response.successCount} success, ${response.failureCount} failed of ${tokens.length} tokens`);

    // Clean up stale tokens
    if (response.failureCount > 0) {
      const staleTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
          staleTokens.push(tokens[idx]);
        }
      });
      // Remove stale tokens from Firestore
      for (const stale of staleTokens) {
        try {
          await db.collection("userTokens").doc(stale).delete();
          console.log("Removed stale token:", stale.slice(0, 20) + "...");
        } catch (e) { /* ignore */ }
      }
    }

    await snap.ref.update({
      status: "sent",
      processedAt: Date.now(),
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err) {
    console.error("Push send error:", err);
    await snap.ref.update({ status: "error", error: err.message, processedAt: Date.now() });
  }
});
