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
