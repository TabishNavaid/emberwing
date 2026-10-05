# phase 4: levels, enemies, power-ups, score, a bigger celebration

goal: bring different age groups together. hatchling stays the gentle game for little kids, flier
and storm rider give older kids, teens and adults a real challenge. nobody can lose: on every level
the dragon always gets home.

## what changed
1. **the speaker is a real button.** click or tap toggles sound, holding the light on it for 1.5s
   toggles it too (once per hold, and not during find or the flight so a guest's beam can't mute
   it by accident). the first tap on a phone turns sound on instead of muting. M still works.
2. **three levels** on the attract screen (`LEVELS` in config.js). each row is a big dwell target:
   badge in a ring, name, hint, tonight's best. holding the light still near the middle for 2s
   starts hatchling, but only after the device has really moved (a prop resting on a table, or a
   rig reconnecting, can't start runs on its own).
3. **choose your dragon.** three lost dragons, hold the light on one ("who will you find?"), picks
   by itself after 5s. the other two stay lost for the next guests, a walk-away puts the picked one
   back at the front.
4. **enemies** (flier, storm rider): grumpy clouds park in front of a hoop or zap one away (not
   counted as your miss), gust sprites shove, fog wisps hide the next hoop. a bump = 0.7s tumble,
   -50 and the streak, then a moment of grace. no health, no game over.
5. **power-ups**: fireball (pops whatever the light points near), speed burst (double points,
   rainbow trail), shield (one bump), magnet, flock friend (only when somebody is home, so the
   numbers still match). hatchling gets smiling puffs to pop, a fireball and a flock friend.
6. **score + stars**: hoops, perfect hoops, streaks, pops, clean flying. 1-3 stars per level. on
   the dragon card, and the best flight per level on attract. C clears it.
7. **celebration** is its own 7.6s scene now: every saved dragon in a spiral, fireworks in their
   colors, the whole sky full of aurora, a full fanfare, this round's 8 names rolling past, and a
   new star that stays in the sky all night.
8. renamed the music file `score.js` -> `tune.js` so "score" only means points.

## run times (scripted guest who knows what to do, game clock)
| level | run | never finds the dragon |
|---|---|---|
| hatchling | 42.6s | 52.1s |
| flier | 48.6s | |
| storm rider | 50.6s | 60.1s |

every 8th guest: +7.6s for the celebration.

## mixed ages (`tests/ages.spec.js`, average of the same 4 hoop layouts per level)
| level | slow kid | decent teen | sharp |
|---|---|---|---|
| hatchling | 2398 ★★★ (8/8) | 2410 ★★★ (8/8) | 2385 ★★★ (8/8) |
| flier | 1675 ★ (8.5/13) | 1819 ★★ (8.8/13) | 3506 ★★★ (11.3/13) |
| storm rider | 913 ★ (8/20) | 1500 ★ (8.8/20) | 3519 ★★ (16/20) |

one layout on its own swings a lot (the decent teen scored anywhere from 1200 to 2600 on flier), so
the test flies every guest through the same 4 layouts with the random numbers and the beat clock
reset, and compares averages. it's exact and the same every run.

the scripted guests are bots, so take the numbers as relative. the "sharp" one reads moving hoops
ahead and dodges perfectly, a real sharp teenager will land somewhere between teen and sharp.

## things nobody has checked yet
- whether real kids, teens and adults feel the levels the same way the bots do
- the celebration fanfare and the new sound effects on the lobby speakers
- whether the small storm rider hoops and the enemies read from 15ft
