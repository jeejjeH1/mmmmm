// 66–80s. "So the workflow becomes:
//   AI Agent → does the work ↓ GenLayer → evaluates the result ↓
//   Consensus → determines whether it passes ↓ Protocol → records the outcome"
import { THREE } from '../engine/gl.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { ICONS, logoSVG, LOGO_GRAD } from '../engine/icons.js';
import { C, clamp, ease, env, lerp, prog, noise1, rgba } from '../engine/util.js';

const NS = 'http://www.w3.org/2000/svg';
const Y = 500; // badge centre line
const XS = [262, 732, 1188, 1658];

export default function workflow(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.workflow;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);

  // 3D: a particle stream flowing left -> right behind the pipeline.
  const N = 900;
  const pos = new Float32Array(N * 3);
  const sd = new Float32Array(N);
  let s = 99;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    pos.set([r() * 18 - 9, (r() - 0.5) * 0.9 + 0.55, -r() * 3], i * 3);
    sd[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uO: { value: 0 }, uC0: { value: new THREE.Color(C.blue) }, uC1: { value: new THREE.Color(C.purple) }, uC2: { value: new THREE.Color(C.green) }, uC3: { value: new THREE.Color(C.pink) } },
    vertexShader: /* glsl */ `
      attribute float aS; uniform float uTime; varying float vX; varying float vA;
      void main(){
        vec3 p = position;
        p.x = mod(p.x + 9.0 + uTime * (0.8 + aS * 1.6), 18.0) - 9.0;
        p.y += sin(uTime * 1.3 + aS * 30.0) * 0.08;
        vX = p.x;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.5 + aS * 3.5) * (10.0 / -mv.z);
        vA = smoothstep(9.0, 6.5, abs(p.x)) * (0.4 + 0.6 * aS);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uO; uniform vec3 uC0, uC1, uC2, uC3; varying float vX; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d)*18.0);
        float k = clamp((vX + 6.0) / 12.0, 0.0, 1.0) * 3.0;
        vec3 c = k < 1.0 ? mix(uC0, uC1, k) : (k < 2.0 ? mix(uC1, uC2, k - 1.0) : mix(uC2, uC3, k - 2.0));
        gl_FragColor = vec4(c * 1.8, a * vA * uO);
      }`,
  });
  const stream = new THREE.Points(g, m);
  stream.frustumCulled = false;
  group.add(stream);

  // DOM
  const head = makeText(root, 'So the workflow becomes:', 'h3');
  setStyle(head.root, { left: '0', right: '0', top: '150px', textAlign: 'center' });

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '1920');
  svg.setAttribute('height', '1080');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  root.appendChild(svg);
  const links = [];
  for (let i = 0; i < 3; i++) {
    const x1 = XS[i] + 112, x2 = XS[i + 1] - 112;
    const base = document.createElementNS(NS, 'line');
    base.setAttribute('x1', x1); base.setAttribute('x2', x2); base.setAttribute('y1', Y); base.setAttribute('y2', Y);
    base.setAttribute('stroke', 'rgba(246,241,255,0.14)'); base.setAttribute('stroke-width', '3'); base.setAttribute('stroke-dasharray', '2 10'); base.setAttribute('stroke-linecap', 'round');
    const live = document.createElementNS(NS, 'line');
    live.setAttribute('x1', x1); live.setAttribute('y1', Y); live.setAttribute('y2', Y);
    live.setAttribute('stroke', `url(#wg${i})`); live.setAttribute('stroke-width', '4'); live.setAttribute('stroke-linecap', 'round');
    live.style.filter = 'drop-shadow(0 0 8px rgba(255,255,255,0.5))';
    const head_ = document.createElementNS(NS, 'path');
    head_.setAttribute('d', `M ${x2 - 14} ${Y - 10} L ${x2 + 2} ${Y} L ${x2 - 14} ${Y + 10}`);
    head_.setAttribute('fill', 'none'); head_.setAttribute('stroke-width', '4'); head_.setAttribute('stroke-linecap', 'round'); head_.setAttribute('stroke-linejoin', 'round');
    svg.append(base, live, head_);
    links.push({ x1, x2, live, head: head_ });
  }
  const cols = [C.blue, '#e070ff', C.green, C.pink];
  svg.insertAdjacentHTML('afterbegin', `<defs>${[0, 1, 2].map((i) => `<linearGradient id="wg${i}" gradientUnits="userSpaceOnUse" x1="${links[i].x1}" y1="0" x2="${links[i].x2}" y2="0"><stop offset="0" stop-color="${cols[i]}"/><stop offset="1" stop-color="${cols[i + 1]}"/></linearGradient>`).join('')}</defs>`);
  links.forEach((L, i) => L.head.setAttribute('stroke', cols[i + 1]));

  const STAGES = [
    { t: 'AI Agent', s: 'does the work', icon: ICONS.cpu, c: C.blue },
    { t: 'GenLayer', s: 'evaluates the result', icon: logoSVG('url(#wlg)', LOGO_GRAD('wlg')), c: '#e070ff' },
    { t: 'Consensus', s: 'determines whether it passes', icon: ICONS.users, c: C.green },
    { t: 'Protocol', s: 'records the outcome', icon: ICONS.block, c: C.pink },
  ];
  const stages = STAGES.map((S, i) => {
    const e = el('div', 'stage', root);
    setStyle(e, { left: `${XS[i]}px`, top: `${Y - 88}px` });
    e.innerHTML = `<div class="badge2" style="color:${S.c};background:radial-gradient(circle at 50% 38%, ${rgba(S.c === '#e070ff' ? '#dc00ff' : S.c, 0.3)}, rgba(10,4,20,0.85) 70%);box-shadow:inset 0 0 0 2px ${rgba(S.c, 0.7)}, 0 0 50px ${rgba(S.c, 0.35)}, inset 0 0 40px ${rgba(S.c, 0.25)}">${S.icon}</div><div class="st">${S.t}</div><div class="ss">${S.s}</div>`;
    return { e, badge: e.querySelector('.badge2'), st: e.querySelector('.st'), ss: e.querySelector('.ss'), S };
  });
  // GenLayer evaluation ring
  const evalRing = el('div', 'abs', root);
  setStyle(evalRing, { left: `${XS[1] - 112}px`, top: `${Y - 112}px`, width: '224px', height: '224px', borderRadius: '50%', border: '3px dashed rgba(255,135,255,0.75)', boxShadow: '0 0 24px rgba(255,135,255,0.35)' });
  // Consensus: five validator votes around the badge
  const votes = [0, 1, 2, 3, 4].map((i) => {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const e = el('div', 'vdot', root);
    setStyle(e, { left: `${(XS[2] + Math.cos(a) * 120).toFixed(1)}px`, top: `${(Y + Math.sin(a) * 120).toFixed(1)}px` });
    return { e, ok: i !== 3 };
  });
  const verdict = el('div', 'verdict', root, 'PASS · 4/5');
  setStyle(verdict, { left: `${XS[2]}px`, top: `${Y - 196}px`, color: '#04140c', background: 'linear-gradient(135deg,#c9ffe2,#9dffc6 55%,#6fe9ff)', boxShadow: '0 0 40px rgba(157,255,198,0.6)' });
  // Protocol: blocks
  const blocks = [0, 1, 2].map((i) => {
    const e = el('div', 'blk', root);
    return e;
  });
  const rec = el('div', 'verdict', root, '✓ RECORDED');
  setStyle(rec, { left: `${XS[3]}px`, top: `${Y - 196}px`, color: '#1a0219', background: 'linear-gradient(135deg,#ffd0ff,#ff87ff 55%,#dc00ff)', boxShadow: '0 0 40px rgba(255,135,255,0.6)', fontSize: '30px' });
  const hash = el('div', 'abs mono', root, 'block #19,284,113 · 0x9f3a…c21e');
  setStyle(hash, { left: `${XS[3]}px`, top: `${Y + 338}px`, transform: 'translateX(-50%)', fontSize: '19px', color: 'rgba(246,241,255,0.55)', whiteSpace: 'nowrap', letterSpacing: '0.04em' });

  const packet = el('div', 'packet', root);
  const ptag = el('div', 'ptag', root, 'output.md');

  // Timeline (absolute seconds)
  const S0 = start;
  const tStage = [S0 + 0.45, S0 + 2.05, S0 + 4.35, S0 + 7.1];
  const tMove = [[S0 + 1.2, S0 + 2.05], [S0 + 3.5, S0 + 4.35], [S0 + 6.25, S0 + 7.1]];
  const tVote = [0, 1, 2, 3, 4].map((i) => S0 + 4.75 + i * 0.22);
  const tPass = S0 + 5.95;
  const tBlock = S0 + 7.45;

  function update(t) {
    const lt = t - start;
    camera.position.set(noise1(t * 0.2, 9) * 0.25, 0.1, 10);
    camera.lookAt(0, 0.1, 0);
    ctx.bgp.floor = 0.4;
    ctx.bgp.floorY = -2.4;
    ctx.bgp.nebula = 0.85;
    ctx.bgp.dust = 0.6;
    m.uniforms.uTime.value = t;
    m.uniforms.uO.value = prog(t, S0 + 1, S0 + 3) * (1 - prog(t, end - 0.6, end - 0.2));

    const fadeOut = prog(t, end - 0.6, end - 0.15, ease.inCubic);
    root.style.opacity = (1 - fadeOut).toFixed(3);
    const drift = prog(t, S0 + 7.8, end, ease.inOutSine);
    root.style.transform = `scale(${lerp(1, 1.035, drift).toFixed(4)})`;
    animChars(head, t, S0 + 0.1, { stagger: 0.02, dur: 0.5, style: 'rise', dist: 30 });

    stages.forEach((st, i) => {
      const k = clamp((t - tStage[i]) / 0.55);
      const e = ease.outBack(k, 1.7);
      st.badge.style.transform = `scale(${lerp(0.2, 1, e).toFixed(3)})`;
      st.badge.style.opacity = clamp(k * 3).toFixed(3);
      const k2 = ease.outCubic(clamp((t - tStage[i] - 0.18) / 0.5));
      st.st.style.opacity = k2.toFixed(3);
      st.st.style.transform = `translateY(${lerp(20, 0, k2).toFixed(1)}px)`;
      const k3 = ease.outCubic(clamp((t - tStage[i] - 0.32) / 0.5));
      st.ss.style.opacity = (k3 * 0.95).toFixed(3);
      st.ss.style.transform = `translateY(${lerp(16, 0, k3).toFixed(1)}px)`;
      // Pulse while active
      const act = env(t, tStage[i], (tMove[i] ? tMove[i][0] : end) + 0.3, 0.1, 0.4);
      st.badge.style.filter = `brightness(${(1 + 0.35 * act * (0.5 + 0.5 * Math.sin(t * 9))).toFixed(3)})`;
    });

    // Links draw as the packet travels
    links.forEach((L, i) => {
      const k = prog(t, tMove[i][0], tMove[i][1], ease.inOutCubic);
      L.live.setAttribute('x2', lerp(L.x1, L.x2, k).toFixed(1));
      L.live.style.opacity = k > 0 ? '1' : '0';
      L.head.style.opacity = k > 0.98 ? '1' : '0';
    });
    // Packet: the first run is narrated; afterwards packets loop through the pipeline.
    let px = XS[0], pa = 0, pc = C.blue;
    for (let i = 0; i < 3; i++) {
      const [a, b] = tMove[i];
      if (t >= a - 0.25 && t <= b + 0.15) {
        const k = prog(t, a, b, ease.inOutCubic);
        px = lerp(XS[i] + 60, XS[i + 1] - 60, k);
        pa = env(t, a - 0.25, b + 0.15, 0.2, 0.15);
        pc = cols[i + 1];
      }
    }
    if (t > S0 + 8.6) {
      const loopT = ((t - (S0 + 8.6)) % 2.6) / 2.6;
      px = lerp(XS[0] + 60, XS[3] - 60, ease.inOutSine(loopT));
      pa = Math.sin(loopT * Math.PI) * (1 - fadeOut);
      pc = cols[Math.min(3, Math.floor(loopT * 4))];
    }
    setStyle(packet, { left: `${px.toFixed(1)}px`, top: `${Y}px`, opacity: pa.toFixed(3), color: pc });
    setStyle(ptag, { left: `${px.toFixed(1)}px`, top: `${Y}px`, opacity: (pa * (t < S0 + 8.6 ? 1 : 0)).toFixed(3) });

    // GenLayer evaluating ring
    const ev = env(t, tStage[1] + 0.2, tMove[1][0] + 0.2, 0.3, 0.3);
    setStyle(evalRing, { opacity: (ev + 0.25 * prog(t, tMove[1][0], tMove[1][0] + 0.4) * (t > S0 + 8.6 ? 1 : 0)).toFixed(3), transform: `rotate(${(lt * 70).toFixed(1)}deg) scale(${(1 + 0.04 * Math.sin(lt * 6)).toFixed(3)})` });

    // Votes
    votes.forEach((v, i) => {
      const k = clamp((t - tVote[i]) / 0.3);
      const vis = clamp((t - (tStage[2] + 0.1)) / 0.4);
      const decided = t >= tVote[i];
      const bg = decided ? (v.ok ? C.green : C.pink) : 'rgba(246,241,255,0.18)';
      if (v.e._bg !== bg) {
        v.e._bg = bg;
        v.e.style.background = bg;
        v.e.innerHTML = decided ? (v.ok ? ICONS.check : ICONS.cross) : '';
        v.e.style.boxShadow = decided ? `0 0 18px ${bg}` : 'none';
      }
      v.e.style.opacity = vis.toFixed(3);
      v.e.style.transform = `scale(${(decided ? lerp(1.6, 1, ease.outBack(k)) : lerp(0.3, 1, ease.outCubic(vis))).toFixed(3)})`;
    });
    const pk = clamp((t - tPass) / 0.45);
    setStyle(verdict, { opacity: clamp(pk * 3).toFixed(3), transform: `translate(-50%, -50%) scale(${lerp(1.8, 1, ease.outBack(pk, 2)).toFixed(3)})` });

    // Blocks: two existing, a third slides in and locks.
    blocks.forEach((b, i) => {
      const bx = XS[3] - 72 + i * 72;
      const by = Y + 300;
      const vis = clamp((t - (tStage[3] + 0.2)) / 0.4);
      let x = bx, op = vis;
      if (i === 2) {
        const k = clamp((t - tBlock) / 0.45);
        x = lerp(bx + 160, bx, ease.outCubic(k));
        op = clamp(k * 2.5);
        b.style.boxShadow = `0 0 ${(18 + 40 * Math.exp(-(t - tBlock - 0.45) * 4) * (t > tBlock + 0.45 ? 1 : 0)).toFixed(1)}px rgba(255,135,255,0.8)`;
        b.style.background = t > tBlock + 0.45 ? 'rgba(255,135,255,0.35)' : 'rgba(255,135,255,0.12)';
      }
      setStyle(b, { left: `${x.toFixed(1)}px`, top: `${by}px`, opacity: op.toFixed(3) });
    });
    const rk = clamp((t - tBlock - 0.5) / 0.45);
    setStyle(rec, { opacity: clamp(rk * 3).toFixed(3), transform: `translate(-50%, -50%) scale(${lerp(1.8, 1, ease.outBack(rk, 2)).toFixed(3)})` });
    hash.style.opacity = prog(t, tBlock + 0.7, tBlock + 1.1).toFixed(3);

    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, 1 - prog(t, start, start + 0.35), prog(t, end - 0.3, end));
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, 0.12 * Math.exp(-(t - tPass) * 8) * (t > tPass ? 1 : 0), 0.12 * Math.exp(-(t - tBlock - 0.45) * 8) * (t > tBlock + 0.45 ? 1 : 0));
    ctx.fx.uiFlashColor = t > tBlock ? '#ffc8ff' : '#c8ffe0';
  }

  return { start, end, root, group, update, layout: () => head.layoutGradients() };
}
