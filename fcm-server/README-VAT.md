VAT Submit Prototype

This prototype provides two endpoints to preview and submit VAT returns to a configurable ZATCA sandbox URL.

Endpoints
- GET /vat/preview?month=YYYY-MM&tin=3126100894
  - Returns a preview payload built from transactions in Firestore for the given month.

- POST /vat/submit
  - Body: { month: 'YYYY-MM', tin: '3126100894' }
  - Builds payload and POSTs to `ZATCA_SANDBOX_URL` with `Authorization: Bearer ZATCA_API_KEY`.

Setup
1. Install deps

```bash
cd fcm-server
npm install express body-parser node-fetch firebase-admin
```

2. Copy `.env.example` to `.env` and fill values. If you want the server to read your Firestore data, set `FIREBASE_SERVICE_ACCOUNT_PATH` to a service account JSON file with access to your project.

3. Run locally

```bash
node vatSubmit.js
```

Notes
- This is a prototype for development only. In production you must secure credentials, support the exact auth method ZATCA requires (mTLS/OAuth), and format the payload per ZATCA's spec.
- Replace the placeholder `ZATCA_SANDBOX_URL` and `ZATCA_API_KEY` with real sandbox credentials once you obtain them.
