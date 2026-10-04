import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { LOGO } from '../logo.js';
import { C } from './util.js';

export const col = (hex) => new THREE.Color(hex);

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1920, 1080) },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.035 },
    uChroma: { value: 0.0 },
    uGlitch: { value: 0.0 },
    uFlash: { value: 0.0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uFade: { value: 1.0 },
    uExposure: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes;
    uniform float uVignette, uGrain, uChroma, uGlitch, uFlash, uFade, uExposure; uniform vec3 uFlashColor;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 aces(vec3 color){
      const mat3 I = mat3(vec3(0.59719,0.07600,0.02840), vec3(0.35458,0.90834,0.13383), vec3(0.04823,0.01566,0.83777));
      const mat3 O = mat3(vec3(1.60475,-0.10208,-0.00327), vec3(-0.53108,1.10813,-0.07276), vec3(-0.07367,-0.00605,1.07602));
      color *= uExposure / 0.6; color = I * color; color = RRTAndODTFit(color); color = O * color; return clamp(color, 0.0, 1.0);
    }
    vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
    float lum(vec3 c){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return l / (1.0 + l); }
    vec3 T(vec2 uv){ return texture2D(tDiffuse, uv).rgb; }
    // Cheap FXAA (Lottes' simple variant): 9 taps, no edge search.
    vec3 aa(vec2 uv){
      vec2 px = 1.0 / uRes;
      vec3 cM = T(uv);
      vec3 cNW = T(uv + vec2(-1.0,-1.0)*px), cNE = T(uv + vec2(1.0,-1.0)*px), cSW = T(uv + vec2(-1.0,1.0)*px), cSE = T(uv + vec2(1.0,1.0)*px);
      float lM = lum(cM), lNW = lum(cNW), lNE = lum(cNE), lSW = lum(cSW), lSE = lum(cSE);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      if (lMax - lMin < 0.04) return cM;
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.25 * 0.125, 1.0/128.0);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, vec2(-6.0), vec2(6.0)) * px;
      vec3 a = 0.5 * (T(uv + dir * (1.0/3.0 - 0.5)) + T(uv + dir * (2.0/3.0 - 0.5)));
      vec3 b = a * 0.5 + 0.25 * (T(uv + dir * -0.5) + T(uv + dir * 0.5));
      float lB = lum(b);
      return (lB < lMin || lB > lMax) ? a : b;
    }
    void main(){
      vec2 uv = vUv;
      float fr = floor(uTime * 30.0);
      if (uGlitch > 0.0) {
        float band = floor(uv.y * 24.0);
        float r = h(vec2(band, fr));
        if (r < uGlitch * 0.6) uv.x += (h(vec2(band + 3.1, fr)) - 0.5) * 0.12 * uGlitch;
        float band2 = floor(uv.y * 90.0);
        if (h(vec2(band2, fr + 7.0)) < uGlitch * 0.25) uv.x += (h(vec2(band2, fr)) - 0.5) * 0.04;
      }
      vec2 d = (uv - 0.5);
      float ca = uChroma + uGlitch * 0.008;
      vec3 c;
      if (ca > 0.0004) {
        c.r = T(uv + d * ca * 2.0 + vec2(uGlitch*0.005,0.0)).r;
        c.g = T(uv).g;
        c.b = T(uv - d * ca * 2.0 - vec2(uGlitch*0.005,0.0)).b;
      } else {
        c = aa(uv);
      }
      float v = smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.82)));
      c *= mix(1.0, v, uVignette);
      c = mix(c, uFlashColor * 2.0, clamp(uFlash, 0.0, 1.0));
      c = srgb(aces(max(c, 0.0)));
      float g = h(vUv * uRes + fract(uTime * 13.37) * 100.0) - 0.5;
      c += g * uGrain;
      c *= uFade;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
};

export function createGL(canvas, W, H, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: opts.msaa ?? 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.55, 0.12);
  // Bloom mips at half the usual resolution: it is a soft glow anyway, and 4x cheaper.
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSetSize(Math.round(w * (opts.bloomScale ?? 0.5)), Math.round(h * (opts.bloomScale ?? 0.5)));
  const final = new ShaderPass(FinalShader);
  final.uniforms.uRes.value.set(W, H);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(final);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(buildEnvScene(), 0.02).texture;

  function render(scene, camera, fx = {}) {
    renderPass.scene = scene;
    renderPass.camera = camera;
    bloom.strength = fx.bloom ?? 0.9;
    bloom.radius = fx.bloomRadius ?? 0.55;
    bloom.threshold = fx.bloomThreshold ?? 0.12;
    const u = final.uniforms;
    u.uTime.value = fx.time ?? 0;
    u.uVignette.value = fx.vignette ?? 0.55;
    u.uGrain.value = fx.grain ?? 0.03;
    u.uChroma.value = fx.chroma ?? 0;
    u.uGlitch.value = fx.glitch ?? 0;
    u.uFlash.value = fx.flash ?? 0;
    u.uFlashColor.value.set(fx.flashColor ?? '#ffffff');
    u.uFade.value = fx.fade ?? 1;
    u.uExposure.value = fx.exposure ?? 1;
    bloom.enabled = opts.bloom !== false;
    composer.render();
  }
  window.__sync = () => {
    const g = renderer.getContext();
    const px = new Uint8Array(4);
    g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  };

  return { renderer, composer, render, envMap, W, H };
}

// A dark "studio" whose light panels are the brand colours, so metals pick up
// pink/purple/blue reflections.
function buildEnvScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x020106);
  const panel = (color, intensity, w, h, pos, look) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(...pos);
    p.lookAt(...look);
    s.add(p);
  };
  panel(C.purple, 6, 6, 10, [-8, 2, 3], [0, 0, 0]);
  panel(C.pink, 5, 5, 6, [7, 4, 4], [0, 0, 0]);
  panel(C.blue, 4, 8, 3, [0, 8, -4], [0, 0, 0]);
  panel(C.green, 2.5, 4, 3, [5, -5, -6], [0, 0, 0]);
  panel('#ffffff', 2.6, 1.2, 12, [5, 0, 8], [0, 0, 0]);
  panel(C.blue, 2.2, 12, 1, [-2, -6, 6], [0, 0, 0]);
  return s;
}

// ---------- Logo ----------
const toShape = (pts) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};

export const LOGO_SCALE = 1 / 170; // logo becomes ~2 units tall

export function logoShapes() {
  return {
    left: toShape(LOGO.left),
    right: toShape(LOGO.right),
    kite: toShape(LOGO.kite),
  };
}

// Returns a group with three separately animatable extruded pieces.
export function makeLogo3D(envMap, opts = {}) {
  const depth = opts.depth ?? 46;
  const shapes = logoShapes();
  const group = new THREE.Group();
  const pieces = {};
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(opts.color ?? '#140822'),
    metalness: 0.7,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 0.8,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [180, 720],
    envMap,
    envMapIntensity: opts.envIntensity ?? 1.6,
    emissive: new THREE.Color(C.purple),
    emissiveIntensity: opts.emissive ?? 0.06,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(C.pink).multiplyScalar(1.5), transparent: true, opacity: 1 });
  for (const k of ['left', 'right', 'kite']) {
    const geo = new THREE.ExtrudeGeometry(shapes[k], {
      depth,
      bevelEnabled: true,
      bevelThickness: 5,
      bevelSize: 3.2,
      bevelSegments: 4,
      curveSegments: 1,
    });
    geo.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geo, bodyMat);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat);
    const piece = new THREE.Group();
    piece.add(mesh);
    piece.add(edges);
    piece.scale.setScalar(LOGO_SCALE);
    group.add(piece);
    pieces[k] = piece;
  }
  return { group, pieces, bodyMat, edgeMat };
}

// ---------- Particles ----------
export function makeParticles({ count, seed = 1, spread = [20, 12, 20], center = [0, 0, 0], colors = [C.pink, C.purple, C.blue, C.green], size = [2, 6], drift = 0.3, opacity = 1 }) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos = new Float32Array(count * 3);
  const colArr = new Float32Array(count * 3);
  const sz = new Float32Array(count);
  const sd = new Float32Array(count);
  const cs = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (r() - 0.5) * spread[0];
    pos[i * 3 + 1] = center[1] + (r() - 0.5) * spread[1];
    pos[i * 3 + 2] = center[2] + (r() - 0.5) * spread[2];
    const c = cs[Math.floor(r() * cs.length)];
    colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
    sz[i] = size[0] + Math.pow(r(), 3) * (size[1] - size[0]);
    sd[i] = r() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDrift: { value: drift }, uOpacity: { value: opacity }, uScale: { value: 1 }, uBoost: { value: 1.6 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uTime, uDrift, uScale;
      varying vec3 vColor; varying float vTw;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*0.31 + aSeed) * uDrift;
        p.y += sin(uTime*0.23 + aSeed*1.7) * uDrift + uTime * 0.02 * (fract(aSeed)-0.3);
        p.z += cos(uTime*0.27 + aSeed*0.7) * uDrift;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale * (10.0 / -mv.z);
        vColor = aColor;
        vTw = 0.65 + 0.35 * sin(uTime * 2.0 + aSeed * 3.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity, uBoost; varying vec3 vColor; varying float vTw;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float r = length(d);
        float a = exp(-r*r*18.0) * 1.0 + exp(-r*r*120.0) * 0.8;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * uBoost * vTw, a * uOpacity);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

// Infinite-looking neon grid floor.
export function makeGridFloor({ size = 200, y = -2, color = C.purple, color2 = C.blue, opacity = 0.5 } = {}) {
  const g = new THREE.PlaneGeometry(size, size, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uC1: { value: new THREE.Color(color) },
      uC2: { value: new THREE.Color(color2) },
      uOpacity: { value: opacity },
      uScroll: { value: 0 },
      uCell: { value: 1.0 },
      uCenter: { value: new THREE.Vector2() },
      uFadeK: { value: 0.045 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uC1, uC2; uniform float uOpacity, uScroll, uCell, uFadeK; uniform vec2 uCenter; varying vec3 vW;
      float gridLine(vec2 p, float w){ vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
      void main(){
        vec2 p = vW.xz / uCell + vec2(0.0, uScroll);
        float l1 = gridLine(p, 1.0);
        float l2 = gridLine(p / 5.0, 1.4);
        float dist = length(vW.xz - uCenter);
        float fade = exp(-dist * uFadeK);
        vec3 c = mix(uC2, uC1, smoothstep(0.0, 40.0, dist));
        float a = (l1 * 0.35 + l2 * 0.8) * fade * uOpacity;
        gl_FragColor = vec4(c * a * 1.5, a);
      }`,
  });
  m.extensions = { derivatives: true };
  const mesh = new THREE.Mesh(g, m);
  mesh.position.y = y;
  return mesh;
}

export { THREE };

// One-shot particle burst. update(t) with t = seconds since the burst.
export function makeBurst({ count = 400, seed = 3, colors = [C.green, C.blue, '#ffffff'], speed = [2, 9], size = [2, 7], life = 1.6, gravity = -0.6, spread3d = true }) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const vel = new Float32Array(count * 3);
  const colArr = new Float32Array(count * 3);
  const sz = new Float32Array(count);
  const lf = new Float32Array(count);
  const cs = colors.map((c) => new THREE.Color(c));
  for (let i = 0; i < count; i++) {
    const th = r() * Math.PI * 2;
    const ph = spread3d ? Math.acos(2 * r() - 1) : Math.PI / 2 + (r() - 0.5) * 0.5;
    const v = speed[0] + Math.pow(r(), 1.5) * (speed[1] - speed[0]);
    vel[i * 3] = Math.sin(ph) * Math.cos(th) * v;
    vel[i * 3 + 1] = Math.cos(ph) * v * (spread3d ? 1 : 0.4);
    vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * v;
    const c = cs[Math.floor(r() * cs.length)];
    colArr.set([c.r, c.g, c.b], i * 3);
    sz[i] = size[0] + Math.pow(r(), 2) * (size[1] - size[0]);
    lf[i] = life * (0.5 + r() * 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aLife', new THREE.BufferAttribute(lf, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: -1 }, uG: { value: gravity }, uBoost: { value: 2.2 } },
    vertexShader: /* glsl */ `
      attribute vec3 aVel; attribute vec3 aColor; attribute float aSize; attribute float aLife;
      uniform float uT, uG; varying vec3 vColor; varying float vA;
      void main(){
        float t = max(uT, 0.0);
        float k = 1.0 - exp(-t * 3.2);
        vec3 p = aVel * k * 0.45 + vec3(0.0, uG * t * t * 0.5, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float life = clamp(t / aLife, 0.0, 1.0);
        vA = (uT < 0.0) ? 0.0 : (1.0 - life) * (1.0 - life);
        gl_PointSize = aSize * (1.0 - life * 0.5) * (10.0 / -mv.z);
        vColor = aColor;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uBoost; varying vec3 vColor; varying float vA;
      void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d)*20.0); if (vA*a < 0.003) discard; gl_FragColor = vec4(vColor*uBoost, a*vA); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.update = (dt) => (m.uniforms.uT.value = dt);
  return pts;
}

// Expanding shockwave ring. update(t) with t = seconds since start.
export function makeShock({ color = C.green, radius = 3, life = 0.9, width = 0.06 } = {}) {
  const g = new THREE.RingGeometry(1 - width, 1, 128, 1);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.update = (dt) => {
    const k = Math.min(Math.max(dt / life, 0), 1);
    const e = 1 - Math.pow(1 - k, 3);
    mesh.visible = dt >= 0 && k < 1;
    mesh.scale.setScalar(0.05 + e * radius);
    m.opacity = (1 - k) * (1 - k);
  };
  return mesh;
}

// Screen pixel (1920x1080 space) -> world point on plane z = zPlane.
export function screenToWorld(camera, x, y, zPlane = 0) {
  camera.updateMatrixWorld();
  const ndc = new THREE.Vector3((x / 1920) * 2 - 1, -(y / 1080) * 2 + 1, 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const d = (zPlane - camera.position.z) / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(d));
}

// World point -> screen pixel (1920x1080 space).
export function worldToScreen(camera, v) {
  camera.updateMatrixWorld();
  const p = v.clone().project(camera);
  return { x: (p.x + 1) * 960, y: (1 - p.y) * 540, z: p.z };
}
