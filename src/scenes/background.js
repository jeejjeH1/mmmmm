// Persistent atmosphere: infinite dust field around the camera, distant nebula
// glows that stay "at infinity", and an optional neon grid floor.
import { THREE, makeGridFloor } from '../engine/gl.js';
import { C } from '../engine/util.js';

function glowTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const softTex = glowTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [0.6, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);

export default function background(ctx) {
  const { world, camera } = ctx;
  const group = new THREE.Group();
  world.add(group);

  // Dust: wraps around the camera so it is infinite in every direction.
  const N = 2600;
  const box = new THREE.Vector3(60, 36, 60);
  let s = 7;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(N * 3);
  const colr = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const seed = new Float32Array(N);
  const pal = [C.pink, C.purple, C.blue, C.green, '#ffffff', C.blue].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    pos[i * 3] = r() * box.x;
    pos[i * 3 + 1] = r() * box.y;
    pos[i * 3 + 2] = r() * box.z;
    const c = pal[Math.floor(r() * pal.length)];
    colr.set([c.r, c.g, c.b], i * 3);
    size[i] = 0.6 + Math.pow(r(), 4) * 4.0;
    seed[i] = r() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(colr, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uOpacity: { value: 1 }, uStretch: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uTime; uniform vec3 uCam; uniform vec3 uBox;
      varying vec3 vColor; varying float vA;
      void main(){
        vec3 p = position + vec3(sin(uTime*0.13+aSeed)*0.6, uTime*0.05*(fract(aSeed*3.1)-0.4), cos(uTime*0.11+aSeed)*0.6);
        p = mod(p - uCam + uBox*0.5, uBox) - uBox*0.5 + uCam;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = aSize * (60.0 / max(d, 0.5));
        vColor = aColor;
        float edge = 1.0 - smoothstep(uBox.z*0.32, uBox.z*0.5, length(p - uCam));
        vA = edge * (0.55 + 0.45 * sin(uTime*1.7 + aSeed*5.0)) * smoothstep(0.3, 2.0, d);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity; varying vec3 vColor; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float r2 = dot(d,d);
        float a = exp(-r2*22.0);
        gl_FragColor = vec4(vColor * 1.4, a * vA * uOpacity);
      }`,
  });
  const dust = new THREE.Points(g, dustMat);
  dust.frustumCulled = false;
  group.add(dust);

  // Nebula glows live "at infinity": fixed world directions projected each frame
  // and drawn as gaussians in the final pass (far cheaper than big sprites).
  const NEB = [
    { dir: [-0.45, 0.16, -1], c: C.purple, a: 0.16, r: 0.55 },
    { dir: [0.5, -0.2, -1], c: C.pink, a: 0.07, r: 0.45 },
    { dir: [0.25, 0.35, -1], c: C.blue, a: 0.06, r: 0.5 },
    { dir: [0.0, -0.4, -1], c: C.purple, a: 0.07, r: 0.45 },
    { dir: [-0.7, -0.3, -1], c: C.green, a: 0.035, r: 0.4 },
  ].map((n) => ({ ...n, v: new THREE.Vector3(...n.dir).normalize(), col: new THREE.Color(n.c) }));
  const tmp = new THREE.Vector3();
  // Drawn first, behind everything: base colour + gaussian nebula blobs.
  const skyMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uBase: { value: new THREE.Color('#05020b') },
      uAsp: { value: 1920 / 1080 },
      uNebPos: { value: Array.from({ length: 5 }, () => new THREE.Vector3()) },
      uNebCol: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase; uniform float uAsp; uniform vec3 uNebPos[5]; uniform vec4 uNebCol[5]; varying vec2 vUv;
      void main(){
        vec3 c = uBase;
        for (int i = 0; i < 5; i++) {
          vec2 q = (vUv - uNebPos[i].xy) * vec2(uAsp, 1.0);
          c += uNebCol[i].rgb * uNebCol[i].a * exp(-dot(q, q) / (uNebPos[i].z * uNebPos[i].z));
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
  skyQuad.frustumCulled = false;
  skyQuad.renderOrder = -1000;
  group.add(skyQuad);

  const floor = makeGridFloor({ size: 400, y: -3, opacity: 0.0 });
  group.add(floor);

  const Q = new URLSearchParams(location.search);
  function update(t) {
    const p = ctx.bgp;
    if (Q.get('noneb')) p.nebula = 0;
    if (Q.get('nofloor')) p.floor = 0;
    if (Q.get('nodust')) p.dust = 0;
    dust.visible = p.dust > 0.001;
    dustMat.uniforms.uTime.value = t;
    dustMat.uniforms.uCam.value.copy(camera.position);
    dustMat.uniforms.uOpacity.value = p.dust;
    camera.updateMatrixWorld();
    NEB.forEach((n, i) => {
      tmp.copy(n.v);
      tmp.x += Math.sin(t * 0.05 + i) * 0.04;
      tmp.y += Math.cos(t * 0.04 + i * 2) * 0.03;
      tmp.add(camera.position);
      const pr = tmp.project(camera);
      const behind = pr.z > 1 ? 0 : 1;
      skyMat.uniforms.uNebPos.value[i].set((pr.x + 1) / 2, (pr.y + 1) / 2, n.r * (35 / camera.fov));
      skyMat.uniforms.uNebCol.value[i].set(n.col.r, n.col.g, n.col.b, n.a * p.nebula * behind * 1.6);
    });
    floor.visible = p.floor > 0.001;
    floor.material.uniforms.uOpacity.value = p.floor;
    floor.position.set(camera.position.x, p.floorY, camera.position.z);
    floor.material.uniforms.uCenter.value.set(camera.position.x, camera.position.z);
    floor.material.uniforms.uFadeK.value = p.floorFade;
    floor.material.uniforms.uC1.value.set(p.floorC1);
    floor.material.uniforms.uC2.value.set(p.floorC2);
  }

  return { update, group };
}
