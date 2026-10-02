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

export const WORLD = {
  seed: 1977,
  blocks: 6,          // town is blocks x blocks
  blockSize: 22,
  roadWidth: 8,
  farmOuter: 165,     // farmland extends to here
  cliffInner: 178,    // canyon walls start here
};
