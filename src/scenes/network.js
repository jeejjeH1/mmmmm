// A large 3D network of agents: clustered nodes, nearest-neighbour links and
// "highways" between clusters, with data pulses running along every link.
import { THREE } from '../engine/gl.js';
import { C, mulberry32 } from '../engine/util.js';

export function buildNetwork({ seed = 5, clusters = 46, perCluster = 48, radius = 13, spread = 1.7, colors = [C.blue, C.blue, C.blue, C.purple, C.pink, C.green] } = {}) {
  const r = mulberry32(seed);
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const centers = [];
  for (let i = 0; i < clusters; i++) {
    // Points in a flattened sphere (a galaxy-ish disc with some thickness).
    const th = r() * Math.PI * 2;
    const rr = radius * Math.pow(r(), 0.6);
    centers.push(new THREE.Vector3(Math.cos(th) * rr, gauss() * radius * 0.28, Math.sin(th) * rr));
  }
  const nodes = [];
  const nodeCluster = [];
  centers.forEach((c, ci) => {
    for (let k = 0; k < perCluster; k++) {
      nodes.push(new THREE.Vector3(c.x + gauss() * spread, c.y + gauss() * spread * 0.8, c.z + gauss() * spread));
      nodeCluster.push(ci);
    }
  });
  const N = nodes.length;

  // Points
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const sd = new Float32Array(N);
  const pal = colors.map((c) => new THREE.Color(c));
  nodes.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3);
    const c = pal[Math.floor(r() * pal.length)];
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 2.2 + Math.pow(r(), 3) * 5;
    sd[i] = r() * 100;
  });
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  pg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const pm = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uReveal: { value: 1 }, uGlitch: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uTime, uReveal, uGlitch; varying vec3 vColor; varying float vA;
      void main(){
        vec3 p = position;
        p += vec3(sin(uTime*0.4+aSeed), cos(uTime*0.33+aSeed*1.3), sin(uTime*0.37+aSeed*0.7)) * 0.06;
        float gl = step(0.985 - uGlitch*0.2, fract(sin(aSeed*91.7 + floor(uTime*24.0))*437.5));
        p.x += gl * uGlitch * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.6 + 0.4 * sin(uTime * (1.5 + fract(aSeed) * 2.5) + aSeed);
        gl_PointSize = aSize * (24.0 / -mv.z) * (0.7 + 0.5 * tw) + 1.2;
        vColor = aColor;
        vA = smoothstep(0.0, 0.08, uReveal - fract(aSeed * 0.0137)) * (0.55 + 0.45 * tw);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vColor; varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r2 = dot(d,d); float a = exp(-r2*18.0)*0.7 + exp(-r2*90.0)*0.9; gl_FragColor = vec4(vColor*1.5, a*vA*uOpacity); }`,
  });
  const points = new THREE.Points(pg, pm);
  points.frustumCulled = false;

  // Edges: 2 nearest neighbours inside the cluster + some long "highways".
  const edges = [];
  const seen = new Set();
  const addEdge = (a, b, kind) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (a === b || seen.has(k)) return;
    seen.add(k);
    edges.push([a, b, kind]);
  };
  for (let ci = 0; ci < clusters; ci++) {
    const ids = [];
    for (let i = 0; i < N; i++) if (nodeCluster[i] === ci) ids.push(i);
    for (const i of ids) {
      const d = ids.filter((j) => j !== i).map((j) => [j, nodes[i].distanceToSquared(nodes[j])]).sort((a, b) => a[1] - b[1]);
      addEdge(i, d[0][0], 0);
      addEdge(i, d[1][0], 0);
      if (r() < 0.25) addEdge(i, d[2][0], 0);
    }
  }
  for (let ci = 0; ci < clusters; ci++) {
    const d = centers.map((c, j) => [j, centers[ci].distanceToSquared(c)]).filter((x) => x[0] !== ci).sort((a, b) => a[1] - b[1]);
    for (let m = 0; m < 3; m++) {
      const cj = d[m][0];
      const a = ci * perCluster + Math.floor(r() * perCluster);
      const b = cj * perCluster + Math.floor(r() * perCluster);
      addEdge(a, b, 1);
    }
  }
  const E = edges.length;
  const lp = new Float32Array(E * 6);
  const lt = new Float32Array(E * 2);
  const lph = new Float32Array(E * 2);
  const lk = new Float32Array(E * 2);
  const lc = new Float32Array(E * 6);
  edges.forEach(([a, b, kind], e) => {
    lp.set([nodes[a].x, nodes[a].y, nodes[a].z, nodes[b].x, nodes[b].y, nodes[b].z], e * 6);
    lt.set([0, 1], e * 2);
    const ph = r();
    lph.set([ph, ph], e * 2);
    lk.set([kind, kind], e * 2);
    const c = kind ? pal[Math.floor(r() * pal.length)] : new THREE.Color(C.blue).lerp(new THREE.Color(C.purple), r() * 0.7);
    lc.set([c.r, c.g, c.b, c.r, c.g, c.b], e * 6);
  });
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('aT', new THREE.BufferAttribute(lt, 1));
  lg.setAttribute('aPh', new THREE.BufferAttribute(lph, 1));
  lg.setAttribute('aK', new THREE.BufferAttribute(lk, 1));
  lg.setAttribute('aColor', new THREE.BufferAttribute(lc, 3));
  const lm = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uReveal: { value: 1 }, uPulse: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aT; attribute float aPh; attribute float aK; attribute vec3 aColor;
      varying float vT; varying float vPh; varying float vK; varying vec3 vColor; varying float vFade;
      void main(){ vT = aT; vPh = aPh; vK = aK; vColor = aColor; vec4 mv = modelViewMatrix*vec4(position,1.0); vFade = smoothstep(60.0, 8.0, -mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uReveal, uPulse; varying float vT; varying float vPh; varying float vK; varying vec3 vColor; varying float vFade;
      void main(){
        float sp = vK > 0.5 ? 0.55 : 0.9;
        float head = fract(uTime * sp + vPh * 7.0);
        float d = vT - head;
        float pulse = exp(-d*d*(vK > 0.5 ? 220.0 : 90.0)) * uPulse;
        float base = vK > 0.5 ? 0.05 : 0.075;
        float show = smoothstep(0.0, 0.1, uReveal - fract(vPh * 13.1));
        gl_FragColor = vec4(vColor * (1.0 + pulse * 2.5), (base + pulse * 0.6) * uOpacity * vFade * show);
      }`,
  });
  const lines = new THREE.LineSegments(lg, lm);
  lines.frustumCulled = false;

  const group = new THREE.Group();
  group.add(lines, points);
  function update(t, { opacity = 1, reveal = 1, glitch = 0, pulse = 1 } = {}) {
    pm.uniforms.uTime.value = t;
    pm.uniforms.uOpacity.value = opacity;
    pm.uniforms.uReveal.value = reveal;
    pm.uniforms.uGlitch.value = glitch;
    lm.uniforms.uTime.value = t;
    lm.uniforms.uOpacity.value = opacity;
    lm.uniforms.uReveal.value = reveal;
    lm.uniforms.uPulse.value = pulse;
  }
  return { group, nodes, update, N, E };
}
