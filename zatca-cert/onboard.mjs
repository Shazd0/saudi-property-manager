/**
 * ZATCA Phase 2 – Step 2: Compliance Onboarding
 * Submits the CSR to ZATCA and retrieves the compliance certificate + secret.
 *
 * Usage:  node onboard.mjs
 *
 * Requirements: Node 18+ (built-in fetch)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CONFIG ────────────────────────────────────────────────────────────────────
const OTP        = '675334';                    // One-time password from Fatoora portal
const CSR_PATH   = join(__dirname, 'csr.pem');

// ZATCA sandbox endpoint — now hosted on sandbox.zatca.gov.sa
// For production, replace with: https://gw-apic-gov.gazt.gov.sa/e-invoicing/core/compliance
const ZATCA_URL  = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance';
// ─────────────────────────────────────────────────────────────────────────────

async function onboard() {
  // 1. Read and base64-encode the CSR (strip PEM headers for the API)
  const csrRaw    = readFileSync(CSR_PATH, 'utf8');
  const csrBase64 = Buffer.from(csrRaw).toString('base64');

  console.log('📤 Submitting CSR to ZATCA Compliance API...');
  console.log('   OTP:', OTP);
  console.log('   URL:', ZATCA_URL);

  const response = await fetch(ZATCA_URL, {
    method: 'POST',
    headers: {
      'Accept':        'application/json',
      'Content-Type':  'application/json',
      'OTP':           OTP,
      'Accept-Version': 'V2',
    },
    body: JSON.stringify({ csr: csrBase64 }),
  });

  const text = await response.text();
  console.log('\n📥 HTTP Status:', response.status, response.statusText);

  if (!response.ok) {
    console.error('❌ ZATCA API Error:\n', text);
    process.exit(1);
  }

  const data = JSON.parse(text);
  console.log('\n✅ Onboarding successful!\n');

  // 2. Save the binary security token (compliance certificate)
  const tokenB64 = data.binarySecurityToken;
  const secret   = data.secret;
  const reqId    = data.requestID;

  if (!tokenB64) {
    console.error('Unexpected response shape:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  // Decode token → PEM certificate
  const certPem = `-----BEGIN CERTIFICATE-----\n${tokenB64}\n-----END CERTIFICATE-----\n`;

  writeFileSync(join(__dirname, 'cert.pem'),    certPem,  'utf8');
  writeFileSync(join(__dirname, 'secret.txt'),  secret,   'utf8');
  writeFileSync(join(__dirname, 'requestID.txt'), String(reqId), 'utf8');

  console.log('📄 Saved:  cert.pem       ← Compliance certificate');
  console.log('🔑 Saved:  secret.txt     ← Keep this SECRET, used for all API calls');
  console.log('🆔 Saved:  requestID.txt  ← Used later to get Production CSID');
  console.log('\nNext: run onboard-production.mjs to get your Production CSID.');
}

onboard().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
