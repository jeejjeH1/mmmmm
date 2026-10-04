// 42–50s. "You can't solve this by blindly trusting the same AI that produced the output."
//         "You need independent verification."
import { THREE, worldToScreen } from '../engine/gl.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { ICONS } from '../engine/icons.js';
import { makeValidators, VCOLORS } from './validators.js';
import { clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

const NS = 'http://www.w3.org/2000/svg';

export default function verify(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.verify;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);
  const V = makeValidators({ n: 5, radius: 2.0 });
  V.group.position.set(0, 0.5, 0);
  group.add(V.group);

  // ---- Part A: the self-check loop (DOM + SVG)
  const partA = el('div', 'abs', root);
  setStyle(partA, { inset: '0' });
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '1920');
  svg.setAttribute('height', '1080');
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  svg.innerHTML = `
    <defs>
      <marker id="ah-b" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8fdcff"/></marker>
      <marker id="ah-p" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ff87ff"/></marker>
    </defs>
    <path class="a1" d="M 770 640 L 1130 640" stroke="#8fdcff" stroke-width="4" fill="none" marker-end="url(#ah-b)" style="filter:drop-shadow(0 0 8px #8fdcff)"/>
    <path class="a2" d="M 1270 470 C 1230 300, 700 300, 660 500" stroke="#ff87ff" stroke-width="4" stroke-dasharray="14 12" fill="none" marker-end="url(#ah-p)" style="filter:drop-shadow(0 0 8px #ff87ff)"/>
    <g class="xx" style="filter:drop-shadow(0 0 14px #ff87ff)"><path d="M 900 300 L 1030 430" stroke="#ff87ff" stroke-width="14" stroke-linecap="round" fill="none"/><path d="M 1030 300 L 900 430" stroke="#ff87ff" stroke-width="14" stroke-linecap="round" fill="none"/></g>`;
  partA.appendChild(svg);
  const a1 = svg.querySelector('.a1');
  const a2 = svg.querySelector('.a2');
  const xx = svg.querySelector('.xx');
  const xParts = xx.querySelectorAll('path');
  const A2LEN = a2.getTotalLength();
  const orb = el('div', 'orb', partA, ICONS.cpu);
  setStyle(orb, { left: '650px', top: '640px' });
  const capA = el('div', 'cap', partA, 'AI AGENT');
  setStyle(capA, { left: '650px', top: '780px' });
  const capP = el('div', 'cap', partA, 'produces');
  setStyle(capP, { left: '950px', top: '600px', fontSize: '19px', color: '#8fdcff' });
  const capS = el('div', 'cap', partA, 'checks its own work');
  setStyle(capS, { left: '965px', top: '250px', fontSize: '20px', color: '#ff87ff' });
  const capX = el('div', 'cap', partA, 'same model · same blind spots');
  setStyle(capX, { left: '965px', top: '446px', fontSize: '20px', color: '#ff87ff', letterSpacing: '0.12em' });

  const doc = el('div', 'glass doc', root);
  doc.innerHTML = `<div class="dh">${ICONS.doc}<span>output.md</span></div><div class="ln" style="width:92%"></div><div class="ln" style="width:78%"></div><div class="ln" style="width:86%"></div><div class="ln" style="width:60%"></div><div class="ln" style="width:72%"></div><div class="chip">conf. 99.2%</div>`;
  const capO = el('div', 'cap', root, 'OUTPUT');

  const tA1 = makeText(root, 'You can’t solve this by <p>blindly trusting</p>', 'h2');
  setStyle(tA1.root, { left: '0', right: '0', top: '86px', textAlign: 'center', fontSize: '74px' });
  const tA2 = makeText(root, 'the same AI that produced the output.', 'h2');
  setStyle(tA2.root, { left: '0', right: '0', top: '170px', textAlign: 'center', fontSize: '74px' });

  // ---- Part B: independent validators
  const vlabels = V.nodes.map((v, i) => {
    const e = el('div', 'vlabel', root, `VALIDATOR 0${i + 1}<span style="opacity:.5"> · MODEL ${'ABCDE'[i]}</span>`);
    e.style.color = VCOLORS[i];
    return e;
  });
  const tB = makeText(root, 'You need <y>independent verification.</y>', 'h1 glow-w');
  setStyle(tB.root, { left: '0', right: '0', top: '858px', textAlign: 'center', fontSize: '96px' });

  const tmp = new THREE.Vector3();
  function update(t) {
    const lt = t - start;
    const B = prog(t, start + 4.2, start + 4.95, ease.inOutCubic); // A -> B
    const rise = prog(t, start + 6.3, end, ease.inQuad);
    camera.position.set(noise1(t * 0.3, 2) * 0.2, 0, lerp(lerp(12, 11, B), 9.8, rise));
    camera.lookAt(0, 0, 0);
    ctx.bgp.nebula = lerp(0.5, 0.9, B);
    ctx.bgp.dust = 0.7;
    ctx.bgp.floor = 0.3 * B;
    ctx.bgp.floorY = -3.6;

    // Part A
    const aOut = prog(t, start + 4.05, start + 4.55);
    partA.style.opacity = (1 - aOut).toFixed(3);
    partA.style.display = aOut < 1 ? '' : 'none';
    const oin = prog(t, start + 0.2, start + 0.8, ease.outBack);
    setStyle(orb, { transform: `scale(${oin.toFixed(3)})`, opacity: clamp(oin * 2).toFixed(3) });
    capA.style.opacity = prog(t, start + 0.5, start + 0.9).toFixed(3);
    const l1 = prog(t, start + 0.7, start + 1.2, ease.outCubic);
    a1.setAttribute('stroke-dasharray', `${(l1 * 360).toFixed(1)} 1000`);
    a1.style.opacity = l1 > 0 ? '1' : '0';
    capP.style.opacity = prog(t, start + 1.0, start + 1.3).toFixed(3);
    const l2 = prog(t, start + 1.45, start + 2.2, ease.inOutCubic);
    a2.style.opacity = l2 > 0 ? '1' : '0';
    if (l2 < 1) {
      const n = Math.floor((A2LEN * l2) / 26);
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(14, 12);
      arr.push(Math.min(14, A2LEN * l2 - n * 26).toFixed(1), 4000);
      a2.setAttribute('stroke-dasharray', arr.join(' '));
      a2.setAttribute('stroke-dashoffset', '0');
      a2.removeAttribute('marker-end');
    } else {
      a2.setAttribute('stroke-dasharray', '14 12');
      a2.setAttribute('stroke-dashoffset', (-(t - start - 2.2) * 40).toFixed(1));
      a2.setAttribute('marker-end', 'url(#ah-p)');
    }
    capS.style.opacity = prog(t, start + 1.9, start + 2.3).toFixed(3);
    const x1 = prog(t, start + 2.55, start + 2.75, ease.outCubic);
    const x2 = prog(t, start + 2.72, start + 2.92, ease.outCubic);
    xParts[0].setAttribute('stroke-dasharray', `${(x1 * 184).toFixed(1)} 400`);
    xParts[1].setAttribute('stroke-dasharray', `${(x2 * 184).toFixed(1)} 400`);
    xx.style.opacity = x1 > 0 ? '1' : '0';
    capX.style.opacity = prog(t, start + 2.95, start + 3.2).toFixed(3);
    // Self-check loop dims once crossed out.
    a2.style.filter = t > start + 2.75 ? 'drop-shadow(0 0 4px #ff87ff) saturate(0.6)' : 'drop-shadow(0 0 8px #ff87ff)';

    // Output doc travels from the right of the loop to the ring centre.
    const din = prog(t, start + 0.95, start + 1.4, ease.outBack);
    const dx = lerp(1280, 960, B);
    const dy = lerp(640, 464, B);
    const ds = lerp(1, 0.86, B) * lerp(0.6, 1, din) * (1 + 0.05 * rise);
    setStyle(doc, { left: `${dx.toFixed(1)}px`, top: `${dy.toFixed(1)}px`, transform: `scale(${ds.toFixed(3)})`, opacity: (clamp(din * 2) * (1 - prog(t, end - 0.2, end))).toFixed(3) });
    setStyle(capO, { left: `${dx.toFixed(1)}px`, top: `${(dy + 172 * ds).toFixed(1)}px`, opacity: (prog(t, start + 1.3, start + 1.6) * (1 - B)).toFixed(3) });

    animChars(tA1, t, start + 0.1, { stagger: 0.016, dur: 0.55, style: 'rise', dist: 40, tout: start + 3.95, outStyle: 'blur', outStagger: 0.005 });
    animChars(tA2, t, start + 0.55, { stagger: 0.016, dur: 0.55, style: 'rise', dist: 40, tout: start + 4.0, outStyle: 'blur', outStagger: 0.005 });

    // Part B: validators fly in around the output
    const enter = V.nodes.map((_, i) => ease.outCubic(prog(t, start + 4.45 + i * 0.13, start + 5.25 + i * 0.13)));
    const spin = lt * 0.18 + rise * rise * 2.4;
    V.layout(t, { spin, enter, radius: lerp(2.0, 1.8, rise) });
    V.group.visible = t > start + 4.35;
    V.group.rotation.x = -0.18;
    V.beamMat.uniforms.uGrow.value = prog(t, start + 5.25, start + 5.85);
    V.beamMat.uniforms.uSpeed.value = 1.1 + rise * 3;
    V.beamMat.uniforms.uO.value = 1 + rise;
    vlabels.forEach((e, i) => {
      const v = V.nodes[i];
      v.node.getWorldPosition(tmp);
      const p = worldToScreen(camera, tmp);
      const a = prog(t, start + 5.15 + i * 0.13, start + 5.55 + i * 0.13) * (1 - prog(t, end - 0.6, end - 0.3));
      const left = p.x > 960;
      setStyle(e, { opacity: a.toFixed(3), display: a > 0 ? '' : 'none', transform: `translate(${(left ? p.x + 46 : p.x - 46).toFixed(1)}px, ${(p.y - 18).toFixed(1)}px) translateX(${left ? '0' : '-100%'})` });
    });
    animChars(tB, t, start + 5.3, { stagger: 0.022, dur: 0.6, style: 'rise', dist: 60, tout: end - 0.35, outStyle: 'blur', outStagger: 0.004 });

    ctx.fx.bloom = 0.85 + rise * 0.6;
    ctx.fx.chroma = Math.max(ctx.fx.chroma, rise * 0.002);
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, prog(t, end - 0.22, end, ease.inQuad));
    ctx.fx.uiFlashColor = '#ffffff';
    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, 1 - prog(t, start, start + 0.3));
  }

  return { start, end, root, group, update, layout: () => [tA1, tA2, tB].forEach((x) => x.layoutGradients()) };
}
