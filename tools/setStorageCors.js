#!/usr/bin/env node
// Run: node tools/setStorageCors.js <bucket-name> [cors-file]
// Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON.

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

async function main() {
  const bucketName = process.argv[2] || 'saudi-property-manager.firebasestorage.app';
  const corsFile = process.argv[3] || path.join(__dirname, '..', 'cors.json');

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('ERROR: Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON file.');
    process.exit(1);
  }

  if (!fs.existsSync(corsFile)) {
    console.error('ERROR: CORS file not found:', corsFile);
    process.exit(1);
  }

  const cors = JSON.parse(fs.readFileSync(corsFile, 'utf8'));
  const storage = new Storage();
  try {
    const bucket = storage.bucket(bucketName);
    await bucket.setMetadata({ cors });
    console.log('CORS successfully set on bucket:', bucketName);
    console.log(JSON.stringify(cors, null, 2));
  } catch (err) {
    console.error('Failed to set CORS:', err.message || err);
    process.exit(2);
  }
}

main();
