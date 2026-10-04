// Ring of validator "crystals" with energy beams to a shared centre.
import { THREE } from '../engine/gl.js';
import { C } from '../engine/util.js';

export const VCOLORS = [C.green, C.blue, C.pink, '#c58cff', C.green];

export function makeValidators({ n = 5, radius = 3, colors = VCOLORS } = {}) {
  const group = new THREE.Group();
  const nodes = [];
  for (let i = 0; i < n; i++) {
    const color = new THREE.Color(colors[i % colors.length]);
    const node = new THREE.Group();
    const shell = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.46, 0)), new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(1.8), transparent: true }));
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 0), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.18), transparent: true, opacity: 0.85, depthWrite: false }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3.0), transparent: true }));
    node.add(body, shell, core);
    group.add(node);
    nodes.push({ node, shell, body, core, color, angle: (i / n) * Math.PI * 2 - Math.PI / 2 });
  }
  // Beams: one segment per validator (node -> centre), pulses travel inward.
  const pos = new Float32Array(n * 6);
  const tt = new Float32Array(n * 2);
  const cc = new Float32Array(n * 6);
  const ph = new Float32Array(n * 2);
  nodes.forEach((v, i) => {
    tt.set([0, 1], i * 2);
    cc.set([v.color.r, v.color.g, v.color.b, v.color.r, v.color.g, v.color.b], i * 6);
    ph.set([i * 0.37, i * 0.37], i * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(cc, 3));
  g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uO: { value: 1 }, uSpeed: { value: 1.2 }, uGrow: { value: 1 } },
    vertexShader: `attribute float aT; attribute vec3 aColor; attribute float aPh; varying float vT; varying vec3 vC; varying float vPh;
      void main(){ vT = aT; vC = aColor; vPh = aPh; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uO, uSpeed, uGrow; varying float vT; varying vec3 vC; varying float vPh;
      void main(){
        if (vT > uGrow) discard;
        float p = 0.0;
        for (int k = 0; k < 3; k++) { float h = fract(uTime * uSpeed + vPh + float(k) / 3.0); float d = vT - h; p += exp(-d*d*260.0); }
        gl_FragColor = vec4(vC * (1.2 + p * 3.0), (0.28 + p * 0.8) * uO);
      }`,
  });
  const beams = new THREE.LineSegments(g, m);
  beams.frustumCulled = false;
  group.add(beams);

  const centre = new THREE.Vector3();
  function layout(t, { radius: r = radius, spin = 0, bob = 0.12, enter = [], scale = 1 } = {}) {
    nodes.forEach((v, i) => {
      const e = enter[i] ?? 1;
      const a = v.angle + spin;
      const rr = r * (1 + (1 - e) * 2.2);
      v.node.position.set(Math.cos(a) * rr, Math.sin(a) * rr + Math.sin(t * 1.6 + i) * bob, (1 - e) * 6);
      v.node.rotation.set(t * 0.5 + i, t * 0.7 + i * 2, 0);
      v.node.scale.setScalar(Math.max(0.001, e) * scale);
      v.shell.material.opacity = e;
      v.core.material.opacity = e;
      v.body.material.opacity = 0.85 * e;
      pos.set([v.node.position.x, v.node.position.y, v.node.position.z, centre.x, centre.y, centre.z], i * 6);
    });
    g.attributes.position.needsUpdate = true;
    m.uniforms.uTime.value = t;
  }
  return { group, nodes, beams, beamMat: m, layout };
}
