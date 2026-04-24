/**
 * ZATCA Production CSID Issuance
 *
 * Run this AFTER onboard-production.mjs succeeds.
 *
 * What it does:
 *   Uses your production compliance cert + secret + requestID to call:
 *     https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids
 *
 *   ZATCA then issues your FINAL production certificate.
 *   After this step your device WILL appear in:
 *     Fatoora portal → "View List of Solutions and Devices"
 *
 * Prerequisites:  (all created by onboard-production.mjs)
 *   zatca-cert/production-compliance-cert.pem
 *   zatca-cert/production-secret.txt
 *   zatca-cert/production-requestID.txt
 *
 * MUST be connected to Saudi network.
 *
 * After success:
 *   - zatca-cert/production-cert.pem          ← final production cert
 *   - zatca-cert/production-api-secret.txt    ← secret for reporting invoices
 *   - Restart zatca-service.js → auto detects production cert → PRODUCTION mode
 *   - All invoices will be signed & reported to ZATCA production
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load production compliance credentials ────────────────────────────────────
let complianceCert, complianceSecret, requestID;
try {
  complianceCert   = fs.readFileSync(path.join(__dirname, 'production-compliance-cert.pem'), 'utf8');
  complianceSecret = fs.readFileSync(path.join(__dirname, 'production-secret.txt'), 'utf8').trim();
  requestID        = fs.readFileSync(path.join(__dirname, 'production-requestID.txt'), 'utf8').trim();
} catch {
  console.error('\n✗ Missing production compliance cert files.');
  console.error('  First run:  node zatca-cert/onboard-production.mjs <OTP>\n');
  process.exit(1);
}

// ── Build Basic Auth header (matches zatca-xml-js library format) ─────────────
// stripped = PEM body = base64(DER)
// bst      = base64(stripped) = binarySecurityToken
// auth     = Basic base64(bst:secret)
function getAuthHeader(certPEM, secret) {
  const stripped = certPEM
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\r?\n/g, '').trim();
  const bst = Buffer.from(stripped).toString('base64');
  return `Basic ${Buffer.from(`${bst}:${secret}`).toString('base64')}`;
}

function httpsPost(url, bodyObj, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    const urlObj  = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path:     urlObj.pathname,
      method:   'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        'Accept-Version':  'V2',
        'Accept-Language': 'en',
        'Content-Length':  Buffer.byteLength(bodyStr),
        ...extraHeaders,
      },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Connection timed out — are you on Saudi network?')); });
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log(' ZATCA Production CSID Issuance');
  console.log('═══════════════════════════════════════════');
  console.log(' Request ID:', requestID);
  console.log(' Endpoint: gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids');
  console.log('───────────────────────────────────────────\n');

  let result;
  try {
    result = await httpsPost(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/production/csids',
      { compliance_request_id: requestID },
      { Authorization: getAuthHeader(complianceCert, complianceSecret) },
    );
  } catch (err) {
    console.error('✗ Network error:', err.message);
    console.error('  Are you on Saudi network?');
    process.exit(1);
  }

  console.log('HTTP Status:', result.status);

  if (result.status !== 200) {
    console.error('\n✗ ZATCA returned an error:');
    console.error(result.body.substring(0, 600));
    console.error('\nPossible causes:');
    console.error('  • requestID is from the sandbox/developer-portal (need production requestID)');
    console.error('  • Compliance invoice checks have not been submitted yet');
    console.error('  • Network issue — retry on fresh Saudi connection');
    process.exit(1);
  }

  const data = JSON.parse(result.body);

  // Decode production certificate
  const certBody = Buffer.from(data.binarySecurityToken, 'base64').toString();
  const certPEM  = `-----BEGIN CERTIFICATE-----\n${certBody}\n-----END CERTIFICATE-----`;

  const certFile   = path.join(__dirname, 'production-cert.pem');
  const secretFile = path.join(__dirname, 'production-api-secret.txt');
  const ridFile    = path.join(__dirname, 'production-final-requestID.txt');

  fs.writeFileSync(certFile,   certPEM);
  fs.writeFileSync(secretFile, data.secret);
  fs.writeFileSync(ridFile,    data.requestID?.toString() ?? '');

  console.log('\n✅ Production CSID issued successfully!');
  console.log('   Production Request ID:', data.requestID);
  console.log('\n   Saved:');
  console.log('     zatca-cert/production-cert.pem');
  console.log('     zatca-cert/production-api-secret.txt');
  console.log('\n═══════════════════════════════════════════');
  console.log(' Your device is now registered in ZATCA production!');
  console.log(' Check:  https://fatoora.zatca.gov.sa');
  console.log('         → View List of Solutions and Devices');
  console.log('═══════════════════════════════════════════');
  console.log('\n NEXT STEP:');
  console.log('  Restart the ZATCA service:');
  console.log('    node fcm-server/zatca-service.js');
  console.log('  It will auto-detect production-cert.pem and switch to PRODUCTION mode.');
  console.log('  All invoices will now be reported to ZATCA production. ✅\n');
}

main();
