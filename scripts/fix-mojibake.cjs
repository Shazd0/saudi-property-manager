/**
 * One-time fixer for double-encoded UTF-8 (mojibake) characters that
 * accidentally got baked into source files when they were saved with
 * the wrong editor encoding on Windows.
 *
 * Strategy:
 *   For each "correct" character we want to restore, we synthesise what
 *   the double-mojibake version looks like when the file is read back
 *   as UTF-8, then do a plain string replace.  The synthesis is done
 *   algorithmically using the CP1252 byte <-> codepoint tables so we
 *   don't need to guess bytes by hand.
 *
 * Usage:
 *   node scripts/fix-mojibake.cjs
 */

const fs = require('fs');
const path = require('path');

/* ---------------------------- CP1252 tables ---------------------------- */

// Byte (0-255) -> Unicode codepoint when decoded as CP1252.
const BYTE_TO_CP = (() => {
  const m = new Array(256);
  for (let i = 0; i < 256; i++) m[i] = i; // identity for most bytes
  // Windows-1252 specific mappings (0x80-0x9F range).
  const specific = {
    0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026,
    0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160,
    0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D,
    0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022,
    0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161,
    0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178,
    // Undefined slots: 0x81, 0x8D, 0x8F, 0x90, 0x9D.  When the file was
    // mis-decoded these appear as U+0081 / U+008D / ... control chars.
    0x81: 0x0081, 0x8D: 0x008D, 0x8F: 0x008F, 0x90: 0x0090, 0x9D: 0x009D,
  };
  Object.keys(specific).forEach(k => { m[Number(k)] = specific[k]; });
  return m;
})();

function utf8EncodeBytes(codepoint) {
  if (codepoint < 0x80) return [codepoint];
  if (codepoint < 0x800) return [0xC0 | (codepoint >> 6), 0x80 | (codepoint & 0x3F)];
  if (codepoint < 0x10000) return [0xE0 | (codepoint >> 12), 0x80 | ((codepoint >> 6) & 0x3F), 0x80 | (codepoint & 0x3F)];
  return [0xF0 | (codepoint >> 18), 0x80 | ((codepoint >> 12) & 0x3F), 0x80 | ((codepoint >> 6) & 0x3F), 0x80 | (codepoint & 0x3F)];
}

function strToBytesUtf8(str) {
  const out = [];
  for (const ch of str) {
    for (const b of utf8EncodeBytes(ch.codePointAt(0))) out.push(b);
  }
  return out;
}

function bytesToStrCp1252(bytes) {
  return String.fromCodePoint(...bytes.map(b => BYTE_TO_CP[b]));
}

/**
 * Simulate one round of "UTF-8 bytes got decoded as CP1252".
 */
function mojibakeOnce(str) {
  return bytesToStrCp1252(strToBytesUtf8(str));
}

/**
 * Apply the mojibake transformation twice, which is what we see in
 * History.tsx: an original UTF-8 file was re-saved through CP1252 twice.
 */
function doubleMojibake(str) {
  return mojibakeOnce(mojibakeOnce(str));
}

/* ---------------------------- Patch list ------------------------------- */

// Correct characters we expect to find baked into the source (via their
// doubly-mangled forms) and want to restore.
const TARGET_CHARS = [
  '\u2192', // → right arrow
  '\u25BC', // ▼ black down-pointing triangle
  '\u{1F4CA}', // 📊 bar chart
  '\u{1F9FE}', // 🧾 receipt
  '\u2713', // ✓ check mark
  '\u23F3', // ⏳ hourglass
  '\u26A0', // ⚠ warning sign
  '\u2014', // — em dash
  '\u2500', // ─ box drawing horizontal
];

const REPLACEMENTS = TARGET_CHARS.map(ch => [doubleMojibake(ch), ch]);

// Some mojibake sequences in comments have lost their final byte during
// manual editing (e.g. "Ã¢â€ â€Owner" – the trailing ™ byte is missing).
// These are the first N-1 chars of the full mojibake pattern.
const TRUNCATED_FALLBACKS = TARGET_CHARS
  .filter(ch => ch === '\u2192') // only right-arrow currently observed
  .map(ch => [doubleMojibake(ch).slice(0, -1), ch]);

// Sort so longer bad strings are replaced first (avoids prefix collisions).
REPLACEMENTS.sort((a, b) => b[0].length - a[0].length);

const TARGETS = [
  'components/History.tsx',
];

const root = path.resolve(__dirname, '..');
let totalFilesFixed = 0;

for (const rel of TARGETS) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.warn('skip (missing):', rel);
    continue;
  }
  const original = fs.readFileSync(full, 'utf8');
  let fixed = original;
  let edits = 0;
  for (const [bad, good] of REPLACEMENTS) {
    let count = 0;
    let idx = fixed.indexOf(bad);
    while (idx !== -1) {
      count++;
      idx = fixed.indexOf(bad, idx + bad.length);
    }
    if (count > 0) {
      fixed = fixed.split(bad).join(good);
      edits += count;
      console.log(`  ${rel}: ${count} x  ${JSON.stringify(good)}  (was ${bad.length}-char mojibake)`);
    }
  }
  // After main replacements, sweep for truncated-mojibake forms (e.g.
  // "Building<mojibake>Owner" where a byte was accidentally dropped).
  for (const [bad, good] of TRUNCATED_FALLBACKS) {
    let count = 0;
    let idx = fixed.indexOf(bad);
    while (idx !== -1) {
      count++;
      idx = fixed.indexOf(bad, idx + bad.length);
    }
    if (count > 0) {
      fixed = fixed.split(bad).join(good);
      edits += count;
      console.log(`  ${rel}: ${count} x truncated-fallback -> ${JSON.stringify(good)}`);
    }
  }
  if (fixed !== original) {
    fs.writeFileSync(full, fixed, 'utf8');
    totalFilesFixed++;
    console.log(`fixed: ${rel}  (${edits} replacements)`);
  } else {
    console.log(`no changes: ${rel}`);
  }
}

console.log(`\nDone. Files modified: ${totalFilesFixed}`);
