# clueless guest, after the fixes

same guest as `clueless-before.md` (seed 11, wanders, pauses, never aims), new build.
`node tools/clueless.mjs http://localhost:4174/ notes/clueless-after 11`, contact sheets in clueless-after/

| sec | before | after |
|---|---|---|
| 0-1 | "EMBER IS LOST!" with the light already sitting on Ember and the ring showing | title card "EMBER IS LOST!" with a scared little Ember, nothing to do yet |
| 2-3 | "FIND THE EYES" for 1 second | "MOVE YOUR LIGHT" + a framed demo of a lantern sliding |
| 3-5 | "FOLLOW THE SPARKS" (tiny dots) | "FIND THE EYES" + demo. eyes get bigger at 4s of pointing |
| 5-7 | Ember hops into the light, ring fills by itself, done at ~7s | still searching. at ~6.5s a dotted line of light runs from your beam to the eyes |
| 8-11 | already flying | at ~9s the beam leans toward the eyes. Ember stays put |
| 11-14 | | last resort: Ember flutters into the beam, "HOLD STILL", the ring fills on the eyes |
| 15-16 | | "YOU FOUND EMBER!" held for a beat, nothing else moving |
| 17 | white flash, "FLY!", first hoop already missed | title card "NOW FLY HOME!" with Ember flapping across |
| 18-20 | | "EMBER FOLLOWS YOUR LIGHT", arrow from the light to Ember, a big glowing hoop gliding in |
| 20-23 | | "FLY THROUGH THE HOOPS", the hoop waits next to Ember with chevrons pointing at it. counter 0 / 8 |
| 23-38 | hoops at unpredictable times, most missed, no count | one big hoop every 2s at the same line, counter climbs to 5 / 8, misses just loop |
| 34-35 | SOAR at 22s | SOAR, shockwave, flock |
| 39-52 | home, end card, attract | same |

whole run: 41s before (the game finished find ember for them), 52s after (they actually do it).
a guest who aims is ~40s, a guest who never finds ember on their own is ~49s.

## checked by tests/clueless.spec.js (3 wandering guests in a row on one page)
- find ember finishes at 13.2-13.7s for all three, never before 10s
- every instruction on screen 2.0s or longer (only the last find ember one can end sooner, by succeeding)
- every run: 8 hoops presented, all 8 reached Ember, every run goes home and back to attract
