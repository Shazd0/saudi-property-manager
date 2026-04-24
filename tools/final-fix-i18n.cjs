'use strict';
/**
 * final-fix-i18n.cjs
 * Fixes two patterns created by the botched fix-t-shadow/revert scripts:
 *
 * PATTERN A: (tx as any) inside callbacks where param is `t` → revert to (t as any)
 *   e.g. .filter(t => (tx as any).deleted) → .filter(t => (t as any).deleted)
 *
 * PATTERN B: t.prop inside functions with `tx:` typed parameter → fix to tx.prop
 *   e.g. generateZATCAQR(tx: Transaction) { t.date... } → tx.date...
 *   e.g. classifyTransaction(tx: Transaction) { t.type... } → tx.type...
 */
const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '../components');

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) files.push(...walkDir(full));
    else if (full.endsWith('.tsx') && !full.endsWith('.bak')) files.push(full);
  }
  return files;
}

let totalFixed = 0;

for (const file of walkDir(componentsDir)) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('useLanguage')) continue;
  
  const original = content;

  // ── PATTERN A: (tx as any) → (t as any) in filter/find/some/every/forEach/reduce callbacks ──
  // These callbacks have `t` as the parameter variable, so (tx as any) is wrong.
  // Strategy: Scan line by line. If a line contains `.filter(t =>` or similar AND also
  // contains `(tx as any)`, replace the (tx as any) with (t as any) on that line.
  // Also handle multi-line callbacks (scan until matching brace depth closes).
  
  // Simple approach: Replace `(tx as any)` with `(t as any)` when followed by 
  // callback patterns in the same logical scope.
  // Since most of these are on the same line or in simple blocks, we can scan lines.
  
  const lines = content.split('\n');
  const fixedLines = lines.map(line => {
    // If line has a filter/find/some/every/forEach callback with `t` as loop param
    // AND has (tx as any), revert (tx as any) → (t as any)
    if (/\b(filter|find|some|every|forEach|reduce)\s*\(\s*(?:\([^)]*,\s*)?t\s*(?:[:,]|\)?\s*=>)/.test(line)) {
      return line.replace(/\(tx\s+as\s+any\)/g, '(t as any)');
    }
    return line;
  });
  content = fixedLines.join('\n');

  // ── PATTERN B: t. → tx. inside function bodies with (tx: TypeName) parameter ──
  // Find standalone function or arrow function declarations with `tx:` typed parameter.
  // Use bracket depth counting to find the body extent.
  // Then rename `t.` and `t[` and `(t as any)` to `tx.` / `tx[` / `(tx as any)` within body.
  
  // Pattern: function NAME(tx: Type or (tx: Type or , tx: Type
  const fnPattern = /^([\s]*(?:const|function|async function)\s+\w+\s*[=:]?\s*(?:<[^>]*>)?\s*\([^)]*\btx\s*:[^)]+\)[^=>{]*(?::\s*[^{]+)?\s*(?:=>)?\s*\{)/m;
  
  // More specific: find all occurrences of function signatures with `tx: `
  const funcSigPattern = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\btx\s*:[^)]+\)|<[^>]+>\s*\([^)]*\btx\s*:[^)]+\))|\([^)]*\btx\s*:[^)]+\)\s*(?::\s*[^{=]+)?\s*=>)/g;
  
  let fsMatch;
  const funcBodyRanges = [];
  
  // Simple approach: find lines that declare a function with `tx:` param
  const lineArray = content.split('\n');
  let charPos = 0;
  const linePositions = lineArray.map(l => {
    const start = charPos;
    charPos += l.length + 1;
    return start;
  });
  
  for (let lineIdx = 0; lineIdx < lineArray.length; lineIdx++) {
    const line = lineArray[lineIdx];
    // Look for function signature with `tx:` parameter (not inside a .map( call)
    // Function patterns: `function foo(tx:`, `const foo = (tx:`, `(tx:` standalone
    if (/(?:function\s+\w+\s*\([^)]*\btx\s*:|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\btx\s*:)/.test(line)) {
      // Find the opening { of this function's body
      const lineStart = linePositions[lineIdx];
      const braceIdx = content.indexOf('{', lineStart);
      if (braceIdx === -1) continue;
      
      // Scan forward from braceIdx to find matching }
      let depth = 1;
      let i = braceIdx + 1;
      while (i < content.length && depth > 0) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') depth--;
        i++;
      }
      funcBodyRanges.push({ start: braceIdx + 1, end: i - 1 });
    }
  }
  
  // Apply Pattern B fixes in reverse order
  for (let i = funcBodyRanges.length - 1; i >= 0; i--) {
    const { start, end } = funcBodyRanges[i];
    const body = content.slice(start, end);
    // In these function bodies, `t.` and `t[` should be `tx.` and `tx[`
    // But only where `t` was the original parameter (now named `tx`)
    // We match `t` at word boundary followed by . or [
    const fixed = body
      .replace(/\bt\.(?=[a-zA-Z_$])/g, 'tx.')
      .replace(/\bt\[/g, 'tx[')
      .replace(/\(t\s+as\s+any\)/g, '(tx as any)');
    content = content.slice(0, start) + fixed + content.slice(end);
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    const name = path.relative(componentsDir, file);
    console.log(`✓ Fixed: ${name}`);
    totalFixed++;
  }
}

console.log(`\nFixed ${totalFixed} files`);
