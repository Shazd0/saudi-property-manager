'use strict';
/**
 * fix-t-shadow.cjs
 * Renames only .map(t => callback parameter and its usages to `tx`
 * in components that also use useLanguage(), to avoid shadowing the t() translation function.
 * 
 * Strategy: Find .map(t => or .map((t, blocks and use bracket-counting to rename
 * only t references inside that specific arrow function body.
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

/**
 * Given source code, find all .map(t => or .map((t, ...) => patterns
 * and rename t -> tx within their body only.
 */
function fixTShadow(content) {
  let result = content;
  
  // Pattern 1: .map(t => EXPR_OR_BLOCK) — single param, no parens
  // Pattern 2: .map((t) => EXPR_OR_BLOCK) — single param with parens
  // Pattern 3: .map((t, idx) => EXPR_OR_BLOCK) — with index
  
  // We'll do a character-level scan to find each .map( that has `t` as its callback param
  // and rename `t` -> `tx` within the body (tracking brace/paren depth).
  
  // Simpler approach: use regex to find the patterns, then rename within the captured group
  // This works for JSX because t.prop patterns are distinctive enough.
  
  // Replace .map(t => with .map(tx_rename => and track depth to replace t. -> tx_rename.
  // Actually the cleanest approach is to use a JS parser, but we don't have one.
  
  // Instead: use regex with a callback that does depth-aware replacement.
  // We identify each `\.map\(\s*t\s*=>` or `\.map\(\s*\(\s*t\s*[,)]\s*[^)]*\)\s*=>`
  // Then scan forward from that point, tracking { } and ( ) depth,
  // and rename standalone `t` (followed by . [ or space that's a property access) to tx.
  
  function renameInScope(code, startIdx) {
    // startIdx points to the first char AFTER the `.map(tx =>` opening
    // We scan forward and rename `\bt\b(?=[\.\[])` to `tx` within this scope
    // Scope ends when the surrounding ) for .map( closes (depth tracking)
    
    // Find the body extent using bracket counting
    // The .map( has already consumed one `(` so we start at depth 1
    let depth = 1;
    let i = startIdx;
    let segment = '';
    
    while (i < code.length && depth > 0) {
      const ch = code[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
      if (depth > 0) segment += ch;
      i++;
    }
    
    // Now rename standalone `t` (not `t(` which is the translation function, not `tx`)
    // that appear as property accesses: t. or t[ or `t ` followed by something
    // but NOT t( which is the translation call
    const renamed = segment.replace(/\bt\b(?=[\.\[])/g, 'tx');
    
    return {
      before: code.slice(0, startIdx),
      renamed,
      after: code.slice(i - 1) // the closing ) char
    };
  }
  
  // Process all .map(t => or .map((t) => patterns
  // Replace them one by one (re-scan after each to handle nesting correctly)
  
  let changed = false;
  
  // Pattern: .map(t => or .map(t=>
  result = result.replace(/\.map\(\s*t\s*=>/g, (match) => {
    changed = true;
    return '.map(tx =>';
  });
  
  // Pattern: .map((t, or .map((t) =>
  result = result.replace(/\.map\(\s*\(\s*t\s*,/g, (match) => {
    changed = true;
    return '.map((tx,';
  });
  result = result.replace(/\.map\(\s*\(\s*t\s*\)\s*=>/g, (match) => {
    changed = true;
    return '.map((tx) =>';
  });
  
  if (!changed) return null;
  
  // Now find all `.map(tx =>` occurrences and rename `t.` -> `tx.` ONLY within their body
  // by doing a bracket-depth scan
  const mapPattern = /\.map\(\s*tx\s*=>|\.map\(\s*\(tx[,)]/g;
  let match;
  const patches = [];
  
  while ((match = mapPattern.exec(result)) !== null) {
    // Find the opening paren of .map(
    const mapStart = result.lastIndexOf('.map(', match.index) + 5; // after .map(
    // The content starts after `tx =>`  or `(tx,...) =>`
    // Find the `=>` position
    const arrowIdx = result.indexOf('=>', match.index);
    if (arrowIdx === -1) continue;
    const bodyStart = arrowIdx + 2;
    
    // Scan from bodyStart to find scope end
    let depth = 1; // we're inside .map(
    let i = mapStart;
    // Count depth up to bodyStart first
    while (i < bodyStart) {
      const ch = result[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }
    
    // Now scan from bodyStart
    let bodyEnd = bodyStart;
    while (bodyEnd < result.length && depth > 0) {
      const ch = result[bodyEnd];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) break;
      }
      bodyEnd++;
    }
    
    patches.push({ start: bodyStart, end: bodyEnd });
  }
  
  // Apply patches in reverse order (to preserve indices)
  for (let i = patches.length - 1; i >= 0; i--) {
    const { start, end } = patches[i];
    const body = result.slice(start, end);
    // Rename t. and t[ to tx. and tx[ but NOT t( (translation calls)
    const renamed = body.replace(/\bt\b(?=[\.\[])/g, 'tx');
    result = result.slice(0, start) + renamed + result.slice(end);
  }
  
  return result !== content ? result : null;
}

let totalFixed = 0;

for (const file of walkDir(componentsDir)) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Only touch files that use useLanguage
  if (!content.includes('useLanguage')) continue;
  
  const fixed = fixTShadow(content);
  if (fixed !== null) {
    fs.writeFileSync(file, fixed, 'utf8');
    const name = path.relative(componentsDir, file);
    console.log(`✓ Fixed: ${name}`);
    totalFixed++;
  }
}

console.log(`\nFixed ${totalFixed} files`);
