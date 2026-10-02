// Low-poly model builders. Every model sits with its base at y = 0.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  }
  return matCache.get(key);
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function part(group, geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

function windows(g, w, d, floors, floorH, y0, color = 0x2b4a6b) {
  const geo = box(0.9, 1.1, 0.12);
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * floorH + floorH * 0.5;
    const nx = Math.max(1, Math.floor(w / 2.4));
    for (let i = 0; i < nx; i++) {
      const x = -w / 2 + (i + 0.5) * (w / nx);
      part(g, geo, color, x, y, d / 2 + 0.03).castShadow = false;
      part(g, geo, color, x, y, -d / 2 - 0.03).castShadow = false;
    }
    const nz = Math.max(1, Math.floor(d / 2.4));
    for (let i = 0; i < nz; i++) {
      const z = -d / 2 + (i + 0.5) * (d / nz);
      const m1 = part(g, geo, color, w / 2 + 0.03, y, z);
      m1.rotation.y = Math.PI / 2; m1.castShadow = false;
      const m2 = part(g, geo, color, -w / 2 - 0.03, y, z);
      m2.rotation.y = Math.PI / 2; m2.castShadow = false;
    }
  }
}

export function tower(rng) {
  const g = new THREE.Group();
  const body = [0x3fb6b0, 0x4fc3c9, 0x5aa7d6, 0xe9c46a][Math.floor(rng() * 4)];
  const floors = 4 + Math.floor(rng() * 3);
  const w = 10, d = 10, fh = 2.6;
  const h = floors * fh;
  part(g, box(w, h, d), body, 0, h / 2, 0);
  windows(g, w, d, floors, fh, 0);
  part(g, new THREE.CylinderGeometry(7.6, 7.6, 1.2, 8), 0xf08a3e, 0, h + 0.6, 0);
  part(g, box(9, 0.3, 9), 0xd9d2c3, 0, h + 1.3, 0);
  part(g, box(4, 2, 4), body, 1.5, h + 2.4, -1);
  part(g, box(4.6, 0.6, 4.6), 0xf08a3e, 1.5, h + 3.6, -1);
  return { group: g, height: h + 4, radius: 7 };
}

export function shop(rng) {
  const g = new THREE.Group();
  const body = [0xf4a259, 0xe76f51, 0xa8dadc, 0xf6bd60][Math.floor(rng() * 4)];
  const awning = [0xe63946, 0x2a9d8f, 0x457b9d][Math.floor(rng() * 3)];
  const w = 9, d = 7, h = 5.5;
  part(g, box(w, h, d), body, 0, h / 2, 0);
  part(g, box(w + 0.4, 0.5, d + 0.4), 0xfaf3e0, 0, h + 0.25, 0);
  part(g, box(w * 0.9, 0.25, 1.6), awning, 0, 2.9, d / 2 + 0.8).rotation.x = 0.25;
  part(g, box(w * 0.7, 1.8, 0.1), 0x9fd3e6, 0, 1.3, d / 2 + 0.05);
  part(g, box(3, 0.9, 0.15), 0xffffff, 0, h - 0.8, d / 2 + 0.08);
  return { group: g, height: h + 1, radius: 5.5 };
}

export function house(rng) {
  const g = new THREE.Group();
  const body = [0xf6e7b4, 0xe9c46a, 0xf1faee, 0xffd6a5, 0xcdb4db][Math.floor(rng() * 5)];
  const roof = [0x3a6ea5, 0xd1495b, 0xf08a3e, 0x6a994e][Math.floor(rng() * 4)];
  const w = 5, d = 4.5, h = 3.2;
  part(g, box(w, h, d), body, 0, h / 2, 0);
  const r = part(g, new THREE.ConeGeometry(4.1, 2.4, 4), roof, 0, h + 1.2, 0);
  r.rotation.y = Math.PI / 4;
  r.scale.set(1, 1, d / w);
  part(g, box(1, 1.8, 0.1), 0x8d5524, 0, 0.9, d / 2 + 0.05);
  part(g, box(0.9, 0.9, 0.1), 0x2b4a6b, -1.5, 1.9, d / 2 + 0.05);
  part(g, box(0.9, 0.9, 0.1), 0x2b4a6b, 1.5, 1.9, d / 2 + 0.05);
  part(g, box(0.6, 1.4, 0.6), 0x6c757d, 1.3, h + 1.6, -0.6);
  return { group: g, height: h + 2.5, radius: 3.4 };
}

function wheel(g, x, z, r = 0.35) {
  const m = part(g, new THREE.CylinderGeometry(r, r, 0.3, 8), 0x222222, x, r, z);
  m.rotation.z = Math.PI / 2;
}

// Vehicles face +z.
export function car(rng) {
  const g = new THREE.Group();
  const c = [0x4cc9f0, 0xf94144, 0xf9c74f, 0x90be6d, 0xf3722c, 0xffffff][Math.floor(rng() * 6)];
  part(g, box(1.6, 0.6, 3), c, 0, 0.6, 0);
  part(g, box(1.4, 0.55, 1.6), c, 0, 1.15, -0.2);
  part(g, box(1.42, 0.4, 1.5), 0x9fd3e6, 0, 1.15, -0.2);
  wheel(g, -0.8, 0.95); wheel(g, 0.8, 0.95); wheel(g, -0.8, -0.95); wheel(g, 0.8, -0.95);
  return { group: g, height: 1.5, radius: 1.6 };
}

export function van(rng) {
  const g = new THREE.Group();
  const c = [0xf3722c, 0xffffff, 0x577590][Math.floor(rng() * 3)];
  part(g, box(1.9, 1.7, 3.8), c, 0, 1.2, 0);
  part(g, box(1.7, 0.6, 0.1), 0x9fd3e6, 0, 1.6, 1.9);
  wheel(g, -0.95, 1.2, 0.4); wheel(g, 0.95, 1.2, 0.4); wheel(g, -0.95, -1.2, 0.4); wheel(g, 0.95, -1.2, 0.4);
  return { group: g, height: 2.1, radius: 2 };
}

export function truck(rng) {
  const g = new THREE.Group();
  const c = [0xf9c74f, 0xf94144, 0x43aa8b][Math.floor(rng() * 3)];
  part(g, box(2.2, 1.8, 1.8), c, 0, 1.5, 1.8);
  part(g, box(2, 0.6, 0.1), 0x9fd3e6, 0, 1.9, 2.71);
  part(g, box(2.2, 0.5, 3.8), 0x8d99ae, 0, 0.85, -0.9);
  part(g, box(2.2, 1.0, 0.2), 0x8d99ae, 0, 1.5, -2.7);
  part(g, box(0.2, 1.0, 3.8), 0x8d99ae, -1, 1.5, -0.9);
  part(g, box(0.2, 1.0, 3.8), 0x8d99ae, 1, 1.5, -0.9);
  wheel(g, -1.1, 1.8, 0.45); wheel(g, 1.1, 1.8, 0.45); wheel(g, -1.1, -1.8, 0.45); wheel(g, 1.1, -1.8, 0.45);
  return { group: g, height: 2.5, radius: 2.6 };
}

export function person(rng) {
  const g = new THREE.Group();
  const shirt = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0x9b5de5][Math.floor(rng() * 5)];
  const skin = [0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac][Math.floor(rng() * 4)];
  part(g, box(0.35, 0.6, 0.3), 0x3d405b, 0, 0.3, 0);
  part(g, box(0.5, 0.6, 0.35), shirt, 0, 0.9, 0);
  part(g, new THREE.SphereGeometry(0.25, 6, 5), skin, 0, 1.45, 0);
  return { group: g, height: 1.7, radius: 0.4 };
}

export function cow() {
  const g = new THREE.Group();
  part(g, box(0.9, 0.8, 1.6), 0xffffff, 0, 0.9, 0);
  part(g, box(0.92, 0.4, 0.5), 0x222222, 0, 1.05, 0.2);
  part(g, box(0.6, 0.6, 0.6), 0xffffff, 0, 1.2, 1.0);
  part(g, box(0.4, 0.25, 0.2), 0xf4acb7, 0, 1.0, 1.32);
  for (const [x, z] of [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]]) part(g, box(0.18, 0.5, 0.18), 0x333333, x, 0.25, z);
  return { group: g, height: 1.6, radius: 1 };
}

export function sheep() {
  const g = new THREE.Group();
  part(g, new THREE.DodecahedronGeometry(0.55), 0xf8f9fa, 0, 0.75, 0);
  part(g, box(0.35, 0.35, 0.4), 0x343a40, 0, 0.85, 0.55);
  for (const [x, z] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.25], [0.2, -0.25]]) part(g, box(0.12, 0.4, 0.12), 0x343a40, x, 0.2, z);
  return { group: g, height: 1.2, radius: 0.7 };
}

export function tree(rng) {
  const g = new THREE.Group();
  const s = 0.8 + rng() * 0.5;
  part(g, new THREE.CylinderGeometry(0.25 * s, 0.35 * s, 2 * s, 6), 0x8d5524, 0, s, 0);
  const leaf = [0x7cc35a, 0x5fa847, 0x95d164][Math.floor(rng() * 3)];
  part(g, new THREE.IcosahedronGeometry(1.5 * s, 0), leaf, 0, 2.6 * s, 0);
  part(g, new THREE.IcosahedronGeometry(1.0 * s, 0), leaf, 0.7 * s, 3.3 * s, 0.2 * s);
  return { group: g, height: 4 * s, radius: 1.6 * s };
}

export function hay() {
  const g = new THREE.Group();
  const m = part(g, new THREE.CylinderGeometry(0.75, 0.75, 1.1, 10), 0xf4b942, 0, 0.75, 0);
  m.rotation.z = Math.PI / 2;
  return { group: g, height: 1.5, radius: 0.8 };
}

export function crop() {
  const g = new THREE.Group();
  part(g, new THREE.ConeGeometry(0.3, 0.9, 5), 0x80b918, 0, 0.45, 0);
  return { group: g, height: 0.9, radius: 0.3 };
}

export function fence() {
  const g = new THREE.Group();
  part(g, box(0.2, 1, 0.2), 0xb5651d, -1, 0.5, 0);
  part(g, box(0.2, 1, 0.2), 0xb5651d, 1, 0.5, 0);
  part(g, box(2.4, 0.18, 0.12), 0xc97c3a, 0, 0.75, 0);
  part(g, box(2.4, 0.18, 0.12), 0xc97c3a, 0, 0.4, 0);
  return { group: g, height: 1, radius: 1.2 };
}

export function bench() {
  const g = new THREE.Group();
  part(g, box(1.8, 0.15, 0.6), 0xb5651d, 0, 0.5, 0);
  part(g, box(1.8, 0.5, 0.12), 0xb5651d, 0, 0.8, -0.25);
  part(g, box(0.15, 0.5, 0.5), 0x495057, -0.75, 0.25, 0);
  part(g, box(0.15, 0.5, 0.5), 0x495057, 0.75, 0.25, 0);
  return { group: g, height: 1, radius: 1 };
}

export function lamp() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(0.1, 0.14, 3.6, 6), 0x495057, 0, 1.8, 0);
  part(g, box(0.5, 0.35, 0.5), 0xfff3b0, 0, 3.7, 0);
  return { group: g, height: 4, radius: 0.4 };
}

export function rock(rng) {
  const g = new THREE.Group();
  const c = [0x9c6644, 0xb07d62, 0x8a5a44][Math.floor(rng() * 3)];
  const h = 14 + rng() * 14;
  const r = 7 + rng() * 5;
  const m = part(g, new THREE.CylinderGeometry(r * 0.75, r, h, 6, 1), c, 0, h / 2, 0);
  m.rotation.y = rng() * Math.PI;
  part(g, new THREE.DodecahedronGeometry(r * 0.6, 0), c, r * 0.3, h + r * 0.1, 0);
  return { group: g, height: h + r * 0.5, radius: r };
}
