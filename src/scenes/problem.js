// 32–42s. "The problem? An agent can return a confident answer that is simply wrong."
import { THREE, makeBurst } from '../engine/gl.js';
import { el, makeText, makeGlitchText, animChars, setStyle } from '../engine/text.js';
import { ICONS } from '../engine/icons.js';
import { clamp, ease, env, lerp, prog, noise1, mixHex } from '../engine/util.js';

export default function problem(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.problem;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);
  const sparks = makeBurst({ count: 260, seed: 41, colors: ['#ff87ff', '#dc00ff', '#ffffff'], speed: [3, 12], size: [3, 10], life: 1.3, gravity: -1.2 });
  sparks.position.set(1.75, 1.35, 0);
  group.add(sparks);

  const glow = el('div', 'abs', root);
  setStyle(glow, { inset: '0', background: 'radial-gradient(ellipse 45% 40% at 50% 46%, rgba(255,135,255,0.16), rgba(220,0,255,0.05) 50%, rgba(0,0,0,0) 75%)' });

  const title = makeGlitchText(root, 'The problem?', 'h0');
  setStyle(title.root, { left: '0', right: '0', top: '440px', textAlign: 'center' });
  title.all.forEach((x) => setStyle(x.root, { width: '100%', textAlign: 'center' }));

  // Answer card
  const cw = el('div', 'abs', root);
  setStyle(cw, { left: '400px', top: '232px' });
  const card = el('div', 'glass answer', cw);
  card.innerHTML = `
    <div class="tint" style="opacity:0"></div>
    <div class="row"><span class="chip">agent://atlas-07</span><span>OUTPUT</span><span style="margin-left:auto">TASK #4821</span></div>
    <div class="quote">“The market will hit <span class="num">$48.2B<span class="strike"></span><span class="fix">actual: $4.82B</span></span> by 2026.”</div>
    <div class="conf"><span>CONFIDENCE</span><div class="bar"><div class="fill"></div></div><span class="pct">0.0%</span></div>
    <div class="scanl" style="top:-10px"></div>`;
  const tint = card.querySelector('.tint');
  const strike = card.querySelector('.strike');
  const fix = card.querySelector('.fix');
  const fill = card.querySelector('.fill');
  const pct = card.querySelector('.pct');
  const scanl = card.querySelector('.scanl');
  const num = card.querySelector('.num');

  const stamp = el('div', 'stamp bad', cw);
  stamp.innerHTML = `<span style="width:46px;height:46px;display:inline-block">${ICONS.cross}</span><span>WRONG</span>`;
  setStyle(stamp, { left: '760px', top: '-34px', fontSize: '50px' });

  const l1 = makeText(root, 'An agent can return a <g>confident</g> answer', 'h2');
  setStyle(l1.root, { left: '0', right: '0', top: '668px', textAlign: 'center' });
  const l2 = makeGlitchText(root, 'that is <x>simply wrong.</x>', 'h1 glow-p');
  setStyle(l2.root, { left: '0', right: '0', top: '775px', textAlign: 'center' });
  l2.all.forEach((x) => setStyle(x.root, { width: '100%', textAlign: 'center' }));

  function update(t) {
    const lt = t - start;
    camera.position.set(noise1(t * 0.3, 7) * 0.3, noise1(t * 0.25, 8) * 0.2, 10);
    camera.lookAt(0, 0, 0);
    ctx.bgp.floor = 0;
    ctx.bgp.nebula = lerp(0.25, 0.55, prog(t, start, start + 4));
    ctx.bgp.dust = 0.45;

    // Title: glitch in, then shrink up into a label.
    const up = prog(t, start + 1.55, start + 2.15, ease.inOutCubic);
    animChars(title.base, t, start + 0.12, { stagger: 0.035, dur: 0.01, style: 'type' });
    title.copies.forEach((x) => animChars(x, t, start + 0.12, { stagger: 0.035, dur: 0.01, style: 'type' }));
    const gAmt = env(t, start + 0.1, start + 1.0, 0.05, 0.5) + 0.5 * env(t, start + 1.45, start + 1.7, 0.02, 0.1) + 0.6 * env(t, 41.2, 42, 0.1, 0.05);
    title.update(t, gAmt);
    setStyle(title.root, { transform: `translateY(${lerp(0, -362, up).toFixed(1)}px) scale(${lerp(1, 0.4, up).toFixed(3)})`, opacity: (1 - prog(t, 41.5, 41.95)).toFixed(3) });

    // Card
    const cin = prog(t, start + 1.85, start + 2.55, ease.outCubic);
    const cout = prog(t, 41.35, 41.9, ease.inCubic);
    setStyle(cw, { opacity: (cin * (1 - cout)).toFixed(3), transform: `translateY(${lerp(80, 0, cin).toFixed(1)}px) scale(${lerp(0.94, 1, cin).toFixed(3)})`, display: cin > 0 ? '' : 'none' });
    const conf = prog(t, start + 2.4, start + 3.4, ease.outCubic) * 99.2;
    const verdict = t > start + 4.05;
    fill.style.width = `${conf.toFixed(1)}%`;
    fill.style.background = verdict ? 'linear-gradient(90deg, #dc00ff, #ff87ff)' : 'linear-gradient(90deg, #8fdcff, #9dffc6)';
    fill.style.boxShadow = verdict ? '0 0 18px #ff87ff' : '0 0 18px #9dffc6';
    const ps = `${conf.toFixed(1)}%`;
    if (pct._t !== ps) pct.textContent = pct._t = ps;
    pct.style.color = verdict ? '#ff87ff' : '#f6f1ff';
    // Verification scan reveals the error.
    const sc = prog(t, start + 3.55, start + 4.15, ease.inOutSine);
    setStyle(scanl, { top: `${lerp(-10, 340, sc).toFixed(1)}px`, opacity: env(t, start + 3.5, start + 4.25, 0.05, 0.15).toFixed(3) });
    tint.style.opacity = (prog(t, start + 3.6, start + 4.2) * 0.9).toFixed(3);
    strike.style.transform = `scaleX(${prog(t, start + 4.05, start + 4.35, ease.outCubic).toFixed(3)})`;
    setStyle(fix, { opacity: prog(t, start + 4.4, start + 4.8).toFixed(3), transform: `translateY(${lerp(10, 0, prog(t, start + 4.4, start + 4.8, ease.outCubic)).toFixed(1)}px)` });
    num.style.color = verdict ? '#ff87ff' : '';
    const sk = clamp((t - start - 4.1) / 0.45);
    setStyle(stamp, { opacity: (t > start + 4.1 ? clamp(sk * 4) : 0).toFixed(3), transform: `scale(${lerp(2.2, 1, ease.outBack(sk, 2.5)).toFixed(3)}) rotate(${lerp(-18, -7, ease.outCubic(sk)).toFixed(2)}deg)` });
    sparks.update(t - (start + 4.18));

    // Lines
    animChars(l1, t, start + 4.75, { stagger: 0.022, dur: 0.6, style: 'rise', dist: 50, tout: 41.3, outStyle: 'blur' });
    l2.all.forEach((x) => animChars(x, t, start + 5.7, { stagger: 0.03, dur: 0.6, style: 'rise', dist: 50, tout: 41.35, outStyle: 'blur' }));
    const flick = noise1(t * 3, 12) > 0.55 ? 0.6 : 0;
    l2.update(t, t > start + 6.2 ? flick + 0.5 * env(t, start + 5.9, start + 6.6, 0.05, 0.3) : 0);

    // Global FX: shake + glitch at the verdict.
    const hit = env(t, start + 4.1, start + 4.7, 0.02, 0.5);
    ctx.fx.glitch = Math.max(ctx.fx.glitch, 0.55 * env(t, start, start + 0.6, 0.02, 0.4), 0.35 * hit, 0.7 * env(t, 41.3, 42.0, 0.2, 0.05));
    ctx.fx.chroma = Math.max(ctx.fx.chroma, 0.004 * hit);
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, 0.25 * (1 - prog(t, start + 4.1, start + 4.4)) * (t > start + 4.1 ? 1 : 0));
    ctx.fx.uiFlashColor = '#ffb0ff';
    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, 1 - prog(t, start, start + 0.25), prog(t, 41.75, 42.0));
    const shake = hit * 10;
    root.style.transform = shake > 0.2 ? `translate(${(noise1(t * 40, 3) * shake).toFixed(1)}px, ${(noise1(t * 40, 4) * shake).toFixed(1)}px)` : '';
  }

  return { start, end, root, group, update, layout: () => [l1, l2.base, title.base].forEach((x) => x.layoutGradients()) };
}
