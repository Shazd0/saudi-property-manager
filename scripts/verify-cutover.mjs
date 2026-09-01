#!/usr/bin/env node
/**
 * Post-cutover smoke checks (run from any machine with network access).
 * Usage: node scripts/verify-cutover.mjs
 */

const CHECKS = [
  { name: 'License API health', url: 'https://saleapi.amlak-app.com/health', expect: (t) => t.includes('"ok":true') },
  { name: 'RR MILLENNIUM app', url: 'https://amlak-app.com/app/?teamCode=P25Y3RHH5GGAZ8', expect: (t) => t.includes('Amlak') },
  { name: 'Duyoof app', url: 'https://amlak-app.com/app/?teamCode=3TAJ3ZWQBSETPR', expect: (t) => t.includes('Amlak') },
  { name: 'SPM Netlify', url: 'https://amlakrrgroup.netlify.app/', expect: (t) => t.includes('Amlak') },
];

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return { status: res.status, text };
}

async function checkNetlifyBundle() {
  const home = await fetchText('https://amlakrrgroup.netlify.app/');
  const mainMatch = home.text.match(/assets\/main-[^"]+\.js/);
  if (!mainMatch) return { ok: false, detail: 'main bundle not found in index.html' };
  const mainUrl = `https://amlakrrgroup.netlify.app/${mainMatch[0]}`;
  const main = await fetch(mainUrl);
  const js = await main.text();
  const hasMacEnv = /VITE_DATA_BACKEND:\s*"mac"/.test(js);
  const hasMacToken = /VITE_MAC_API_TOKEN/.test(js);
  const fsMatch = home.text.match(/assets\/firestoreService-[^"]+\.js/);
  let firestoreUsesFirebase = false;
  if (fsMatch) {
    const fsJs = await (await fetch(`https://amlakrrgroup.netlify.app/${fsMatch[0]}`)).text();
    firestoreUsesFirebase = fsJs.includes('firestore') && !fsJs.includes('macSaveDocument');
  }
  return {
    ok: !hasMacEnv && !hasMacToken && firestoreUsesFirebase,
    detail: `VITE_DATA_BACKEND=mac in bundle=${hasMacEnv}, MAC_API_TOKEN in bundle=${hasMacToken}, firestore chunk looks Firebase=${firestoreUsesFirebase}`,
  };
}

async function main() {
  let failed = 0;
  for (const check of CHECKS) {
    try {
      const { status, text } = await fetchText(check.url);
      const ok = status === 200 && check.expect(text);
      console.log(`${ok ? 'OK' : 'FAIL'}  ${check.name} (${status})`);
      if (!ok) failed += 1;
    } catch (error) {
      console.log(`FAIL  ${check.name}: ${error?.message || error}`);
      failed += 1;
    }
  }
  try {
    const bundle = await checkNetlifyBundle();
    console.log(`${bundle.ok ? 'OK' : 'WARN'} Netlify bundle: ${bundle.detail}`);
  } catch (error) {
    console.log(`WARN Netlify bundle: ${error?.message || error}`);
  }
  process.exitCode = failed ? 1 : 0;
}

main();
