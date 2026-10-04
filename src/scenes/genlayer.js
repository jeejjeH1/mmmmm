// 50–58s. The drop: "This is where GenLayer becomes interesting."
//          + Intelligent Contracts / decentralized validation / non-deterministic outcomes.
import { THREE } from '../engine/gl.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { ICONS } from '../engine/icons.js';
import { buildLogoHero } from './logohero.js';
import { clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

export default function genlayer(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.genlayer;
  const LOCK = start + 0.5; // pieces lock on beat 2 of the drop bar
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);
  const hero = buildLogoHero(ctx, { scale: 1.3 });
  group.add(hero.group);

  // Speed lines converging during the fly-in.
  const N = 160;
  const lp = new Float32Array(N * 6);
  const la = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.sin(i * 12.9) * 0.2;
    const r0 = 3 + (Math.sin(i * 7.7) * 0.5 + 0.5) * 6;
    const len = 1.5 + (Math.sin(i * 3.3) * 0.5 + 0.5) * 3;
    lp.set([Math.cos(a) * r0, Math.sin(a) * r0, -2, Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len), -2], i * 6);
    la.set([1, 0], i * 2);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('aA', new THREE.BufferAttribute(la, 1));
  const lm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uK: { value: 0 }, uO: { value: 1 } },
    vertexShader: `attribute float aA; uniform float uK; varying float vA; void main(){ vec3 p = position * (1.0 - uK * 0.85); vA = aA; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float uO; varying float vA; void main(){ gl_FragColor = vec4(vec3(1.0,0.75,1.0)*2.0, vA*uO); }`,
  });
  const speed = new THREE.LineSegments(lg, lm);
  speed.frustumCulled = false;
  group.add(speed);

  // DOM
  const blk = el('div', 'abs', root);
  setStyle(blk, { left: '1010px', top: '0', width: '880px', height: '1080px' });
  const t1 = makeText(blk, 'This is where', 'h3 t-d');
  setStyle(t1.root, { left: '0', top: '318px' });
  const t2 = makeText(blk, '<x>GenLayer</x>', 'h0 glow-p');
  setStyle(t2.root, { left: '-8px', top: '380px', fontSize: '176px' });
  const t3 = makeText(blk, 'becomes interesting.', 'h3');
  setStyle(t3.root, { left: '0', top: '578px' });

  const pills = [
    { txt: 'Intelligent Contracts', icon: 'code', c: '#ff87ff' },
    { txt: 'Decentralized Validation', icon: 'users', c: '#9dffc6' },
  ].map((P, i) => {
    const e = el('div', 'abs glass', blk);
    e.style.cssText += `;left:0;top:${300 + i * 118}px;display:flex;align-items:center;gap:20px;padding:20px 32px 20px 22px;border-radius:24px;font-family:'Space Grotesk';font-weight:600;font-size:48px;letter-spacing:-0.015em;white-space:nowrap`;
    e.innerHTML = `<span style="width:58px;height:58px;color:${P.c};display:inline-grid;place-items:center;border-radius:16px;background:${P.c}22;box-shadow:inset 0 0 0 1.5px ${P.c}88"><span style="width:38px;height:38px;display:block">${ICONS[P.icon]}</span></span>${P.txt}`;
    return e;
  });
  const t4 = makeText(blk, 'to evaluate outcomes that', 'h4 t-d');
  setStyle(t4.root, { left: '4px', top: '560px' });
  const t5 = makeText(blk, 'aren’t purely <q>deterministic.</q>', 'h2');
  setStyle(t5.root, { left: '0', top: '616px', fontSize: '78px' });

  function update(t) {
    const lt = t - start;
    const k = prog(t, start - 0.05, LOCK, ease.linear);
    const impactT = t >= LOCK ? t - LOCK : -1;
    const shake = impactT >= 0 ? Math.exp(-impactT * 5) * 0.12 : 0;
    // Camera: tight push on the lock, then a slow drift; logo sits left of centre.
    const orbit = prog(t, LOCK, end, ease.inOutSine);
    camera.position.set(lerp(0.4, -0.6, orbit) + noise1(t * 30, 1) * shake, lerp(0.15, 0.35, orbit) + noise1(t * 30, 2) * shake, lerp(8.0, 9.4, prog(t, start, LOCK + 1.4, ease.outCubic)) + lerp(0, 0.5, orbit));
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(1920, 1080, 400, 0, 1920, 1080);
    camera.fov = 40;
    camera.updateProjectionMatrix();
    ctx.bgp.nebula = 1;
    ctx.bgp.dust = 1;
    ctx.bgp.floor = 0;

    hero.update(t, {
      k,
      impactT,
      spinY: Math.sin(lt * 0.55) * 0.42 + (1 - ease.outCubic(clamp(lt / 1.2))) * -0.8,
      tiltX: Math.sin(lt * 0.4) * 0.08,
      haloA: prog(t, LOCK, LOCK + 0.6),
      rayA: prog(t, LOCK, LOCK + 0.3) * (0.75 + 0.25 * Math.sin(lt * 1.3)),
      sparkA: prog(t, LOCK, LOCK + 1),
      sweep: env(t, start + 2.6, start + 3.6, 0.4, 0.6),
    });
    lm.uniforms.uK.value = k;
    lm.uniforms.uO.value = (1 - k) * prog(t, start - 0.05, start + 0.15);
    speed.visible = k < 1;

    // Text block 1
    animChars(t1, t, LOCK + 0.35, { stagger: 0.025, dur: 0.6, style: 'rise', dist: 40, tout: start + 3.65, outStyle: 'blur' });
    animChars(t2, t, LOCK + 0.55, { stagger: 0.05, dur: 0.9, style: 'blur', tout: start + 3.7, outStyle: 'blur' });
    animChars(t3, t, LOCK + 1.15, { stagger: 0.022, dur: 0.6, style: 'rise', dist: 40, tout: start + 3.75, outStyle: 'blur' });
    // Text block 2
    pills.forEach((p, i) => {
      const a = ease.outBack(clamp((t - (start + 4.0 + i * 0.4)) / 0.6), 1.4);
      const o = prog(t, end - 0.55, end - 0.25);
      setStyle(p, { opacity: (clamp(a * 2) * (1 - o)).toFixed(3), transform: `translateX(${lerp(80, 0, a).toFixed(1)}px) scale(${lerp(0.9, 1, a).toFixed(3)})`, display: t > start + 3.9 ? 'flex' : 'none' });
    });
    animChars(t4, t, start + 4.85, { stagger: 0.02, dur: 0.5, style: 'rise', dist: 30, tout: end - 0.5, outStyle: 'blur' });
    animChars(t5, t, start + 5.2, { stagger: 0.025, dur: 0.6, style: 'rise', dist: 40, tout: end - 0.45, outStyle: 'blur' });

    // FX
    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, 1 - prog(t, start, start + 0.35, ease.outQuad), impactT >= 0 ? 0.55 * Math.exp(-impactT * 7) : 0);
    ctx.fx.uiFlashColor = impactT >= 0 && impactT < 0.6 ? '#ffd9ff' : '#ffffff';
    ctx.fx.bloom = 0.9 + (impactT >= 0 ? Math.exp(-impactT * 2) * 0.8 : 0.3);
    ctx.fx.bloomThreshold = 0.22;
    ctx.fx.chroma = Math.max(ctx.fx.chroma, impactT >= 0 ? Math.exp(-impactT * 4) * 0.004 : 0.002);
    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, prog(t, end - 0.28, end));
    root.style.transform = shake > 0.01 ? `translate(${(noise1(t * 30, 5) * shake * 60).toFixed(1)}px, ${(noise1(t * 30, 6) * shake * 60).toFixed(1)}px)` : '';
  }

  return { start, end, root, group, update, layout: () => [t1, t2, t3, t4, t5].forEach((x) => x.layoutGradients()) };
}
