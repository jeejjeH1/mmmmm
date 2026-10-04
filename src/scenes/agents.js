// 20–32s. "Imagine thousands of AI agents working autonomously:" + the four roles.
import { THREE, worldToScreen } from '../engine/gl.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { ICONS } from '../engine/icons.js';
import { buildNetwork } from './network.js';
import { C, clamp, ease, env, lerp, prog, noise1, rgba } from '../engine/util.js';

const ROLES = [
  { who: '→ one', what: 'researches a market', icon: 'search', color: C.blue, x: 80, y: 120, side: 'r', target: [760, 420], id: '#4F1A' },
  { who: '→ another', what: 'writes a report', icon: 'doc', color: '#c58cff', x: 1260, y: 150, side: 'l', target: [1180, 430], id: '#9C07' },
  { who: '→ another', what: 'verifies the data', icon: 'shield', color: C.green, x: 100, y: 790, side: 'r', target: [780, 700], id: '#2B55' },
  { who: '→ another', what: 'executes the task', icon: 'bolt', color: C.pink, x: 1240, y: 770, side: 'l', target: [1150, 660], id: '#E310' },
];
const TAGS = [
  ['agent_3fa9', 'researching', C.blue], ['agent_77c0', 'writing', '#c58cff'], ['agent_a41e', 'trading', C.pink], ['agent_0d2b', 'verifying', C.green],
  ['agent_5e8f', 'executing', C.pink], ['agent_c19a', 'summarizing', C.blue], ['agent_81d4', 'negotiating', C.purple],
];

export default function agents(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.agents;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);
  const net = buildNetwork({ seed: 21 });
  group.add(net.group);

  function camAt(t) {
    const k = prog(t, start, start + 4.2, ease.outCubic);
    const R = lerp(2.2, 30, k) + lerp(0, -4, prog(t, start + 4.2, end, ease.inOutSine));
    const th = 0.3 + 0.25 * k + 0.45 * prog(t, start + 4, end, ease.inOutSine);
    const elv = lerp(0.08, 0.32, k);
    camera.position.set(Math.sin(th) * Math.cos(elv) * R, Math.sin(elv) * R, Math.cos(th) * Math.cos(elv) * R);
    camera.lookAt(0, 0, 0);
    camera.fov = 38;
    camera.updateProjectionMatrix();
  }

  // Pick the node that sits closest to each card's target point mid-sequence.
  camAt(start + 7.5);
  const picked = ROLES.map((R) => {
    let best = 0, bd = 1e9;
    net.nodes.forEach((n, i) => {
      const p = worldToScreen(camera, n);
      if (p.z > 1) return;
      const d = (p.x - R.target[0]) ** 2 + (p.y - R.target[1]) ** 2;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  });
  // Tags sit on nodes that stay clear of the headline band while it is up.
  camAt(start + 2.2);
  const tagNodes = [];
  const want = [[330, 210], [1520, 250], [260, 760], [1600, 790], [880, 860], [1180, 180], [620, 280]];
  want.forEach(([x, y]) => {
    let best = 0, bd = 1e9;
    net.nodes.forEach((n, i) => {
      const p = worldToScreen(camera, n);
      if (p.z > 1) return;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd && !tagNodes.includes(i)) { bd = d; best = i; }
    });
    tagNodes.push(best);
  });

  // DOM
  const shade = el('div', 'vignette-center', root);
  const t1 = makeText(root, 'Imagine <y>thousands</y> of AI agents', 'h1 glow-w');
  setStyle(t1.root, { left: '0', right: '0', top: '398px', textAlign: 'center' });
  const t2 = makeText(root, 'working autonomously', 'h3 t-d');
  setStyle(t2.root, { left: '0', right: '0', top: '540px', textAlign: 'center', letterSpacing: '0.01em' });

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '1920');
  svg.setAttribute('height', '1080');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  root.appendChild(svg);

  const tags = TAGS.map(([id, st, c]) => {
    const e = el('div', 'tag', root);
    e.innerHTML = `<span class="dot" style="background:${c};box-shadow:0 0 10px ${c}"></span>${id}<span style="color:${c}">· ${st}</span>`;
    return e;
  });

  const cards = ROLES.map((R, i) => {
    const wrap = el('div', 'abs', root);
    setStyle(wrap, { left: `${R.x}px`, top: `${R.y}px` });
    const card = el('div', 'glass role', wrap);
    card.style.background = `linear-gradient(160deg, rgba(24,14,44,0.86), rgba(8,4,18,0.9)) padding-box, linear-gradient(135deg, ${R.color}, ${rgba(R.color, 0.15)} 55%, ${rgba(R.color, 0.6)}) border-box`;
    card.style.boxShadow = `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${rgba(R.color, 0.2)}, inset 0 1px 0 rgba(255,255,255,0.1)`;
    card.innerHTML = `<div class="ico" style="color:${R.color};background:${rgba(R.color, 0.12)};box-shadow:inset 0 0 0 1.5px ${rgba(R.color, 0.5)}, 0 0 30px ${rgba(R.color, 0.25)}">${ICONS[R.icon]}</div>
      <div><div class="meta" style="color:${R.color};white-space:nowrap">${R.who} <span style="color:rgba(246,241,255,0.4)">· ${R.id}</span></div><div class="main">${R.what}</div></div>`;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('stroke', R.color);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '6 6');
    line.style.filter = `drop-shadow(0 0 6px ${R.color})`;
    svg.appendChild(line);
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('r', '7');
    dot.setAttribute('fill', R.color);
    dot.style.filter = `drop-shadow(0 0 10px ${R.color})`;
    svg.appendChild(dot);
    const ring = el('div', 'ring', root);
    ring.style.color = R.color;
    return { wrap, card, line, dot, ring, R, node: picked[i], t0: start + 4.25 + i * 1.25 };
  });

  function update(t) {
    const lt = t - start;
    camAt(t);
    ctx.bgp.floor = 0;
    ctx.bgp.nebula = 1;
    ctx.bgp.dust = 0.6;
    ctx.fx.bloom = 0.7;
    ctx.fx.bloomThreshold = 0.2;

    const glitch = env(t, 31.0, 32.0, 0.6, 0.05);
    net.update(t, { opacity: 1, reveal: lerp(0.35, 1.05, prog(t, start, start + 2.5, ease.outCubic)), glitch, pulse: 1 });
    ctx.fx.glitch = Math.max(ctx.fx.glitch, glitch * 0.5 + (t > 31.7 ? 0.6 : 0));
    ctx.fx.chroma = Math.max(ctx.fx.chroma, glitch * 0.003);
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, 0.9 * (1 - prog(t, start, start + 0.5, ease.outCubic)));
    ctx.fx.uiFlashColor = '#e8f6ff';
    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, prog(t, 31.82, 32.0));

    // Headline
    setStyle(shade, { opacity: (env(t, start, start + 4.4, 0.6, 0.6)).toFixed(3) });
    animChars(t1, t, start + 0.45, { stagger: 0.03, dur: 0.75, style: 'rise', dist: 70, tout: start + 3.7, outStyle: 'blur', outStagger: 0.01 });
    animChars(t2, t, start + 1.35, { stagger: 0.025, dur: 0.6, style: 'blur', tout: start + 3.75, outStyle: 'blur' });
    t1.root.style.display = t2.root.style.display = lt < 4.5 ? '' : 'none';

    // Floating agent tags
    tags.forEach((e, i) => {
      const a = env(t, start + 1.0 + i * 0.22, start + 3.9 + i * 0.04, 0.3, 0.3);
      if (a <= 0) return (e.style.display = 'none');
      const p = worldToScreen(camera, net.nodes[tagNodes[i]]);
      const off = i % 2 ? -1 : 1;
      setStyle(e, { display: 'flex', opacity: a.toFixed(3), transform: `translate(${(p.x + 14 * off - (off < 0 ? 210 : 0)).toFixed(1)}px, ${(p.y - 14).toFixed(1)}px) scale(${lerp(0.85, 1, a).toFixed(3)})` });
    });

    // Role cards + leader lines to their node
    cards.forEach((c, i) => {
      const k = clamp((t - c.t0) / 0.7);
      const e = ease.outBack(k, 1.4);
      const out = prog(t, 30.9 + i * 0.05, 31.4 + i * 0.05, ease.inCubic);
      const a = clamp(k * 2) * (1 - out);
      const show = a > 0.001;
      c.wrap.style.display = show ? '' : 'none';
      c.line.style.display = c.dot.style.display = show ? '' : 'none';
      c.ring.style.display = show ? '' : 'none';
      if (!show) return;
      const dx = (c.R.side === 'r' ? -1 : 1) * (1 - e) * 120;
      setStyle(c.wrap, { opacity: a.toFixed(3), transform: `translate(${dx.toFixed(1)}px, ${(noise1(t * 0.5, i) * 6).toFixed(1)}px) scale(${lerp(0.9, 1, e).toFixed(3)})` });
      const p = worldToScreen(camera, net.nodes[c.node]);
      const ax = c.R.side === 'r' ? c.left + c.w : c.left;
      const ay = c.R.y + 78;
      const lk = prog(t, c.t0 + 0.15, c.t0 + 0.6, ease.outCubic);
      const ex = lerp(ax, p.x, lk);
      const ey = lerp(ay, p.y, lk);
      c.line.setAttribute('x1', ax.toFixed(1));
      c.line.setAttribute('y1', ay.toFixed(1));
      c.line.setAttribute('x2', ex.toFixed(1));
      c.line.setAttribute('y2', ey.toFixed(1));
      c.line.setAttribute('stroke-dashoffset', (-t * 40).toFixed(1));
      c.line.setAttribute('opacity', a.toFixed(3));
      c.dot.setAttribute('cx', ex.toFixed(1));
      c.dot.setAttribute('cy', ey.toFixed(1));
      c.dot.setAttribute('opacity', (a * lk).toFixed(3));
      const rp = ((t - c.t0 - 0.5) % 1.4) / 1.4;
      setStyle(c.ring, { transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${(0.3 + rp * 1.4).toFixed(3)})`, opacity: (lk * a * (1 - rp)).toFixed(3) });
    });
  }

  // Cards size to their text; right-column cards keep their right edge.
  function layout() {
    [t1, t2].forEach((x) => x.layoutGradients());
    cards.forEach((c) => {
      c.w = c.card.offsetWidth;
      c.left = c.R.side === 'r' ? c.R.x : c.R.x + 580 - c.w;
      c.wrap.style.left = `${c.left}px`;
    });
  }

  return { start, end, root, group, update, layout };
}
