import * as THREE from 'three';
import { KINDS, UFO, TORNADO, ASTEROID, liftFor, scaleFor } from './config.js';
import { buildWorld, updateMovers, mulberry32 } from './world.js';
import { buildUfo } from './ufo.js';
import { buildTornado } from './tornado.js';
import { buildAsteroid } from './asteroid.js';
import { createInput } from './input.js';
import { stepObjects, stepTornadoObjects, blast, stepAsteroidObjects } from './game.js';

const $ = (id) => document.getElementById(id);

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8ef);
scene.fog = new THREE.Fog(0x9fd8ef, 120, 320);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1500);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0xdff4ff, 0x8a6b4a, 1.25);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(hemi, sun, sun.target);

// ---------- world ----------
const { objects } = buildWorld(scene);
const readInput = createInput($('stick'), $('knob'));
const rng = mulberry32(42);

const totalMass = objects.reduce((s, o) => s + o.mass, 0);
const kindsByMass = Object.entries(KINDS).sort((a, b) => a[1].mass - b[1].mass);
const absorbedFor = (lift) => Math.max(0, (lift - liftFor(0)) / (liftFor(1) - liftFor(0)));

const state = {
  x: 0, z: 124, vx: 0, vz: 0,
  absorbed: 0, lift: liftFor(0), scale: 1,
  pendingPop: 0, popTimer: 0, bannerTimer: 0, heavyTimer: 0,
  remaining: objects.length, ended: false, moved: false,
};

// ---------- players ----------
// Each mode supplies: cfg, popHeight(s), update(dt, time, s, speed), step(dt, time, s)

function ufoMode() {
  const { ufo, beam, ring, lights, edge } = buildUfo(scene);
  return {
    cfg: UFO,
    words: { stat: 'LIFT', banner: 'NOW LIFTING', heavy: 'eat', progress: 'Canyon eaten', end: 'NOTHING LEFT',
      endText: (m) => `Your saucer weighs ${m}. The canyon is empty.` },
    popHeight: () => ufo.position.y,
    update(dt, time, s, speed) {
      const hover = UFO.hoverHeight * s;
      const beamR = UFO.beamRadius * s;
      ufo.position.set(state.x, hover + Math.sin(time * 2.2) * 0.25 * s, state.z);
      ufo.scale.setScalar(s);
      ufo.rotation.set(state.vz / speed * 0.22, ufo.rotation.y + dt * 1.5, -state.vx / speed * 0.22, 'YXZ');
      lights.forEach((l, i) => { l.visible = Math.floor(time * 8 + i) % 3 !== 0; });
      beam.position.set(state.x, ufo.position.y - 0.4 * s, state.z);
      beam.scale.set(beamR, ufo.position.y - 0.4 * s, beamR);
      beam.material.opacity = 0.18 + Math.sin(time * 6) * 0.04;
      ring.position.set(state.x, 0.06, state.z);
      ring.scale.setScalar(beamR);
      edge.material.opacity = 0.6 + Math.sin(time * 5) * 0.25;
    },
    step(dt, time, s) {
      return stepObjects({
        objects, ufoPos: ufo.position, lift: state.lift, scale: s, dt, time,
        absorbedFor, absorbed: state.absorbed, onAbsorb: absorb,
        onRemove: (o) => scene.remove(o.group),
      });
    },
  };
}

function tornadoMode() {
  const storm = 0x8fa3ad;
  scene.background.set(storm);
  scene.fog.color.set(storm);
  hemi.color.set(0xc9d6dc);
  sun.intensity = 1.1;
  const tw = buildTornado(scene);
  const center = new THREE.Vector3();
  const lean = { x: 0, z: 0 };
  return {
    cfg: TORNADO,
    words: { stat: 'POWER', banner: 'NOW FLINGING', heavy: 'fling', progress: 'Canyon wrecked', end: 'TOTAL WRECK',
      endText: (m) => `Your tornado flung ${m} tons. Nothing is standing.` },
    popHeight: (s) => TORNADO.height * s * 0.8,
    update(dt, time, s) {
      center.set(state.x, 0, state.z);
      // The top trails behind the direction of travel
      const k = 1 - Math.exp(-dt * 2);
      lean.x += (state.vx * 0.35 - lean.x) * k;
      lean.z += (state.vz * 0.35 - lean.z) * k;
      tw.root.position.copy(center);
      tw.update(dt, time, s, lean);
    },
    step(dt, time, s) {
      return stepTornadoObjects({
        objects, center, lean, lift: state.lift, scale: s, dt, time, rng,
        absorbedFor, absorbed: state.absorbed, onFling: absorb,
      });
    },
  };
}

function asteroidMode() {
  const dusk = 0xe8b48f;
  scene.background.set(dusk);
  scene.fog.color.set(dusk);
  hemi.color.set(0xffe2c9);
  sun.color.set(0xffc58f);
  const ast = buildAsteroid(scene);
  let cooldown = 0;
  let heavyFromBlast = 0, heavyTimer = 0;
  const btn = $('strike');
  btn.hidden = false;
  const fire = () => {
    if (cooldown > 0 || state.ended) return;
    cooldown = ASTEROID.cooldown;
    state.moved = true;
    ast.launch(state.x, state.z, state.scale, ASTEROID.blastRadius * state.scale);
  };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(); });
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); fire(); } });
  return {
    cfg: ASTEROID,
    words: { stat: 'IMPACT', banner: 'NOW BLASTING', heavy: 'blast', progress: 'Canyon cratered', end: 'EXTINCTION EVENT',
      endText: (m) => `You blasted ${m} tons into the sky. Nothing is left standing.` },
    popHeight: (s) => 6 * s,
    update(dt, time, s) {
      cooldown = Math.max(0, cooldown - dt);
      btn.style.setProperty('--cd', `${(cooldown / ASTEROID.cooldown) * 360}deg`);
      btn.classList.toggle('ready', cooldown <= 0);
      const shake = ast.update(dt, time, s, state.x, state.z, cooldown, (x, z, radius, rs) => {
        const need = blast({ objects, cx: x, cz: z, radius, lift: state.lift, scale: rs, rng,
          absorbedFor, absorbed: state.absorbed, onFling: absorb });
        if (need) { heavyFromBlast = need; heavyTimer = 1.4; }
      });
      if (shake) state.shake = Math.max(state.shake || 0, 0.5 * Math.sqrt(s));
    },
    step(dt, time, s) {
      stepAsteroidObjects({ objects, scale: s, dt, time, rng });
      heavyTimer -= dt;
      return heavyTimer > 0 ? heavyFromBlast : 0;
    },
  };
}

let mode = null;

// ---------- HUD helpers ----------
function fmt(n) { return Math.floor(n).toLocaleString(); }

function updateHud() {
  $('mass').textContent = fmt(state.absorbed);
  $('lift').textContent = fmt(state.lift);
  const nk = kindsByMass.find(([, k]) => k.mass > state.lift);
  if (!nk) {
    $('nextLabel').textContent = `${mode.words.progress}: ${Math.floor((state.absorbed / totalMass) * 100)}%`;
    $('nextFill').style.width = `${(state.absorbed / totalMass) * 100}%`;
    return;
  }
  const prev = [...kindsByMass].reverse().find(([, k]) => k.mass <= state.lift);
  const from = absorbedFor(prev ? Math.max(prev[1].mass, liftFor(0)) : liftFor(0));
  const to = absorbedFor(nk[1].mass);
  const t = Math.min(1, Math.max(0, (state.absorbed - from) / (to - from)));
  $('nextLabel').textContent = `Next: ${nk[1].label}`;
  $('nextFill').style.width = `${t * 100}%`;
}

function showBanner(label) {
  $('bannerText').textContent = label.toUpperCase();
  $('banner').classList.add('show');
  state.bannerTimer = 1.8;
}

const tmpV = new THREE.Vector3();
function popAt(amount) {
  tmpV.set(state.x, mode.popHeight(state.scale), state.z).project(camera);
  const el = document.createElement('div');
  el.className = 'pop stroke';
  el.textContent = `+${fmt(amount)}`;
  el.style.left = `${(tmpV.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 40}px`;
  el.style.top = `${(-tmpV.y * 0.5 + 0.5) * innerHeight - 30}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function absorb(o) {
  const before = state.lift;
  state.absorbed += o.mass;
  state.lift = liftFor(state.absorbed);
  state.pendingPop += o.mass;
  state.remaining--;
  for (const [, k] of kindsByMass) {
    if (k.mass > before && k.mass <= state.lift) showBanner(k.label);
  }
  // Give the last flung things time to land before the end card
  if (state.remaining === 0) setTimeout(endGame, 2500);
}

function endGame() {
  state.ended = true;
  $('endTitle').textContent = mode.words.end;
  $('endText').textContent = mode.words.endText(fmt(state.absorbed));
  $('end').classList.add('show');
}
$('again').addEventListener('click', () => location.reload());

// ---------- main loop ----------
const clock = new THREE.Clock();
let time = 0;

function placeCamera(dt, s) {
  const portrait = Math.max(1, 1 / camera.aspect) ** 0.55;
  const tall = mode === null || mode.cfg === UFO ? 1 : 1.15;
  const dist = 30 * (0.7 + 0.3 * s) * portrait * tall;
  tmpV.set(state.x, dist * 0.85, state.z + dist * 0.62);
  camera.position.lerp(tmpV, dt === null ? 1 : 1 - Math.exp(-dt * 4));
  camera.lookAt(state.x, 7 * s * 0.25 * tall, state.z - dist * 0.08);
  if (state.shake > 0 && dt !== null) {
    const a = state.shake;
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
    state.shake = Math.max(0, state.shake - dt * 2.5 * Math.max(1, a));
  }
  scene.fog.near = dist * 2.2;
  scene.fog.far = dist * 6 + 140;
  const sb = dist * 1.3;
  sun.position.set(state.x + 40 * s, 70 * s + 40, state.z + 25 * s);
  sun.target.position.set(state.x, 0, state.z - dist * 0.2);
  Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 1, far: 260 * s + 200 });
  sun.shadow.camera.updateProjectionMatrix();
}

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  time += dt;

  state.scale += (scaleFor(state.lift) - state.scale) * (1 - Math.exp(-dt * 2.5));
  const s = state.scale;

  // Movement: screen up is world -z
  const inp = readInput();
  if (inp.x || inp.y) state.moved = true;
  const speed = mode.cfg.speed * Math.pow(s, mode.cfg.speedGrowth);
  const k = 1 - Math.exp(-dt * 6);
  state.vx += (inp.x * speed - state.vx) * k;
  state.vz += (inp.y * speed - state.vz) * k;
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  const r = Math.hypot(state.x, state.z);
  if (r > mode.cfg.worldRadius) { state.x *= mode.cfg.worldRadius / r; state.z *= mode.cfg.worldRadius / r; }

  mode.update(dt, time, s, speed);
  updateMovers(objects, dt, rng);
  const heaviestNeed = mode.step(dt, time, s);

  state.popTimer -= dt;
  if (state.pendingPop > 0 && state.popTimer <= 0) { popAt(state.pendingPop); state.pendingPop = 0; state.popTimer = 0.18; }
  if (state.bannerTimer > 0 && (state.bannerTimer -= dt) <= 0) $('banner').classList.remove('show');
  if (heaviestNeed > 0) {
    state.heavyTimer = 0.4;
    $('heavyText').textContent = `${mode.words.heavy} ${fmt(heaviestNeed)} more mass`;
    $('heavy').classList.add('show');
  } else if (state.heavyTimer > 0 && (state.heavyTimer -= dt) <= 0) {
    $('heavy').classList.remove('show');
  }
  if (state.moved) $('hint').style.opacity = '0';
  updateHud();

  placeCamera(dt, s);
  renderer.render(scene, camera);
  if (!state.ended) requestAnimationFrame(tick);
}

// ---------- start screen ----------
function start(which) {
  mode = which === 'tornado' ? tornadoMode() : which === 'asteroid' ? asteroidMode() : ufoMode();
  $('statLabel').textContent = mode.words.stat;
  $('bannerLead').textContent = mode.words.banner;
  $('pick').classList.add('gone');
  $('hud').hidden = false;
  $('hint').hidden = false;
  if (which === 'asteroid') $('hint').textContent = 'Drag to aim · tap STRIKE or press Space';
  clock.getDelta();
  requestAnimationFrame(tick);
}
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => start(b.dataset.mode)));

placeCamera(null, 1);
renderer.render(scene, camera);

// ?ufo or ?tornado skips the picker. ?debug exposes helpers in the console.
const params = new URLSearchParams(location.search);
if (params.has('ufo')) start('ufo');
if (params.has('tornado')) start('tornado');
if (params.has('asteroid')) start('asteroid');
if (params.has('debug')) {
  window.game = {
    state, objects,
    give(m) { state.absorbed += m; state.lift = liftFor(state.absorbed); },
    goto(x, z) { state.x = x; state.z = z; },
  };
}
