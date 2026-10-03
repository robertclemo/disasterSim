// Places every water source for data center mode and draws them draining.
// Runs in the browser and in the Node sim (no canvas or DOM use here).
import * as THREE from 'three';
import { TANKER } from './config.js';
import { makeSource } from './tanker-logic.js';
import { mulberry32 } from './world.js';

const WATER_COL = new THREE.Color(0x3fa6e3);
const MUD_COL = 0x6b4a33;
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function flatDisc(geo, material, y) {
  const m = new THREE.Mesh(geo, material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

// A lumpy pond outline so ponds don't look like perfect circles.
function blobGeo(r, rng, segs = 22) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const rr = r * (0.82 + rng() * 0.3);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  return new THREE.ShapeGeometry(shape);
}

// Each builder returns { group, radius, setLevel(f), update?(dt, time) }
const builders = {
  birdbath() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.8, 6), lam(0xbfb8ad), 0, 0.4, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.22, 10), lam(0xcfc8bd), 0, 0.9, 0));
    const mud = flatDisc(new THREE.CircleGeometry(0.45, 12), lam(MUD_COL), 1.015);
    const water = flatDisc(new THREE.CircleGeometry(0.45, 12), lam(WATER_COL), 1.02);
    g.add(mud, water);
    return { group: g, radius: 0.55, setLevel: (f) => { water.visible = f > 0; water.scale.setScalar(0.4 + 0.6 * f); } };
  },
  kiddie(rng) {
    const g = new THREE.Group();
    const c = [0xff6b9a, 0xffc93c, 0x6bd3ff, 0x8ce06b][Math.floor(rng() * 4)];
    const ring = mesh(new THREE.TorusGeometry(0.95, 0.22, 6, 16), lam(c), 0, 0.22, 0);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const mud = flatDisc(new THREE.CircleGeometry(0.9, 16), lam(0x9fd6e6), 0.05);
    const water = flatDisc(new THREE.CircleGeometry(0.9, 16), lam(WATER_COL), 0.3);
    g.add(mud, water);
    return { group: g, radius: 1.15, setLevel: (f) => { water.visible = f > 0; water.position.y = 0.06 + 0.24 * f; } };
  },
  pool() {
    const g = new THREE.Group();
    const coping = lam(0xf2efe8);
    for (const [w, d, x, z] of [[3.6, 0.3, 0, 1.15], [3.6, 0.3, 0, -1.15], [0.3, 2.6, 1.65, 0], [0.3, 2.6, -1.65, 0]]) {
      g.add(mesh(new THREE.BoxGeometry(w, 0.16, d), coping, x, 0.08, z));
    }
    const floor = flatDisc(new THREE.PlaneGeometry(3.0, 2.0), lam(0x9cc7d2), 0.03);
    const water = flatDisc(new THREE.PlaneGeometry(3.0, 2.0), lam(WATER_COL), 0.14);
    const ladder = mesh(new THREE.TorusGeometry(0.18, 0.03, 4, 8, Math.PI), lam(0xcfd6da), 1.2, 0.3, 0.95);
    g.add(floor, water, ladder);
    return { group: g, radius: 1.8, setLevel: (f) => { water.visible = f > 0; water.position.y = 0.04 + 0.1 * f; } };
  },
  fountain(rng) {
    const g = new THREE.Group();
    const stone = lam(0xd8cfc0);
    const wall = mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.45, 14, 1, true), stone, 0, 0.22, 0);
    wall.material = stone.clone(); wall.material.side = THREE.DoubleSide;
    g.add(wall);
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.3, 8), stone, 0, 0.65, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.18, 10), stone, 0, 1.3, 0));
    const mud = flatDisc(new THREE.CircleGeometry(1.35, 16), lam(0x8d7a66), 0.04);
    const water = flatDisc(new THREE.CircleGeometry(1.35, 16), lam(WATER_COL), 0.32);
    g.add(mud, water);
    const drops = [];
    const dropMat = lam(0xbfe8ff, { transparent: true, opacity: 0.85 });
    for (let i = 0; i < 10; i++) {
      const d = mesh(new THREE.SphereGeometry(0.07, 5, 4), dropMat);
      d.castShadow = false;
      d.userData = { a: (i / 10) * Math.PI * 2, t: rng() };
      g.add(d);
      drops.push(d);
    }
    let level = 1;
    return {
      group: g, radius: 1.5,
      setLevel: (f) => { level = f; water.visible = f > 0; water.position.y = 0.06 + 0.26 * f; },
      update(dt) {
        for (const d of drops) {
          d.visible = level > 0;
          if (!d.visible) continue;
          const u = d.userData;
          u.t = (u.t + dt * 0.9) % 1;
          const r = 0.2 + u.t * 0.9;
          d.position.set(Math.cos(u.a) * r, 1.4 + Math.sin(u.t * Math.PI) * 0.8 * (0.4 + 0.6 * level) - u.t * 1.1, Math.sin(u.a) * r);
        }
      },
    };
  },
  pond(rng, r = 4.3) {
    const g = new THREE.Group();
    const mud = flatDisc(blobGeo(r * 1.06, rng), lam(MUD_COL), 0.035);
    const water = flatDisc(blobGeo(r, rng), lam(WATER_COL), 0.06);
    g.add(mud, water);
    const pads = [];
    for (let i = 0; i < 5; i++) {
      const p = flatDisc(new THREE.CircleGeometry(0.35, 7), lam(0x5fae4e), 0.07);
      const a = rng() * 6.28, rr = r * (0.3 + rng() * 0.45);
      p.position.x = Math.cos(a) * rr; p.position.z = Math.sin(a) * rr;
      g.add(p);
      pads.push(p);
    }
    const rocks = lam(0x9a8b7a);
    for (let i = 0; i < 7; i++) {
      const a = rng() * 6.28;
      g.add(mesh(new THREE.DodecahedronGeometry(0.25 + rng() * 0.3, 0), rocks, Math.cos(a) * r * 1.02, 0.1, Math.sin(a) * r * 1.02));
    }
    return {
      group: g, radius: r,
      setLevel: (f) => {
        water.visible = f > 0;
        water.scale.setScalar(0.3 + 0.7 * f);
        for (const p of pads) { p.position.y = f > 0 ? 0.07 : 0.04; p.material.color.setHex(f > 0.25 ? 0x5fae4e : 0x7d6a3c); }
      },
    };
  },
  farmpond(rng, r) { return builders.pond(rng, r); },
  tower() {
    const g = new THREE.Group();
    const steel = lam(0x9aa3ab);
    for (const [x, z] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) {
      const leg = mesh(new THREE.CylinderGeometry(0.14, 0.18, 9, 6), steel, x * 0.85, 4.5, z * 0.85);
      leg.rotation.z = -x * 0.025; leg.rotation.x = z * 0.025;
      g.add(leg);
    }
    g.add(mesh(new THREE.TorusGeometry(1.6, 0.06, 4, 16), steel, 0, 5, 0).rotateX(Math.PI / 2));
    const tankMat = lam(0xcfe3ee);
    g.add(mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 14), tankMat, 0, 10.6, 0));
    g.add(mesh(new THREE.ConeGeometry(2.6, 1.4, 14), lam(0x8aa0ad), 0, 12.9, 0));
    g.add(mesh(new THREE.SphereGeometry(2.4, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), tankMat, 0, 9, 0));
    const full = new THREE.Color(0xcfe3ee), empty = new THREE.Color(0x9a5f3a);
    return { group: g, radius: 2.4, setLevel: (f) => tankMat.color.copy(empty).lerp(full, f) };
  },
  reservoir(rng) {
    const r = 18;
    const g = new THREE.Group();
    const bed = flatDisc(blobGeo(r * 1.05, rng, 30), lam(0x7a5a40), 0.035);
    const water = flatDisc(blobGeo(r, rng, 30), lam(0x3592cf), 0.07);
    g.add(bed, water);
    const rocks = lam(0x9c7f66);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * 6.28 + rng() * 0.2;
      g.add(mesh(new THREE.DodecahedronGeometry(0.6 + rng() * 0.9, 0), rocks, Math.cos(a) * r * 1.04, 0.2, Math.sin(a) * r * 1.04));
    }
    // Concrete dam wall on the town-facing edge
    const dam = mesh(new THREE.BoxGeometry(14, 1.6, 1.4), lam(0xc9c4ba), 0, 0.8, r * 1.02);
    g.add(dam);
    const deep = new THREE.Color(0x3592cf), murky = new THREE.Color(0x6f7f5a);
    return {
      group: g, radius: r,
      setLevel: (f) => { water.visible = f > 0; water.scale.setScalar(0.25 + 0.75 * f); water.material.color.copy(murky).lerp(deep, f); },
    };
  },
};

// Builds all water for the mode. Clears world objects that would overlap the new features.
export function buildWater(scene, world) {
  const rng = mulberry32(2024);
  const { objects, layout } = world;
  const sources = [];

  function clearArea(x, z, r) {
    for (const o of objects) {
      if (o.state !== 'ground' || o.kind === 'rock') continue;
      const p = o.group.position;
      if (Math.hypot(p.x - x, p.z - z) < r + o.radius * 0.5) { o.state = 'gone'; scene.remove(o.group); }
    }
  }
  function add(kind, x, z, extra) {
    const b = builders[kind](rng, extra);
    b.group.position.set(x, 0, z);
    scene.add(b.group);
    const s = makeSource(kind, x, z, b.radius);
    s.group = b.group; s.setLevel = b.setLevel; s.update = b.update;
    sources.push(s);
    return s;
  }

  // Backyards
  for (const h of layout.houses) {
    const roll = rng();
    const back = Math.sign(h.cz - h.z);
    if (roll < 0.35) add('pool', h.x, h.z + back * 3.9);
    else if (roll < 0.65) add('kiddie', h.x + (rng() - 0.5) * 1.5, h.z + back * 3.7);
    else if (roll < 0.9) add('birdbath', h.x + (rng() < 0.5 ? -1.3 : 1.3), h.z + back * 3.6);
  }

  // Parks get a pond and a fountain; shopping blocks get a plaza fountain
  const towerSpots = [];
  for (const b of layout.blocks) {
    if (b.type === 'park') {
      clearArea(b.cx, b.cz, 5);
      add('pond', b.cx, b.cz);
      clearArea(b.cx + 7, b.cz + 7, 2.2);
      add('fountain', b.cx + 7, b.cz + 7);
    } else if (b.type === 'shops') {
      add('fountain', b.cx, b.cz);
    } else if (b.type === 'houses' && b.ring >= 2) {
      towerSpots.push(b);
    }
  }

  // Two water towers in outer neighbourhoods, far apart
  towerSpots.sort((a, b) => Math.atan2(a.cz, a.cx) - Math.atan2(b.cz, b.cx));
  for (const b of [towerSpots[0], towerSpots[Math.floor(towerSpots.length / 2)]].filter(Boolean)) {
    clearArea(b.cx, b.cz, 2.6);
    add('tower', b.cx, b.cz);
  }

  // Farm ponds replace some crop fields; one hay field gets a water tower
  const nearCampus = (f) => Math.hypot(f.x - TANKER.campusX, f.z - TANKER.campusZ) < 45;
  const crops = layout.fields.filter((f) => f.type === 'crops' && !nearCampus(f));
  for (let i = 0; i < crops.length && i < 16; i += 2) {
    const f = crops[i];
    clearArea(f.x, f.z, Math.hypot(f.w, f.d) / 2);
    add('farmpond', f.x, f.z, Math.min(f.w, f.d) / 2 - 0.4);
  }
  const hay = layout.fields.find((f) => f.type === 'hay' && !nearCampus(f));
  if (hay) { clearArea(hay.x, hay.z, 3); add('tower', hay.x, hay.z); }

  // The reservoir, out by the canyon wall
  clearArea(-118, -100, 21);
  add('reservoir', -118, -100);

  // Room for the intake
  clearArea(TANKER.campusX, TANKER.campusZ, TANKER.intakeRadius + 2);

  return sources;
}
