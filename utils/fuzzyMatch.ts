/** Shared fuzzy string matching (from SheetsImport). */

export function fuzzyNorm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function fuzzyMatch(needle: string, haystack: string[]): string | null {
  const n = fuzzyNorm(needle);
  if (!n) return null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const h of haystack) {
    const hn = fuzzyNorm(h);
    if (hn === n) return h;
    if (hn.includes(n) || n.includes(hn)) {
      const score = Math.abs(hn.length - n.length);
      if (score < bestScore) {
        bestScore = score;
        best = h;
      }
    }
  }
  return best;
}

export function fuzzyContains(needle: string, haystack: string): boolean {
  const n = fuzzyNorm(needle);
  const h = fuzzyNorm(haystack);
  if (!n || !h) return false;
  return h.includes(n) || n.includes(h);
}
