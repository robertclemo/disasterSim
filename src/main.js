import * as THREE from 'three';
import { KINDS, UFO, TORNADO, ASTEROID, TANKER, TIERS, WATER, WORLD, liftFor, scaleFor } from './config.js';
import { buildWorld, updateMovers, mulberry32 } from './world.js';
import { buildUfo } from './ufo.js';
import { buildTornado } from './tornado.js';
import { buildAsteroid } from './asteroid.js';
import { buildWater } from './water.js';
import { buildTruck, buildCampus, buildPickets } from './datacenter.js';
import { createTanker, stepTanker, prGesture, hallsFor } from './tanker-logic.js';
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
const world = buildWorld(scene);
const { objects } = world;
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
  const fire = () => {
    if (cooldown > 0 || state.ended) return;
    cooldown = ASTEROID.cooldown;
    state.moved = true;
    ast.launch(state.x, state.z, state.scale, ASTEROID.blastRadius * state.scale);
  };
  readInput.onDoubleTap = fire;
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); fire(); } });
  return {
    cfg: ASTEROID,
    words: { stat: 'IMPACT', banner: 'NOW BLASTING', heavy: 'blast', progress: 'Canyon cratered', end: 'EXTINCTION EVENT',
      endText: (m) => `You blasted ${m} tons into the sky. Nothing is left standing.` },
    popHeight: (s) => 6 * s,
    update(dt, time, s) {
      cooldown = Math.max(0, cooldown - dt);
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

// ---------- data center ----------
const PR_GESTURES = ['Free tote bags', 'Community splash pad', 'Sustainability report', 'Branded water bottles',
  'Thoughts and prayers', 'Little League sponsorship', 'Hydration awareness week'];

function gal(units) {
  const g = units * 1000;
  if (g >= 1e6) return `${(g / 1e6).toFixed(g >= 1e7 ? 0 : 1)}M`;
  if (g >= 1e3) return `${Math.round(g / 1e3)}K`;
  return `${Math.round(g)}`;
}

function dataMode() {
  scene.background.set(0xbfe3f0);
  scene.fog.color.set(0xbfe3f0);
  const sources = buildWater(scene, world);
  const truck = buildTruck(scene);
  const campus = buildCampus(scene, objects, sources);
  const pitch = WORLD.blockSize + WORLD.roadWidth;
  const roadLines = Array.from({ length: WORLD.blocks + 1 }, (_, i) => -world.half + i * pitch);
  const pickets = buildPickets(scene, roadLines, world.townEdge);
  const tk = createTanker();
  state.x = tk.x; state.z = tk.z;
  campus.addHall();
  const totalWater = sources.reduce((a, s) => a + s.max, 0);
  let popDelivered = 0, popTimer = 0, heading = Math.PI, done = false;

  const tierLabel = (t) => Object.values(WATER).filter((w) => w.tier === t).map((w) => w.label).join(' & ');
  const pr = () => {
    if (state.ended) return;
    if (prGesture(tk)) {
      showBanner(PR_GESTURES[Math.floor(Math.random() * PR_GESTURES.length)], `PR GESTURE · OUTRAGE -${TANKER.prDrop}`);
    } else if (tk.prTimer <= 0) {
      popAt('Tank too low for PR');
    }
  };
  readInput.onDoubleTap = pr;
  addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); pr(); } });
  $('outrage').hidden = false;
  $('massLabel').textContent = 'DELIVERED';

  return {
    cfg: TANKER,
    words: { stat: 'TANK', banner: 'NOW PUMPING', end: 'DROUGHT DECLARED',
      endText: () => `Wellspring Compute moved ${gal(tk.delivered)} gallons into the cloud. Shareholders are thrilled.` },
    popHeight: (s) => 4 * s,
    scaleTarget: () => 1 + 0.22 * tk.tier,
    speedMult: () => TIERS[tk.tier].speed * (pickets.blocks(state.x, state.z) ? TANKER.picketSlow : 1),
    update(dt, time, s) {
      tk.x = state.x; tk.z = state.z;
      if (Math.hypot(state.vx, state.vz) > 0.5) {
        const want = Math.atan2(state.vx, state.vz);
        let d = want - heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        heading += d * (1 - Math.exp(-dt * 8));
      }
      truck.group.position.set(state.x, 0, state.z);
      truck.group.rotation.y = heading;
      truck.group.scale.setScalar(s);
      truck.group.updateMatrixWorld();
    },
    step(dt, time, s) {
      const before = tk.delivered;
      stepTanker(tk, sources, dt, {
        onDrained: () => popAt('Drained!'),
        onTier: (t) => showBanner(tierLabel(t), TIERS[t].pr),
        onFreeze: () => {
          showBanner('PERMIT FROZEN', 'City council is reviewing concerns', 3);
          pickets.spawnNear(state.x, state.z);
          state.shake = 0.6;
        },
        onPicketsClear: () => { pickets.clear(); popAt('Protesters went home'); },
      });
      popDelivered += tk.delivered - before;
      popTimer -= dt;
      if (popDelivered > 0 && popTimer <= 0 && !tk.delivering) { popAt(`+${gal(popDelivered)} gal`); popDelivered = 0; }
      if (popDelivered > 0 && popTimer <= 0 && tk.delivering && popDelivered > TIERS[tk.tier].cap * 0.3) {
        popAt(`+${gal(popDelivered)} gal`); popDelivered = 0; popTimer = 0.3;
      }
      while (campus.count < hallsFor(tk.delivered)) {
        const before = campus.count;
        tk.outrage = Math.min(100, tk.outrage + campus.addHall());
        if (campus.count === before) break;
        popAt('+1 SERVER HALL');
      }
      if (tk.pumping) tk.pumping.setLevel(tk.pumping.volume / tk.pumping.max);
      for (const src of sources) if (src.update && src.alive) src.update(dt, time);
      campus.update(dt, time, tk.delivering);
      pickets.update(time);
      truck.setFill(tk.tank / TIERS[tk.tier].cap);
      truck.setHose(tk.pumping, time, Math.max(1, s * 0.8));

      const left = sources.some((src) => src.alive && src.volume > 0);
      if (!left && tk.tank < 0.01 && !done) { done = true; setTimeout(endGame, 1200); }

      if (tk.freeze > 0) return { title: 'PERMIT FROZEN', text: `pumping resumes in ${Math.ceil(tk.freeze)}s` };
      if (tk.blocked) {
        const need = TIERS[tk.blocked.tier].at - tk.delivered;
        return { title: 'PUMP TOO SMALL', text: `deliver ${gal(need)} more gallons` };
      }
      if (tk.tank >= TIERS[tk.tier].cap - 1e-6 && !tk.delivering) return { title: 'TANK FULL', text: 'head back to the campus', soft: true };
      return 0;
    },
    hud() {
      const tier = TIERS[tk.tier], next = TIERS[tk.tier + 1];
      $('mass').textContent = gal(tk.delivered);
      $('lift').textContent = `${gal(tk.tank)}/${gal(tier.cap)}`;
      if (next) {
        $('nextLabel').textContent = `Next: ${tierLabel(tk.tier + 1)}`;
        $('nextFill').style.width = `${Math.min(100, ((tk.delivered - tier.at) / (next.at - tier.at)) * 100)}%`;
      } else {
        const remaining = sources.reduce((a, src) => a + (src.alive ? src.volume : 0), 0);
        $('nextLabel').textContent = `Town water left: ${Math.ceil((remaining / totalWater) * 100)}%`;
        $('nextFill').style.width = `${(remaining / totalWater) * 100}%`;
      }
      $('outrageLabel').textContent = tk.freeze > 0 ? 'PERMIT FROZEN' : tk.pickets ? 'PUBLIC OUTRAGE · PICKETS OUT' : 'PUBLIC OUTRAGE';
      $('outrageFill').style.width = `${tk.outrage}%`;
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

function showBanner(label, lead = mode.words.banner, secs = 1.8) {
  $('bannerText').textContent = label.toUpperCase();
  $('bannerLead').textContent = lead;
  $('banner').classList.add('show');
  state.bannerTimer = secs;
}

const tmpV = new THREE.Vector3();
function popAt(amount) {
  const text = typeof amount === 'string' ? amount : `+${fmt(amount)}`;
  tmpV.set(state.x, mode.popHeight(state.scale), state.z).project(camera);
  const el = document.createElement('div');
  el.className = 'pop stroke';
  el.textContent = text;
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

  const targetScale = mode.scaleTarget ? mode.scaleTarget() : scaleFor(state.lift);
  state.scale += (targetScale - state.scale) * (1 - Math.exp(-dt * 2.5));
  const s = state.scale;

  // Movement: screen up is world -z
  const inp = readInput();
  if (inp.x || inp.y) state.moved = true;
  const speed = mode.cfg.speed * Math.pow(s, mode.cfg.speedGrowth) * (mode.speedMult ? mode.speedMult() : 1);
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
  if (heaviestNeed) {
    state.heavyTimer = 0.4;
    const msg = typeof heaviestNeed === 'object' ? heaviestNeed
      : { title: 'TOO HEAVY', text: `${mode.words.heavy} ${fmt(heaviestNeed)} more mass` };
    $('heavyTitle').textContent = msg.title;
    $('heavyText').textContent = msg.text;
    $('heavy').classList.toggle('soft', !!msg.soft);
    $('heavy').classList.add('show');
  } else if (state.heavyTimer > 0 && (state.heavyTimer -= dt) <= 0) {
    $('heavy').classList.remove('show');
  }
  if (state.moved) $('hint').style.opacity = '0';
  if (mode.hud) mode.hud(); else updateHud();

  placeCamera(dt, s);
  renderer.render(scene, camera);
  if (!state.ended) requestAnimationFrame(tick);
}

// ---------- start screen ----------
function start(which) {
  mode = { tornado: tornadoMode, asteroid: asteroidMode, datacenter: dataMode }[which]?.() ?? ufoMode();
  $('statLabel').textContent = mode.words.stat;
  $('bannerLead').textContent = mode.words.banner;
  $('pick').classList.add('gone');
  $('hud').hidden = false;
  $('hint').hidden = false;
  if (which === 'asteroid') $('hint').textContent = 'Drag to aim · double-tap to strike';
  if (which === 'datacenter') $('hint').textContent = 'Drag to drive · park by water to pump · double-tap for PR';
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
if (params.has('datacenter')) start('datacenter');
if (params.has('debug')) {
  window.game = {
    state, objects,
    give(m) { state.absorbed += m; state.lift = liftFor(state.absorbed); },
    goto(x, z) { state.x = x; state.z = z; },
  };
}
