// The tornado: two swirling funnel layers that bend each frame, a dust skirt, and orbiting debris.
import * as THREE from 'three';
import { TORNADO } from './config.js';
import { funnelSway } from './game.js';

function streakTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 256;
    const len = 40 + Math.random() * 160;
    const x = Math.random() * 256;
    g.strokeStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.55})`;
    g.lineWidth = 2 + Math.random() * 9;
    g.lineCap = 'round';
    // Slanted streaks so the scrolling texture reads as a spiral
    for (const ox of [-256, 0, 256]) {
      g.beginPath();
      g.moveTo(x + ox, y);
      g.lineTo(x + ox + len, y - len * 0.35);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function funnelLayer(widen, color, opacity, repeatX) {
  const pts = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const h = (i / N) * TORNADO.height;
    const t = i / N;
    const r = (TORNADO.baseRadius + (TORNADO.topRadius - TORNADO.baseRadius) * Math.pow(t, 1.6)) * widen;
    pts.push(new THREE.Vector2(r, h));
  }
  const geo = new THREE.LatheGeometry(pts, 32);
  const tex = streakTexture();
  tex.repeat.set(repeatX, 2);
  const mat = new THREE.MeshLambertMaterial({
    color, map: tex, alphaMap: tex, transparent: true, opacity,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.base = Float32Array.from(geo.attributes.position.array);
  return mesh;
}

export function buildTornado(scene) {
  const root = new THREE.Group();
  const layers = [
    funnelLayer(0.92, 0x6f6658, 0.95, 3),
    funnelLayer(1.12, 0xa89f90, 0.6, 2),
  ];
  layers.forEach((l) => root.add(l));

  // Dust skirt at the base
  const dust = new THREE.Group();
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xb59573, transparent: true, opacity: 0.7, flatShading: true, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.6, 0), puffMat);
    m.userData = { a: (i / 14) * Math.PI * 2, r: 2.2 + Math.random() * 1.4, y: 0.4 + Math.random() * 1.2, s: 0.8 + Math.random() * 0.6 };
    dust.add(m);
    puffs.push(m);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1, 48), new THREE.MeshBasicMaterial({
    color: 0x5a4632, transparent: true, opacity: 0.35, depthWrite: false,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  dust.add(ring);
  root.add(dust);

  // Chunks of junk that circle the funnel for texture
  const bits = [];
  const bitMat = new THREE.MeshLambertMaterial({ color: 0x5b4a3a, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.35), bitMat);
    m.userData = { a: Math.random() * 6.28, h: Math.random() * TORNADO.height * 0.9, sp: 2 + Math.random() * 3 };
    root.add(m);
    bits.push(m);
  }
  scene.add(root);

  const sw = { x: 0, z: 0 };

  // Called once per frame. root sits at the tornado's ground position; geometry is in scale-1 units.
  function update(dt, time, s, lean) {
    root.scale.setScalar(s);
    const leanUnit = { x: lean.x / s, z: lean.z / s };
    for (const [i, l] of layers.entries()) {
      const pos = l.geometry.attributes.position;
      const base = l.userData.base;
      for (let v = 0; v < pos.count; v++) {
        const h = base[v * 3 + 1];
        funnelSway(h, 1, time, leanUnit, sw);
        pos.array[v * 3] = base[v * 3] + sw.x;
        pos.array[v * 3 + 2] = base[v * 3 + 2] + sw.z;
      }
      pos.needsUpdate = true;
      l.material.map.offset.x -= dt * (i ? 0.35 : 0.55);
      l.material.map.offset.y -= dt * 0.25;
    }
    for (const p of puffs) {
      const u = p.userData;
      u.a += dt * 3.2;
      p.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(time * 3 + u.a) * 0.2, Math.sin(u.a) * u.r);
      p.scale.setScalar(u.s * (0.9 + Math.sin(time * 4 + u.a * 2) * 0.15));
      p.rotation.y += dt;
    }
    ring.scale.setScalar(TORNADO.catchRadius);
    ring.material.opacity = 0.28 + Math.sin(time * 5) * 0.1;
    for (const b of bits) {
      const u = b.userData;
      const t = u.h / TORNADO.height;
      u.a += dt * u.sp * (1.5 - t);
      u.h += dt * 2.5;
      if (u.h > TORNADO.height) u.h = 0;
      funnelSway(u.h, 1, time, leanUnit, sw);
      const r = (TORNADO.baseRadius + (TORNADO.topRadius - TORNADO.baseRadius) * Math.pow(t, 1.6)) * 1.15;
      b.position.set(sw.x + Math.cos(u.a) * r, u.h, sw.z + Math.sin(u.a) * r);
      b.rotation.x += dt * 4; b.rotation.y += dt * 3;
    }
  }

  return { root, update };
}
