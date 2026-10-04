// 80–88s. "This is a fundamentally different idea from simply putting AI inside a smart contract.
//          It's about creating a trustless layer for decisions that require judgment."
import { THREE, worldToScreen } from '../engine/gl.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { ICONS, logoSVG, LOGO_GRAD } from '../engine/icons.js';
import { LOGO } from '../logo.js';
import { buildStack, STACK_LAYERS } from './stack.js';
import { C, clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

function logoTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 640);
  // grid
  g.strokeStyle = 'rgba(220,0,255,0.35)';
  g.lineWidth = 2;
  for (let x = 0; x <= 1024; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 640); g.stroke(); }
  for (let y = 0; y <= 640; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
  // logo in the middle, as seen from above
  g.save();
  g.translate(512, 320);
  g.scale(1.25, 1.25);
  const grd = g.createLinearGradient(-180, -170, 180, 170);
  grd.addColorStop(0, '#ff87ff');
  grd.addColorStop(1, '#dc00ff');
  g.fillStyle = grd;
  g.shadowColor = '#ff87ff';
  g.shadowBlur = 30;
  for (const poly of [LOGO.left, LOGO.right, LOGO.kite]) {
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, -y) : g.moveTo(x, -y)));
    g.closePath();
    g.fill();
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export default function trustless(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.trustless;
  const SPLIT = start + 4.0;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);

  // ---- Part A: "AI inside a smart contract" (DOM)
  const partA = el('div', 'abs', root);
  setStyle(partA, { inset: '0' });
  const contract = el('div', 'glass blue', partA);
  setStyle(contract, { left: '770px', top: '170px', width: '380px', height: '300px', boxSizing: 'border-box', padding: '26px 30px' });
  contract.innerHTML = `<div class="dh mono" style="display:flex;align-items:center;gap:12px;font-size:20px;color:#f6f1ff"><span style="width:30px;height:30px;color:#8fdcff;display:inline-block">${ICONS.code}</span>contract.sol</div>
    <div style="margin-top:22px;height:10px;width:70%;border-radius:6px;background:rgba(246,241,255,.14)"></div>
    <div style="margin-top:16px;height:10px;width:52%;border-radius:6px;background:rgba(246,241,255,.14)"></div>
    <div style="position:absolute;left:30px;right:30px;bottom:26px;height:120px;border-radius:16px;border:2px dashed rgba(143,220,255,.4)"></div>`;
  const chip = el('div', 'abs', partA);
  setStyle(chip, { left: '900px', top: '330px', width: '120px', height: '96px', display: 'grid', placeItems: 'center', borderRadius: '18px', color: '#8fdcff', background: 'rgba(143,220,255,0.14)', boxShadow: 'inset 0 0 0 2px rgba(143,220,255,0.7), 0 0 30px rgba(143,220,255,0.4)' });
  chip.innerHTML = `<span style="width:58px;height:58px;display:block">${ICONS.cpu}</span>`;
  const capA = el('div', 'cap', partA, 'AI  +  SMART CONTRACT');
  setStyle(capA, { left: '960px', top: '496px', color: '#8fdcff' });
  const strike = el('div', 'abs', partA);
  setStyle(strike, { left: '730px', top: '316px', width: '460px', height: '10px', borderRadius: '6px', background: '#ff87ff', boxShadow: '0 0 20px #ff87ff', transformOrigin: '0 50%', transform: 'rotate(-24deg) scaleX(0)' });
  const tA1 = makeText(partA, 'A fundamentally different idea from', 'h3 t-d');
  setStyle(tA1.root, { left: '0', right: '0', top: '600px', textAlign: 'center' });
  const tA2 = makeText(partA, 'simply putting <p>AI inside a smart contract.</p>', 'h2');
  setStyle(tA2.root, { left: '0', right: '0', top: '680px', textAlign: 'center' });

  // ---- Part B: the stack again, GenLayer fills the missing layer
  const labels = el('div', 'abs', root);
  setStyle(labels, { inset: '0' });
  const stack = buildStack(ctx, labels, STACK_LAYERS);
  group.add(stack.group);
  const missing = stack.slabs.find((x) => x.L.missing);
  const glMat = [
    new THREE.MeshPhysicalMaterial({ color: '#2a0a3a', emissive: new THREE.Color(C.purple), emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.3, clearcoat: 1, envMap: ctx.gl.envMap, envMapIntensity: 0.4 }),
  ];
  const topMat = new THREE.MeshBasicMaterial({ map: logoTexture(), color: new THREE.Color(1.6, 1.6, 1.6), transparent: true });
  const gl = new THREE.Group();
  const glBody = new THREE.Mesh(new RoundedBoxGeometry(stack.W, stack.Hh, stack.D, 3, 0.08), glMat[0]);
  const glTop = new THREE.Mesh(new THREE.PlaneGeometry(stack.W - 0.12, stack.D - 0.12), topMat);
  glTop.rotation.x = -Math.PI / 2;
  glTop.position.y = stack.Hh / 2 + 0.004;
  const glEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(stack.W + 0.01, stack.Hh + 0.01, stack.D + 0.01)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.pink).multiplyScalar(2.2), transparent: true }));
  gl.add(glBody, glTop, glEdges);
  missing.node.add(gl);
  const glLabel = el('div', 'abs stack-label', labels);
  glLabel.innerHTML = `<span class="dot" style="background:#ff87ff;box-shadow:0 0 12px #ff87ff"></span><span style="color:#ff87ff">GENLAYER</span>`;
  setStyle(glLabel, { border: '1px solid rgba(255,135,255,0.6)', boxShadow: '0 0 24px rgba(255,135,255,0.35)' });

  const tB1 = makeText(root, 'It’s about creating a', 'h3 t-d');
  setStyle(tB1.root, { left: '120px', top: '300px' });
  const tB2 = makeText(root, '<y>trustless layer</y>', 'h1 glow-g');
  setStyle(tB2.root, { left: '112px', top: '372px' });
  const tB3 = makeText(root, 'for decisions that|require <x>judgment.</x>', 'h2');
  setStyle(tB3.root, { left: '118px', top: '520px' });

  const v = new THREE.Vector3();
  function update(t) {
    const B = t >= SPLIT - 0.05;
    const lt = t - start;
    partA.style.display = t < SPLIT + 0.1 ? '' : 'none';
    labels.style.display = B ? '' : 'none';
    for (const x of [tB1, tB2, tB3]) x.root.style.display = B ? '' : 'none';
    stack.group.visible = B;

    if (!B) {
      camera.position.set(noise1(t * 0.2, 1) * 0.2, 0, 10);
      camera.lookAt(0, 0, 0);
      ctx.bgp.nebula = 0.7;
      ctx.bgp.dust = 0.7;
      const ci = prog(t, start + 0.1, start + 0.6, ease.outCubic);
      setStyle(contract, { opacity: ci.toFixed(3), transform: `translateY(${lerp(30, 0, ci).toFixed(1)}px)` });
      const drop = clamp((t - start - 0.6) / 0.7);
      setStyle(chip, { opacity: clamp(drop * 3).toFixed(3), transform: `translateY(${lerp(-260, 0, ease.outBack(drop, 1.3)).toFixed(1)}px)` });
      capA.style.opacity = prog(t, start + 1.2, start + 1.5).toFixed(3);
      const sk = prog(t, start + 2.15, start + 2.45, ease.outCubic);
      strike.style.transform = `rotate(-24deg) scaleX(${sk.toFixed(3)})`;
      const dim = prog(t, start + 2.4, start + 2.8);
      contract.style.filter = chip.style.filter = `saturate(${lerp(1, 0.3, dim).toFixed(2)}) brightness(${lerp(1, 0.6, dim).toFixed(2)})`;
      animChars(tA1, t, start + 0.3, { stagger: 0.018, dur: 0.5, style: 'rise', dist: 30, tout: SPLIT - 0.45, outStyle: 'blur' });
      animChars(tA2, t, start + 0.75, { stagger: 0.018, dur: 0.55, style: 'rise', dist: 40, tout: SPLIT - 0.4, outStyle: 'blur' });
      partA.style.opacity = (1 - prog(t, SPLIT - 0.35, SPLIT)).toFixed(3);
    } else {
      const bt = t - SPLIT;
      const th = lerp(-0.95, -0.7, prog(t, SPLIT, end, ease.inOutSine));
      const R = lerp(17.5, 15.8, prog(t, SPLIT, end, ease.outCubic));
      const elv = 0.3;
      camera.position.set(Math.sin(th) * Math.cos(elv) * R, Math.sin(elv) * R, Math.cos(th) * Math.cos(elv) * R);
      camera.lookAt(0, 0, 0);
      camera.setViewOffset(1920, 1080, -215, 0, 1920, 1080);
      camera.updateProjectionMatrix();
      ctx.bgp.floor = 0.35;
      ctx.bgp.floorY = -3.4;
      ctx.bgp.nebula = 0.85;
      stack.drop(t, SPLIT - 0.1, 0.08, 0.6);
      // Missing layer: the dashed ghost fades as GenLayer slides in from the right.
      const slide = prog(t, SPLIT + 0.9, SPLIT + 1.7, ease.inOutCubic);
      const lock = t - (SPLIT + 1.7);
      gl.position.set(lerp(9, 0, slide), 0, 0);
      gl.visible = slide > 0;
      missing.edges.material.opacity *= 1 - slide;
      missing.node.userData.ghost.material.opacity = 0.06 * (1 - slide);
      glMat[0].emissiveIntensity = 0.35 + (lock > 0 ? Math.exp(-lock * 3) * 1.5 : 0) + 0.1 * Math.sin(bt * 3);
      for (const sl of stack.slabs) if (sl.grid) sl.grid.material.uniforms.uScan.value = lock > 0 ? ((lock * 0.6) % 1.4) - 0.2 : -1;
      // Labels
      stack.placeLabels(camera, 1 - prog(t, end - 0.5, end - 0.2), 1);
      missing.label.style.opacity = (1 - slide).toFixed(3);
      v.set(stack.W / 2, 0, stack.D / 2);
      gl.localToWorld(v);
      const p = worldToScreen(camera, v);
      const la = prog(t, SPLIT + 1.75, SPLIT + 2.1) * (1 - prog(t, end - 0.5, end - 0.2));
      setStyle(glLabel, { transform: `translate(${(p.x + 22).toFixed(1)}px, ${(p.y - 19).toFixed(1)}px) scale(${lerp(1.3, 1, prog(t, SPLIT + 1.75, SPLIT + 2.1, ease.outBack)).toFixed(3)})`, opacity: la.toFixed(3), display: la > 0 ? 'flex' : 'none', transformOrigin: '0 50%' });

      animChars(tB1, t, SPLIT + 0.25, { stagger: 0.02, dur: 0.5, style: 'rise', dist: 30, tout: end - 0.55, outStyle: 'blur' });
      animChars(tB2, t, SPLIT + 1.75, { stagger: 0.04, dur: 0.7, style: 'flip', dist: 60, tout: end - 0.5, outStyle: 'blur' });
      animChars(tB3, t, SPLIT + 2.3, { stagger: 0.018, dur: 0.55, style: 'rise', dist: 40, tout: end - 0.45, outStyle: 'blur' });

      ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, lock > 0 ? 0.35 * Math.exp(-lock * 6) : 0);
      ctx.fx.uiFlashColor = '#ffd0ff';
      ctx.fx.bloom = 0.85 + (lock > 0 ? Math.exp(-lock * 2.5) * 0.6 : 0);
    }
    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, 1 - prog(t, start, start + 0.3), env(t, SPLIT - 0.25, SPLIT + 0.25, 0.25, 0.25) * 0.9, prog(t, end - 0.25, end));
  }

  return { start, end, root, group, update, layout: () => [tA1, tA2, tB1, tB2, tB3].forEach((x) => x.layoutGradients()) };
}
