# FCM Server (local/dev)

This small scaffold offers a single endpoint `/send` to deliver FCM push messages to a device token.

It supports two modes:

1. Using `firebase-admin` with a service account JSON (recommended for production).
2. Using the legacy HTTP endpoint with an `FCM_SERVER_KEY` (easier for quick testing).

Setup

- Install deps:

```bash
cd fcm-server
npm install
```

FCM server scaffold removed. This folder no longer contains a runnable server. Delete the `fcm-server` folder if you wish to remove the scaffold entirely.
  - `FIREBASE_SERVICE_ACCOUNT_PATH` environment variable pointing to your service account JSON file (or set the path in `.env`), OR
