// 88–96s. "Because in an agentic economy, execution is only half the problem.
//          The other half is knowing whether the work was actually good enough."
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { ICONS } from '../engine/icons.js';
import { clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

const NS = 'http://www.w3.org/2000/svg';
const CX = 560, CY = 540, R = 268;
const HALF = Math.PI * R;

export default function half(ctx) {
  const { T, camera, ui } = ctx;
  const [start, end] = T.scenes.half;
  const P2 = start + 3.6;
  const root = el('div', 'scene', ui);

  const ringWrap = el('div', 'abs', root);
  setStyle(ringWrap, { left: '0', top: '0', width: '1920px', height: '1080px', transformOrigin: `${CX}px ${CY}px` });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '1920');
  svg.setAttribute('height', '1080');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  const top = `${CX} ${CY - R}`, bot = `${CX} ${CY + R}`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="hg1" gradientUnits="userSpaceOnUse" x1="0" y1="${CY - R}" x2="0" y2="${CY + R}"><stop offset="0" stop-color="#8fdcff"/><stop offset="1" stop-color="#9dffc6"/></linearGradient>
      <linearGradient id="hg2" gradientUnits="userSpaceOnUse" x1="0" y1="${CY - R}" x2="0" y2="${CY + R}"><stop offset="0" stop-color="#ff87ff"/><stop offset="1" stop-color="#dc00ff"/></linearGradient>
    </defs>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(246,241,255,0.07)" stroke-width="46"/>
    <path class="hR0" d="M ${top} A ${R} ${R} 0 0 1 ${bot}" fill="none" stroke="#ff87ff" stroke-width="3" stroke-dasharray="10 14" opacity="0.8"/>
    <path class="hL" d="M ${top} A ${R} ${R} 0 0 0 ${bot}" fill="none" stroke="url(#hg1)" stroke-width="46" stroke-linecap="butt" style="filter:drop-shadow(0 0 22px rgba(143,220,255,0.6))"/>
    <path class="hR" d="M ${top} A ${R} ${R} 0 0 1 ${bot}" fill="none" stroke="url(#hg2)" stroke-width="46" stroke-linecap="butt" style="filter:drop-shadow(0 0 22px rgba(255,135,255,0.7))"/>`;
  ringWrap.appendChild(svg);
  const hL = svg.querySelector('.hL');
  const hR = svg.querySelector('.hR');
  const hR0 = svg.querySelector('.hR0');
  const capL = el('div', 'cap', ringWrap, 'EXECUTION');
  setStyle(capL, { left: `${CX - 190}px`, top: `${CY + R + 46}px`, color: '#8fdcff' });
  const capR = el('div', 'cap', ringWrap, 'JUDGMENT');
  setStyle(capR, { left: `${CX + 190}px`, top: `${CY + R + 46}px`, color: '#ff87ff' });
  const pct = el('div', 'abs', ringWrap);
  setStyle(pct, { left: `${CX - 200}px`, top: `${CY - 88}px`, width: '400px', textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: '700', fontSize: '150px', letterSpacing: '-0.04em', color: '#f6f1ff' });
  const qm = el('div', 'abs', ringWrap, '?');
  setStyle(qm, { left: `${CX + R - 40}px`, top: `${CY - 70}px`, fontFamily: 'Space Grotesk', fontWeight: '700', fontSize: '110px', color: '#ff87ff', textShadow: '0 0 30px #ff87ff' });

  const a1 = makeText(root, 'In an agentic economy,', 'h3 t-d');
  setStyle(a1.root, { left: '972px', top: '330px' });
  const a2 = makeText(root, 'execution is only', 'h2');
  setStyle(a2.root, { left: '966px', top: '404px', fontSize: '82px' });
  const a3 = makeText(root, '<y>half</y> the problem.', 'h2 glow-b');
  setStyle(a3.root, { left: '966px', top: '494px', fontSize: '82px' });
  const b1 = makeText(root, 'The other half is knowing', 'h3 t-d');
  setStyle(b1.root, { left: '972px', top: '330px' });
  const b2 = makeText(root, 'whether the work was', 'h2');
  setStyle(b2.root, { left: '966px', top: '404px', fontSize: '82px' });
  const b3 = makeText(root, 'actually <x>good enough.</x>', 'h2 glow-p');
  setStyle(b3.root, { left: '966px', top: '494px', fontSize: '82px' });

  function update(t) {
    camera.position.set(noise1(t * 0.2, 5) * 0.25, 0, 10);
    camera.lookAt(0, 0, 0);
    ctx.bgp.nebula = 0.75;
    ctx.bgp.dust = 0.7;

    const rin = prog(t, start + 0.1, start + 0.7, ease.outCubic);
    const fly = prog(t, end - 0.75, end, ease.inCubic);
    setStyle(ringWrap, { opacity: (rin * (1 - prog(t, end - 0.2, end))).toFixed(3), transform: `rotate(${lerp(-30, 0, rin) + fly * 200}deg) scale(${(lerp(0.85, 1, rin) * (1 + fly * 2.2)).toFixed(3)})` });
    const kL = prog(t, start + 0.5, start + 1.5, ease.inOutCubic);
    hL.setAttribute('stroke-dasharray', `${(kL * HALF).toFixed(1)} 2000`);
    const kR = prog(t, P2 + 0.3, P2 + 1.4, ease.inOutCubic);
    hR.setAttribute('stroke-dasharray', `${(kR * HALF).toFixed(1)} 2000`);
    hR.style.opacity = kR > 0 ? '1' : '0';
    hR0.style.opacity = (prog(t, start + 1.3, start + 1.7) * (1 - kR) * (0.5 + 0.5 * Math.sin(t * 6))).toFixed(3);
    hR0.setAttribute('stroke-dashoffset', (-t * 30).toFixed(1));
    const val = Math.round(kL * 50 + kR * 50);
    const s = `${val}%`;
    if (pct._s !== s) pct.textContent = pct._s = s;
    pct.style.color = kR > 0.99 ? '#9dffc6' : '#f6f1ff';
    pct.style.textShadow = kR > 0.99 ? '0 0 40px rgba(157,255,198,0.7)' : 'none';
    capL.style.opacity = prog(t, start + 1.0, start + 1.4).toFixed(3);
    capR.style.opacity = prog(t, start + 1.4, start + 1.8).toFixed(3);
    qm.style.opacity = (prog(t, start + 1.5, start + 1.9) * (1 - prog(t, P2 + 0.3, P2 + 0.6)) * (0.7 + 0.3 * Math.sin(t * 5))).toFixed(3);

    animChars(a1, t, start + 0.3, { stagger: 0.02, dur: 0.5, style: 'rise', dist: 30, tout: P2 - 0.45, outStyle: 'blur' });
    animChars(a2, t, start + 0.65, { stagger: 0.022, dur: 0.55, style: 'rise', dist: 50, tout: P2 - 0.42, outStyle: 'blur' });
    animChars(a3, t, start + 1.05, { stagger: 0.03, dur: 0.6, style: 'rise', dist: 50, tout: P2 - 0.4, outStyle: 'blur' });
    const on2 = t > P2 - 0.1;
    for (const x of [b1, b2, b3]) x.root.style.display = on2 ? '' : 'none';
    for (const x of [a1, a2, a3]) x.root.style.display = t < P2 + 0.1 ? '' : 'none';
    if (on2) {
      animChars(b1, t, P2, { stagger: 0.02, dur: 0.5, style: 'rise', dist: 30, tout: end - 0.75, outStyle: 'blur' });
      animChars(b2, t, P2 + 0.35, { stagger: 0.02, dur: 0.55, style: 'rise', dist: 50, tout: end - 0.72, outStyle: 'blur' });
      animChars(b3, t, P2 + 0.8, { stagger: 0.03, dur: 0.6, style: 'rise', dist: 50, tout: end - 0.7, outStyle: 'blur' });
    }

    const done = t - (P2 + 1.4);
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, done > 0 ? 0.2 * Math.exp(-done * 6) : 0, prog(t, end - 0.3, end, ease.inQuad));
    ctx.fx.uiFlashColor = t > end - 0.5 ? '#ffffff' : '#d8ffe9';
    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, 1 - prog(t, start, start + 0.3));
  }

  return { start, end, root, group: null, update, layout: () => [a1, a2, a3, b1, b2, b3].forEach((x) => x.layoutGradients()) };
}
