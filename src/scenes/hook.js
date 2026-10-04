// 0–14s. "An AI agent finished the job." -> "But who decides if the job was actually done well?"
import { THREE, makeBurst, makeShock } from '../engine/gl.js';
import { el, makeText, animChars, typed, setStyle } from '../engine/text.js';
import { clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

const CHECK = '<svg viewBox="0 0 48 48" class="stroke"><circle cx="24" cy="24" r="21" stroke="currentColor" stroke-width="3.5" opacity=".35"/><path d="M14 25 l7 7 l14 -16" stroke="currentColor" stroke-width="5"/></svg>';
const QMARK = '<svg viewBox="0 0 48 48" class="stroke"><circle cx="24" cy="24" r="21" stroke="currentColor" stroke-width="3.5" opacity=".5" stroke-dasharray="6 5"/><path d="M17.5 18.5 a6.5 6.5 0 1 1 9.5 5.8 c-2 1.1 -3 2.4 -3 4.7" stroke="currentColor" stroke-width="4.5"/><circle cx="24" cy="35.5" r="2.6" fill="currentColor" stroke="none"/></svg>';

export default function hook(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = [T.scenes.hook[0], T.scenes.decides[1]];
  const root = el('div', 'scene', ui);

  // --- 3D: burst + shockwave on "task complete"
  const group = new THREE.Group();
  world.add(group);
  const burst = makeBurst({ count: 420, seed: 11, colors: ['#9dffc6', '#8fdcff', '#ffffff', '#9dffc6'], speed: [3, 14], size: [3, 14], life: 1.8, gravity: -0.8 });
  const shock = makeShock({ color: '#9dffc6', radius: 5.5, life: 1.0, width: 0.035 });
  const shock2 = makeShock({ color: '#8fdcff', radius: 8, life: 1.3, width: 0.02 });
  const fxAnchor = new THREE.Group();
  fxAnchor.add(burst, shock, shock2);
  group.add(fxAnchor);

  // --- DOM
  const persp = el('div', 'abs persp', root);
  setStyle(persp, { inset: '0' });
  const cardWrap = el('div', 'abs', persp);
  setStyle(cardWrap, { left: '510px', top: '290px', width: '900px', height: '470px', transformStyle: 'preserve-3d' });
  const card = el('div', 'glass term', cardWrap);
  card.innerHTML = `
    <div class="term-bar"><i></i><i></i><i></i><span class="term-title">agent://atlas-07</span><span class="badge">● AUTONOMOUS</span></div>
    <div class="term-body"></div>
    <div class="term-progress"><span>PROGRESS</span><div class="bar"><div class="fill"></div></div><span class="pct">0%</span></div>
    <div class="scan abs" style="left:0;right:0;height:3px;top:0;background:linear-gradient(90deg,transparent,#ff87ff,transparent);box-shadow:0 0 22px #ff87ff;opacity:0"></div>`;
  const body = card.querySelector('.term-body');
  const fill = card.querySelector('.fill');
  const pct = card.querySelector('.pct');
  const scan = card.querySelector('.scan');
  const lines = [
    { t: 1.2, s: '$ agent.run(task_4821)', cls: '' },
    { t: 1.6, s: '▸ objective   research market → draft report', k: 11 },
    { t: 2.1, s: '▸ sources     214 collected', k: 11 },
    { t: 2.45, s: '▸ reasoning   1,882 steps', k: 11 },
    { t: 2.8, s: '▸ output      report.md · 2,431 words', k: 11 },
  ];
  const lineEls = lines.map(() => el('div', '', body));
  const stamp = el('div', 'stamp ok', cardWrap);
  stamp.innerHTML = `<span class="ic">${CHECK}</span><span class="lbl">TASK COMPLETE</span>`;
  setStyle(stamp, { left: '262px', top: '388px' });
  const stampIc = stamp.querySelector('.ic');
  const stampLbl = stamp.querySelector('.lbl');

  const head1 = makeText(root, 'An AI agent|<y>finished the job.</y>', 'h1 glow-w');
  setStyle(head1.root, { left: '120px', top: '372px', width: '1000px' });

  const q1 = makeText(root, 'But who decides', 'h2');
  setStyle(q1.root, { left: '0', right: '0', top: '250px', textAlign: 'center' });
  const q2 = makeText(root, 'if the job was actually', 'h2');
  setStyle(q2.root, { left: '0', right: '0', top: '348px', textAlign: 'center' });
  const q3 = makeText(root, '<x>done well?</x>', 'h0 glow-p');
  setStyle(q3.root, { left: '0', right: '0', top: '470px', textAlign: 'center' });

  const lidT = el('div', 'lid', root);
  const lidB = el('div', 'lid', root);
  const hair = el('div', 'hair', root);
  setStyle(lidT, { top: '0' });
  setStyle(lidB, { top: '540px' });

  function renderLine(i, t) {
    const L = lines[i];
    const vis = typed(L.s, t, L.t, 72);
    if (!vis) return '';
    const done = vis.length === L.s.length;
    let html;
    if (i === 0) html = `<span class="g">$</span> <span class="k">${vis.slice(2)}</span>`;
    else {
      const a = vis.slice(0, 1);
      const b = vis.slice(1, L.k + 1);
      const c = vis.slice(L.k + 1);
      html = `<span class="p">${a}</span><span class="d">${b}</span>${c}`;
    }
    const active = !done || (i === lines.length - 1 && t < 3.6);
    const blink = Math.floor(t * 3.2) % 2 === 0;
    return html + (active && (blink || !done) ? '<span class="cursor"></span>' : '');
  }

  function update(t) {
    // ---------- 3D camera & atmosphere
    const push = prog(t, 0, 14, ease.inOutSine);
    camera.position.set(noise1(t * 0.25, 1) * 0.25, 0.35 + noise1(t * 0.2, 2) * 0.15, lerp(13, 8.6, push));
    camera.lookAt(0, 0.1, 0);
    camera.fov = 35;
    camera.updateProjectionMatrix();
    ctx.bgp.floor = 0.55 * prog(t, 0.6, 2.5);
    ctx.bgp.floorY = -2.6;
    ctx.bgp.nebula = prog(t, 0.4, 2.2);
    ctx.bgp.dust = prog(t, 0.4, 1.8);

    // ---------- aperture open
    const hs = 0.18 + 0.82 * prog(t, 0.0, 0.55, ease.outExpo);
    const lid = prog(t, 0.45, 1.25, ease.inOutCubic);
    setStyle(hair, { transform: `scaleX(${hs.toFixed(4)}) scaleY(${(1 + lid * 6).toFixed(2)})`, opacity: (1 - prog(t, 0.85, 1.35)).toFixed(3), display: t < 1.4 ? '' : 'none' });
    setStyle(lidT, { transform: `translateY(${(-lid * 560).toFixed(1)}px)`, display: t < 1.3 ? '' : 'none' });
    setStyle(lidB, { transform: `translateY(${(lid * 560).toFixed(1)}px)`, display: t < 1.3 ? '' : 'none' });

    // ---------- terminal card
    const cin = prog(t, 0.85, 1.7, ease.outCubic);
    const toSide = prog(t, 4.0, 5.1, ease.inOutCubic);
    const toBack = prog(t, 7.7, 8.7, ease.inOutCubic);
    const fly = prog(t, 13.25, 13.95, ease.inCubic);
    let tx = lerp(0, 395, toSide);
    let ty = lerp(40, 0, cin) + noise1(t * 0.6, 5) * 6;
    let tz = lerp(-420, 0, cin);
    let ry = lerp(-14, -4, prog(t, 0.8, 4)) + lerp(0, -12, toSide);
    let rx = lerp(20, 6, cin);
    let sc = lerp(1, 0.86, toSide);
    // S2: card sinks back and blurs behind the question
    tx = lerp(tx, 0, toBack);
    ty = lerp(ty, 110, toBack);
    tz = lerp(tz, -700, toBack);
    ry = lerp(ry, 0, toBack) + Math.sin(t * 0.5) * 2 * toBack;
    rx = lerp(rx, 12, toBack);
    tz = lerp(tz, 900, fly);
    const blur = toBack * 7 * (1 - fly);
    setStyle(cardWrap, {
      transform: `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,${tz.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(3)})`,
      opacity: (cin * lerp(1, 0.55, toBack) * (1 - fly)).toFixed(3),
      filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : '',
    });
    lineEls.forEach((e, i) => {
      const h = renderLine(i, t);
      if (e._h !== h) e.innerHTML = e._h = h;
    });
    const p = prog(t, 1.35, 3.55, ease.inOutCubic);
    const pv = Math.min(100, Math.round(p * 100 + (p < 1 ? noise1(t * 9, 3) * 3 : 0)));
    fill.style.width = `${Math.max(0, pv)}%`;
    const pt = `${Math.max(0, pv)}%`;
    if (pct._t !== pt) pct.textContent = pct._t = pt;

    // stamp: pops at 3.6, glitches into "?" at ~8.5
    const sp = clamp((t - 3.6) / 0.5);
    const ss = t < 3.6 ? 0 : ease.outBack(sp, 2.2);
    const qMode = t > 8.55;
    const glitchWin = t > 8.25 && t < 8.85;
    const flick = glitchWin && Math.floor(t * 30) % 3 !== 0;
    const isQ = qMode || flick;
    const wantCls = isQ ? 'stamp q' : 'stamp ok';
    if (stamp.className !== wantCls) stamp.className = wantCls;
    const lbl = isQ ? 'VERIFIED BY: ???' : 'TASK COMPLETE';
    if (stampLbl.textContent !== lbl) {
      stampLbl.textContent = lbl;
      stampIc.innerHTML = isQ ? QMARK : CHECK;
    }
    const gx = glitchWin ? (noise1(t * 60, 9) * 26) : 0;
    setStyle(stamp, {
      opacity: (t < 3.6 ? 0 : clamp(sp * 3)).toFixed(3),
      transform: `translate3d(${gx.toFixed(1)}px,0,60px) scale(${(lerp(1.6, 1, ss)).toFixed(3)}) rotate(${lerp(-8, -3, ss).toFixed(2)}deg)`,
    });
    const sweep = prog(t, 9.0, 10.4, ease.inOutSine);
    setStyle(scan, { top: `${(sweep * 470).toFixed(0)}px`, opacity: (env(t, 8.9, 10.6, 0.2, 0.3) * 1).toFixed(3) });

    // ---------- headline 1
    animChars(head1, t, 4.35, { stagger: 0.03, dur: 0.75, style: 'rise', dist: 80, tout: 7.55, outStyle: 'blur', outStagger: 0.012 });
    setStyle(head1.root, { display: t > 4.2 && t < 8.3 ? '' : 'none' });

    // ---------- question
    const qOn = t > 8.0 && t < 14;
    for (const q of [q1, q2, q3]) q.root.style.display = qOn ? '' : 'none';
    if (qOn) {
      animChars(q1, t, 8.15, { stagger: 0.028, dur: 0.6, style: 'rise', dist: 50, tout: 13.25, outStyle: 'blur' });
      animChars(q2, t, 8.75, { stagger: 0.022, dur: 0.6, style: 'rise', dist: 50, tout: 13.3, outStyle: 'blur' });
      animChars(q3, t, 9.55, { stagger: 0.05, dur: 0.9, style: 'blur', tout: 13.35, outStyle: 'blur', order: 'center' });
      const breathe = 1 + Math.sin((t - 9.5) * 2.2) * 0.012 * prog(t, 10, 11);
      q3.root.style.transform = `scale(${breathe.toFixed(4)})`;
    }

    // ---------- 3D fx anchored behind the stamp
    fxAnchor.position.set(0.25, -1.05, 0);
    burst.update(t - 3.6);
    shock.update(t - 3.6);
    shock2.update(t - 3.68);
    shock.rotation.x = shock2.rotation.x = -0.25;

    // ---------- global fx
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, 0.12 * (1 - prog(t, 3.6, 3.9)) * (t >= 3.6 ? 1 : 0));
    ctx.fx.uiFlashColor = '#d9ffe9';
    ctx.fx.chroma = 0.0012 + 0.0025 * env(t, 3.58, 4.2, 0.02, 0.5) + 0.004 * env(t, 8.25, 8.9, 0.05, 0.2);
    ctx.fx.glitch = 0.35 * env(t, 8.25, 8.85, 0.02, 0.1);
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, prog(t, 13.6, 14.0, ease.inQuad) * 0.9);
    ctx.fx.uiFlashColor = t > 13 ? '#ffd6ff' : '#d9ffe9';
  }

  return { start, end, root, group, update, layout: () => [head1, q1, q2, q3].forEach((x) => x.layoutGradients()) };
}
