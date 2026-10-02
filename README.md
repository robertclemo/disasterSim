# UFO Sandbox

The game those mobile ads promise. Fly a saucer over a low-poly canyon town and beam up everything. What you eat makes you bigger, and bigger means you can lift heavier things: crops and sheep, then cows, cars, trucks, houses, shops, apartment towers, and finally the canyon walls. No paywalls, no timers, no upgrade shop.

## Run it

```
npm install
npm run dev      # local dev server, open the printed URL (works on your phone over LAN)
npm run build    # static build in dist/, ready for GitHub Pages
npm run sim      # headless bot playthrough that prints unlock times
```

Controls: drag anywhere for a floating joystick, or WASD / arrow keys.

Add `?debug` to the URL to get `game.give(mass)` and `game.goto(x, z)` in the browser console.

## Where things live

| File | What it does |
| --- | --- |
| `src/config.js` | Every tuning knob: object masses, lift curve, UFO speed and size, world layout |
| `src/world.js` | Builds the town grid, traffic, pedestrians, farmland, and canyon ring from a seed |
| `src/models.js` | Low-poly model builders for each object kind |
| `src/game.js` | Per-frame lift, fall, and absorb logic (shared by the game and the sim) |
| `src/ufo.js` | Saucer, beam cone, ground ring |
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

The main levers are `LIFT_PER_MASS` (how much each bite grows your lift) and the masses in `KINDS`. Change them, run `npm run sim`, compare.
