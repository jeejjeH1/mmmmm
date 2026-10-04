import { createGL, THREE } from './engine/gl.js';
import { show } from './engine/text.js';
import { clamp } from './engine/util.js';
import background from './scenes/background.js';
import hook from './scenes/hook.js';
import layer from './scenes/layer.js';
import agents from './scenes/agents.js';
import problem from './scenes/problem.js';
import verify from './scenes/verify.js';
import genlayer from './scenes/genlayer.js';
import question from './scenes/question.js';
import workflow from './scenes/workflow.js';
import trustless from './scenes/trustless.js';
import half from './scenes/half.js';
import outro from './scenes/outro.js';

const W = 1920;
const H = 1080;
const Q = new URLSearchParams(location.search);
const scale = Number(Q.get('scale') || 1);

async function init() {
  const T = await (await fetch('./timeline.json')).json();
  const canvas = document.getElementById('gl');
  const glScale = scale * Number(Q.get('gls') || 1);
  const gl = createGL(canvas, Math.round(W * glScale), Math.round(H * glScale), { msaa: Number(Q.get('msaa') ?? 0), bloom: Q.get('bloom') !== '0', fxaa: Q.get('fxaa') !== '0', bloomScale: Number(Q.get('bs') ?? 0.5) });
  if (Q.get('dom') === '0') document.getElementById('ui').style.visibility = 'hidden';
  const world = new THREE.Scene();
  world.background = new THREE.Color('#05020b');
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 500);
  camera.position.set(0, 0, 10);
  const ui = document.getElementById('ui');
  const ctx = { T, gl, world, camera, ui, W, H, fx: {} };

  const fonts = ['400 20px "Space Grotesk"', '500 20px "Space Grotesk"', '600 20px "Space Grotesk"', '700 20px "Space Grotesk"', '400 20px "JetBrains Mono"', '500 20px "JetBrains Mono"', '700 20px "JetBrains Mono"', '400 20px Inter', '600 20px Inter'];
  await Promise.all(fonts.map((f) => document.fonts.load(f)));
  await document.fonts.ready;

  const bg = background(ctx);
  const scenes = [hook, layer, agents, problem, verify, genlayer, question, workflow, trustless, half, outro].map((f) => f(ctx));
  for (const s of scenes) s.root && show(s.root, true);
  for (const s of scenes) s.layout && s.layout();
  for (const s of scenes) s.root && show(s.root, false);

  const flash = document.getElementById('flash');
  const fade = document.getElementById('fade');

  // jx/jy: sub-pixel camera jitter used when several samples are blended per frame.
  window.renderFrame = (t, jx = 0, jy = 0) => {
    ctx.fx = { time: t, bloom: 0.85, bloomRadius: 0.55, bloomThreshold: 0.12, glitch: 0, flash: 0, chroma: 0, vignette: 0.6, grain: 0.012, fade: 1, uiFlash: 0, uiFlashColor: '#ffffff', uiFade: 0 };
    ctx.bgp = { dust: 1, nebula: 1, floor: 0, floorY: -3, floorFade: 0.045, floorC1: '#dc00ff', floorC2: '#8fdcff' };
    camera.clearViewOffset();
    camera.fov = 35;
    camera.up.set(0, 1, 0);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    for (const s of scenes) {
      const active = t >= s.start - (s.pre ?? 0) && t < s.end + (s.post ?? 0);
      if (s.root) show(s.root, active);
      if (s.group) s.group.visible = active;
      if (active) s.update(t);
    }
    bg.update(t);
    if (jx || jy) {
      const v = camera.view;
      if (v && v.enabled) camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX + (jx * v.fullWidth) / W, v.offsetY + (jy * v.fullHeight) / H, v.width, v.height);
      else camera.setViewOffset(W, H, jx, jy, W, H);
      camera.updateProjectionMatrix();
    }
    flash.style.opacity = clamp(ctx.fx.uiFlash).toFixed(3);
    flash.style.background = ctx.fx.uiFlashColor;
    fade.style.opacity = clamp(ctx.fx.uiFade).toFixed(3);
    gl.render(world, camera, ctx.fx);
    return true;
  };
  window.__ready = true;
}

init();
