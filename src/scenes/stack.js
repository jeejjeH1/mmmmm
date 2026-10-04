// The "layer stack" of the agentic economy, with one missing layer.
// Used by the "missing layer" scene and again when GenLayer fills the gap.
import { THREE, worldToScreen } from '../engine/gl.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { el, setStyle } from '../engine/text.js';
import { C, clamp, ease, lerp } from '../engine/util.js';

const W = 4.8, Hh = 0.28, D = 3.0, GAP = 1.0;

function gridMat(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color(color) }, uO: { value: 1 }, uT: { value: 0 }, uScan: { value: -1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC; uniform float uO, uT, uScan; varying vec2 vUv;
      void main(){
        vec2 p = vUv * vec2(${(W * 4).toFixed(1)}, ${(D * 4).toFixed(1)});
        vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
        float l = 1.0 - min(min(g.x, g.y), 1.0);
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.0, 0.08, min(e.x, e.y));
        float scan = uScan >= 0.0 ? exp(-pow((vUv.x - uScan) * 9.0, 2.0)) : 0.0;
        float a = (l * 0.28 * edge + scan * 0.55) * uO;
        gl_FragColor = vec4(uC * (1.1 + scan * 1.6), a);
      }`,
  });
}

export function buildStack(ctx, root, layers) {
  const group = new THREE.Group();
  const slabs = [];
  const n = layers.length;
  layers.forEach((L, i) => {
    const y = ((n - 1) / 2 - i) * GAP;
    const node = new THREE.Group();
    node.position.y = y;
    group.add(node);
    const color = new THREE.Color(L.color);
    let body = null;
    let edges;
    let grid = null;
    if (!L.missing) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#120822'),
        metalness: 0.2,
        roughness: 0.42,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        envMap: ctx.gl.envMap,
        envMapIntensity: 0.25,
        emissive: color,
        emissiveIntensity: 0.04,
        transparent: true,
        opacity: 0.92,
      });
      body = new THREE.Mesh(new RoundedBoxGeometry(W, Hh, D, 3, 0.08), mat);
      node.add(body);
      edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.01, Hh + 0.01, D + 0.01)), new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(1.3), transparent: true }));
      grid = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, D - 0.1), gridMat(L.color));
      grid.rotation.x = -Math.PI / 2;
      grid.position.y = Hh / 2 + 0.003;
      node.add(grid);
    } else {
      const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, Hh, D));
      edges = new THREE.LineSegments(eg, new THREE.LineDashedMaterial({ color: color.clone().multiplyScalar(2.2), dashSize: 0.16, gapSize: 0.11, transparent: true }));
      edges.computeLineDistances();
      const ghost = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.5), transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }));
      node.add(ghost);
      node.userData.ghost = ghost;
    }
    node.add(edges);
    const label = el('div', 'abs stack-label', root);
    label.innerHTML = L.missing
      ? `<span class="dot" style="background:${L.color};box-shadow:0 0 12px ${L.color}"></span><span>${L.name}</span>`
      : `<span class="dot" style="background:${L.color};box-shadow:0 0 12px ${L.color}"></span><span>${L.name}</span>`;
    setStyle(label, { color: L.missing ? L.color : 'rgba(246,241,255,0.85)' });
    slabs.push({ node, body, edges, grid, label, y, L });
  });

  // Labels hang off the right-front corner of each slab.
  const corner = new THREE.Vector3();
  function placeLabels(camera, alpha = 1, cz = -1) {
    group.updateMatrixWorld(true);
    for (const s of slabs) {
      corner.set(W / 2, 0, (cz * D) / 2);
      s.node.localToWorld(corner);
      const p = worldToScreen(camera, corner);
      const a = (s.node.userData.alpha ?? 1) * alpha;
      setStyle(s.label, { transform: `translate(${(p.x + 22).toFixed(1)}px, ${(p.y - 19).toFixed(1)}px)`, opacity: clamp(a).toFixed(3), display: a > 0.01 ? 'flex' : 'none' });
    }
  }

  // Slabs drop in from above, one after another.
  function drop(t, t0, stagger = 0.16, dur = 0.7) {
    slabs.forEach((s, i) => {
      const k = clamp((t - t0 - i * stagger) / dur);
      const e = ease.outBack(k, 1.2);
      s.node.position.y = s.y + (1 - e) * 4.5;
      s.node.userData.alpha = clamp(k * 2.5);
      if (s.body) s.body.material.opacity = 0.92 * clamp(k * 2.5);
      s.edges.material.opacity = clamp(k * 2.5);
      if (s.grid) s.grid.material.uniforms.uO.value = clamp(k * 2);
    });
  }

  return { group, slabs, placeLabels, drop, W, D, Hh, GAP };
}

export const STACK_LAYERS = [
  { name: 'AI AGENTS', color: C.blue },
  { name: 'TOOLS & DATA', color: '#b7a6ff' },
  { name: 'MISSING: JUDGMENT', color: C.pink, missing: true },
  { name: 'PAYMENTS', color: C.purple },
  { name: 'SETTLEMENT', color: C.purple },
];
