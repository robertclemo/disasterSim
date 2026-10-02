// Per-frame object logic, shared by the game and the headless balance sim.
import { UFO } from './config.js';

// Advances every object one frame. `ufoPos` is the saucer's world position.
// Calls onAbsorb(o) when something disappears into the saucer.
// Returns the smallest extra mass needed to lift anything too heavy in the beam (0 if none).
export function stepObjects({ objects, ufoPos, lift, scale, dt, time, absorbedFor, absorbed, onAbsorb, onRemove }) {
  const beamR = UFO.beamRadius * scale;
  let heaviestNeed = 0;

  for (const o of objects) {
    if (o.state === 'gone') continue;
    const p = o.group.position;
    const dx = ufoPos.x - p.x, dz = ufoPos.z - p.z;
    const d = Math.hypot(dx, dz);

    if (o.state === 'ground') {
      if (d < beamR + o.radius * 0.35) {
        if (o.mass <= lift) {
          o.state = 'lifting';
          o.vy = 0;
          if (o.mover && o.mover.type === 'drive') o.mover = null;
        } else {
          const need = Math.ceil(absorbedFor(o.mass) - absorbed);
          heaviestNeed = heaviestNeed ? Math.min(heaviestNeed, need) : need;
          o.group.rotation.z = Math.sin(time * 40) * 0.04;
        }
      } else if (o.group.rotation.z) {
        o.group.rotation.z *= 0.8;
      }
    } else if (o.state === 'lifting') {
      const strain = 1 - 0.65 * (o.mass / lift);
      o.vy = Math.min(o.vy + UFO.liftAccel * scale * strain * dt, 9 * scale * strain + 2);
      p.y += o.vy * dt;
      const pull = 1 - Math.exp(-dt * 2.2);
      p.x += dx * pull; p.z += dz * pull;
      o.group.rotation.y += o.spin * dt;
      o.group.rotation.x = Math.sin(time * 3 + o.spin) * 0.25;
      if (d > beamR * 1.4 + o.radius) o.state = 'falling';
      else if (p.y + o.height * 0.5 >= ufoPos.y - 0.5 * scale) o.state = 'absorbing';
    } else if (o.state === 'absorbing') {
      o.shrink -= dt * 5;
      o.group.scale.setScalar(Math.max(0, o.shrink));
      const k = 1 - Math.exp(-dt * 12);
      p.x += (ufoPos.x - p.x) * k; p.y += (ufoPos.y - p.y) * k; p.z += (ufoPos.z - p.z) * k;
      if (o.shrink <= 0) {
        o.state = 'gone';
        onRemove?.(o);
        onAbsorb(o);
      }
    } else if (o.state === 'falling') {
      o.vy -= 30 * dt;
      p.y += o.vy * dt;
      if (p.y <= 0) {
        p.y = 0; o.vy = 0; o.state = 'ground';
        o.group.rotation.x = 0;
      }
    }
  }
  return heaviestNeed;
}

// ---------- Tornado ----------
import { TORNADO } from './config.js';
import { wreckLook } from './models.js';

// Funnel radius at height h (world units) for a tornado at scale s.
export function funnelRadius(h, s) {
  const t = Math.min(1, Math.max(0, h / (TORNADO.height * s)));
  return s * (TORNADO.baseRadius + (TORNADO.topRadius - TORNADO.baseRadius) * Math.pow(t, 1.6));
}

// Sideways offset of the funnel's centre line at height h, so it snakes and trails behind movement.
export function funnelSway(h, s, time, lean, out) {
  const t = Math.min(1, h / (TORNADO.height * s));
  const amp = 1.4 * s * Math.pow(t, 1.5);
  out.x = Math.sin(time * 1.1 + (h / s) * 0.18) * amp - lean.x * t;
  out.z = Math.cos(time * 0.9 + (h / s) * 0.13) * amp - lean.z * t;
  return out;
}

const sw = { x: 0, z: 0 };

// Objects spiral up the funnel, get flung out on an arc, and land as wreckage.
// onFling(o) fires at launch (that's when mass counts). Returns extra mass needed like stepObjects.
export function stepTornadoObjects({ objects, center, lean, lift, scale: s, dt, time, absorbedFor, absorbed, onFling, onLand, rng }) {
  const catchR = TORNADO.catchRadius * s;
  const H = TORNADO.height * s;
  let heaviestNeed = 0;

  for (const o of objects) {
    const st = o.state;
    if (st === 'gone' || st === 'wreck') continue;
    const p = o.group.position;

    if (st === 'ground') {
      const dx = p.x - center.x, dz = p.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d < catchR + o.radius * 0.35) {
        if (o.mass <= lift) {
          o.state = 'orbit';
          o.ang = Math.atan2(dz, dx);
          o.r = d;
          o.h = p.y;
          o.ejectH = H * (0.5 + rng() * 0.45);
          if (o.mover) o.mover = null;
        } else {
          const need = Math.ceil(absorbedFor(o.mass) - absorbed);
          heaviestNeed = heaviestNeed ? Math.min(heaviestNeed, need) : need;
          o.group.rotation.z = Math.sin(time * 40) * 0.05;
        }
      } else if (o.group.rotation.z) {
        o.group.rotation.z *= 0.8;
      }
    } else if (st === 'orbit') {
      const strain = 1 - 0.6 * (o.mass / lift);
      const t = o.h / H;
      o.ang += TORNADO.spin * (1.5 - t) * dt;
      o.h += TORNADO.riseSpeed * Math.sqrt(s) * strain * dt;
      const target = funnelRadius(o.h, s) * 1.08 + o.radius * 0.35;
      o.r += (target - o.r) * (1 - Math.exp(-dt * 3));
      funnelSway(o.h, s, time, lean, sw);
      p.set(center.x + sw.x + Math.cos(o.ang) * o.r, o.h, center.z + sw.z + Math.sin(o.ang) * o.r);
      o.group.rotation.y += o.spin * 2 * dt;
      o.group.rotation.x += o.spin * dt;

      if (o.h >= o.ejectH) {
        // Launch: tangent to the spin plus an outward kick and some lift
        const c = Math.cos(o.ang), sn = Math.sin(o.ang);
        // Launch speed grows slower than the camera pulls back, so arcs stay on screen
        const k = Math.pow(s, 0.4);
        const out = TORNADO.flingSpeed * k * (0.5 + rng() * 0.9);
        const tan = TORNADO.spin * (1.5 - t) * (o.r / s) * 0.35 * k;
        o.vx = c * out - sn * tan;
        o.vz = sn * out + c * tan;
        o.vy = (3 + rng() * 9) * Math.sqrt(s);
        o.state = 'flung';
        onFling(o);
      }
    } else if (st === 'flung') {
      o.vy -= TORNADO.gravity * Math.sqrt(s) * dt;
      p.x += o.vx * dt; p.y += o.vy * dt; p.z += o.vz * dt;
      o.group.rotation.x += o.spin * 2.5 * dt;
      o.group.rotation.z += o.spin * 1.5 * dt;
      if (p.y <= 0 && o.vy < 0) {
        o.state = 'wreck';
        wreckLook(o.group);
        const upsideDown = o.mass < 200 && rng() < 0.4;
        o.group.rotation.set(upsideDown ? Math.PI : (rng() - 0.5) * 0.5, o.group.rotation.y, (rng() - 0.5) * 0.5);
        o.group.scale.set(1, 0.8, 1);
        p.y = upsideDown ? o.height * 0.8 : 0;
        onLand?.(o);
      }
    }
  }
  return heaviestNeed;
}
