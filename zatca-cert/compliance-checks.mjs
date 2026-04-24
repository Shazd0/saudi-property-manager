/**
 * ZATCA Compliance Invoice Checks
 *
 * ZATCA requires 3 signed invoices be submitted to the compliance check endpoint
 * before a production CSID can be issued:
 *   1. Simplified Tax Invoice (standard)
 *   2. Simplified Credit Note
 *   3. Simplified Debit Note
 *
 * Uses: production-compliance-cert.pem + production-secret.txt (from onboard-production.mjs)
 * 
 * Run: node zatca-cert/compliance-checks.mjs
 * Then: node zatca-cert/issue-production-csid.mjs
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require  = createRequire(import.meta.url);
const { ZATCASimplifiedTaxInvoice, ZATCAInvoiceTypes, ZATCAPaymentMethods } = require('zatca-xml-js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Credentials ───────────────────────────────────────────────────────────────
const certRaw  = fs.readFileSync(path.join(__dirname, 'production-compliance-cert.pem'), 'utf8');
const secret   = fs.readFileSync(path.join(__dirname, 'production-secret.txt'), 'utf8').trim();
// Use production private key if available, else fall back to sandbox key
const privKeyFile = fs.existsSync(path.join(__dirname, 'private_key_production.pem'))
  ? 'private_key_production.pem' : 'private_key_zatca.pem';
const privKey  = fs.readFileSync(path.join(__dirname, privKeyFile), 'utf8');
console.log('Using private key:', privKeyFile);

// Normalise cert (ZATCA cert body may be double-base64)
function normalizeCert(pem) {
  const body = pem.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\r?\n/g, '').trim();
  const decoded = Buffer.from(body, 'base64');
  if (decoded[0] === 0x30) return pem;
  return `-----BEGIN CERTIFICATE-----\n${decoded.toString()}\n-----END CERTIFICATE-----`;
}
const certNorm = normalizeCert(certRaw);

// ── Auth header ───────────────────────────────────────────────────────────────
// Matches zatca-xml-js library exactly:
//   stripped    = PEM body = base64(DER)
//   bst         = base64(stripped) = base64(base64(DER)) = binarySecurityToken
//   Authorization: Basic base64(bst:secret)
function authHeader() {
  const stripped = certNorm
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\r?\n/g, '').trim();
  const bst = Buffer.from(stripped).toString('base64');
  return `Basic ${Buffer.from(`${bst}:${secret}`).toString('base64')}`;
}

// ── EGS info (must match the CSR) ────────────────────────────────────────────
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
    building: '1', street: 'King Fahad Road', city: 'Riyadh',
    city_subdivision: 'Central', plot_identification: '0000', postal_zone: '12345',
  },
};

const INITIAL_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

// ── Build + sign ──────────────────────────────────────────────────────────────
function signInvoice(counterNum, prevHash, extraProps = {}) {
  const now = new Date();
  const issueDate = now.toISOString().slice(0, 10);
  const issueTime = now.toTimeString().slice(0, 8);

  const props = {
    egs_info: EGS_INFO,
    invoice_counter_number: counterNum,
    invoice_serial_number:  `COMP-CHK-${counterNum}`,
    issue_date:   issueDate,
    issue_time:   issueTime,
    previous_invoice_hash: prevHash,
    line_items: [{
      id: '1', name: 'Compliance Check Invoice',
      quantity: 1, tax_exclusive_price: 100, VAT_percent: 0.15,
    }],
    ...extraProps,
  };

  const invoice = new ZATCASimplifiedTaxInvoice({ props });
  const { signed_invoice_string, invoice_hash } = invoice.sign(certNorm, privKey);
  return { signed_invoice_string, invoice_hash };
}

// ── POST to compliance check endpoint ────────────────────────────────────────
function checkCompliance(signedXml, invoiceHash) {
  const body = JSON.stringify({
    invoiceHash,
    uuid:    EGS_INFO.uuid,
    invoice: Buffer.from(signedXml).toString('base64'),
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'gw-fatoora.zatca.gov.sa',
      path:     '/e-invoicing/core/compliance/invoices',
      method:   'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        'Authorization':   authHeader(),
        'Accept-Version':  'V2',
        'Accept-Language': 'en',
        'Content-Length':  Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout — are you on Saudi network?')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log(' ZATCA Compliance Invoice Checks (3 required)');
  console.log('═══════════════════════════════════════════════════\n');

  let pih = INITIAL_PIH;
  let allPassed = true;

  // ── Check 1: Standard simplified tax invoice ─────────────────────────────
  console.log('● Check 1/3 — Simplified Tax Invoice…');
  const inv1 = signInvoice(1, pih);
  const res1 = await checkCompliance(inv1.signed_invoice_string, inv1.invoice_hash);
  console.log('  Status:', res1.status);
  if (res1.status === 200 || res1.status === 202) {
    console.log('  ✓ PASSED', res1.status === 202 ? '(with warnings — OK)' : '');
    pih = inv1.invoice_hash;
  } else {
    console.log('  ✗ FAILED:', res1.body.substring(0, 400));
    allPassed = false;
  }

  // ── Check 2: Simplified credit note ─────────────────────────────────────
  console.log('\n● Check 2/3 — Simplified Credit Note…');
  const inv2 = signInvoice(2, pih, {
    // ZATCA BR-KSA spec: credit note line items must use NEGATIVE tax_exclusive_price
    // so that cbc:TaxInclusiveAmount and cbc:TaxAmount in the XML (and QR Tags 4 & 5) are negative
    line_items: [{ id: '1', name: 'Compliance Check Credit Note', quantity: 1, tax_exclusive_price: -100, VAT_percent: 0.15 }],
    cancelation: {
      cancelation_type:        ZATCAInvoiceTypes.CREDIT_NOTE,
      payment_method:          ZATCAPaymentMethods.CASH,
      reason:                  'Compliance check credit note',
      canceled_invoice_number: 'COMP-CHK-1',
    },
  });
  const res2 = await checkCompliance(inv2.signed_invoice_string, inv2.invoice_hash);
  console.log('  Status:', res2.status);
  if (res2.status === 200 || res2.status === 202) {
    console.log('  ✓ PASSED', res2.status === 202 ? '(with warnings — OK)' : '');
    pih = inv2.invoice_hash;
  } else {
    console.log('  ✗ FAILED:', res2.body.substring(0, 400));
    allPassed = false;
  }

  // ── Check 3: Simplified debit note ──────────────────────────────────────
  console.log('\n● Check 3/3 — Simplified Debit Note…');
  const inv3 = signInvoice(3, pih, {
    cancelation: {
      cancelation_type:        ZATCAInvoiceTypes.DEBIT_NOTE,
      payment_method:          ZATCAPaymentMethods.CASH,
      reason:                  'Compliance check debit note',
      canceled_invoice_number: 'COMP-CHK-1',
    },
  });
  const res3 = await checkCompliance(inv3.signed_invoice_string, inv3.invoice_hash);
  console.log('  Status:', res3.status);
  if (res3.status === 200 || res3.status === 202) {
    console.log('  ✓ PASSED', res3.status === 202 ? '(with warnings — OK)' : '');
  } else {
    console.log('  ✗ FAILED:', res3.body.substring(0, 400));
    allPassed = false;
  }

  console.log('\n───────────────────────────────────────────────────');
  if (allPassed) {
    console.log(' ✅ All 3 compliance checks passed!');
    console.log('\n NEXT STEP:');
    console.log('   node zatca-cert/issue-production-csid.mjs');
  } else {
    console.log(' ✗ Some checks failed. Review errors above.');
    console.log('   Common causes:');
    console.log('   • Cert doesn\'t match private key');
    console.log('   • Not on Saudi network');
  }
  console.log('───────────────────────────────────────────────────\n');
}

main().catch(e => {
  console.error('\n✗ Fatal error:', e.message);
  console.error('  Are you on Saudi network?\n');
  process.exit(1);
});
