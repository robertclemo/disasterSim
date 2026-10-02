// Headless balance check: a bot flies to the nearest thing it can lift and eats the world.
// Run with: npm run sim            (UFO)
//           npm run sim -- tornado
import * as THREE from 'three';
import { KINDS, UFO, TORNADO, liftFor, scaleFor } from '../src/config.js';
import { buildWorld, updateMovers, mulberry32 } from '../src/world.js';
import { stepObjects, stepTornadoObjects } from '../src/game.js';

const MODE = process.argv[2] === 'tornado' ? 'tornado' : 'ufo';
const CFG = MODE === 'tornado' ? TORNADO : UFO;
console.log(`mode: ${MODE}`);

const scene = new THREE.Scene();
const { objects } = buildWorld(scene);
const rng = mulberry32(42);
const absorbedFor = (lift) => Math.max(0, (lift - liftFor(0)) / (liftFor(1) - liftFor(0)));

const counts = {};
for (const o of objects) counts[o.kind] = (counts[o.kind] || 0) + 1;
const total = objects.reduce((s, o) => s + o.mass, 0);
console.log(`objects: ${objects.length}, total mass: ${total}`);
console.log(Object.entries(counts).map(([k, n]) => `${k}:${n}`).join('  '));

const st = { x: 0, z: 124, absorbed: 0, lift: liftFor(0), scale: 1 };
const ufoPos = new THREE.Vector3();
const unlocked = {};
let left = objects.length, t = 0;
const dt = 1 / 30, LIMIT = 60 * 60;
const onAbsorb = (o) => {
  const before = st.lift;
  st.absorbed += o.mass; st.lift = liftFor(st.absorbed); left--;
  for (const [name, k] of Object.entries(KINDS)) {
    if (k.mass > before && k.mass <= st.lift) unlocked[name] = t;
  }
};

while (left > 0 && t < LIMIT) {
  t += dt;
  st.scale += (scaleFor(st.lift) - st.scale) * (1 - Math.exp(-dt * 2.5));
  // Steer toward the nearest liftable object on the ground
  let best = null, bd = Infinity;
  for (const o of objects) {
    if (o.state !== 'ground' || o.mass > st.lift) continue;
    const d = Math.hypot(o.group.position.x - st.x, o.group.position.z - st.z);
    if (d < bd) { bd = d; best = o; }
  }
  const speed = CFG.speed * Math.pow(st.scale, CFG.speedGrowth);
  if (best && bd > 0.5) {
    const step = Math.min(bd, speed * dt);
    st.x += ((best.group.position.x - st.x) / bd) * step;
    st.z += ((best.group.position.z - st.z) / bd) * step;
  }
  const r = Math.hypot(st.x, st.z);
  if (r > CFG.worldRadius) { st.x *= CFG.worldRadius / r; st.z *= CFG.worldRadius / r; }
  ufoPos.set(st.x, UFO.hoverHeight * st.scale, st.z);
  updateMovers(objects, dt, rng);
  if (MODE === 'tornado') {
    ufoPos.y = 0;
    stepTornadoObjects({ objects, center: ufoPos, lean: { x: 0, z: 0 }, lift: st.lift, scale: st.scale, dt, time: t, rng,
      absorbedFor, absorbed: st.absorbed, onFling: onAbsorb });
  } else {
    stepObjects({ objects, ufoPos, lift: st.lift, scale: st.scale, dt, time: t, absorbedFor, absorbed: st.absorbed, onAbsorb });
  }
  const settled = (o) => o.state === 'gone' || o.state === 'ground' || o.state === 'wreck';
  if (!best && objects.every(settled) && left > 0) {
    const stuck = objects.filter((o) => o.state === 'ground');
    console.log(`STUCK at ${t.toFixed(0)}s: lift ${st.lift.toFixed(0)}, lightest left ${Math.min(...stuck.map((o) => o.mass))}`);
    break;
  }
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
console.log('\nunlock times:');
for (const [k, v] of Object.entries(unlocked).sort((a, b) => a[1] - b[1])) console.log(`  ${mmss(v).padStart(6)}  ${KINDS[k].label}`);
console.log(`\n${left === 0 ? 'ATE EVERYTHING' : `${left} objects left`} at ${mmss(t)}, final mass ${st.absorbed}, scale ${st.scale.toFixed(1)}`);
