// The hero 3D GenLayer mark: three extruded pieces that fly in and lock,
// with a halo ring, light rays, orbiting sparks, impact shockwaves.
import { THREE, makeLogo3D, makeBurst, makeShock, makeParticles } from '../engine/gl.js';
import { C, clamp, ease, lerp } from '../engine/util.js';

function raysTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + Math.sin(i * 7.3) * 0.08;
    const w = 0.02 + (Math.sin(i * 3.7) * 0.5 + 0.5) * 0.05;
    const len = 180 + (Math.sin(i * 5.1) * 0.5 + 0.5) * 76;
    const grd = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    grd.addColorStop(0, 'rgba(255,255,255,0.0)');
    grd.addColorStop(0.15, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len);
    g.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let RAYS = null;

export function buildLogoHero(ctx, { scale = 1.4, seed = 1 } = {}) {
  const group = new THREE.Group();
  const logo = makeLogo3D(ctx.gl.envMap, { envIntensity: 0.85, emissive: 0.03, color: '#0d0618' });
  logo.group.scale.setScalar(scale);
  group.add(logo.group);

  const key = new THREE.PointLight(new THREE.Color(C.pink), 4, 30, 1.6);
  key.position.set(3, 2.5, 4);
  const fill = new THREE.PointLight(new THREE.Color(C.blue), 3.5, 30, 1.6);
  fill.position.set(-4, -1, 3);
  const rim = new THREE.PointLight(new THREE.Color(C.purple), 6, 30, 1.6);
  rim.position.set(0, 3, -3);
  group.add(key, fill, rim, new THREE.AmbientLight(0x6040a0, 0.25));

  // Halo + rays behind the mark
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.012, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.purple).multiplyScalar(2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const halo2 = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.006, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.blue).multiplyScalar(2.0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.z = halo2.position.z = -0.9;
  if (!RAYS) RAYS = raysTexture();
  const rays = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: RAYS, color: new THREE.Color(C.purple), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  rays.position.z = -1.2;
  // Dark "portal" disc so the mark reads against the glow.
  const pc = document.createElement('canvas');
  pc.width = pc.height = 256;
  const pg = pc.getContext('2d');
  const grd = pg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(4,1,10,0.95)');
  grd.addColorStop(0.75, 'rgba(8,2,18,0.8)');
  grd.addColorStop(0.97, 'rgba(30,6,50,0.5)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  pg.fillStyle = grd;
  pg.fillRect(0, 0, 256, 256);
  const ptex = new THREE.CanvasTexture(pc);
  const portal = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshBasicMaterial({ map: ptex, transparent: true, depthWrite: false }));
  portal.position.z = -1.0;
  group.add(rays, portal, halo, halo2);

  const sparks = makeParticles({ count: 420, seed: 77 + seed, spread: [9, 6, 6], colors: [C.pink, C.purple, C.blue, '#ffffff'], size: [1.5, 5], drift: 0.25 });
  group.add(sparks);
  const burst = makeBurst({ count: 600, seed: 13 + seed, colors: [C.pink, C.purple, '#ffffff', C.blue], speed: [4, 20], size: [3, 12], life: 2.0, gravity: -0.3 });
  const shock1 = makeShock({ color: C.pink, radius: 7, life: 1.1, width: 0.025 });
  const shock2 = makeShock({ color: C.purple, radius: 11, life: 1.5, width: 0.015 });
  const shock3 = makeShock({ color: C.blue, radius: 4.5, life: 0.8, width: 0.04 });
  group.add(burst, shock1, shock2, shock3);

  const P = logo.pieces;
  const from = {
    left: { p: [-7, 2.5, -6], r: [0.3, 1.6, 0.6] },
    right: { p: [7, -2.5, -6], r: [-0.3, -1.6, -0.6] },
    kite: { p: [0, -5, 7], r: [2.4, 0.6, 0] },
  };

  // k: 0..1 assembly progress (1 = locked). impactT: seconds since lock.
  function update(t, { k = 1, impactT = -1, spinY = 0, tiltX = 0, haloA = 1, rayA = 1, sparkA = 1, edge = 1, sweep = 0 } = {}) {
    for (const name of ['left', 'right', 'kite']) {
      const f = from[name];
      const e = ease.inCubic(clamp(k));
      const piece = P[name];
      const inv = 1 - e;
      piece.position.set(f.p[0] * inv, f.p[1] * inv, f.p[2] * inv);
      piece.rotation.set(f.r[0] * inv, f.r[1] * inv, f.r[2] * inv);
    }
    // Recoil after the lock.
    const rec = impactT >= 0 ? Math.exp(-impactT * 6) * Math.sin(impactT * 22) * 0.05 : 0;
    logo.group.scale.setScalar(scale * (1 + rec));
    logo.group.rotation.set(tiltX, spinY, 0);
    logo.edgeMat.opacity = edge;
    logo.bodyMat.emissiveIntensity = 0.02 + (impactT >= 0 ? Math.exp(-impactT * 4) * 0.6 : 0);

    const hs = 1.5 + Math.sin(t * 0.8) * 0.02;
    halo.scale.setScalar(hs * scale);
    halo2.scale.setScalar((hs + 0.18) * scale);
    halo.material.opacity = haloA;
    halo2.material.opacity = haloA * 0.7;
    halo.rotation.z = t * 0.1;
    rays.scale.setScalar(6.5 * scale * (1 + (impactT >= 0 ? Math.exp(-impactT * 2.5) * 0.4 : 0)));
    rays.rotation.z = t * 0.06;
    rays.material.opacity = rayA * 0.13;
    portal.material.opacity = haloA * 0.85;
    portal.scale.setScalar(hs * scale);
    sparks.material.uniforms.uTime.value = t;
    sparks.material.uniforms.uOpacity.value = sparkA;
    burst.update(impactT);
    shock1.update(impactT);
    shock2.update(impactT - 0.06);
    shock3.update(impactT);
  }

  return { group, logo, update, lights: { key, fill, rim } };
}
