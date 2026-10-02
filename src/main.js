import * as THREE from 'three';
import { KINDS, UFO, liftFor, scaleFor } from './config.js';
import { buildWorld, updateMovers, mulberry32 } from './world.js';
import { buildUfo } from './ufo.js';
import { createInput } from './input.js';
import { stepObjects } from './game.js';

const $ = (id) => document.getElementById(id);

// ---------- renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const SKY = 0x9fd8ef;
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 120, 320);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 1500);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.HemisphereLight(0xdff4ff, 0x8a6b4a, 1.25));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

// ---------- world + player ----------
const { objects } = buildWorld(scene);
const { ufo, beam, ring, lights, edge } = buildUfo(scene);
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

// ---------- HUD helpers ----------
function fmt(n) { return Math.floor(n).toLocaleString(); }

function nextKind() { return kindsByMass.find(([, k]) => k.mass > state.lift); }

function updateHud() {
  $('mass').textContent = fmt(state.absorbed);
  $('lift').textContent = fmt(state.lift);
  const nk = nextKind();
  if (!nk) {
    $('nextLabel').textContent = `Canyon eaten: ${Math.floor((state.absorbed / totalMass) * 100)}%`;
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
  tmpV.set(state.x, ufo.position.y, state.z).project(camera);
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
  if (state.remaining === 0) endGame();
}

function endGame() {
  state.ended = true;
  $('endText').textContent = `Your saucer weighs ${fmt(state.absorbed)}. The canyon is empty.`;
  $('end').classList.add('show');
}
$('again').addEventListener('click', () => location.reload());

// ---------- main loop ----------
const clock = new THREE.Clock();
let time = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  time += dt;

  // Size eases toward what our lift says it should be
  const targetScale = scaleFor(state.lift);
  state.scale += (targetScale - state.scale) * (1 - Math.exp(-dt * 2.5));
  const s = state.scale;
  const hover = UFO.hoverHeight * s;
  const beamR = UFO.beamRadius * s;

  // Movement: screen up is world -z
  const inp = readInput();
  if (inp.x || inp.y) state.moved = true;
  const speed = UFO.speed * Math.pow(s, UFO.speedGrowth);
  const k = 1 - Math.exp(-dt * 6);
  state.vx += (inp.x * speed - state.vx) * k;
  state.vz += (inp.y * speed - state.vz) * k;
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  const r = Math.hypot(state.x, state.z);
  if (r > UFO.worldRadius) { state.x *= UFO.worldRadius / r; state.z *= UFO.worldRadius / r; }

  // Saucer pose
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

  // Objects
  updateMovers(objects, dt, rng);
  const heaviestNeed = stepObjects({
    objects, ufoPos: ufo.position, lift: state.lift, scale: s, dt, time,
    absorbedFor, absorbed: state.absorbed, onAbsorb: absorb,
    onRemove: (o) => scene.remove(o.group),
  });

  // HUD timers
  state.popTimer -= dt;
  if (state.pendingPop > 0 && state.popTimer <= 0) { popAt(state.pendingPop); state.pendingPop = 0; state.popTimer = 0.18; }
  if (state.bannerTimer > 0 && (state.bannerTimer -= dt) <= 0) $('banner').classList.remove('show');
  if (heaviestNeed > 0) {
    state.heavyTimer = 0.4;
    $('heavyText').textContent = `eat ${fmt(heaviestNeed)} more mass`;
    $('heavy').classList.add('show');
  } else if (state.heavyTimer > 0 && (state.heavyTimer -= dt) <= 0) {
    $('heavy').classList.remove('show');
  }
  if (state.moved) $('hint').style.opacity = '0';
  updateHud();

  // Camera pulls back as the saucer grows; a bit further on portrait screens
  const portrait = Math.max(1, 1 / camera.aspect) ** 0.55;
  const dist = 30 * (0.7 + 0.3 * s) * portrait;
  const camTarget = tmpV.set(state.x, 0, state.z + dist * 0.62);
  camera.position.lerp(camTarget.setY(dist * 0.85), 1 - Math.exp(-dt * 4));
  camera.lookAt(state.x, hover * 0.25, state.z - dist * 0.08);
  scene.fog.near = dist * 2.2;
  scene.fog.far = dist * 6 + 140;

  // Shadow box follows the player and grows with the camera
  const sb = dist * 1.3;
  sun.position.set(state.x + 40 * s, 70 * s + 40, state.z + 25 * s);
  sun.target.position.set(state.x, 0, state.z - dist * 0.2);
  Object.assign(sun.shadow.camera, { left: -sb, right: sb, top: sb, bottom: -sb, near: 1, far: 260 * s + 200 });
  sun.shadow.camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  if (!state.ended) requestAnimationFrame(tick);
}

camera.position.set(state.x, 26, state.z + 19);
requestAnimationFrame(tick);

// Test hook: ?debug exposes state so you can teleport or grant mass from the console
if (new URLSearchParams(location.search).has('debug')) {
  window.game = {
    state, objects,
    give(m) { state.absorbed += m; state.lift = liftFor(state.absorbed); },
    goto(x, z) { state.x = x; state.z = z; },
  };
}
