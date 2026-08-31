#!/usr/bin/env node
import 'dotenv/config';
import { pool, closePool } from '../lib/db.mjs';
import {
  getRegistryAdmin,
  loadPostgresBookIdMap,
  suggestPostgresBookIdMap,
  writeReport,
} from './lib/migration-utils.mjs';

async function loadLicenseBuyers() {
  try {
    const { db } = getRegistryAdmin();
    const snap = await db.collection('product_licenses').get();
    return snap.docs.map((doc) => {
      const d = doc.data() || {};
      return {
        licenseId: doc.id,
        teamCode: String(d.teamCode || '').trim().toUpperCase(),
        label: d.label || '',
        status: d.status || 'unknown',
        sourceProjectId: String(d.tenantFirebaseConfig?.projectId || '').trim(),
      };
    });
  } catch (error) {
    console.warn(`License registry unavailable: ${error?.message || error}`);
    return [];
  }
}

async function main() {
  const buyers = await loadLicenseBuyers();
  const { suggestions, evidence } = await suggestPostgresBookIdMap(pool, buyers);
  const configured = loadPostgresBookIdMap();

  const report = {
    generatedAt: new Date().toISOString(),
    configured,
    suggested: suggestions,
    evidence,
    envLine: `POSTGRES_BOOK_ID_MAP=${JSON.stringify(Object.keys(configured).length ? configured : suggestions)}`,
    activeLicenses: buyers.filter((buyer) => buyer.status === 'active' && buyer.teamCode),
  };

  writeReport('postgres-book-id-map.json', report);
  console.log(JSON.stringify({
    configuredCount: Object.keys(configured).length,
    suggestedCount: Object.keys(suggestions).length,
    envLine: report.envLine,
    evidence,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool().catch(() => {});
  });
