/**
 * ZATCA Phase 2 — Invoice Signing & Reporting Service
 *
 * Uses zatca-xml-js library for everything:
 *   - ZATCASimplifiedTaxInvoice  → builds fully compliant UBL 2.1 XML
 *   - invoice.sign(cert, key)    → embeds XMLDSig (XAdES) inside the XML + generates Phase 2 QR
 *
 * Tracks automatically:
 *   - PIH  (Previous Invoice Hash)  → zatca-cert/pih.txt
 *   - ICV  (Invoice Counter Value)  → zatca-cert/counter.txt
 *
 * Mode detection (automatic):
 *   - If  zatca-cert/production-cert.pem  exists → PRODUCTION mode
 *   - Otherwise                                  → COMPLIANCE/SANDBOX mode
 *
 * Start:  node fcm-server/zatca-service.js
 */

import { createRequire } from 'module';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// zatca-xml-js is CJS-only
const require = createRequire(import.meta.url);
const { ZATCASimplifiedTaxInvoice, ZATCAInvoiceTypes, ZATCAPaymentMethods } = require('zatca-xml-js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Override for Docker/VPS: mount certs at e.g. /data/zatca-cert */
const CERT_DIR = process.env.ZATCA_CERT_DIR
  ? path.resolve(process.env.ZATCA_CERT_DIR)
  : path.join(__dirname, '..', 'zatca-cert');
const PIH_FILE  = path.join(CERT_DIR, 'pih.txt');
const CNTR_FILE = path.join(CERT_DIR, 'counter.txt');

// Standard ZATCA first-invoice PIH (from zatca-xml-js examples / ZATCA docs)
const INITIAL_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

// ── Cert normalization ────────────────────────────────────────────────────────
// ZATCA returns binarySecurityToken = base64(base64(DER)).
// The onboard script stores it directly as the PEM body, so the PEM body is
// base64(base64(DER)) instead of standard base64(DER).
// This function normalises to standard PEM so Node.js crypto + zatca-xml-js can parse it.
function normalizeCertPEM(pem) {
  const body = pem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\r?\n/g, '').trim();
  const decoded = Buffer.from(body, 'base64');
  // Standard DER SEQUENCE starts with 0x30
  if (decoded[0] === 0x30) return pem;   // already standard
  // decoded.toString() yields the inner base64 PEM body (standard format)
  return `-----BEGIN CERTIFICATE-----\n${decoded.toString()}\n-----END CERTIFICATE-----`;
}

// ── Load credentials ─────────────────────────────────────────────────────────
const _RAW_COMPLIANCE_CERT  = process.env.ZATCA_CERT    || fs.readFileSync(path.join(CERT_DIR, 'cert.pem'), 'utf8');
const COMPLIANCE_SECRET      = (process.env.ZATCA_SECRET || fs.readFileSync(path.join(CERT_DIR, 'secret.txt'), 'utf8')).trim();
const PRIVATE_KEY = process.env.ZATCA_PRIVATE_KEY
  || (() => {
    const prodKey = path.join(CERT_DIR, 'private_key_production.pem');
    const sandboxKey = path.join(CERT_DIR, 'private_key_zatca.pem');
    return fs.readFileSync(fs.existsSync(prodKey) ? prodKey : sandboxKey, 'utf8');
  })();

// Normalise so zatca-xml-js can parse the DER inside
const COMPLIANCE_CERT = normalizeCertPEM(_RAW_COMPLIANCE_CERT);

let PROD_CERT = null;
let PROD_SECRET = null;
try { PROD_CERT   = normalizeCertPEM(fs.readFileSync(path.join(CERT_DIR, 'production-cert.pem'), 'utf8')); } catch {}
try { PROD_SECRET = fs.readFileSync(path.join(CERT_DIR, 'production-api-secret.txt'), 'utf8').trim(); } catch {}

const IS_PRODUCTION = !!(PROD_CERT && PROD_SECRET);

// ── EGS Info (must match the CSR / compliance cert) ──────────────────────────
const EGS_INFO = {
  uuid:            '1-amlak-prod|2-1.0|3-001',
  custom_id:       'amlak-prod',
  model:           'amlak-v1',
  CRN_number:      '312610089400003',
  VAT_number:      '312610089400003',
  VAT_name:        'RR MILLENNIUM',
  branch_name:     'Main Branch',
  branch_industry: 'Real Estate',
  location: {
    building:          '1',
    street:            'King Fahad Road',
    city:              'Riyadh',
    city_subdivision:  'Central',
    plot_identification:'0000',
    postal_zone:       '12345',
  },
};

// ── PIH & Counter helpers ─────────────────────────────────────────────────────
const loadPIH     = () => { try { return fs.readFileSync(PIH_FILE,  'utf8').trim(); } catch { return INITIAL_PIH; } };
const savePIH     = (h) => fs.writeFileSync(PIH_FILE,  h, 'utf8');
const loadCounter = () => { try { return parseInt(fs.readFileSync(CNTR_FILE, 'utf8').trim(), 10) || 1; } catch { return 1; } };
const saveCounter = (n) => fs.writeFileSync(CNTR_FILE, String(n), 'utf8');

// ── ZATCA Basic Auth header ───────────────────────────────────────────────────
// Matches zatca-xml-js library exactly:
//   stripped = PEM body = base64(DER)
//   bst      = base64(stripped) = base64(base64(DER)) = binarySecurityToken
//   Authorization: Basic base64(bst:secret)
function getAuthHeader(certPEM, secret) {
  const stripped = certPEM
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\r?\n/g, '').trim();
  const bst = Buffer.from(stripped).toString('base64');
  return `Basic ${Buffer.from(`${bst}:${secret}`).toString('base64')}`;
}

// ── Report to ZATCA ───────────────────────────────────────────────────────────
function reportToZATCA(signedXml, invoiceHash) {
  const cert    = IS_PRODUCTION ? PROD_CERT   : COMPLIANCE_CERT;
  const secret  = IS_PRODUCTION ? PROD_SECRET : COMPLIANCE_SECRET;
  const envPath = IS_PRODUCTION ? 'core'       : 'developer-portal';
  const url     = `https://gw-fatoora.zatca.gov.sa/e-invoicing/${envPath}/invoices/reporting/single`;

  const body = JSON.stringify({
    invoiceHash,
    uuid:    EGS_INFO.uuid,
    invoice: Buffer.from(signedXml).toString('base64'),
  });

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path:     urlObj.pathname,
      method:   'POST',
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   getAuthHeader(cert, secret),
        'Accept-Version':  'V2',
        'Accept-Language': 'en',
        'Clearance-Status':'0',
        'Content-Length':  Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.setTimeout(12000, () => { req.destroy(); resolve({ status: 0, body: 'timeout — not on Saudi network?' }); });
    req.write(body);
    req.end();
  });
}

// ── Build + sign an invoice ───────────────────────────────────────────────────
function buildAndSign(req) {
  const {
    invoiceNumber, issueDate,
    vatRate = 15, description,
    isCreditNote = false, originalInvoiceId,
  } = req;

  // Credit notes MUST use negative tax_exclusive_price so that cbc:TaxInclusiveAmount
  // and cbc:TaxAmount in the signed XML (and QR TLV Tags 4 & 5) are negative.
  // Enforce the correct sign here as a safety net regardless of what the caller sends.
  let taxExclusivePrice = parseFloat(req.amount);
  if (isCreditNote) {
    taxExclusivePrice = -Math.abs(taxExclusivePrice);
  }

  const pih     = loadPIH();
  const counter = loadCounter();
  const issueTime = new Date().toTimeString().split(' ')[0];

  const props = {
    egs_info:              EGS_INFO,
    invoice_counter_number: counter,
    invoice_serial_number:  invoiceNumber,
    issue_date:             issueDate,
    issue_time:             issueTime,
    previous_invoice_hash:  pih,
    line_items: [{
      id:                 '1',
      name:               description || 'Property Services',
      quantity:           1,
      tax_exclusive_price: taxExclusivePrice,
      VAT_percent:        vatRate / 100,   // library expects decimal (0.15 = 15%)
    }],
  };

  if (isCreditNote && originalInvoiceId) {
    props.cancelation = {
      cancelation_type:         ZATCAInvoiceTypes.CREDIT_NOTE,
      payment_method:           ZATCAPaymentMethods.CASH,
      reason:                   'Invoice cancellation',
      canceled_invoice_number:  originalInvoiceId,
    };
  }

  // 1. Build UBL 2.1 XML with PIH and ICV placeholders
  const invoice = new ZATCASimplifiedTaxInvoice({ props });

  // 2. Sign: embeds XMLDSig (XAdES) + generates Phase 2 QR (8-tag TLV)
  const cert = IS_PRODUCTION ? PROD_CERT : COMPLIANCE_CERT;
  const { signed_invoice_string, invoice_hash, qr } = invoice.sign(cert, PRIVATE_KEY);

  // 3. Advance PIH and counter for the next invoice
  savePIH(invoice_hash);
  saveCounter(counter + 1);

  const vatTotal = parseFloat((taxExclusivePrice * vatRate / 100).toFixed(2));
  const total    = parseFloat((taxExclusivePrice + vatTotal).toFixed(2));

  return { signed_invoice_string, invoice_hash, qr, counter, vatTotal, total };
}

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();
// Comma-separated origins, e.g. ZATCA_CORS_ORIGINS=https://app.example.com,https://www.example.com
if (process.env.ZATCA_CORS_ORIGINS && process.env.ZATCA_CORS_ORIGINS.trim()) {
  const list = process.env.ZATCA_CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: list.length ? list : true, credentials: true }));
} else {
  app.use(cors());
}
app.use(express.json());

/**
 * POST /zatca/sign
 * Sign only (no ZATCA API call). Works offline. Good for dev.
 */
app.post('/zatca/sign', (req, res) => {
  try {
    if (!req.body.invoiceNumber || !req.body.issueDate || !req.body.amount)
      return res.status(400).json({ error: 'Missing: invoiceNumber, issueDate, amount' });

    const { signed_invoice_string, invoice_hash, qr, counter, vatTotal, total } = buildAndSign(req.body);
    const subtotal = parseFloat((total - vatTotal).toFixed(2));

    return res.json({
      success: true, invoice_hash, qrCode: qr, counter,
      totals: { subtotal, vatTotal, total },
    });
  } catch (err) {
    console.error('[ZATCA /sign]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /zatca/sign-and-report
 * Sign + report to ZATCA. Requires Saudi network for the report step.
 * Signing always works regardless of network.
 */
app.post('/zatca/sign-and-report', async (req, res) => {
  try {
    if (!req.body.invoiceNumber || !req.body.issueDate || !req.body.amount)
      return res.status(400).json({ error: 'Missing: invoiceNumber, issueDate, amount' });

    const { signed_invoice_string, invoice_hash, qr, counter, vatTotal, total } = buildAndSign(req.body);
    const subtotal = parseFloat((total - vatTotal).toFixed(2));

    // Report to ZATCA (graceful — fails silently when not on Saudi network)
    const zatcaResult = await reportToZATCA(signed_invoice_string, invoice_hash);

    return res.json({
      success: true, invoice_hash, qrCode: qr, counter,
      zatcaStatus:   zatcaResult.status,
      zatcaResponse: zatcaResult.body?.substring(0, 300),
      mode: IS_PRODUCTION ? 'production' : 'compliance',
      totals: { subtotal, vatTotal, total },
    });
  } catch (err) {
    console.error('[ZATCA /sign-and-report]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get('/zatca/health', (_, res) => res.json({
  status: 'ok',
  mode:   IS_PRODUCTION ? '🟢 PRODUCTION' : '🟡 COMPLIANCE/SANDBOX',
  counter: loadCounter(),
  pih:    loadPIH().substring(0, 24) + '…',
}));

const PORT = Number(process.env.ZATCA_PORT) || 3002;
const HOST = process.env.ZATCA_HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`[ZATCA] http://${HOST}:${PORT}  |  mode: ${IS_PRODUCTION ? 'PRODUCTION ✅' : 'COMPLIANCE/SANDBOX (run onboard-production.mjs to go live)'}`);
});

export default app;
