// Deterministic frame renderer: headless Chromium (WebGL via SwiftShader) ->
// PNG frames -> ffmpeg. Frames are split across parallel browser workers.
//
//   node scripts/render.mjs --stills 1.5,8,20.25          # PNG stills to out/stills
//   node scripts/render.mjs --from 0 --to 10 --fps 30     # quick preview clip
//   node scripts/render.mjs --fps 60 --workers 3 --audio out/soundtrack.wav --out out/genlayer-motion.mp4
//
// Highest quality: two jittered samples per frame (120 samples/s blended to 60 fps:
// motion blur + anti-aliasing), lossless PNG capture, two-pass encode at a fixed bitrate.
//   node scripts/render.mjs --sub 2 --png --parts out/parts_hq --no-encode
//   node scripts/render.mjs --parts out/parts_hq --encode-only --audio out/soundtrack.wav \
//     --vbitrate 7000k --abitrate 256k --preset veryslow --out out/genlayer-motion.mp4
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
const PARTS = path.resolve(ROOT, args.parts ?? 'out/parts');
const STILL = Boolean(args.stills);
const JPEG_Q = Number(args.jpeg ?? 95);
const SUB = Number(args.sub ?? 1); // samples blended into each output frame
const PNG = Boolean(args.png);
// Sub-pixel camera jitter per sample (rotated grid), in output pixels.
const JITTER = { 1: [[0, 0]], 2: [[-0.25, -0.25], [0.25, 0.25]], 4: [[-0.375, -0.125], [0.125, -0.375], [0.375, 0.125], [-0.125, 0.375]] }[SUB];
if (!JITTER) throw new Error('--sub must be 1, 2 or 4');

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
  const grab = async (t, jx = 0, jy = 0) => {
    await page.evaluate(([tt, x, y]) => window.renderFrame(tt, x, y), [t, jx, jy]);
    const r = await cdp.send('Page.captureScreenshot', STILL || PNG ? { format: 'png', optimizeForSpeed: true } : { format: 'jpeg', quality: JPEG_Q });
    return Buffer.from(r.data, 'base64');
  };
  return { browser, page, grab };
}

// JPEG frames are BT.601 full range; convert once to BT.709 limited and tag it,
// which is what browsers and X assume for HD video.
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

function ffmpegPart(file) {
  // Decode to RGB, blend the SUB samples of each frame, then convert once to BT.709.
  const blend = SUB > 1 ? `tmix=frames=${SUB}:weights=${Array(SUB).fill(1).join(' ')},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),` : '';
  const vf = `format=gbrp,${blend}zscale=matrix=709:range=limited,format=yuv444p`;
  const icrf = args.icrf ?? (PNG || SUB > 1 ? '6' : '10');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', PNG ? 'png' : 'mjpeg', '-i', '-', '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', icrf, ...BT709, file], { stdio: ['pipe', 'inherit', 'inherit'] });
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
  if (args['encode-only']) {
    srv.close();
    return encode(path.join(PARTS, 'list.txt'), Date.now());
  }
  // Resumable: the range is cut into segments; a finished segment is renamed into
  // place, so a restarted run skips everything already on disk.
  const segLen = Math.round(Number(args.seg ?? 2) * FPS);
  const segs = [];
  for (let a = 0; a < total; a += segLen) segs.push({ a, b: Math.min(total, a + segLen), file: path.join(PARTS, `seg_${String(segs.length).padStart(3, '0')}.mkv`) });
  const todo = segs.filter((g) => !fs.existsSync(g.file));
  const t0 = Date.now();
  let doneFrames = 0;
  const todoFrames = todo.reduce((n, g) => n + g.b - g.a, 0);
  console.log(`${segs.length - todo.length}/${segs.length} segments already done; rendering ${todoFrames} frames`);
  const queue = [...todo];
  const workers = [];
  for (let w = 0; w < Math.min(WORKERS, queue.length); w++) {
    workers.push(
      (async () => {
        const { browser, grab } = await openPage(port);
        let g;
        while ((g = queue.shift())) {
          const tmp = g.file.replace(/\.mkv$/, '.tmp.mkv');
          const { ff, done } = ffmpegPart(tmp);
          for (let f = g.a; f < g.b; f++) {
            for (let s = 0; s < SUB; s++) {
              const png = await grab(FROM + (f + s / SUB) / FPS, JITTER[s][0], JITTER[s][1]);
              await write(ff.stdin, png);
            }
            doneFrames++;
          }
          ff.stdin.end();
          await done;
          fs.renameSync(tmp, g.file);
          const el = (Date.now() - t0) / 1000;
          console.log(`${path.basename(g.file)} done  ${doneFrames}/${todoFrames} frames  eta ${((el / doneFrames) * (todoFrames - doneFrames) / 60).toFixed(1)}min`);
        }
        await browser.close();
      })(),
    );
  }
  await Promise.all(workers);
  srv.close();
  const list = path.join(PARTS, 'list.txt');
  fs.writeFileSync(list, segs.map((g) => `file '${g.file}'`).join('\n'));
  if (args['no-encode']) return console.log(`rendered: ${path.relative(ROOT, list)} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  await encode(list, t0);
}

const run = (a) => new Promise((res, rej) => spawn('ffmpeg', a, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed: ' + c)))));

// Final H.264 encode. With --vbitrate it is a two-pass encode at that average
// bitrate (to fill a size budget); otherwise single-pass CRF.
async function encode(list, t0) {
  const input = ['-f', 'concat', '-safe', '0', '-i', list];
  const audioIn = AUDIO ? ['-ss', String(FROM), '-t', String(TO - FROM), '-i', AUDIO] : [];
  const v = ['-c:v', 'libx264', '-preset', args.preset ?? 'slow', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', ...BT709, '-g', String(FPS * 2), '-r', String(FPS)];
  if (args.vbitrate) {
    const kb = parseInt(args.vbitrate, 10);
    v.push('-b:v', `${kb}k`, '-maxrate', `${kb * 2}k`, '-bufsize', `${kb * 4}k`, '-aq-mode', '3', '-psy-rd', '1.0:0.15', '-deblock', '-1:-1', '-passlogfile', path.join(PARTS, 'x264pass'));
    await run(['-y', '-loglevel', 'error', ...input, ...v, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
    v.push('-pass', '2');
  } else {
    v.push('-crf', args.crf ?? '18', '-maxrate', args.maxrate ?? '16M', '-bufsize', args.bufsize ?? '32M');
  }
  const a = AUDIO ? ['-map', '1:a', '-c:a', 'aac', '-b:a', args.abitrate ?? '320k', '-ar', '48000'] : [];
  await run(['-y', '-loglevel', 'error', ...input, ...audioIn, '-map', '0:v', ...a, ...v, '-movflags', '+faststart', OUT]);
  console.log(`done: ${path.relative(ROOT, OUT)} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
