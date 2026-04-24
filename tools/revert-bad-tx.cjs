'use strict';
/**
 * revert-bad-tx.cjs
 * The previous bad script replaced ALL `t.` with `tx.` globally.
 * This script reverts `tx.` back to `t.` EXCEPT within .map(tx => bodies.
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
  if (!content.includes('tx.') && !content.includes('tx[')) continue;

  // Step 1: Find all ranges that ARE legitimate .map(tx => bodies
  // These should keep `tx.`
  const legitimateRanges = [];
  const mapPattern = /\.map\(\s*tx\s*=>|\.map\(\s*\(tx[,)]/g;
  let match;
  
  while ((match = mapPattern.exec(content)) !== null) {
    // Find .map( opening
    const mapOpenIdx = content.lastIndexOf('.map(', match.index);
    if (mapOpenIdx === -1) continue;
    const bodyStart = mapOpenIdx + 5; // skip ".map("
    
    // Scan to find the end of this .map() call (depth-tracking)
    let depth = 1;
    let i = bodyStart;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }
    legitimateRanges.push({ start: bodyStart, end: i });
  }

  // Step 2: Revert tx. -> t. everywhere that is NOT in a legitimate range
  // Build result char by char, tracking position
  let result = '';
  let pos = 0;
  
  // Find all `tx.` and `tx[` occurrences and decide whether to revert
  const txPattern = /\btx([\.\[])/g;
  let txMatch;
  
  // Also need to revert tx parameter declarations in .filter(t => or .reduce((s,t) =>
  // which got broken: now they say .filter(t => tx.type) but t is defined, tx is not
  // More specifically: we need to revert `tx.` that appears inside callbacks where
  // the parameter was still `t` (i.e., .filter(t =>, .reduce((s, t) =>)
  // But this is complex to track. Simpler: revert ALL tx. that are NOT in .map(tx =>) bodies.
  
  const allTxPositions = [];
  while ((txMatch = txPattern.exec(content)) !== null) {
    allTxPositions.push({ idx: txMatch.index, suffix: txMatch[1], len: txMatch[0].length });
  }
  
  // For each tx. occurrence, check if it's in a legitimate range
  function isInLegitimateRange(idx) {
    return legitimateRanges.some(r => idx >= r.start && idx < r.end);
  }
  
  // Rebuild the string with reversions
  const chars = content.split('');
  for (const { idx, suffix, len } of allTxPositions) {
    if (!isInLegitimateRange(idx)) {
      // Revert: replace tx. with t. at this position
      chars[idx] = 't';
      chars[idx + 1] = suffix; // . or [
      chars[idx + 2] = ''; // remove the extra character (tx has 2 chars, t has 1)
    }
  }
  
  const newContent = chars.join('');
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    const name = path.relative(componentsDir, file);
    console.log(`✓ Reverted: ${name}`);
    totalFixed++;
  }
}

console.log(`\nReverted ${totalFixed} files`);
