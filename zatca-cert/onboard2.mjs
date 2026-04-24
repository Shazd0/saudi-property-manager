import { request } from 'https';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG = (msg) => { process.stdout.write(msg + '\n'); writeFileSync(join(__dirname,'zatca_log.txt'), msg+'\n', {flag:'a'}); };

const OTP = '315817';  // ← REPLACE WITH FRESH OTP FROM fatoora.zatca.gov.sa
const csrPem = readFileSync(join(__dirname, 'csr.pem'), 'utf8');
// Extract raw base64 DER (strip PEM headers — this is what ZATCA expects)
const csrBase64 = csrPem
  .replace('-----BEGIN CERTIFICATE REQUEST-----', '')
  .replace('-----END CERTIFICATE REQUEST-----', '')
  .replace(/\r?\n/g, '')
  .trim();
const body = JSON.stringify({ csr: csrBase64 });

LOG('Starting ZATCA onboarding with gw-fatoora.zatca.gov.sa...');
LOG('OTP: ' + OTP);

// Clear previous log
writeFileSync(join(__dirname,'zatca_log.txt'), '');

const options = {
  hostname: 'gw-fatoora.zatca.gov.sa',
  path: '/e-invoicing/developer-portal/compliance',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Accept': 'application/json',
    'OTP': OTP,
    'Accept-Version': 'V2'
  }
};

const req = request(options, (res) => {
  LOG('HTTP Status: ' + res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    LOG('Raw response: ' + data.substring(0, 1000));
    if (res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        const token = parsed.binarySecurityToken;
        const secret = parsed.secret;
        const reqId = parsed.requestID;
        if (token) {
          const certPem = `-----BEGIN CERTIFICATE-----\n${token}\n-----END CERTIFICATE-----\n`;
          writeFileSync(join(__dirname, 'cert.pem'), certPem);
          writeFileSync(join(__dirname, 'secret.txt'), secret || '');
          writeFileSync(join(__dirname, 'requestID.txt'), String(reqId || ''));
          LOG('SUCCESS! cert.pem, secret.txt, requestID.txt saved.');
        } else {
          LOG('ERROR: Unexpected response shape: ' + JSON.stringify(parsed));
        }
      } catch(e) {
        LOG('JSON parse error: ' + e.message);
      }
    } else {
      LOG('ZATCA error response: ' + data);
    }
  });
});

req.on('error', (e) => { LOG('Request error: ' + e.code + ' - ' + e.message); });
req.write(body);
req.end();
