// 96–106s. "And that might be one of the most important problems GenLayer is trying to solve."
//           -> end card.
import { THREE } from '../engine/gl.js';
import { el, makeText, animChars, setStyle } from '../engine/text.js';
import { buildLogoHero } from './logohero.js';
import { clamp, ease, env, lerp, prog, noise1 } from '../engine/util.js';

export default function outro(ctx) {
  const { T, camera, world, ui } = ctx;
  const [start, end] = T.scenes.outro;
  const CARD = start + 4.75;
  const root = el('div', 'scene', ui);
  const group = new THREE.Group();
  world.add(group);
  const hero = buildLogoHero(ctx, { scale: 1.12, seed: 9 });
  group.add(hero.group);

  const l1 = makeText(root, 'And that might be one of the most important problems', 'h3');
  setStyle(l1.root, { left: '0', right: '0', top: '792px', textAlign: 'center', fontSize: '56px' });
  const l2 = makeText(root, '<x>GenLayer</x> is trying to solve.', 'h2 glow-p');
  setStyle(l2.root, { left: '0', right: '0', top: '866px', textAlign: 'center' });

  const word = makeText(root, '<x>GenLayer</x>', 'h0 glow-p');
  setStyle(word.root, { left: '0', right: '0', top: '672px', textAlign: 'center', fontSize: '176px' });
  const tag = makeText(root, 'A trustless layer for decisions that require judgment.', 'h4 t-d');
  setStyle(tag.root, { left: '0', right: '0', top: '880px', textAlign: 'center' });
  const line = el('div', 'abs', root);
  setStyle(line, { left: '760px', top: '862px', width: '400px', height: '2px', background: 'linear-gradient(90deg, transparent, #ff87ff, #dc00ff, transparent)', transformOrigin: '50% 50%' });

  function update(t) {
    const lt = t - start;
    const card = prog(t, CARD - 0.2, CARD + 1.0, ease.inOutCubic);
    camera.position.set(Math.sin(lt * 0.25) * 0.5, lerp(0.25, 0.6, card) + noise1(t * 0.3, 3) * 0.05, lerp(9.8, 10.6, card));
    camera.lookAt(0, lerp(0.3, 0.75, card), 0);
    camera.fov = 40;
    camera.updateProjectionMatrix();
    ctx.bgp.nebula = 1;
    ctx.bgp.dust = 1;
    ctx.bgp.floor = 0.25 * (1 - card);
    ctx.bgp.floorY = -3;

    hero.group.position.set(0, lerp(0.8, 1.85, card), 0);
    hero.group.scale.setScalar(lerp(1, 0.8, card));
    const spin = ease.outCubic(prog(t, start, start + 1.8));
    hero.update(t, {
      k: 1,
      impactT: t - (start + 0.05),
      spinY: (1 - spin) * Math.PI * 1.5 + Math.sin(lt * 0.5) * 0.25 * spin,
      tiltX: Math.sin(lt * 0.4) * 0.06,
      haloA: prog(t, start + 0.1, start + 0.8),
      rayA: prog(t, start + 0.2, start + 1.2) * (0.8 + 0.2 * Math.sin(lt * 1.3)),
      sparkA: prog(t, start + 0.3, start + 1.4),
    });

    animChars(l1, t, start + 0.8, { stagger: 0.015, dur: 0.5, style: 'rise', dist: 30, tout: CARD - 0.55, outStyle: 'blur', outStagger: 0.004 });
    animChars(l2, t, start + 1.7, { stagger: 0.025, dur: 0.6, style: 'rise', dist: 40, tout: CARD - 0.5, outStyle: 'blur' });
    for (const x of [l1, l2]) x.root.style.display = t < CARD + 0.2 ? '' : 'none';
    const on = t > CARD - 0.1;
    word.root.style.display = tag.root.style.display = line.style.display = on ? '' : 'none';
    if (on) {
      animChars(word, t, CARD + 0.35, { stagger: 0.055, dur: 0.9, style: 'blur', order: 'center' });
      animChars(tag, t, CARD + 1.2, { stagger: 0.012, dur: 0.5, style: 'rise', dist: 20 });
      line.style.transform = `scaleX(${prog(t, CARD + 0.9, CARD + 1.6, ease.outCubic).toFixed(3)})`;
    }

    ctx.fx.uiFlash = Math.max(ctx.fx.uiFlash, 1 - prog(t, start, start + 0.6, ease.outQuad));
    ctx.fx.uiFlashColor = '#ffffff';
    ctx.fx.bloom = 0.95 + Math.exp(-lt * 2) * 0.6;
    ctx.fx.bloomThreshold = 0.22;
    ctx.fx.uiFade = Math.max(ctx.fx.uiFade, prog(t, end - 1.4, end - 0.1, ease.inOutSine));
  }

  return { start, end, root, group, update, layout: () => [l1, l2, word, tag].forEach((x) => x.layoutGradients()) };
}
