// Asteroid mode visuals: the target reticle, rocks in flight (the canyon rock model, reused),
// impact flash, dust shockwave, and the craters left behind.
import * as THREE from 'three';
import { ASTEROID } from './config.js';
import { rock, wreckLook } from './models.js';
import { mulberry32 } from './world.js';

export function buildAsteroid(scene) {
  const rng = mulberry32(99);

  // Reticle: blast-radius ring with four ticks
  const reticle = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.85, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 56), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({
    color: 0xff5a3c, transparent: true, opacity: 0.12, depthWrite: false,
  }));
  fill.rotation.x = -Math.PI / 2;
  reticle.add(ring, fill);
  for (let i = 0; i < 4; i++) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.3), ringMat);
    t.rotation.x = -Math.PI / 2;
    t.rotation.z = (i * Math.PI) / 2;
    t.position.set(Math.sin((i * Math.PI) / 2) * 0.82, 0, Math.cos((i * Math.PI) / 2) * 0.82);
    reticle.add(t);
  }
  reticle.position.y = 0.08;
  scene.add(reticle);

  const inFlight = [];
  const effects = [];
  let craterCount = 0;

  function launch(tx, tz, s, radius) {
    const built = rock(rng);
    wreckLook(built.group); // scorched look for the incoming rock
    const size = (radius * 0.35) / built.radius;
    built.group.scale.setScalar(size);
    // Glowing entry trail: a stretched additive cone pointing back along the path
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.32, radius * 3.2, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const H = 70 * Math.pow(s, 0.7);
    const from = new THREE.Vector3(tx - H * 0.45, H, tz - H * 0.35);
    const to = new THREE.Vector3(tx, 0, tz);
    const dir = to.clone().sub(from).normalize();
    trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    scene.add(built.group, trail);
    inFlight.push({ group: built.group, trail, from, to, dir, t: 0, radius, s, spin: new THREE.Vector3(rng(), rng(), rng()) });
  }

  function crater(x, z, radius) {
    const g = new THREE.Group();
    const y = 0.04 + Math.min(craterCount++, 200) * 0.0004; // stagger so overlapping craters don't flicker
    const floor = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.62, 20), new THREE.MeshLambertMaterial({ color: 0x3b2c22 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = y;
    floor.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius * 0.6, radius * 0.85, 20), new THREE.MeshLambertMaterial({ color: 0x7a5a42 }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = y + 0.0002;
    rim.receiveShadow = true;
    g.add(floor, rim);
    // A few chunks of thrown-up ground around the rim
    const chunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6448, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = rng() * Math.PI * 2;
      const r = radius * (0.65 + rng() * 0.25);
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * (0.05 + rng() * 0.06), 0), chunkMat);
      c.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      c.castShadow = true;
      g.add(c);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rng() * Math.PI;
    scene.add(g);
  }

  function boom(x, z, radius) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({
      color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flash.position.set(x, 0, z);
    const wave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({
      color: 0xd9b48c, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide,
    }));
    wave.rotation.x = -Math.PI / 2;
    wave.position.set(x, 0.3, z);
    scene.add(flash, wave);
    effects.push({ flash, wave, t: 0, radius });
    crater(x, z, radius);
  }

  // onImpact(x, z, radius, s) is called when a rock lands. Returns camera shake amount for this frame.
  function update(dt, time, s, rx, rz, cooldownLeft, onImpact) {
    reticle.position.set(rx, 0.08, rz);
    reticle.scale.setScalar(ASTEROID.blastRadius * s);
    reticle.rotation.y += dt * 0.6;
    const ready = cooldownLeft <= 0;
    ringMat.opacity = ready ? 0.7 + Math.sin(time * 8) * 0.25 : 0.35;

    let shake = 0;
    for (let i = inFlight.length - 1; i >= 0; i--) {
      const a = inFlight[i];
      a.t += dt / ASTEROID.flightTime;
      const t = Math.min(1, a.t);
      const pos = a.from.clone().lerp(a.to, t * t); // accelerates in
      a.group.position.copy(pos);
      a.group.rotation.x += a.spin.x * dt * 4;
      a.group.rotation.z += a.spin.z * dt * 4;
      a.trail.position.copy(pos).addScaledVector(a.dir, -a.radius * 1.6);
      if (a.t >= 1) {
        scene.remove(a.group, a.trail);
        inFlight.splice(i, 1);
        boom(a.to.x, a.to.z, a.radius);
        onImpact(a.to.x, a.to.z, a.radius, a.s);
        shake = Math.max(shake, 1);
      }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.t += dt;
      const k = e.t / 0.6;
      e.flash.scale.setScalar(e.radius * (0.3 + k * 0.9));
      e.flash.material.opacity = Math.max(0, 0.9 * (1 - k));
      e.wave.scale.setScalar(e.radius * (0.4 + k * 2.2));
      e.wave.material.opacity = Math.max(0, 0.8 * (1 - k));
      if (k >= 1) { scene.remove(e.flash, e.wave); effects.splice(i, 1); }
    }
    return shake;
  }

  return { launch, update, get busy() { return inFlight.length > 0; } };
}
