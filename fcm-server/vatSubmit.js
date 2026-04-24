const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Minimal prototype server to build a VAT return payload from Firestore transactions
// and POST to a configurable ZATCA sandbox URL (placeholder). Credentials are read
// from environment variables.

const app = express();
app.use(bodyParser.json());

// Initialize Firebase admin if service account path provided via env
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)),
  });
}

const db = (() => {
  try { return getFirestore(); } catch (e) { return null; }
})();

// Helper: collect transactions for a given month (YYYY-MM)
async function collectTransactions(month) {
  if (!db) throw new Error('Firestore not initialized in server. Set FIREBASE_SERVICE_ACCOUNT_PATH');
  const [year, m] = month.split('-');
  const start = new Date(parseInt(year), parseInt(m) - 1, 1);
  const end = new Date(parseInt(year), parseInt(m), 1);

  const txsRef = db.collection('transactions');
  const snapshot = await txsRef.where('date', '>=', start.toISOString()).where('date', '<', end.toISOString()).get();
  const items = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    items.push({ id: doc.id, ...d });
  });
  return items;
}

// Build a simple VAT return summary payload (placeholder schema)
function buildVatPayload(companyTin, month, transactions) {
  let totalSales = 0;
  let totalVat = 0;
  let totalPurchases = 0;

  transactions.forEach(t => {
    const amt = t.amountIncludingVAT || t.totalWithVat || t.amount || 0;
    const vat = t.vatAmount || 0;
    if (t.type === 'INCOME') { totalSales += amt; totalVat += vat; }
    else { totalPurchases += amt; }
  });

  return {
    companyTin,
    period: month,
    totalSales: totalSales.toFixed(2),
    totalVat: totalVat.toFixed(2),
    totalPurchases: totalPurchases.toFixed(2),
    lineCount: transactions.length,
    generatedAt: new Date().toISOString(),
    transactionsPreview: transactions.slice(0, 20).map(t => ({ id: t.id, date: t.date, amount: t.amount, vatAmount: t.vatAmount }))
  };
}

// POST to ZATCA sandbox (placeholder)
async function postToZatca(payload) {
  const zatcaUrl = process.env.ZATCA_SANDBOX_URL || 'https://example-zatca-sandbox.local/api/vat/submit';
  const apiKey = process.env.ZATCA_API_KEY || 'PLACEHOLDER';

  const resp = await fetch(zatcaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    // timeout handled by host environment
  });

  const text = await resp.text();
  return { status: resp.status, body: text };
}

// Endpoint: preview payload
app.get('/vat/preview', async (req, res) => {
  const { month, tin } = req.query;
  if (!month || !tin) return res.status(400).json({ error: 'Missing month or tin' });
  try {
    const txs = await collectTransactions(month);
    const payload = buildVatPayload(tin, month, txs);
    return res.json({ ok: true, payload });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Endpoint: submit
app.post('/vat/submit', async (req, res) => {
  const { month, tin } = req.body;
  if (!month || !tin) return res.status(400).json({ error: 'Missing month or tin' });
  try {
    const txs = await collectTransactions(month);
    const payload = buildVatPayload(tin, month, txs);

    // store submission attempt in Firestore if available
    let submissionRef = null;
    try {
      if (db) submissionRef = await db.collection('vat_submissions').add({ tin, month, payload, status: 'pending', createdAt: new Date().toISOString() });
    } catch (e) {}

    const result = await postToZatca(payload);

    // update submission
    try { if (submissionRef) await submissionRef.update({ status: result.status, response: result.body, updatedAt: new Date().toISOString() }); } catch (e) {}

    return res.json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 4001;
app.listen(port, () => console.log('VAT submit prototype running on port', port));
