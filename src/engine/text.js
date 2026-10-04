// Kinetic typography helpers. Text is real DOM (crisp at 1080p) and every
// character is an inline-block span so it can be animated individually.
import { clamp, ease, lerp } from './util.js';

const GRADIENTS = {
  x: ['#ff87ff', '#dc00ff'], // pink -> purple (brand)
  y: ['#8fdcff', '#9dffc6'], // blue -> green
  z: ['#dc00ff', '#8fdcff'], // purple -> blue
  q: ['#ff87ff', '#8fdcff'], // pink -> blue
};

export function el(tag, cls = '', parent = null, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}

// Markup: plain text with <g>, <b>, <p>, <v>, <w> (colour) and <x>, <y>, <z>, <q>
// (gradient) tags. Tags do not nest. "|" forces a line break.
function parse(markup) {
  const segs = [];
  const re = /<(\w)>(.*?)<\/\1>|([^<]+)/g;
  let m;
  while ((m = re.exec(markup))) {
    if (m[3] !== undefined) segs.push({ text: m[3], tag: null });
    else segs.push({ text: m[2], tag: m[1] });
  }
  return segs;
}

export function makeText(parent, markup, cls = '', opts = {}) {
  const root = el('div', `txt ${cls}`, parent);
  const chars = [];
  const words = [];
  const segChars = [];
  for (const seg of parse(markup)) {
    const parts = seg.text.split(/(\s+|\|)/);
    const list = [];
    for (const part of parts) {
      if (part === '') continue;
      if (part === '|') {
        el('br', '', root);
        continue;
      }
      if (/^\s+$/.test(part)) {
        root.appendChild(document.createTextNode(' '));
        continue;
      }
      const w = el('span', `w${seg.tag ? ' t-' + seg.tag : ''}`, root);
      words.push(w);
      if (opts.words) {
        w.textContent = part;
        w._i = chars.length;
        chars.push(w);
        list.push(w);
      } else {
        for (const ch of part) {
          const c = el('span', 'ch', w);
          c.textContent = ch;
          c._i = chars.length;
          chars.push(c);
          list.push(c);
        }
      }
    }
    if (seg.tag && GRADIENTS[seg.tag]) segChars.push({ list, g: GRADIENTS[seg.tag] });
  }
  const t = { root, chars, words, segChars };
  // Layout-dependent gradient mapping is done once fonts are ready.
  t.layoutGradients = () => applyGradients(t);
  return t;
}

function applyGradients(t) {
  for (const { list, g } of t.segChars) {
    // Group by visual line so a wrapped phrase still gets a full gradient per line.
    const rows = new Map();
    for (const c of list) {
      const r = c.getBoundingClientRect();
      const key = Math.round(r.top / 10);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ c, r });
    }
    for (const row of rows.values()) {
      const x0 = Math.min(...row.map((o) => o.r.left));
      const x1 = Math.max(...row.map((o) => o.r.right));
      const w = Math.max(1, x1 - x0);
      for (const { c, r } of row) {
        c.style.backgroundImage = `linear-gradient(90deg, ${g[0]}, ${g[1]})`;
        c.style.backgroundSize = `${w}px 100%`;
        c.style.backgroundPosition = `${-(r.left - x0)}px 0`;
        c.classList.add('grad');
      }
    }
  }
}

// Animate characters in (and optionally out). All parameters in seconds.
// style: 'rise' | 'drop' | 'blur' | 'scale' | 'flip' | 'type'
export function animChars(txt, t, tin, opts = {}) {
  const {
    stagger = 0.022,
    dur = 0.7,
    style = 'rise',
    dist = 60,
    tout = Infinity,
    outDur = 0.45,
    outStagger = 0.008,
    outStyle = 'up',
    easing = ease.outQuart,
    order = 'ltr',
  } = opts;
  const n = txt.chars.length;
  for (let i = 0; i < n; i++) {
    const c = txt.chars[i];
    let idx = i;
    if (order === 'center') idx = Math.abs(i - (n - 1) / 2) * 2;
    if (order === 'rtl') idx = n - 1 - i;
    if (order === 'random') idx = (Math.sin(i * 91.7) * 0.5 + 0.5) * n;
    const pi = easing(clamp((t - tin - idx * stagger) / dur));
    const po = ease.inCubic(clamp((t - tout - i * outStagger) / outDur));
    let tx = 0, ty = 0, sc = 1, rx = 0, op = 1, bl = 0;
    if (style === 'rise') { ty = (1 - pi) * dist; op = clamp(pi * 1.6); rx = (1 - pi) * -70; }
    else if (style === 'drop') { ty = -(1 - pi) * dist; op = clamp(pi * 1.6); }
    else if (style === 'blur') { op = pi; bl = (1 - pi) * 18; sc = lerp(1.25, 1, pi); }
    else if (style === 'scale') { sc = lerp(0.2, 1, ease.outBack(clamp((t - tin - idx * stagger) / dur))); op = clamp(pi * 2); }
    else if (style === 'flip') { rx = (1 - pi) * 95; op = clamp(pi * 2); ty = (1 - pi) * dist * 0.4; }
    else if (style === 'type') { op = t >= tin + idx * stagger ? 1 : 0; }
    else if (style === 'slide') { tx = (1 - pi) * dist; op = clamp(pi * 1.4); }
    if (po > 0) {
      if (outStyle === 'up') { ty -= po * dist * 0.8; op *= 1 - po; }
      else if (outStyle === 'fade') { op *= 1 - po; }
      else if (outStyle === 'blur') { op *= 1 - po; bl += po * 14; sc *= 1 + po * 0.15; }
      else if (outStyle === 'down') { ty += po * dist; op *= 1 - po; }
    }
    c.style.opacity = op.toFixed(3);
    c.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) rotateX(${rx.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
    c.style.filter = bl > 0.2 ? `blur(${bl.toFixed(1)}px)` : '';
  }
}

// Typewriter: reveals n characters of a fixed string; returns the visible substring.
export function typed(str, t, t0, cps = 40) {
  const n = Math.max(0, Math.floor((t - t0) * cps));
  return str.slice(0, Math.min(n, str.length));
}

export function setStyle(e, s) {
  for (const k in s) e.style[k] = s[k];
}

export function show(e, on, disp = 'block') {
  const v = on ? disp : 'none';
  if (e.style.display !== v) e.style.display = v;
}

// RGB-split glitch: a white text plus pink/blue copies that jitter and slice.
// Returns { root, base, update(t, amount) } where base is the animatable text.
export function makeGlitchText(parent, markup, cls = '', colors = ['#ff87ff', '#8fdcff']) {
  const root = el('div', 'abs', parent);
  const a = makeText(root, markup, cls);
  const b = makeText(root, markup.replace(/<\/?\w>/g, ''), cls);
  const c = makeText(root, markup.replace(/<\/?\w>/g, ''), cls);
  for (const [x, col] of [[b, colors[0]], [c, colors[1]]]) {
    setStyle(x.root, { left: '0', top: '0', color: col, mixBlendMode: 'screen', opacity: '0' });
  }
  setStyle(a.root, { position: 'relative' });
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  function update(t, amount) {
    const f = Math.floor(t * 24);
    const on = amount > 0.01;
    for (const [x, k] of [[b, 1], [c, -1]]) {
      if (!on) {
        x.root.style.opacity = '0';
        continue;
      }
      const dx = k * (4 + hash(f + k * 3) * 22) * amount;
      const dy = (hash(f * 1.7 + k) - 0.5) * 8 * amount;
      const top = hash(f * 3.1 + k) * 80;
      const h = 8 + hash(f * 5.3 + k) * 40;
      x.root.style.opacity = (0.85 * Math.min(1, amount * 2)).toFixed(2);
      x.root.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      x.root.style.clipPath = hash(f + 9 * k) < 0.5 ? `inset(${top.toFixed(0)}% 0 ${Math.max(0, 100 - top - h).toFixed(0)}% 0)` : 'none';
    }
    const jx = on && hash(f * 0.37) < amount * 0.6 ? (hash(f) - 0.5) * 30 * amount : 0;
    a.root.style.transform = `translateX(${jx.toFixed(1)}px)`;
  }
  return { root, base: a, copies: [b, c], update, all: [a, b, c] };
}
