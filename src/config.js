// All the tuning knobs live here. Change numbers, refresh, play.

// Every liftable thing in the world. `mass` is what it adds to the UFO
// and what lift you need to pick it up. `label` shows in unlock banners.
export const KINDS = {
  crop:   { mass: 1,    label: 'Crops' },
  hay:    { mass: 2,    label: 'Hay bales' },
  fence:  { mass: 2,    label: 'Fences' },
  bench:  { mass: 2,    label: 'Benches' },
  sheep:  { mass: 3,    label: 'Sheep' },
  person: { mass: 3,    label: 'Townsfolk' },
  cow:    { mass: 5,    label: 'Cows' },
  lamp:   { mass: 6,    label: 'Street lamps' },
  tree:   { mass: 9,    label: 'Trees' },
  car:    { mass: 15,   label: 'Cars' },
  van:    { mass: 25,   label: 'Vans' },
  truck:  { mass: 45,   label: 'Trucks' },
  house:  { mass: 120,  label: 'Houses' },
  shop:   { mass: 300,  label: 'Shops' },
  tower:  { mass: 900,  label: 'Apartment towers' },
  rock:   { mass: 1200, label: 'The canyon itself' },
};

// Lift capacity grows with everything you've absorbed.
export const START_LIFT = 3;
export const LIFT_PER_MASS = 0.06;
export const liftFor = (absorbed) => START_LIFT + LIFT_PER_MASS * absorbed;

// UFO size follows lift. 1.0 at the start.
export const scaleFor = (lift) => Math.pow(lift / START_LIFT, 0.3);

export const UFO = {
  hoverHeight: 7,     // world units at scale 1
  beamRadius: 3.2,    // ground radius of the beam at scale 1
  speed: 13,          // units/sec at scale 1
  speedGrowth: 0.55,  // speed multiplies by scale^speedGrowth
  liftAccel: 26,      // how fast things rise in the beam
  worldRadius: 205,   // how far the UFO can roam
};

export const TORNADO = {
  height: 18,         // funnel height at scale 1
  baseRadius: 1.1,    // funnel radius at the ground
  topRadius: 7.5,     // funnel radius at the top
  catchRadius: 3.6,   // ground radius that pulls things in at scale 1
  speed: 13,
  speedGrowth: 0.55,
  riseSpeed: 7,       // how fast caught things climb the funnel
  spin: 4.2,          // orbit speed (radians/sec) near the ground
  flingSpeed: 8,      // outward launch speed at scale 1
  gravity: 24,        // lower = floatier arcs
  worldRadius: 205,
};

export const ASTEROID = {
  blastRadius: 6.5,    // impact radius at scale 1
  cooldown: 0.8,      // seconds between strikes
  flightTime: 0.7,    // seconds from launch to impact
  flingSpeed: 10,     // outward launch speed at the edge-to-centre midpoint
  gravity: 24,
  speed: 16,          // reticle speed at scale 1
  speedGrowth: 0.55,
  worldRadius: 205,
};

export const WORLD = {
  seed: 1977,
  blocks: 6,          // town is blocks x blocks
  blockSize: 22,
  roadWidth: 8,
  farmOuter: 165,     // farmland extends to here
  cliffInner: 178,    // canyon walls start here
};

// ---------- Data center mode ----------
// Water sources. `volume` is in water units; the HUD shows units x 1,000 as gallons.
export const WATER = {
  birdbath:  { tier: 0, volume: 1,    label: 'Birdbaths' },
  kiddie:    { tier: 0, volume: 3,    label: 'Kiddie pools' },
  pool:      { tier: 1, volume: 12,   label: 'Backyard pools' },
  fountain:  { tier: 2, volume: 30,   label: 'Fountains' },
  pond:      { tier: 3, volume: 120,  label: 'Park ponds' },
  farmpond:  { tier: 4, volume: 300,  label: 'Farm ponds' },
  tower:     { tier: 5, volume: 600,  label: 'Water towers' },
  reservoir: { tier: 6, volume: 4000, label: 'The municipal reservoir' },
};

// Truck tiers, unlocked by total water delivered. Each one is a press release.
export const TIERS = [
  { at: 0,    cap: 10,   pump: 3,   speed: 1.0,   pr: 'Wellspring Compute is proud to join your community!' },
  { at: 20,   cap: 24,   pump: 6,   speed: 1.15,  pr: 'Community Partnership Unlocked!' },
  { at: 80,   cap: 55,   pump: 11,  speed: 1.3,   pr: 'Civic Engagement Initiative Launched!' },
  { at: 250,  cap: 180,  pump: 28,  speed: 1.5,  pr: 'Green Campus Certified!' },
  { at: 700,  cap: 500,  pump: 60,  speed: 1.75,  pr: 'Rural Prosperity Program Announced!' },
  { at: 1700, cap: 1100, pump: 110, speed: 2.0,   pr: 'Infrastructure Synergy Achieved!' },
  { at: 3200, cap: 2200, pump: 200, speed: 2.3,   pr: 'Water Neutral by 2090!' },
];

export const TANKER = {
  speed: 15,
  speedGrowth: 0,        // speed comes from the tier table instead
  worldRadius: 205,
  campusX: 0,
  campusZ: 140,
  intakeRadius: 8,       // drive inside this ring to deliver
  deliverRate: 3,        // delivery speed as a multiple of pump speed
  reach: 3,              // how close the truck must be to a water source's edge
  outragePump: 12,       // outrage per second while pumping, at full residential proximity
  outrageDecay: 1.2,     // outrage lost per second
  outrageBulldoze: { house: 6, shop: 9, tower: 14 },
  freezeTime: 8,         // seconds of permit freeze at max outrage
  picketsClearAt: 40,    // pickets go home once outrage falls below this
  picketSlow: 0.35,      // truck speed multiplier inside a picket line
  prCost: 0.25,          // share of a full tank spent on one PR gesture
  prDrop: 35,            // outrage removed per PR gesture
  prCooldown: 2,
  hallW: 12, hallD: 9.5, cellW: 15, cellD: 12.5,
};
