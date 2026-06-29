'use strict';
const fs = require('fs');

/* index.html DB에서 URL 추출 */
const html = fs.readFileSync('index.html', 'utf8');
const urls = [...new Set(
  [...html.matchAll(/url:'(https?:\/\/[^']+)'/g)].map(m => m[1])
)];

async function checkUrl(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinkChecker/1.0)' }
    });
    clearTimeout(timer);
    return { url, status: res.status, ok: res.status < 400 };
  } catch (err) {
    clearTimeout(timer);
    return { url, status: 0, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`🔎 ${urls.length}개 URL 체크 시작...\n`);
  const results = {};
  const BATCH = 8;

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const res = await Promise.all(batch.map(checkUrl));
    for (const r of res) {
      results[r.url] = {
        status: r.status,
        ok: r.ok,
        error: r.error ?? null,
        checkedAt: new Date().toISOString()
      };
      const mark = r.ok ? '✓' : '✗';
      console.log(`${mark} [${String(r.status).padStart(3)}] ${r.url}`);
    }
    if (i + BATCH < urls.length) await new Promise(r => setTimeout(r, 600));
  }

  fs.writeFileSync(
    'link-status.json',
    JSON.stringify({ updatedAt: new Date().toISOString(), results }, null, 2)
  );

  const issues = Object.entries(results).filter(([, v]) => !v.ok);
  console.log(`\n완료: ${urls.length}개 체크, 문제 ${issues.length}개`);
  if (issues.length) {
    console.log('\n문제 목록:');
    issues.forEach(([url, v]) => console.log(`  [${v.status}] ${url}`));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
