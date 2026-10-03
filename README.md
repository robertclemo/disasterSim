# disasterSim

The game those mobile ads promise. Pick a UFO, a tornado, an asteroid, or a data center and wreck a low-poly canyon town.

- **UFO:** beam things up and they vanish into the saucer.
- **Tornado:** things spiral up the funnel, get flung out on an arc, and land as scorched wreckage.
- **Asteroid:** aim a reticle and double-tap to strike. Each impact leaves a crater and blasts everything in range outward. Wreckage gets kicked around again by later hits.
- **Data center:** drive a Wellspring Compute tanker, park by water to pump it dry, and haul it back to the campus. Deliveries build server halls that bulldoze whatever is next to them and upgrade your truck from birdbaths up to the municipal reservoir. Pumping near homes raises public outrage; max it out and you get a permit freeze plus picket lines. Double-tap for a PR gesture that spends some water to calm things down.

In the disaster modes, what you take makes you bigger, and bigger means you can lift heavier things: crops and sheep, then cows, cars, trucks, houses, shops, apartment towers, and finally the canyon walls. No paywalls, no timers, no upgrade shop.

## Run it

```
npm install
npm run dev      # local dev server, open the printed URL (works on your phone over LAN)
npm run build    # static build in dist/, ready for GitHub Pages
npm run sim      # headless bot playthrough (UFO) that prints unlock times
npm run sim -- tornado
npm run sim -- asteroid
npm run sim -- datacenter
```

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`.

Controls: drag anywhere for a floating joystick, or WASD / arrow keys. Double-tap anywhere (or press Space) strikes in asteroid mode and makes a PR gesture in data center mode, so every mode plays one-thumbed.

Add `?ufo`, `?tornado`, `?asteroid`, or `?datacenter` to the URL to skip the picker. Add `?debug` to get `game.give(mass)` and `game.goto(x, z)` in the browser console.

## Where things live

| File | What it does |
| --- | --- |
| `src/config.js` | Every tuning knob: object masses, lift curve, UFO, tornado, and asteroid handling, world layout |
| `src/world.js` | Builds the town grid, traffic, pedestrians, farmland, and canyon ring from a seed |
| `src/models.js` | Low-poly model builders for each object kind |
| `src/game.js` | Per-frame object logic for both modes (beam lift, funnel orbit, blasts, fling arcs, wreckage), shared by the game and the sim |
| `src/ufo.js` | Saucer, beam cone, ground ring |
| `src/tornado.js` | Swaying funnel layers, dust skirt, orbiting debris |
| `src/water.js` | Data center mode: places the birdbaths, pools, fountains, ponds, water towers, and reservoir, and draws them draining |
| `src/tanker-logic.js` | Data center rules (pumping, delivery, tiers, outrage, campus growth order), shared by the game and the sim |
| `src/datacenter.js` | Tanker truck and hose, campus intake and server halls, picket lines |
| `src/asteroid.js` | Reticle, incoming rocks (the canyon rock model, reused), impact flash, shockwave, craters |
| `src/main.js` | Renderer, camera, HUD, main loop |
| `scripts/sim.mjs` | Balance check: a bot eats the world and reports pacing |
| `scripts/sim-datacenter.mjs` | Data center balance check: a bot hauls water until the town is dry |

## Balance

The bot (which always flies to the nearest liftable thing) currently finishes in about 3 minutes:

| Unlock | Bot time |
| --- | --- |
| Cows | 0:03 |
| Cars | 0:13 |
| Trucks | 0:41 |
| Houses | 1:27 |
| Shops | 1:46 |
| Apartment towers | 2:23 |
| Canyon walls | 2:30 |
| Everything gone | 3:02 |

Tornado mode lands within a few seconds of these, finishing around 3:18. Asteroid mode finishes around 4:30, partly because the bot aims at single targets instead of clusters. Blast size and pace are `ASTEROID.blastRadius` and `ASTEROID.cooldown`. Fling distance is set by `TORNADO.flingSpeed` and `TORNADO.gravity`.

Data center mode takes the bot about 7.5 minutes: backyard pools at 0:43, park ponds at 2:35, the reservoir at 6:14. Skipping PR gestures costs it about 80 seconds behind picket lines (`NO_PR=1 npm run sim -- datacenter`). Its knobs are `WATER`, `TIERS`, and `TANKER` in `src/config.js`.

The main levers are `LIFT_PER_MASS` (how much each bite grows your lift) and the masses in `KINDS`. Change them, run `npm run sim`, compare.
