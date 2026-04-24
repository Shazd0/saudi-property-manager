'use strict';

/**
 * patch-i18n.cjs
 * Automatically patches React components to use t() for hardcoded strings
 * that match values in the en.ts translation dictionary.
 * 
 * Also adds `useLanguage` import and hook call to components missing it.
 */

const fs = require('fs');
const path = require('path');

// ─── 1. Build reverse lookup: English value → translation key ────────────────

const enPath = path.join(__dirname, '../i18n/translations/en.ts');
const enContent = fs.readFileSync(enPath, 'utf8');

const valueToKey = new Map();
const keyValueRegex = /'([^']+)'\s*:\s*'([^'\\]+)'/g;
let m;
while ((m = keyValueRegex.exec(enContent)) !== null) {
  const key = m[1];
  const value = m[2];
  // Skip very short values to avoid false positives
  if (value.length >= 3 && !valueToKey.has(value)) {
    valueToKey.set(value, key);
  }
}

console.log(`Loaded ${valueToKey.size} translation mappings from en.ts`);

// ─── 2. Determine import path based on file depth ───────────────────────────

function getImportPath(filePath) {
  const componentsDir = path.join(__dirname, '../components');
  const relFromComponents = path.relative(componentsDir, path.dirname(filePath));
  // If inside a subdirectory, need ../../i18n
  if (relFromComponents && relFromComponents !== '.') {
    return '../../i18n';
  }
  return '../i18n';
}

// ─── 3. Process a single TSX file ────────────────────────────────────────────

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let replacements = 0;

  const hasImport = content.includes('useLanguage');
  // Check if t is destructured from useLanguage
  const hasT = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useLanguage\s*\(/.test(content);

  // ── 3a. Add import statement if missing ──────────────────────────────────
  let needsImport = !hasImport;
  let needsHook = !hasT;

  if (needsImport) {
    const importPath = getImportPath(filePath);
    const importLine = `import { useLanguage } from '${importPath}';\n`;
    // Find the end of the last import block (handles multi-line imports)
    // Look for last occurrence of `} from '...'` or `from '...'` pattern
    const fromPattern = /^[^\n]*from\s+['"][^'"]+['"]\s*;?\s*$/mg;
    let lastFromMatch = null;
    let fm;
    while ((fm = fromPattern.exec(content)) !== null) {
      // Only consider lines that are part of an import statement
      // (preceded by 'import' somewhere above or on the same line)
      lastFromMatch = fm;
    }
    if (lastFromMatch) {
      const insertPos = lastFromMatch.index + lastFromMatch[0].length;
      // Insert after the newline
      const afterNewline = content[insertPos] === '\n' ? insertPos + 1 : insertPos;
      content = content.slice(0, afterNewline) + importLine + content.slice(afterNewline);
    } else {
      content = importLine + content;
    }
  }

  // ── 3b. Add hook call inside component if missing ────────────────────────
  if (needsHook) {
    // Strategy: find the first useState, useEffect, useNavigate, useToast, useRef, useMemo call
    // and insert the useLanguage hook RIGHT BEFORE that line
    const hookLinePattern = /^(\s*)(const\s+\{[^}]+\}\s*=\s*use(?:State|Effect|Navigate|Memo|Ref|Toast|Callback|Context|Reducer|ImperativeHandle|LayoutEffect|DebugValue|DeferredValue|Id|InsertionEffect|Sync|Transition)\s*\(|const\s+\[?\s*\w+[^\n]*=\s*use(?:State|Memo|Callback|Ref)\s*\()/m;
    const hm = hookLinePattern.exec(content);
    if (hm) {
      const indent = hm[1] || '  ';
      const pos = hm.index;
      const hookLine = `${indent}const { t, isRTL } = useLanguage();\n`;
      content = content.slice(0, pos) + hookLine + content.slice(pos);
    } else {
      // Fallback: insert after the first opening { of the component function
      // Look for: const ComponentName: React.FC<...> = (...) => {
      // or         const ComponentName = (...) => {
      const compFnPattern = /const\s+[A-Z]\w*\s*(?::\s*React\.FC[^=]*)?\s*=\s*(?:\([^)]*\)|[a-z_]\w*)\s*=>\s*\{/;
      const cfm = compFnPattern.exec(content);
      if (cfm) {
        const pos = cfm.index + cfm[0].length;
        content = content.slice(0, pos) + '\n  const { t, isRTL } = useLanguage();' + content.slice(pos);
      }
    }
  }

  // ── 3c. Replace JSX text nodes: >TEXT< → >{t('key')}< ───────────────────
  // Match text between > and < that:
  //   - Has no JSX braces, quotes, tags inside
  //   - Is 3-80 chars (trimmed)
  //   - Matches a translation value exactly
  content = content.replace(
    />(\s*)([^{}<>"'\n\r\\]{3,80})(\s*)(<)/g,
    (full, pre, text, post, lt) => {
      const trimmed = text.trim();
      if (valueToKey.has(trimmed)) {
        replacements++;
        return `>{t('${valueToKey.get(trimmed)}')}${lt}`;
      }
      return full;
    }
  );

  // ── 3d. Replace placeholder="TEXT" and title="TEXT" attributes ───────────
  for (const attr of ['placeholder', 'title', 'aria-label', 'label']) {
    const re = new RegExp(`(\\b${attr}=)"([^"]{3,80})"`, 'g');
    content = content.replace(re, (full, attrEq, value) => {
      if (valueToKey.has(value)) {
        replacements++;
        return `${attrEq}{t('${valueToKey.get(value)}')}`;
      }
      return full;
    });
  }

  // ── 3e. Replace isRTL ternary patterns ───────────────────────────────────
  // Pattern: isRTL ? 'ArabicText' : 'EnglishText'
  content = content.replace(
    /isRTL\s*\?\s*'[^']*'\s*:\s*'([^']+)'/g,
    (full, enValue) => {
      if (valueToKey.has(enValue)) {
        replacements++;
        return `t('${valueToKey.get(enValue)}')`;
      }
      return full;
    }
  );

  // Also handle: language === 'ar' ? 'ArabicText' : 'EnglishText'
  content = content.replace(
    /language\s*===\s*['"]ar['"]\s*\?\s*'[^']*'\s*:\s*'([^']+)'/g,
    (full, enValue) => {
      if (valueToKey.has(enValue)) {
        replacements++;
        return `t('${valueToKey.get(enValue)}')`;
      }
      return full;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { changed: true, replacements, addedImport: needsImport && !hasImport, addedHook: needsHook };
  }

  return { changed: false, replacements: 0, addedImport: false, addedHook: false };
}

// ─── 4. Walk components directory ────────────────────────────────────────────

const componentsDir = path.join(__dirname, '../components');

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      files.push(...walkDir(full));
    } else if (full.endsWith('.tsx') && !full.endsWith('.bak')) {
      files.push(full);
    }
  }
  return files;
}

const tsxFiles = walkDir(componentsDir);
console.log(`Found ${tsxFiles.length} TSX files to process\n`);

let totalChanged = 0;
let totalReplacements = 0;
let totalImports = 0;
let totalHooks = 0;

for (const file of tsxFiles) {
  try {
    const result = processFile(file);
    const name = path.relative(componentsDir, file);
    if (result.changed) {
      totalChanged++;
      totalReplacements += result.replacements;
      if (result.addedImport) totalImports++;
      if (result.addedHook) totalHooks++;
      const flags = [];
      if (result.addedImport) flags.push('+import');
      if (result.addedHook) flags.push('+hook');
      if (result.replacements > 0) flags.push(`${result.replacements} replacements`);
      console.log(`✓ ${name}  [${flags.join(', ')}]`);
    }
  } catch (err) {
    console.error(`✗ ERROR in ${path.relative(componentsDir, file)}: ${err.message}`);
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Files modified:    ${totalChanged}`);
console.log(`String replacements: ${totalReplacements}`);
console.log(`Imports added:     ${totalImports}`);
console.log(`Hooks added:       ${totalHooks}`);
console.log(`\nDone. Run TypeScript check: npx tsc --noEmit`);
