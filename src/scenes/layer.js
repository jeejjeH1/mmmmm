// 14–20s. "That's the missing layer in an agentic economy."
import { THREE, worldToScreen } from '../engine/gl.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { buildStack, STACK_LAYERS } from './stack.js';
import { clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

export default function layer(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.layer;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);

  const labels = el('div', 'abs', root);
  setStyle(labels, { inset: '0' });
  const stack = buildStack(ctx, labels, STACK_LAYERS);
  group.add(stack.group);
  const missing = stack.slabs.find((s) => s.L.missing);

  const qm = el('div', 'abs', root, '?');
  setStyle(qm, { left: '0', top: '0', width: '120px', height: '120px', marginLeft: '-60px', marginTop: '-60px', lineHeight: '120px', textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: '700', fontSize: '110px', color: '#ff87ff', textShadow: '0 0 30px #ff87ff, 0 0 80px #dc00ff' });

  const l1 = makeText(root, "That's the", 'h3 t-d');
  setStyle(l1.root, { left: '120px', top: '318px' });
  const l2 = makeText(root, '<x>missing layer</x>', 'h1 glow-p');
  setStyle(l2.root, { left: '112px', top: '392px' });
  const l3 = makeText(root, 'in an agentic economy.', 'h3');
  setStyle(l3.root, { left: '120px', top: '536px' });

  const v = new THREE.Vector3();
  function update(t) {
    const lt = t - start;
    // Camera orbit around the stack; view offset pushes the stack to the right.
    const dive = prog(t, 19.25, 20.0, ease.inCubic);
    const th = lerp(0.95, 0.62, prog(t, start, end, ease.inOutSine));
    const el_ = lerp(0.34, 0.27, prog(t, start, end));
    const R = lerp(lerp(15.5, 14.2, prog(t, start, 19.2, ease.outCubic)), 4.2, dive);
    camera.position.set(Math.sin(th) * Math.cos(el_) * R, Math.sin(el_) * R + noise1(t * 0.3, 4) * 0.08, Math.cos(th) * Math.cos(el_) * R);
    camera.lookAt(0, lerp(-0.15, 0, dive), 0);
    camera.setViewOffset(1920, 1080, lerp(-250, 0, dive), 0, 1920, 1080);
    camera.fov = lerp(35, 50, dive);
    camera.updateProjectionMatrix();

    ctx.bgp.floor = 0.35;
    ctx.bgp.floorY = -3.4;
    ctx.bgp.nebula = 0.8;

    stack.drop(t, start + 0.1, 0.14, 0.75);
    const pulse = 0.55 + 0.45 * Math.sin(lt * 6.0);
    missing.edges.material.opacity *= 0.55 + 0.45 * pulse;
    missing.node.userData.ghost.material.opacity = 0.05 + 0.08 * pulse;
    missing.edges.material.dashSize = 0.16;
    for (const s of stack.slabs) {
      if (s.grid) s.grid.material.uniforms.uScan.value = ((lt * 0.45 + s.y * 0.13) % 1.3) - 0.15;
    }
    stack.placeLabels(camera, 1 - prog(t, 19.1, 19.5));

    v.set(0, 0.05, 0);
    missing.node.localToWorld(v);
    const p = worldToScreen(camera, v);
    const qa = prog(t, start + 0.9, start + 1.5) * (1 - prog(t, 19.0, 19.4));
    setStyle(qm, { transform: `translate(${p.x.toFixed(1)}px, ${(p.y - 6 + Math.sin(lt * 2.4) * 6).toFixed(1)}px) scale(${(0.8 + 0.2 * pulse * qa).toFixed(3)})`, opacity: (qa * (0.6 + 0.4 * pulse)).toFixed(3) });

    animChars(l1, t, start + 0.35, { stagger: 0.025, dur: 0.6, style: 'rise', dist: 40, tout: 19.0, outStyle: 'blur' });
    animChars(l2, t, start + 0.6, { stagger: 0.04, dur: 0.8, style: 'flip', dist: 60, tout: 19.05, outStyle: 'blur' });
    animChars(l3, t, start + 1.2, { stagger: 0.02, dur: 0.6, style: 'rise', dist: 40, tout: 19.1, outStyle: 'blur' });

    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, 0.85 * (1 - prog(t, start, start + 0.45, ease.outCubic)), 0.9 * prog(t, 19.65, 20.0, ease.inQuad));
    ctx.fx.uiFlashColor = t < start + 1 ? '#ffd6ff' : '#e8f6ff';
  }

  return { start, end, root, group, update, layout: () => [l1, l2, l3].forEach((x) => x.layoutGradients()) };
}
