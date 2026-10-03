// Builds the static ground and spawns every liftable object.
import * as THREE from 'three';
import { KINDS, WORLD } from './config.js';
import * as M from './models.js';

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function flat(w, d, color, x, z, y = 0.01) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

export function buildWorld(scene) {
  const rng = mulberry32(WORLD.seed);
  const objects = [];
  // Layout notes for modes that add their own features (no extra rng calls, so other modes are unchanged)
  const layout = { blocks: [], houses: [], fields: [] };
  const pitch = WORLD.blockSize + WORLD.roadWidth;
  const half = (WORLD.blocks * pitch) / 2;   // 90 by default
  const townEdge = half + WORLD.roadWidth / 2;

  function spawn(kind, built, x, z, rotY = 0, mover = null) {
    built.group.position.set(x, 0, z);
    built.group.rotation.y = rotY;
    scene.add(built.group);
    objects.push({
      kind, mass: KINDS[kind].mass, group: built.group,
      height: built.height, radius: built.radius,
      state: 'ground', vy: 0, spin: (rng() - 0.5) * 3, mover, shrink: 1,
    });
  }

  // Ground layers
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(420, 48), M.mat(0xc49a6c));
  dirt.rotation.x = -Math.PI / 2;
  dirt.receiveShadow = true;
  scene.add(dirt);
  scene.add(flat(townEdge * 2 + 6, townEdge * 2 + 6, 0x9ccc65, 0, 0, 0.005));

  // Roads with dashed centre lines
  const roadLen = townEdge * 2;
  for (let i = 0; i <= WORLD.blocks; i++) {
    const r = -half + i * pitch;
    scene.add(flat(WORLD.roadWidth, roadLen, 0x5c5f66, r, 0, 0.02));
    scene.add(flat(roadLen, WORLD.roadWidth, 0x5c5f66, 0, r, 0.021));
    for (let s = -half; s < half; s += 6) {
      scene.add(flat(0.3, 2.4, 0xffffff, r, s + 3, 0.03));
      scene.add(flat(2.4, 0.3, 0xffffff, s + 3, r, 0.03));
    }
  }

  // City blocks
  for (let bx = 0; bx < WORLD.blocks; bx++) {
    for (let bz = 0; bz < WORLD.blocks; bz++) {
      const cx = -half + pitch / 2 + bx * pitch;
      const cz = -half + pitch / 2 + bz * pitch;
      const ring = Math.max(Math.abs(bx - (WORLD.blocks - 1) / 2), Math.abs(bz - (WORLD.blocks - 1) / 2));
      const roll = rng();
      let type;
      if (ring < 1) type = roll < 0.75 ? 'tower' : 'shops';
      else if (ring < 2) type = roll < 0.3 ? 'tower' : roll < 0.75 ? 'shops' : roll < 0.9 ? 'houses' : 'park';
      else type = roll < 0.12 ? 'shops' : roll < 0.75 ? 'houses' : 'park';

      const bs = WORLD.blockSize;
      layout.blocks.push({ type, cx, cz, ring });
      if (type === 'tower' || type === 'shops') scene.add(flat(bs, bs, 0xd6d2c4, cx, cz, 0.025));

      if (type === 'tower') {
        spawn('tower', M.tower(rng), cx, cz, Math.floor(rng() * 4) * Math.PI / 2);
      } else if (type === 'shops') {
        spawn('shop', M.shop(rng), cx, cz - 5, Math.PI);
        spawn('shop', M.shop(rng), cx, cz + 5, 0);
      } else if (type === 'houses') {
        for (const [dx, dz, ry] of [[-5.5, -5.5, Math.PI], [5.5, -5.5, Math.PI], [-5.5, 5.5, 0], [5.5, 5.5, 0]]) {
          spawn('house', M.house(rng), cx + dx, cz + dz, ry);
          layout.houses.push({ x: cx + dx, z: cz + dz, cx, cz, obj: objects[objects.length - 1] });
        }
        if (rng() < 0.6) spawn('tree', M.tree(rng), cx, cz);
      } else {
        for (let t = 0; t < 5; t++) spawn('tree', M.tree(rng), cx + (rng() - 0.5) * 16, cz + (rng() - 0.5) * 16);
        spawn('bench', M.bench(), cx - 3, cz + 2, 0);
        spawn('bench', M.bench(), cx + 3, cz - 2, Math.PI);
      }

      // Lamps on block corners
      if (rng() < 0.6) spawn('lamp', M.lamp(), cx - bs / 2 + 0.6, cz - bs / 2 + 0.6);
      if (rng() < 0.6) spawn('lamp', M.lamp(), cx + bs / 2 - 0.6, cz + bs / 2 - 0.6);

      // Pedestrians wander around the block edge
      const n = type === 'park' ? 4 : 2;
      for (let p = 0; p < n; p++) {
        const lim = bs / 2 - 0.5;
        const px = cx + (rng() < 0.5 ? -1 : 1) * lim;
        const pz = cz + (rng() - 0.5) * lim * 2;
        spawn('person', M.person(rng), px, pz, 0,
          { type: 'wander', minX: cx - lim, maxX: cx + lim, minZ: cz - lim, maxZ: cz + lim, speed: 1.4, tx: px, tz: pz });
      }
    }
  }

  // Traffic: vehicles drive lanes and U-turn at the town edge
  for (let i = 0; i <= WORLD.blocks; i++) {
    const r = -half + i * pitch;
    for (const axis of ['x', 'z']) {
      const count = 2 + Math.floor(rng() * 2);
      for (let c = 0; c < count; c++) {
        const roll = rng();
        const kind = roll < 0.6 ? 'car' : roll < 0.85 ? 'van' : 'truck';
        const built = kind === 'car' ? M.car(rng) : kind === 'van' ? M.van(rng) : M.truck(rng);
        const dir = rng() < 0.5 ? 1 : -1;
        const along = (rng() - 0.5) * (half * 2 - 10);
        const mover = { type: 'drive', axis, line: r, along, dir, speed: 6 + rng() * 4, limit: half + 2 };
        spawn(kind, built, 0, 0, 0, mover);
        placeVehicle(objects[objects.length - 1]);
      }
    }
  }

  // Farmland between the town and the canyon
  const rects = [];
  const clear = (x, z, w, d) => rects.every((r) =>
    Math.abs(r.x - x) > (r.w + w) / 2 + 3 || Math.abs(r.z - z) > (r.d + d) / 2 + 3);
  const inBand = (x, z, w, d) => {
    const outsideTown = Math.abs(x) - w / 2 > townEdge + 4 || Math.abs(z) - d / 2 > townEdge + 4;
    const corner = Math.hypot(Math.abs(x) + w / 2, Math.abs(z) + d / 2);
    return outsideTown && corner < WORLD.farmOuter;
  };

  function field(type, x, z, w, d) {
    rects.push({ x, z, w, d });
    layout.fields.push({ type, x, z, w, d });
    if (type === 'crops') {
      scene.add(flat(w, d, 0x9c6b3f, x, z, 0.02));
      for (let rx = -w / 2 + 1; rx <= w / 2 - 1; rx += 2.4) {
        scene.add(flat(0.5, d - 1, 0x7a5230, x + rx, z, 0.025));
        for (let rz = -d / 2 + 1; rz <= d / 2 - 1; rz += 2.4) spawn('crop', M.crop(), x + rx, z + rz);
      }
    } else if (type === 'hay') {
      scene.add(flat(w, d, 0xe9d8a6, x, z, 0.02));
      for (let k = 0; k < 6; k++) spawn('hay', M.hay(), x + (rng() - 0.5) * (w - 2), z + (rng() - 0.5) * (d - 2), rng() * Math.PI);
    } else {
      scene.add(flat(w, d, 0x8fc15b, x, z, 0.02));
      for (let fx = -w / 2 + 1.2; fx < w / 2; fx += 2.4) {
        spawn('fence', M.fence(), x + fx, z - d / 2);
        spawn('fence', M.fence(), x + fx, z + d / 2);
      }
      for (let fz = -d / 2 + 1.2; fz < d / 2; fz += 2.4) {
        spawn('fence', M.fence(), x - w / 2, z + fz, Math.PI / 2);
        spawn('fence', M.fence(), x + w / 2, z + fz, Math.PI / 2);
      }
      const animal = rng() < 0.5 ? 'cow' : 'sheep';
      const lim = { minX: x - w / 2 + 1.5, maxX: x + w / 2 - 1.5, minZ: z - d / 2 + 1.5, maxZ: z + d / 2 - 1.5 };
      for (let a = 0; a < 5; a++) {
        const ax = x + (rng() - 0.5) * (w - 4), az = z + (rng() - 0.5) * (d - 4);
        spawn(animal, animal === 'cow' ? M.cow() : M.sheep(), ax, az, rng() * 6.28,
          { type: 'wander', ...lim, speed: 0.6, tx: ax, tz: az });
      }
    }
  }

  // A guaranteed starter patch where the UFO spawns
  field('crops', -9, 128, 12, 10);
  field('hay', 9, 128, 10, 10);
  field('pasture', 0, 143, 16, 10);

  const types = ['crops', 'crops', 'hay', 'pasture'];
  for (let tries = 0; tries < 900 && rects.length < 44; tries++) {
    const w = 10 + Math.floor(rng() * 10), d = 8 + Math.floor(rng() * 8);
    const x = (rng() - 0.5) * WORLD.farmOuter * 2, z = (rng() - 0.5) * WORLD.farmOuter * 2;
    if (inBand(x, z, w, d) && clear(x, z, w, d)) field(types[Math.floor(rng() * types.length)], x, z, w, d);
  }
  for (let t = 0; t < 70; t++) {
    const x = (rng() - 0.5) * 320, z = (rng() - 0.5) * 320;
    if (inBand(x, z, 3, 3) && clear(x, z, 1, 1)) spawn('tree', M.tree(rng), x, z);
  }

  // Canyon wall ring
  let ang = 0;
  while (ang < Math.PI * 2) {
    const built = M.rock(rng);
    const R = WORLD.cliffInner + built.radius + rng() * 8;
    spawn('rock', built, Math.cos(ang) * R, Math.sin(ang) * R, 0);
    ang += (built.radius * 1.5) / R;
  }

  return { objects, half, townEdge, layout };
}

export function placeVehicle(o) {
  const m = o.mover;
  const lane = 2 * m.dir;
  if (m.axis === 'x') {
    o.group.position.set(m.along, 0, m.line + lane);
    o.group.rotation.y = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    o.group.position.set(m.line - lane, 0, m.along);
    o.group.rotation.y = m.dir > 0 ? 0 : Math.PI;
  }
}

export function updateMovers(objects, dt, rng) {
  for (const o of objects) {
    const m = o.mover;
    if (!m || o.state !== 'ground') continue;
    if (m.type === 'drive') {
      m.along += m.dir * m.speed * dt;
      if (Math.abs(m.along) > m.limit) { m.along = Math.sign(m.along) * m.limit; m.dir *= -1; }
      placeVehicle(o);
    } else if (m.type === 'wander') {
      const p = o.group.position;
      const dx = m.tx - p.x, dz = m.tz - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.3) {
        m.tx = m.minX + rng() * (m.maxX - m.minX);
        m.tz = m.minZ + rng() * (m.maxZ - m.minZ);
      } else {
        p.x += (dx / dist) * m.speed * dt;
        p.z += (dz / dist) * m.speed * dt;
        o.group.rotation.y = Math.atan2(dx, dz);
      }
    }
  }
}
