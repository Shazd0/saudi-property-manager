/**
 * Generate a PRODUCTION CSR for ZATCA
 *
 * The current CSR (egs_data.json) was generated with production=false,
 * which uses the TSTZATCA-Code-Signing template — valid for sandbox only.
 *
 * This script generates a NEW key pair + production CSR (ZATCA-Code-Signing template).
 * Saves to: egs_data_production.json + private_key_production.pem
 *
 * AFTER running this script:
 *   1. Go to https://fatoora.zatca.gov.sa → Solutions and Devices → Add Device
 *   2. Get the 6-digit OTP shown on the page
 *   3. Run: node zatca-cert/onboard-production.mjs <OTP>
 *      (onboard-production.mjs will auto-use the production CSR)
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require  = createRequire(import.meta.url);
const { EGS }  = require('zatca-xml-js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Windows: zatca-xml-js needs OpenSSL in PATH + writable temp folder
process.env.TEMP_FOLDER = 'D:/tmp/';
if (!fs.existsSync('D:/tmp')) fs.mkdirSync('D:/tmp', { recursive: true });

// Add Git's bundled OpenSSL to PATH
const GIT_OPENSSL = 'C:\\Program Files\\Git\\usr\\bin';
if (!process.env.PATH.includes(GIT_OPENSSL)) {
  process.env.PATH = GIT_OPENSSL + ';' + process.env.PATH;
}

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

async function main() {
  console.log('\n═══════════════════════════════════════════');
  console.log(' Generating PRODUCTION CSR');
  console.log('═══════════════════════════════════════════\n');

  const egs = new EGS(EGS_INFO);

  console.log('Generating new secp256k1 key pair + production CSR...');
  console.log('(Uses OpenSSL — takes a few seconds)\n');

  await egs.generateNewKeysAndCSR(true, 'amlak-prod');   // production=true

  const info       = egs.get();
  const privateKey = info.private_key;
  const csr        = info.csr;

  if (!csr.includes('-----BEGIN CERTIFICATE REQUEST-----')) {
    console.error('✗ CSR generation failed — is OpenSSL in PATH?');
    process.exit(1);
  }

  // Save new production data
  const prodDataFile = path.join(__dirname, 'egs_data_production.json');
  const prodKeyFile  = path.join(__dirname, 'private_key_production.pem');

  fs.writeFileSync(prodDataFile, JSON.stringify({ private_key: privateKey, csr }, null, 2));
  fs.writeFileSync(prodKeyFile, privateKey);

  console.log('✓ Production CSR generated successfully!');
  console.log('\nFiles saved:');
  console.log('  zatca-cert/egs_data_production.json');
  console.log('  zatca-cert/private_key_production.pem');

  console.log('\nCSR (first 100 chars):');
  console.log(' ', csr.substring(0, 100));

  console.log('\n═══════════════════════════════════════════');
  console.log(' NEXT STEPS:');
  console.log('─────────────────────────────────────────');
  console.log(' 1. Go to:  https://fatoora.zatca.gov.sa');
  console.log('    Login → Solutions and Devices → Add Device');
  console.log('    Copy the 6-digit OTP');
  console.log('');
  console.log(' 2. Run:  node zatca-cert/onboard-production.mjs <OTP>');
  console.log('    (while connected to Saudi network)');
  console.log('═══════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('\n✗ Error:', e.message);
  process.exit(1);
});
