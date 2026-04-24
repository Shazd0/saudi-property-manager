/**
 * ZATCA PRODUCTION Onboarding — Registers your device in the Fatoora portal
 *
 * ═══════════════════════════════════════════════════════════════════
 *  BEFORE RUNNING — do these steps in the browser first:
 *  1. Go to    https://fatoora.zatca.gov.sa
 *  2. Login    with your organization's credentials (Absher / OIDC)
 *  3. Navigate to:  Solutions and Devices → Add Solution / Device
 *  4. Fill in the EGS details (must match below):
 *       Solution Name:   amlak-prod
 *       Model:           amlak-v1
 *       VAT Number:      312610089400003
 *       Branch:          Main Branch
 *  5. Copy the 6-digit OTP shown on the portal page
 *  6. Come back here and run:
 *       node zatca-cert/onboard-production.mjs <OTP>
 * ═══════════════════════════════════════════════════════════════════
 *
 *  MUST be connected to Saudi network (hotspot / STC VPN / Saudi server)
 *
 *  Submits CSR to PRODUCTION endpoint (not developer-portal):
 *    https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance
 *
 *  After success → run issue-production-csid.mjs
 *  After THAT    → device appears in "View List of Solutions and Devices"
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OTP = process.argv[2];
if (!OTP || !/^\d{6}$/.test(OTP)) {
  console.error('\n  Usage:  node zatca-cert/onboard-production.mjs <6-digit-OTP>');
  console.error('  Get the OTP from: https://fatoora.zatca.gov.sa → Solutions and Devices\n');
  process.exit(1);
}

// Read the CSR — prefer production CSR if it exists, fall back to sandbox CSR
let egsData, csrPEM, privateKeyFile;
const prodDataPath = path.join(__dirname, 'egs_data_production.json');
const sandboxDataPath = path.join(__dirname, 'egs_data.json');

if (fs.existsSync(prodDataPath)) {
  egsData = JSON.parse(fs.readFileSync(prodDataPath, 'utf8'));
  privateKeyFile = 'private_key_production.pem';
  console.log('Using: egs_data_production.json (PRODUCTION CSR ✓)');
} else {
  egsData = JSON.parse(fs.readFileSync(sandboxDataPath, 'utf8'));
  privateKeyFile = 'private_key_zatca.pem';
  console.log('WARNING: egs_data_production.json not found.');
  console.log('Run generate-production-csr.mjs first for a real production certificate.');
  console.log('Using sandbox CSR (may fail with "wrong certificate template" error).\n');
}
csrPEM = egsData.csr;

if (!csrPEM?.includes('-----BEGIN CERTIFICATE REQUEST-----')) {
  console.error('Error: egs_data.json does not contain a valid CSR.');
  process.exit(1);
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
  console.log(' ZATCA Production Onboarding');
  console.log('═══════════════════════════════════════════');
  console.log(' OTP:', OTP);
  console.log(' Endpoint: gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance');
  console.log('───────────────────────────────────────────\n');

  let result;
  try {
    result = await httpsPost(
      'https://gw-fatoora.zatca.gov.sa/e-invoicing/core/compliance',
      { csr: Buffer.from(csrPEM).toString('base64') },
      { OTP },
    );
  } catch (err) {
    console.error('✗ Network error:', err.message);
    console.error('\n  Is your device connected to a Saudi network (hotspot/VPN)?');
    process.exit(1);
  }

  console.log('HTTP Status:', result.status);

  if (result.status !== 200) {
    console.error('\n✗ ZATCA returned an error:');
    console.error(result.body.substring(0, 600));
    console.error('\nPossible causes:');
    console.error('  • Invalid or expired OTP (OTPs expire in ~1 hour)');
    console.error('  • OTP already used (each OTP is single-use)');
    console.error('  • CSR fields don\'t match what you entered in the portal');
    process.exit(1);
  }

  const data = JSON.parse(result.body);
  const requestID = data.requestID?.toString();

  // Decode certificate: ZATCA returns base64(base64(DER)) as binarySecurityToken
  const certBody  = Buffer.from(data.binarySecurityToken, 'base64').toString();
  const certPEM   = `-----BEGIN CERTIFICATE-----\n${certBody}\n-----END CERTIFICATE-----`;

  const certFile     = path.join(__dirname, 'production-compliance-cert.pem');
  const secretFile   = path.join(__dirname, 'production-secret.txt');
  const requestFile  = path.join(__dirname, 'production-requestID.txt');

  fs.writeFileSync(certFile,    certPEM);
  fs.writeFileSync(secretFile,  data.secret);
  fs.writeFileSync(requestFile, requestID);

  console.log('\n✓ Production compliance certificate issued!');
  console.log('  Request ID:', requestID);
  console.log('\n  Saved:');
  console.log('    zatca-cert/production-compliance-cert.pem');
  console.log('    zatca-cert/production-secret.txt');
  console.log('    zatca-cert/production-requestID.txt');
  console.log('\n─────────────────────────────────────────────');
  console.log('  NEXT STEP:');
  console.log('  node zatca-cert/issue-production-csid.mjs');
  console.log('─────────────────────────────────────────────\n');
}

main();
