// 58–66s. "Instead of asking: Did the code execute correctly?
//          You can ask: Does this output actually satisfy the requirements?"
//          "That opens the door to things like automated QA and Collective Memory."
import { THREE, makeLogo3D } from '../engine/gl.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { ICONS } from '../engine/icons.js';
import { C, clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

export default function question(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.question;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);
  // A big wireframe mark drifting in the background for depth.
  const ghost = makeLogo3D(ctx.gl.envMap, { depth: 40 });
  ghost.bodyMat.visible = false;
  ghost.group.children.forEach((p) => (p.children[0].visible = false));
  ghost.edgeMat.color.set(C.purple).multiplyScalar(1.2);
  ghost.group.scale.setScalar(3.2);
  ghost.group.position.set(5.2, -0.4, -6);
  group.add(ghost.group);

  const lab1 = el('div', 'abs label', root, 'Instead of asking');
  setStyle(lab1, { left: '150px', top: '150px' });
  const q1w = el('div', 'abs', root);
  setStyle(q1w, { left: '150px', top: '196px' });
  const q1 = el('div', 'glass blue qcard', q1w);
  q1.innerHTML = `<div class="qi">${ICONS.code}</div><div class="qt">Did the code execute correctly?<span class="qstrike"></span></div><div class="qb">exit 0 ✓</div>`;
  const q1strike = q1.querySelector('.qstrike');
  const q1badge = q1.querySelector('.qb');

  const lab2 = el('div', 'abs label', root, 'You can ask');
  setStyle(lab2, { left: '150px', top: '410px', color: '#ff87ff' });
  const q2 = makeText(root, 'Does this output <x>actually satisfy</x>|<x>the requirements?</x>', 'h1 glow-p');
  setStyle(q2.root, { left: '142px', top: '450px', fontSize: '104px' });

  const chipRow = el('div', 'abs', root);
  setStyle(chipRow, { left: '150px', top: '690px', display: 'flex', gap: '22px' });
  const chips = ['accurate', 'complete', 'meets the brief'].map((txt) => {
    const e = el('div', 'chip', chipRow);
    e.style.position = 'relative';
    e.innerHTML = `${ICONS.check}<span>${txt}</span>`;
    return e;
  });

  const doorTxt = makeText(root, 'That opens the door to', 'h4 t-d');
  setStyle(doorTxt.root, { left: '150px', top: '832px' });
  const doors = [
    { txt: 'Automated QA', icon: 'qa', c: C.blue, x: 690 },
    { txt: 'Collective Memory', icon: 'memory', c: C.pink, x: 1196 },
  ].map((D) => {
    const e = el('div', 'door glass', root);
    e.style.background = `linear-gradient(160deg, rgba(24,14,44,0.86), rgba(8,4,18,0.9)) padding-box, linear-gradient(135deg, ${D.c}, ${D.c}33 55%, ${D.c}99) border-box`;
    e.innerHTML = `<span class="di" style="color:${D.c};background:${D.c}1f;box-shadow:inset 0 0 0 1.5px ${D.c}88">${ICONS[D.icon]}</span>${D.txt}`;
    setStyle(e, { left: `${D.x}px`, top: '806px' });
    return e;
  });

  function update(t) {
    const lt = t - start;
    camera.position.set(noise1(t * 0.2, 3) * 0.3, noise1(t * 0.2, 4) * 0.2, 10);
    camera.lookAt(0, 0, 0);
    ctx.bgp.nebula = 0.8;
    ctx.bgp.dust = 0.8;
    ghost.group.rotation.set(0.15, -0.5 + lt * 0.07, 0.05);
    ghost.edgeMat.opacity = 0.45 * env(t, start, end, 1.0, 0.6);

    const out = (d = 0) => prog(t, end - 0.55 + d, end - 0.2 + d, ease.inCubic);
    const o = 1 - out();
    // Old question
    lab1.style.opacity = (prog(t, start + 0.15, start + 0.5) * o).toFixed(3);
    const qin = prog(t, start + 0.3, start + 0.9, ease.outCubic);
    const dim = prog(t, start + 2.1, start + 2.6);
    setStyle(q1w, { opacity: (qin * lerp(1, 0.5, dim) * o).toFixed(3), transform: `translateX(${lerp(-60, 0, qin).toFixed(1)}px) scale(${lerp(1, 0.94, dim).toFixed(3)})`, transformOrigin: '0 50%' });
    q1strike.style.transform = `scaleX(${prog(t, start + 1.9, start + 2.3, ease.outCubic).toFixed(3)})`;
    q1badge.style.opacity = prog(t, start + 1.0, start + 1.3).toFixed(3);
    // New question
    lab2.style.opacity = (prog(t, start + 2.4, start + 2.7) * o).toFixed(3);
    animChars(q2, t, start + 2.55, { stagger: 0.022, dur: 0.65, style: 'rise', dist: 60, tout: end - 0.55, outStyle: 'blur', outStagger: 0.004 });
    chips.forEach((c, i) => {
      const k = clamp((t - (start + 4.3 + i * 0.28)) / 0.5);
      setStyle(c, { opacity: (clamp(k * 2) * o).toFixed(3), transform: `translateY(${lerp(24, 0, ease.outBack(k)).toFixed(1)}px) scale(${lerp(0.85, 1, ease.outBack(k)).toFixed(3)})` });
    });
    animChars(doorTxt, t, start + 5.35, { stagger: 0.02, dur: 0.5, style: 'rise', dist: 30, tout: end - 0.5, outStyle: 'fade' });
    doors.forEach((d, i) => {
      const k = clamp((t - (start + 5.75 + i * 0.4)) / 0.6);
      setStyle(d, { opacity: (clamp(k * 2) * o).toFixed(3), transform: `translateY(${lerp(40, 0, ease.outBack(k, 1.6)).toFixed(1)}px) scale(${lerp(0.8, 1, ease.outBack(k, 1.6)).toFixed(3)})` });
    });

    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, 1 - prog(t, start, start + 0.35), prog(t, end - 0.25, end));
  }

  return { start, end, root, group, update, layout: () => [q2, doorTxt].forEach((x) => x.layoutGradients()) };
}
