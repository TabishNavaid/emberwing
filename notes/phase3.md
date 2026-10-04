# phase 3: every guest gets their own dragon

playtesting the live site it felt generic, and some things contradicted each other: the same dragon
got lost every run while the counter said dragons were already home, "3 dragons home" showed while
5 dragons flew past, and copy like "listen for the brass" made no sense with no sound.

| thing | after phase 2 / clarity pass | after phase 3 |
|---|---|---|
| playwright suite | 81 tests | 112 tests (dragons, sound, routes specs + more screenshots) |
| typical run | ~40.0s | ~40.2s |
| never finds the dragon | ~49.2s | ~49.1s (still fails above 50s) |
| clueless wandering guest (seed 11) | ~52s | ~49s |
| a whole run muted | | ~40.1s, same as with sound |
| every 8th guest (celebration) | | +3.6s |
| idle reset | 10.4s | 10.4s |

## what changed
1. **every guest rescues a different dragon.** `src/core/dragons.js` builds one from a seed: 13 body
   colors, 7 wing colors, 4 wing shapes (bat, leaf, feather, moth), 5 heads (horns, ram curls,
   frill, antlers, crest), 6 tail tips, 3 markings, 6 eye colors, 5 sizes, 5 quirks (sneezes
   sparks, loves loops, wobbly flier, shy at first, bouncy). the next dragon always gets a new body
   color and different shapes from the last one. 56 names, no repeats in a night until they run out.
   the dragon that's lost shows up in the storybook on attract, and stays lost (same dragon) if a
   guest walks away.
2. **the flock is the dragons people brought home.** each ribbon in localStorage now also stores
   its dragon's seed and name. attract, the swell and home all draw from that: newest 12 up close,
   the rest as specks. near + far always equals the count (tested at 0, 1, 3, 12, 13, 20). the first
   guest of the night flies home to an empty sky. the counter only shows up once it's on the new
   number. C clears the dragons with the ribbons.
3. **celebration every 8th dragon** (`FLOCK.CELEBRATE_EVERY`): the flock breaks out of the circle
   for a flyover, the aurora flares once, "8 DRAGONS HOME!". attract counts down to it.
4. **dragon card** instead of the end card: 2x portrait, name, "THE 9TH EMBERWING HOME TONIGHT",
   quirk, act II line. 5s, skippable. home went 6.5s -> 4.6s to pay for it.
5. **sound, on by default.** `src/core/score.js` is an original tune in D mixolydian, `synth.js`
   makes every instrument with web audio (karplus-strong harp, whistle, drone, hand drum, strings,
   brass, bells, chirps), `Audio.js` schedules it on the audio clock lined up with the game's beat.
   the flight timeline now snaps to the nearest beat and the swell moved to 12s (a downbeat, was
   ~11.2s) so the hoops chime and the brass lands on the music. browsers block sound until a key
   press: the station shows "PRESS ANY KEY TO START" (phones unlock on the first touch). speaker
   icon in the corner shows on / muted / waiting. M is remembered.
6. **three routes** (`src/art/routes.js`), one per guest in turn: sea stacks at dusk, a rain squall
   that clears into a rainbow, low over standing stones under early aurora. same hoops, same timing.
7. deploy-pages v4 -> v5 (v4 ran on node 20).

## things nobody has checked yet
- what the music actually sounds like on the lobby speakers (it was only checked by rendering it
  offline: levels, no clipping, the swell being the loudest moment)
- whether 12 dragons circling on attract is readable from 15ft
