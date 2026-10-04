// Times renderFrame (with a forced GL sync) and the screenshot separately.
//   node scripts/profile.mjs 3.75 "msaa=0&bloom=0"
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.css': 'text/css' };
const srv = http.createServer((q, s) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => (e ? s.writeHead(404).end() : (s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }), s.end(d))));
}).listen(0);
await new Promise((r) => srv.on('listening', r));
const t = Number(process.argv[2] ?? 3.75);
const q = process.argv[3] ?? '';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://localhost:${srv.address().port}/src/index.html?${q}`);
await page.waitForFunction(() => window.__ready === true);
const cdp = await page.context().newCDPSession(page);
let a = 0, b = 0;
const N = 6;
for (let i = 0; i < N; i++) {
  const t0 = Date.now();
  await page.evaluate((tt) => { window.renderFrame(tt); window.__sync && window.__sync(); }, t + i / 60);
  const t1 = Date.now();
  await cdp.send('Page.captureScreenshot', process.env.JPEG ? { format: 'jpeg', quality: Number(process.env.JPEG) } : { format: 'png', optimizeForSpeed: true });
  const t2 = Date.now();
  if (i > 0) { a += t1 - t0; b += t2 - t1; }
}
console.log(`t=${t} [${q}] render+sync ${(a / (N - 1)).toFixed(0)}ms  capture ${(b / (N - 1)).toFixed(0)}ms`);
await browser.close();
srv.close();
