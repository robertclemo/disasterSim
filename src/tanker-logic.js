// Data center mode rules with no rendering, shared by the game and the balance sim.
import { WATER, TIERS, TANKER as T } from './config.js';

export function tierFor(delivered) {
  let t = 0;
  for (let i = 0; i < TIERS.length; i++) if (delivered >= TIERS[i].at) t = i;
  return t;
}

// Server halls on campus for a given amount delivered.
export const hallsFor = (delivered) => 1 + Math.floor(Math.sqrt(delivered) / 3);

// Water taken near the middle of town makes people angrier than water taken out in the canyon.
export function proximity(x, z) {
  return Math.min(1.2, Math.max(0.25, 1.25 - Math.hypot(x, z) / 140));
}

// Campus grid cells in the order halls get built: outward from the intake, leaning toward town.
export function hallCells(maxR = 168) {
  const cells = [];
  for (let i = -5; i <= 5; i++) {
    for (let j = -8; j <= 2; j++) {
      if (i === 0 && j === 0) continue; // the intake sits here
      const x = T.campusX + i * T.cellW, z = T.campusZ + j * T.cellD;
      if (Math.hypot(Math.abs(x) + T.hallW / 2, Math.abs(z) + T.hallD / 2) > maxR) continue;
      const cost = Math.hypot(i * T.cellW, j * T.cellD * (j < 0 ? 0.55 : 1.6));
      cells.push({ x, z, cost });
    }
  }
  return cells.sort((a, b) => a.cost - b.cost);
}

export function inHall(cell, x, z, pad = 0) {
  return Math.abs(x - cell.x) < T.hallW / 2 + pad && Math.abs(z - cell.z) < T.hallD / 2 + pad;
}

export function createTanker() {
  return {
    x: T.campusX, z: T.campusZ + 4, tank: 0, delivered: 0, tier: 0,
    outrage: 0, freeze: 0, pickets: false, prTimer: 0,
    pumping: null, blocked: null, delivering: false,
  };
}

export function makeSource(kind, x, z, radius) {
  const k = WATER[kind];
  return { kind, tier: k.tier, volume: k.volume, max: k.volume, x, z, radius, prox: proximity(x, z), alive: true };
}

// Advances one frame. `ev` holds optional callbacks: onDrained(src), onTier(i), onFreeze(), onPicketsClear().
export function stepTanker(t, sources, dt, ev = {}) {
  const tier = TIERS[t.tier];
  t.freeze = Math.max(0, t.freeze - dt);
  t.prTimer = Math.max(0, t.prTimer - dt);
  t.pumping = null;
  t.blocked = null;

  // Nearest live source in reach that the pump can handle; a too-big one only matters if nothing else is in reach
  let src = null, best = Infinity, big = null, bigD = Infinity;
  for (const s of sources) {
    if (!s.alive || s.volume <= 0) continue;
    const d = Math.hypot(s.x - t.x, s.z - t.z) - s.radius;
    if (d >= T.reach) continue;
    if (s.tier <= t.tier) { if (d < best) { best = d; src = s; } }
    else if (d < bigD) { bigD = d; big = s; }
  }
  if (!src && big) t.blocked = big;
  if (src) {
    if (t.freeze <= 0 && t.tank < tier.cap) {
      const amt = Math.min(tier.pump * dt, tier.cap - t.tank, src.volume);
      src.volume -= amt;
      t.tank += amt;
      t.pumping = src;
      t.outrage += T.outragePump * src.prox * dt;
      if (src.volume <= 1e-6) { src.volume = 0; ev.onDrained?.(src); }
    }
  }

  // Delivery at the intake
  t.delivering = false;
  if (t.tank > 0 && Math.hypot(t.x - T.campusX, t.z - T.campusZ) < T.intakeRadius) {
    const amt = Math.min(t.tank, tier.pump * T.deliverRate * dt);
    t.tank -= amt;
    t.delivered += amt;
    t.delivering = true;
    const nt = tierFor(t.delivered);
    while (t.tier < nt) { t.tier++; ev.onTier?.(t.tier); }
  }

  // Outrage
  if (t.freeze <= 0) t.outrage = Math.max(0, t.outrage - T.outrageDecay * dt);
  if (t.outrage >= 100 && t.freeze <= 0 && !t.pickets) {
    t.outrage = 100;
    t.freeze = T.freezeTime;
    t.pickets = true;
    ev.onFreeze?.();
  }
  t.outrage = Math.min(100, t.outrage);
  if (t.pickets && t.freeze <= 0 && t.outrage < T.picketsClearAt) {
    t.pickets = false;
    ev.onPicketsClear?.();
  }
}

// Spend part of the tank to calm people down. Returns false if the tank is too low or on cooldown.
export function prGesture(t) {
  const cost = TIERS[t.tier].cap * T.prCost;
  if (t.prTimer > 0 || t.tank < cost) return false;
  t.tank -= cost;
  t.outrage = Math.max(0, t.outrage - T.prDrop);
  t.prTimer = T.prCooldown;
  return true;
}
