# phase 1: cleanup results

nothing removed from the game. same scenes, hotkeys, assists, operator tools, input adapters,
debug overlay lines and tests.

## vs baseline.md

| thing | baseline | after cleanup |
|---|---|---|
| playwright suite | 30/30 | 30/30 |
| typical run | 38.98s | 39.02s |
| assisted run | 44.38s | 44.25s |
| idle reset (find / flight) | 10.5s / 10.6s | 10.6s / 10.5s |
| screenshots (22, projector + phone) | | **22/22 pixel-identical** (zero changed pixels) |

run times wobble by about ±0.1s between runs because the scripted guest runs on the wall clock.
`phase1-before-after.png` has the projector shots side by side.

the screenshot spec had to be made deterministic first (seeded Math.random, no real-time loop),
otherwise two runs of the *same* code differed by up to 3% of pixels and the comparison was useless.

## what changed
- dead code: unused easing fns, rng.pick, Beat.breath, camera zoom, rain particles, drawEyesIcon, prog, Dwell.reset, unused exports and imports, dead fields (seenNear, homeX, px/py, hits)
- 8 unused palette colors out of config.js
- params that were always the same value (drawCliff ox, drawStone colors, drawTree alpha, drawRibbon reveal, drawKnotFrame fill, drawLighthouse lamp)
- knotwork ring + band shared one copy-pasted weave loop, now one `weave()`
- two hand-rolled sky cross-fades now use `drawSky(..., alpha)`
- SceneManager takes the scenes as an object instead of register() calls
- comments rewritten (only the why), banners and doc-style lines gone

## lines per file
| file | before | after | change |
|---|---:|---:|---:|
| src/art/aurora.js | 120 | 115 | -5 |
| src/art/ember.js | 281 | 261 | -20 |
| src/art/font.js | 127 | 126 | -1 |
| src/art/icons.js | 131 | 100 | -31 |
| src/art/knotwork.js | 109 | 96 | -13 |
| src/art/sprites.js | 61 | 58 | -3 |
| src/art/world.js | 415 | 394 | -21 |
| src/config.js | 109 | 95 | -14 |
| src/core/Audio.js | 106 | 101 | -5 |
| src/core/AuroraStore.js | 69 | 67 | -2 |
| src/core/Beat.js | 36 | 32 | -4 |
| src/core/Camera.js | 26 | 22 | -4 |
| src/core/Operator.js | 89 | 87 | -2 |
| src/core/Particles.js | 71 | 66 | -5 |
| src/core/SceneManager.js | 75 | 72 | -3 |
| src/core/util.js | 117 | 111 | -6 |
| src/input/Dwell.js | 31 | 22 | -9 |
| src/input/Input.js | 80 | 73 | -7 |
| src/input/OneEuroFilter.js | 33 | 27 | -6 |
| src/input/adapters.js | 132 | 121 | -11 |
| src/main.js | 151 | 150 | -1 |
| src/scenes/Attract.js | 325 | 300 | -25 |
| src/scenes/EndCard.js | 81 | 79 | -2 |
| src/scenes/FindEmber.js | 311 | 290 | -21 |
| src/scenes/Flight.js | 370 | 340 | -30 |
| src/scenes/Home.js | 146 | 138 | -8 |
| tests/fullrun.spec.js | 55 | 55 | +0 |
| tests/helpers.js | 83 | 80 | -3 |
| tests/idle.spec.js | 30 | 29 | -1 |
| tests/input.spec.js | 41 | 41 | +0 |
| tests/screenshots.spec.js | 46 | 52 | +6 |
| **total** | **3857** | **3600** | **-257** |