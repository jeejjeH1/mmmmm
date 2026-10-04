// Deterministic frame renderer: headless Chromium (WebGL via SwiftShader) ->
// PNG frames -> ffmpeg. Frames are split across parallel browser workers.
//
//   node scripts/render.mjs --stills 1.5,8,20.25          # PNG stills to out/stills
//   node scripts/render.mjs --from 0 --to 10 --fps 30     # quick preview clip
//   node scripts/render.mjs --fps 60 --workers 3 --audio out/soundtrack.wav --out out/genlayer-motion.mp4
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
    return acc;
  }, []),
);
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/timeline.json'), 'utf8'));
const FPS = Number(args.fps ?? 60);
const FROM = Number(args.from ?? 0);
const TO = Number(args.to ?? timeline.duration);
const WORKERS = Number(args.workers ?? 3);
const SCALE = Number(args.scale ?? 1);
const OUT = path.resolve(ROOT, args.out ?? 'out/genlayer-motion.mp4');
const AUDIO = args.audio ? path.resolve(ROOT, args.audio) : null;
const PARTS = path.join(ROOT, 'out/parts');
const STILL = Boolean(args.stills);
const JPEG_Q = Number(args.jpeg ?? 95);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, s) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      if (!f.startsWith(ROOT)) return s.writeHead(403).end();
      fs.readFile(f, (e, d) => {
        if (e) return s.writeHead(404).end();
        s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        s.end(d);
      });
    });
    srv.listen(0, () => res(srv));
  });
}

async function openPage(port) {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none', '--disable-lcd-text'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GL Driver Message')) console.error('[page]', m.text());
  });
  await page.goto(`http://localhost:${port}/src/index.html?scale=${SCALE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const cdp = await page.context().newCDPSession(page);
  const grab = async (t) => {
    await page.evaluate((tt) => window.renderFrame(tt), t);
    const r = await cdp.send('Page.captureScreenshot', STILL ? { format: 'png', optimizeForSpeed: true } : { format: 'jpeg', quality: JPEG_Q });
    return Buffer.from(r.data, 'base64');
  };
  return { browser, page, grab };
}

// JPEG frames are BT.601 full range; convert once to BT.709 limited and tag it,
// which is what browsers and X assume for HD video.
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

function ffmpegPart(file) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', 'zscale=matrixin=470bg:rangein=full:matrix=709:range=limited,format=yuv444p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', ...BT709, file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
  return { ff, done };
}

const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once('drain', res)));

async function main() {
  const srv = await serve();
  const port = srv.address().port;

  if (args.stills) {
    const dir = path.join(ROOT, args.stillsDir ?? 'out/stills');
    fs.mkdirSync(dir, { recursive: true });
    const { browser, grab } = await openPage(port);
    for (const s of String(args.stills).split(',')) {
      const t = Number(s);
      const png = await grab(t);
      const f = path.join(dir, `still_${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(f, png);
      console.log('wrote', path.relative(ROOT, f));
    }
    await browser.close();
    srv.close();
    return;
  }

  const total = Math.round((TO - FROM) * FPS);
  fs.mkdirSync(PARTS, { recursive: true });
  const per = Math.ceil(total / WORKERS);
  const t0 = Date.now();
  let doneFrames = 0;
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const a = w * per;
    const b = Math.min(total, a + per);
    if (a >= b) break;
    const file = path.join(PARTS, `part_${String(w).padStart(2, '0')}.mkv`);
    jobs.push(
      (async () => {
        const { browser, grab } = await openPage(port);
        const { ff, done } = ffmpegPart(file);
        for (let f = a; f < b; f++) {
          const png = await grab(FROM + f / FPS);
          await write(ff.stdin, png);
          doneFrames++;
          if (doneFrames % 120 === 0) {
            const el = (Date.now() - t0) / 1000;
            const eta = (el / doneFrames) * (total - doneFrames);
            console.log(`${doneFrames}/${total} frames  ${(el / doneFrames * 1000).toFixed(0)}ms/frame(eff)  eta ${(eta / 60).toFixed(1)}min`);
          }
        }
        ff.stdin.end();
        await done;
        await browser.close();
        return file;
      })(),
    );
  }
  const files = await Promise.all(jobs);
  srv.close();
  const list = path.join(PARTS, 'list.txt');
  fs.writeFileSync(list, files.map((f) => `file '${f}'`).join('\n'));
  const enc = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (AUDIO) enc.push('-ss', String(FROM), '-t', String(TO - FROM), '-i', AUDIO);
  enc.push('-map', '0:v');
  if (AUDIO) enc.push('-map', '1:a', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
  enc.push('-c:v', 'libx264', '-preset', args.preset ?? 'slow', '-crf', args.crf ?? '18', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', ...BT709, '-maxrate', args.maxrate ?? '16M', '-bufsize', args.bufsize ?? '32M', '-g', String(FPS * 2), '-movflags', '+faststart', '-r', String(FPS), OUT);
  await new Promise((res, rej) => spawn('ffmpeg', enc, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? res() : rej(new Error('final encode failed')))));
  console.log(`done: ${path.relative(ROOT, OUT)} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
