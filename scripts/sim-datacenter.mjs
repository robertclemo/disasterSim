// Headless balance check for data center mode: a bot hauls water until the town is dry.
// Run with: npm run sim -- datacenter
import * as THREE from 'three';
import { TANKER, TIERS, WATER } from '../src/config.js';
import { buildWorld } from '../src/world.js';
import { buildWater } from '../src/water.js';
import { buildCampus } from '../src/datacenter.js';
import { createTanker, stepTanker, prGesture, hallsFor } from '../src/tanker-logic.js';

const scene = new THREE.Scene();
const world = buildWorld(scene);
const sources = buildWater(scene, world);
const campus = buildCampus(scene, world.objects, sources);
const tk = createTanker();
campus.addHall();

const total = sources.reduce((a, s) => a + s.max, 0);
console.log(`mode: datacenter\nwater sources: ${sources.length}, total water: ${total}`);

const dt = 1 / 30, LIMIT = 60 * 60;
let t = 0, freezes = 0, prs = 0, freezeTime = 0, hauling = false;
const tierAt = {};
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

while (t < LIMIT) {
  t += dt;
  const tier = TIERS[tk.tier];
  const live = sources.filter((s) => s.alive && s.volume > 0);
  if (!live.length && tk.tank < 0.01) break;

  // Pick a destination
  let tx = TANKER.campusX, tz = TANKER.campusZ, stopAt = TANKER.intakeRadius * 0.5;
  if (tk.tank >= tier.cap - 0.01 || (tk.freeze > 0 && tk.tank > 0)) hauling = true;
  if (tk.tank < 0.01) hauling = false;
  const goHome = hauling;
  if (!goHome) {
    let best = null, bd = Infinity;
    for (const s of live) {
      if (s.tier > tk.tier) continue;
      const d = Math.hypot(s.x - tk.x, s.z - tk.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (best && tk.freeze <= 0) { tx = best.x; tz = best.z; stopAt = best.radius + TANKER.reach * 0.5; }
    else if (!best && tk.tank < 0.01) { console.log(`STUCK at ${mmss(t)}: tier ${tk.tier}, nothing tappable`); break; }
  }
  const d = Math.hypot(tx - tk.x, tz - tk.z);
  const speed = TANKER.speed * tier.speed * (tk.pickets ? 0.7 : 1);
  if (d > stopAt) {
    const step = Math.min(d - stopAt, speed * dt);
    tk.x += ((tx - tk.x) / d) * step;
    tk.z += ((tz - tk.z) / d) * step;
  }
  if (!process.env.NO_PR && tk.outrage > 85 && prGesture(tk)) prs++;
  stepTanker(tk, sources, dt, { onTier: (i) => { tierAt[i] = t; }, onFreeze: () => freezes++ });
  if (tk.freeze > 0) freezeTime += dt;
  while (campus.count < hallsFor(tk.delivered)) {
    const n = campus.count;
    tk.outrage = Math.min(100, tk.outrage + campus.addHall());
    if (campus.count === n) break;
  }
}

const lost = sources.filter((s) => !s.alive).reduce((a, s) => a + s.volume, 0);
console.log('\ntier unlocks:');
for (const [i, v] of Object.entries(tierAt)) {
  const label = Object.values(WATER).filter((w) => w.tier === +i).map((w) => w.label).join(' & ');
  console.log(`  ${mmss(v).padStart(6)}  ${label}`);
}
console.log(`\nfinished at ${mmss(t)}: delivered ${Math.round(tk.delivered)}, bulldozed ${Math.round(lost)} unpumped water, ` +
  `${campus.count} halls, ${freezes} freezes (${Math.round(freezeTime)}s frozen), ${prs} PR gestures`);
