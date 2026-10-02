# Disaster Sandbox (working name)

The game those mobile ads promise. Pick a UFO or a tornado and wreck a low-poly canyon town.

- **UFO:** beam things up and they vanish into the saucer.
- **Tornado:** things spiral up the funnel, get flung out on an arc, and land as scorched wreckage.

In both modes, what you take makes you bigger, and bigger means you can lift heavier things: crops and sheep, then cows, cars, trucks, houses, shops, apartment towers, and finally the canyon walls. No paywalls, no timers, no upgrade shop.

## Run it

```
npm install
npm run dev      # local dev server, open the printed URL (works on your phone over LAN)
npm run build    # static build in dist/, ready for GitHub Pages
npm run sim      # headless bot playthrough (UFO) that prints unlock times
npm run sim -- tornado
```

Controls: drag anywhere for a floating joystick, or WASD / arrow keys.

Add `?ufo` or `?tornado` to the URL to skip the picker. Add `?debug` to get `game.give(mass)` and `game.goto(x, z)` in the browser console.

## Where things live

| File | What it does |
| --- | --- |
| `src/config.js` | Every tuning knob: object masses, lift curve, UFO and tornado handling, world layout |
| `src/world.js` | Builds the town grid, traffic, pedestrians, farmland, and canyon ring from a seed |
| `src/models.js` | Low-poly model builders for each object kind |
| `src/game.js` | Per-frame object logic for both modes (beam lift, funnel orbit, fling arcs, wreckage) (shared by the game and the sim) |
| `src/ufo.js` | Saucer, beam cone, ground ring |
| `src/tornado.js` | Swaying funnel layers, dust skirt, orbiting debris |
| `src/main.js` | Renderer, camera, HUD, main loop |
| `scripts/sim.mjs` | Balance check: a bot eats the world and reports pacing |

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

Tornado mode lands within a few seconds of these, finishing around 3:18. Fling distance is set by `TORNADO.flingSpeed` and `TORNADO.gravity`.

The main levers are `LIFT_PER_MASS` (how much each bite grows your lift) and the masses in `KINDS`. Change them, run `npm run sim`, compare.
