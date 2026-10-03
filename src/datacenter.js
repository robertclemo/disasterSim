// Data center mode visuals: the tanker truck and hose, the campus (intake + server halls), and picket lines.
import * as THREE from 'three';
import { TANKER as T } from './config.js';
import { hallCells, inHall } from './tanker-logic.js';
import { person, wreckLook } from './models.js';
import { mulberry32 } from './world.js';

const TEAL = 0x1fa99a;
const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function signTexture(lines, bg = '#ffffff', fg = '#14303a', w = 512, h = 160) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    g.font = `${l.size}px "Lilita One", system-ui, sans-serif`;
    g.fillText(l.text, w / 2, h * (lines.length === 1 ? 0.5 : (i + 0.75) / (lines.length + 0.5)));
  });
  return new THREE.CanvasTexture(c);
}

// ---------- truck ----------
export function buildTruck(scene) {
  const g = new THREE.Group();
  const white = lam(0xf4f6f7), teal = lam(TEAL), steel = lam(0xc9d1d6), dark = lam(0x222222);
  g.add(mesh(new THREE.BoxGeometry(2.3, 0.5, 6.4), lam(0x4a4f55), 0, 0.75, 0));        // chassis
  g.add(mesh(new THREE.BoxGeometry(2.3, 1.9, 1.9), white, 0, 1.75, 2.3));             // cab
  g.add(mesh(new THREE.BoxGeometry(2.32, 0.7, 0.1), lam(0x9fd3e6), 0, 2.2, 3.26));     // windshield
  g.add(mesh(new THREE.BoxGeometry(2.34, 0.25, 1.92), teal, 0, 1.2, 2.3));            // cab stripe
  const tank = mesh(new THREE.CylinderGeometry(1.15, 1.15, 4.2, 14), steel, 0, 2.05, -0.9);
  tank.rotation.x = Math.PI / 2;
  g.add(tank);
  const band = mesh(new THREE.CylinderGeometry(1.17, 1.17, 0.5, 14), teal, 0, 2.05, -0.9);
  band.rotation.x = Math.PI / 2;
  g.add(band);
  g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 8), steel, 0, 3.3, -0.4));   // hatch
  for (const [x, z] of [[-1.15, 2.2], [1.15, 2.2], [-1.15, -0.6], [1.15, -0.6], [-1.15, -2.1], [1.15, -2.1]]) {
    const w = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 10), dark, x, 0.5, z);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  }
  // Fill gauge on the tank's side: a teal bar that grows with the load
  const gauge = mesh(new THREE.BoxGeometry(0.06, 0.35, 3.6), lam(0x1d3640), 1.17, 2.05, -0.9);
  const fill = mesh(new THREE.BoxGeometry(0.07, 0.25, 3.5), lam(0x4fd2ff, { emissive: 0x0d4a66 }), 1.19, 2.05, -0.9);
  gauge.castShadow = fill.castShadow = false;
  g.add(gauge, fill);
  scene.add(g);

  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 6), lam(0x2b2b2b));
  hose.visible = false;
  scene.add(hose);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  return {
    group: g,
    setFill(f) {
      fill.scale.z = Math.max(0.01, f);
      fill.position.z = -0.9 - 1.75 * (1 - f);
    },
    // Hose from the back of the truck to the water's surface; null hides it
    setHose(target, time, s) {
      hose.visible = !!target;
      if (!target) return;
      tmpA.set(0, 1.4, -3.2).applyMatrix4(g.matrixWorld);
      tmpB.set(target.x, target.kind === 'tower' ? 9 : 0.4, target.z);
      const len = tmpA.distanceTo(tmpB);
      hose.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
      hose.position.y += Math.sin(time * 12) * 0.06;
      hose.scale.set(s, len, s);
      hose.quaternion.setFromUnitVectors(up, tmpB.sub(tmpA).normalize());
    },
  };
}

// ---------- campus ----------
export function buildCampus(scene, objects, sources) {
  const rng = mulberry32(31);
  const cells = hallCells();
  const halls = [];
  const dying = [];
  const puffs = [];
  const hasDOM = typeof document !== 'undefined';

  // Intake: concrete pad, storage tank, pipes, glowing delivery ring, billboard
  const intake = new THREE.Group();
  intake.position.set(T.campusX, 0, T.campusZ);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(T.intakeRadius, 36), lam(0xb9b6ae));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.04; pad.receiveShadow = true;
  intake.add(pad);
  intake.add(mesh(new THREE.CylinderGeometry(2.2, 2.2, 4.5, 16), lam(0xe9edef), 0, 2.25, 0));
  intake.add(mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.5, 16), lam(TEAL), 0, 3.8, 0));
  for (const a of [0.6, 2.2, 3.9]) {
    const p = mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 8), lam(0x8d969c), Math.cos(a) * 3.4, 0.35, Math.sin(a) * 3.4);
    p.rotation.z = Math.PI / 2; p.rotation.y = -a;
    intake.add(p);
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.7, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(T.intakeRadius - 0.45, T.intakeRadius, 48), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.07;
  intake.add(ring);
  if (hasDOM) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshLambertMaterial({
      map: signTexture([{ text: 'WELLSPRING COMPUTE', size: 64 }, { text: 'Powering Tomorrow, Today', size: 34 }], '#ffffff', '#14303a'),
    }));
    board.position.set(0, 7, T.intakeRadius + 1);
    const post = mesh(new THREE.CylinderGeometry(0.2, 0.2, 6, 6), lam(0x8d969c), 0, 3, T.intakeRadius + 0.9);
    intake.add(board, post);
  }
  scene.add(intake);

  function hallModel() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(T.hallW, 4.6, T.hallD), lam(0xdfe5ea), 0, 2.3, 0));
    g.add(mesh(new THREE.BoxGeometry(T.hallW + 0.05, 0.5, T.hallD + 0.05), lam(TEAL), 0, 3.9, 0));
    g.add(mesh(new THREE.BoxGeometry(3, 2.6, 0.1), lam(0x9aa3ab), -3, 1.3, T.hallD / 2 + 0.05));
    const fan = lam(0x3b4248);
    for (let i = 0; i < 4; i++) {
      const x = -T.hallW / 2 + 1.8 + i * 2.8;
      g.add(mesh(new THREE.BoxGeometry(2, 0.9, 2), lam(0xb8c0c6), x, 5.05, -1.5));
      const f = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 10), fan, x, 5.55, -1.5);
      g.add(f);
    }
    // Blinking status lights along the front
    for (let i = 0; i < 6; i++) {
      g.add(mesh(new THREE.BoxGeometry(0.25, 0.25, 0.05), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x47ff9c : 0x5fd8ff }),
        1 + i * 0.6, 3.1, T.hallD / 2 + 0.06));
    }
    return g;
  }

  // Squash and remove anything a new hall lands on. Returns outrage caused.
  function bulldoze(cell) {
    let outrage = 0;
    for (const o of objects) {
      if (o.state !== 'ground' && o.state !== 'wreck') continue;
      if (o.kind === 'rock') continue;
      const p = o.group.position;
      if (!inHall(cell, p.x, p.z, o.radius * 0.4)) continue;
      outrage += T.outrageBulldoze[o.kind] || 0;
      o.state = 'gone';
      if (o.mover) o.mover = null;
      wreckLook(o.group);
      dying.push({ group: o.group, t: 0 });
    }
    for (const s of sources) {
      if (!s.alive || !inHall(cell, s.x, s.z, s.radius * 0.5)) continue;
      s.alive = false;
      dying.push({ group: s.group, t: 0 });
    }
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), lam(0xb8956d, { transparent: true, opacity: 0.8, depthWrite: false }));
      m.position.set(cell.x + (rng() - 0.5) * T.hallW, 0.8, cell.z + (rng() - 0.5) * T.hallD);
      scene.add(m);
      puffs.push({ m, t: 0 });
    }
    return outrage;
  }

  function addHall() {
    const cell = cells[halls.length];
    if (!cell) return 0;
    const g = hallModel();
    g.position.set(cell.x, 0, cell.z);
    g.scale.y = 0.01;
    scene.add(g);
    halls.push({ cell, g, t: 0 });
    return bulldoze(cell);
  }

  // Townsfolk and cars that wander onto campus are "acquired"
  function acquireMovers() {
    for (const o of objects) {
      if (!o.mover || o.state !== 'ground') continue;
      const p = o.group.position;
      for (const h of halls) {
        if (inHall(h.cell, p.x, p.z, 0.5)) {
          o.state = 'gone'; o.mover = null;
          dying.push({ group: o.group, t: 0 });
          break;
        }
      }
    }
  }

  function update(dt, time, delivering) {
    for (const h of halls) {
      if (h.t < 1) { h.t = Math.min(1, h.t + dt * 1.6); h.g.scale.y = 1 - Math.pow(1 - h.t, 3); }
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      d.t += dt * 2.5;
      d.group.scale.y = Math.max(0.05, 1 - d.t);
      if (d.t >= 1) { scene.remove(d.group); dying.splice(i, 1); }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.t += dt;
      p.m.scale.setScalar(1 + p.t * 4);
      p.m.position.y += dt * 2;
      p.m.material.opacity = Math.max(0, 0.8 - p.t * 1.1);
      if (p.t > 0.75) { scene.remove(p.m); puffs.splice(i, 1); }
    }
    ringMat.opacity = delivering ? 0.95 : 0.45 + Math.sin(time * 4) * 0.25;
    acquireMovers();
  }

  return { addHall, update, get count() { return halls.length; } };
}

// ---------- picket lines ----------
const SLOGANS = [['HANDS OFF', 'OUR POND'], ['WATER IS', 'LIFE'], ['MY POOL', 'NOT YOUR', 'COOLANT'], ['SAVE THE', 'BIRDBATHS'], ['WELLSPRING', 'GO HOME']];

export function buildPickets(scene, roadLines, townEdge) {
  const rng = mulberry32(77);
  const groups = [];
  const hasDOM = typeof document !== 'undefined';
  const signMats = hasDOM ? SLOGANS.map((s) => new THREE.MeshLambertMaterial({
    map: signTexture(s.map((t) => ({ text: t, size: 40 })), '#fff8e6', '#c0392b', 256, 160),
  })) : [new THREE.MeshLambertMaterial({ color: 0xfff8e6 })];

  function spawnNear(x, z) {
    clear();
    // Pick road spots near the truck (or the town edge closest to it)
    const cx = Math.max(-townEdge + 6, Math.min(townEdge - 6, x));
    const cz = Math.max(-townEdge + 6, Math.min(townEdge - 6, z));
    for (let n = 0; n < 6; n++) {
      const line = roadLines[Math.floor(rng() * roadLines.length)];
      const alongX = rng() < 0.5;
      const along = (alongX ? cx : cz) + (rng() - 0.5) * 70;
      const px = alongX ? Math.max(-townEdge, Math.min(townEdge, along)) : line;
      const pz = alongX ? line : Math.max(-townEdge, Math.min(townEdge, along));
      const g = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const p = person(rng).group;
        const off = (i - 1.5) * 1.6;
        p.position.set(alongX ? 0 : off, 0, alongX ? off : 0);
        p.rotation.y = alongX ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
        const stick = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4), lam(0x8d5524), 0.3, 1.6, 0.2);
        const board = mesh(new THREE.BoxGeometry(1.3, 0.8, 0.05), signMats[Math.floor(rng() * signMats.length)], 0.3, 2.5, 0.25);
        p.add(stick, board);
        g.add(p);
      }
      g.position.set(px, 0, pz);
      g.userData.phase = rng() * 6;
      scene.add(g);
      groups.push(g);
    }
  }

  function clear() {
    for (const g of groups) scene.remove(g);
    groups.length = 0;
  }

  // Returns true if (x, z) is inside a picket line
  function blocks(x, z) {
    return groups.some((g) => Math.hypot(g.position.x - x, g.position.z - z) < 5);
  }

  function update(time) {
    for (const g of groups) {
      g.children.forEach((p, i) => { p.position.y = Math.abs(Math.sin(time * 5 + g.userData.phase + i)) * 0.25; });
    }
  }

  return { spawnNear, clear, blocks, update };
}
