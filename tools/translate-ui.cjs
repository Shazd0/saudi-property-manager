#!/usr/bin/env node
/**
 * translate-ui.cjs
 * Uses LibreTranslate public API to fully re-translate all UI strings in ar.ts from en.ts
 * Usage: node tools/translate-ui.cjs
 * Optional: node tools/translate-ui.cjs --endpoint https://your-server/translate
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// MyMemory free translation API — 1000 req/day, no API key needed
// For higher limits add your email: MYMEMORY_EMAIL env var
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const EMAIL_PARAM = process.env.MYMEMORY_EMAIL
  ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}`
  : '';

const DELAY_MS = 350; // ~1000 requests/day safely within limits

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── HTTP GET wrapper (no external deps) ──────────────────────────────────────
function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const lib = urlStr.startsWith('https') ? https : http;
    const req = lib.get(urlStr, { timeout: 12000 }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`Invalid JSON: ${raw.slice(0, 100)}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── Call MyMemory API ─────────────────────────────────────────────────────────
async function callTranslateAPI(text, from, to) {
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${from}|${to}${EMAIL_PARAM}`;
  try {
    const result = await httpGet(url);
    if (result && result.responseData && result.responseData.translatedText) {
      const translated = result.responseData.translatedText.trim();
      // MyMemory returns "QUERY LENGTH LIMIT EXCEEDED" on error
      if (translated.toUpperCase().includes('QUERY LENGTH') || translated.toUpperCase().includes('LIMIT EXCEEDED')) {
        return null;
      }
      return translated;
    }
  } catch { /* ignore, return null */ }
  return null;
}

// ── Translate a single value, preserving emoji/symbol prefixes ────────────────
async function translate(text, from, to) {
  if (!text || text.trim().length < 2) return text;

  // Preserve leading emoji/symbols (non-word, non-Arabic)
  const prefixMatch = text.match(/^([^\w\u0600-\u06FF]{1,6}\s*)/);
  if (prefixMatch && prefixMatch[1].trim().length > 0) {
    const prefix = prefixMatch[1];
    const rest = text.slice(prefix.length).trim();
    if (!rest) return text;
    const translated = await callTranslateAPI(rest, from, to);
    return translated ? prefix + translated : null;
  }

  // Split long strings into chunks (MyMemory limit ~500 chars)
  if (text.length > 400) {
    return callTranslateAPI(text.slice(0, 400), from, to);
  }

  return callTranslateAPI(text, from, to);
}

// ── Parse the TS translation file to extract key→value pairs ─────────────────
function parseTranslationFile(content) {
  const pairs = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('const ') ||
        trimmed.startsWith('export ') || trimmed === '{' || trimmed === '};') continue;

    // Match: 'key': 'value', or 'key': "value",
    const keyMatch = trimmed.match(/^'([^']+)'\s*:/);
    if (!keyMatch) continue;

    const key = keyMatch[1];
    const rest = trimmed.slice(keyMatch[0].length).trim().replace(/,\s*$/, '');

    let val = '';
    if (rest.startsWith("'")) {
      // single-quoted value
      let i = 1, esc = false;
      while (i < rest.length) {
        if (!esc && rest[i] === "'") break;
        esc = !esc && rest[i] === '\\';
        i++;
      }
      val = rest.slice(1, i).replace(/\\'/g, "'");
    } else if (rest.startsWith('"')) {
      // double-quoted value
      let i = 1, esc = false;
      while (i < rest.length) {
        if (!esc && rest[i] === '"') break;
        esc = !esc && rest[i] === '\\';
        i++;
      }
      val = rest.slice(1, i).replace(/\\"/g, '"');
    }

    if (key) pairs[key] = val;
  }

  return pairs;
}

// ── Build new ar.ts file content ─────────────────────────────────────────────
function buildArContent(pairs) {
  const sections = [
    ['nav.',           '// Sidebar / Navigation'],
    ['common.',        '// Common'],
    ['app.',           '// App'],
    ['login.',         '// Login'],
    ['chat.',          '// Chat'],
    ['dashboard.',     '// Dashboard'],
    ['entry.',         '// Entry Form'],
    ['history.',       '// History'],
    ['contract.',      '// Contract Form'],
    ['customer.',      '// Customers'],
    ['building.',      '// Buildings'],
    ['vendor.',        '// Vendors'],
    ['task.',          '// Tasks'],
    ['settings.',      '// Settings'],
    ['reports.',       '// Reports'],
    ['invoice.',       '// Invoice'],
    ['approval.',      '// Approval'],
    ['calendar.',      '// Calendar'],
    ['monitoring.',    '// Monitoring'],
    ['borrowing.',     '// Borrowings'],
    ['transfer.',      '// Transfers'],
    ['staff.',         '// Staff'],
    ['car.',           '// Car Registry'],
    ['stock.',         '// Stock'],
    ['help.',          '// Help'],
    ['about.',         '// About'],
    ['owner.',         '// Owner Portal'],
    ['tenant.',        '// Tenant Portal'],
    ['autoRent.',      '// Auto Rent'],
    ['notifications.', '// Notifications'],
    ['quickActions.',  '// Quick Actions'],
  ];

  let content = '// Arabic translations\nconst ar: Record<string, string> = {\n';
  const covered = new Set();

  for (const [prefix, comment] of sections) {
    const sectionKeys = Object.keys(pairs).filter(k => k.startsWith(prefix));
    if (sectionKeys.length === 0) continue;
    content += `\n  ${comment}\n`;
    for (const key of sectionKeys) {
      const val = (pairs[key] || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      content += `  '${key}': '${val}',\n`;
      covered.add(key);
    }
  }

  // Any remaining keys not covered by a section prefix
  const remaining = Object.keys(pairs).filter(k => !covered.has(k));
  if (remaining.length > 0) {
    content += '\n  // Other\n';
    for (const key of remaining) {
      const val = (pairs[key] || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      content += `  '${key}': '${val}',\n`;
    }
  }

  content += '};\n\nexport default ar;\n';
  return content;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const rootDir = path.join(__dirname, '..');
  const enPath = path.join(rootDir, 'i18n', 'translations', 'en.ts');
  const arPath = path.join(rootDir, 'i18n', 'translations', 'ar.ts');

  console.log('📖 Reading translation files...');
  const enContent = fs.readFileSync(enPath, 'utf8');
  const arContent = fs.readFileSync(arPath, 'utf8');

  const enPairs = parseTranslationFile(enContent);
  const arPairs = parseTranslationFile(arContent);

  const keys = Object.keys(enPairs);
  console.log(`✅ Found ${keys.length} English translation keys`);

  // ── Test API connectivity ──
  console.log('\n🌐 Testing MyMemory API...');
  const testResult = await callTranslateAPI('Hello', 'en', 'ar');
  if (!testResult) {
    console.error('❌ Could not connect to MyMemory API. Check internet connection.');
    process.exit(1);
  }
  console.log(`✅ API ready! Test: "Hello" → "${testResult}"\n`);

  // ── Create backup ──
  const backupPath = arPath + '.backup';
  fs.writeFileSync(backupPath, arContent, 'utf8');
  console.log(`💾 Backup saved: ar.ts.backup`);

  // ── Translate all keys ──
  console.log(`\n🚀 Translating ${keys.length} strings (en → ar)...\n`);

  const newArPairs = {};
  let translated = 0, kept = 0, failed = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const enValue = enPairs[key];

    const progress = `[${String(i + 1).padStart(3)}/${keys.length}]`;
    const label = key.substring(0, 42).padEnd(42);

    // Skip empty or very short strings
    if (!enValue || enValue.trim().length < 2) {
      process.stdout.write(`${progress} ${label} → (skip)\n`);
      newArPairs[key] = enValue;
      kept++;
      continue;
    }

    const arTranslation = await translate(enValue, 'en', 'ar');

    if (arTranslation && arTranslation.trim()) {
      process.stdout.write(`${progress} ${label} → ${arTranslation.substring(0, 35)}\n`);
      newArPairs[key] = arTranslation;
      translated++;
    } else if (arPairs[key]) {
      process.stdout.write(`${progress} ${label} → [kept: ${arPairs[key].substring(0, 25)}]\n`);
      newArPairs[key] = arPairs[key];
      kept++;
      failed++;
    } else {
      process.stdout.write(`${progress} ${label} → [fallback: ${enValue.substring(0, 25)}]\n`);
      newArPairs[key] = enValue;
      failed++;
    }

    await sleep(DELAY_MS);
  }

  // ── Write new ar.ts ──
  const newContent = buildArContent(newArPairs);
  fs.writeFileSync(arPath, newContent, 'utf8');

  console.log('\n────────────────────────────────────────────────');
  console.log(`📊 Done!  Translated: ${translated}  |  Kept: ${kept}  |  Failed: ${failed}`);
  console.log(`✅ ar.ts updated with ${keys.length} Arabic translations`);
  console.log(`💾 Original backed up as ar.ts.backup`);
}

main().catch(err => {
  console.error('\n❌ Script error:', err.message);
  process.exit(1);
});
