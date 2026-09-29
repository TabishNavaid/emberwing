# baseline (before cleanup)

commit `1c00c2e` "working version before cleanup", 2026-09-29

full playwright suite: **30 / 30 passing** (`npx playwright test`, chromium headless, 1920x1080)

| thing | number |
|---|---|
| typical run (finds ember, game clock) | 38.98s (wall 40.8s) |
| assisted run (never finds ember) | 44.38s |
| idle reset during find ember | 10.5s |
| idle reset during flight | 10.6s |
| end card skip by holding lantern | works (<3s) |
| ribbon survives refresh | yes |
| console errors in a full run | none |
| mocap pointer / postMessage | works |
| clear-sky confirm (C then N keeps, C then Y clears) | works |
| portrait rotate hint | shows |

phase 1 (cleanup) has to end with all of these still true, within about ±0.3s on the timings.
screenshots from `npm run shots` (22 of them, projector + phone) are the visual baseline.
