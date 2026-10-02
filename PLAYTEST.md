# Playtest checklist: real projector + lobby laptop

Do this at Cordiner (or wherever the real projector is) before Nov 5. Takes about 30 minutes with two people: one plays, one holds a stopwatch and this list.

**Bring:** the lobby laptop + charger, the projector cable, the lantern prop + mocap rig, a mouse (backup), a stopwatch (phone is fine), a tape measure or a 15 ft piece of string, painter's tape for the floor mark.

Write results in the blanks. Anything that fails goes in the notes at the bottom with what you saw.

## 1. Setup

- [ ] Laptop on power (not battery saver), plugged into the projector, projector at full resolution (1920×1080 if it supports it)
- [ ] Close everything else (other browsers, VMs, Docker, chat apps). Open Activity Monitor > Memory: memory pressure should be green and swap used near zero. When we built this, a laptop deep in swap froze every app for minutes at a time, the game included
- [ ] Open the game. Live site: `https://tabishnavaid.github.io/<repo-name>/`, or offline on the laptop: `npm run build && npm run preview`, then `http://localhost:4173`
- [ ] Press **F** for fullscreen. No browser bars or cursor visible on the wall
- [ ] Press **D** for the debug overlay

## 2. Frame rate (debug overlay, top left)

- [ ] FPS on the attract screen: ____
- [ ] FPS during the brass swell (busiest moment, about 12s into the flight): ____
- [ ] Anything under 30 is worth writing down. The game clock keeps real time down to about 4 fps, so a slow laptop won't make runs longer, but it will look choppy
- [ ] Press **D** again to hide it

## 3. Readable from 15 ft

Stand 15 ft from the wall (measure it), at the far edge of where the line will be.

- [ ] Attract: NEXT FLYER, STEP HERE, RAISE YOUR LIGHT, the storybook captions, "N DRAGONS HOME TONIGHT"
- [ ] Find Ember: EMBER IS LOST!, FIND THE EYES, HOLD STEADY. Can you see the two glowing eyes in the fog?
- [ ] Flight: FLY!, SOAR!, the lighthouse-to-home track along the top
- [ ] Home: HOME!, the counter, HEAR IT LIVE IN ACT II
- [ ] End card: ACT II, the title, LISTEN FOR THE BRASS!
- [ ] Anything washed out by the room lights? Note it with where you were standing: ____

## 4. Calibration (mocap rig)

- [ ] Rig connected (`?mocap=...` in the URL, or the rig drives the mouse). Debug overlay shows the source as MOCAP or MOUSE
- [ ] Press **K**. Point the prop at each of the 4 corner rings and hold still until the ring fills. Toast says CALIBRATED
- [ ] Debug overlay shows `CAL MOCAP <date>` (or MOUSE)
- [ ] Point at the lantern on the attract screen. Does the light land on it? ____
- [ ] Refresh the page (Cmd+R). Calibration is still there in the debug overlay
- [ ] Try **K** then **Delete**: CAL goes back to OFF. Then recalibrate for real
- [ ] If it feels off: recalibrate standing exactly where guests will stand (on the tape mark)

## 5. A full run, timed

Start the stopwatch the moment the lantern ring finishes filling. Stop it when the attract screen is back.

- [ ] Run 1, finding Ember quickly: ____ s (expect about 38)
- [ ] Run 2, someone who "can't find it" (wave the light around the top of the screen): ____ s (expect about 40.5, never over 45)
- [ ] Ember follows the light without lag or jitter? ____
- [ ] The dragon count went up by one after each run

## 6. Idle reset

- [ ] Start a run, then put the prop down mid Find Ember. Back to attract in about 10s? ____ s
- [ ] Same thing during the flight: ____ s
- [ ] Rest the prop on a table pointing at the screen (still, but present). Still resets after about 10s?

## 7. Audio (never checked by anyone yet)

- [ ] Press **M**. Toast says AUDIO ON. Do you hear a soft drone, wind, and some random notes? ____
- [ ] Do a run with audio on. Chimes on rings, a chord when Ember's wings light up, a rising arpeggio at home?
- [ ] Is it too loud or too quiet for the lobby? Is it annoying after 10 minutes?
- [ ] Press **M** again. Silence. Leave it off unless the team decides otherwise

## 8. Other operator keys

- [ ] **G** cycles reduced motion: AUTO, FORCED REDUCED, FORCED FULL. In reduced mode there's no screen shake and the flashes are softer
- [ ] **S** skips a scene, **R** goes back to attract
- [ ] **C** asks before clearing the sky. Press **N** to keep it (don't clear the night by accident)

## 9. Other browsers

Do one full run in each. Write down anything that looks different from Chrome.

- [ ] Safari: ____
- [ ] Firefox: ____
- [ ] A phone in landscape, using a finger (the light should sit just above your fingertip): ____
- [ ] The same phone in portrait: shows "ROTATE YOUR PHONE"

## 10. The space

- [ ] Floor mark (tape footprints) about 10-12 ft from the wall, centered
- [ ] Can the line see the screen without standing in the projector beam?
- [ ] Where does the operator stand to reach the laptop?

## Notes

| what | where / when | what happened |
|---|---|---|
| | | |
