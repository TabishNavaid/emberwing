# Playtest checklist: real projector + lobby laptop

Do this at Cordiner (or wherever the real projector is) before Nov 5. Takes about 30 minutes with two people: one plays, one holds a stopwatch and this list.

**Bring:** the lobby laptop + charger, the projector cable, the lantern prop + mocap rig, a mouse (backup), a stopwatch (phone is fine), a tape measure or a 15 ft piece of string, painter's tape for the floor mark.

Write results in the blanks. Anything that fails goes in the notes at the bottom with what you saw.

## 1. Setup

- [ ] Laptop on power (not battery saver), plugged into the projector, projector at full resolution (1920×1080 if it supports it)
- [ ] Close everything else (other browsers, VMs, Docker, chat apps). Open Activity Monitor > Memory: memory pressure should be green and swap used near zero. When we built this, a laptop deep in swap froze every app for minutes at a time, the game included
- [ ] Open the game. Live site: `https://tabishnavaid.github.io/emberwing/`, or offline on the laptop: `npm run build && npm run preview`, then `http://localhost:4173`
- [ ] The screen says **PRESS ANY KEY TO START**. Press any key (that key only starts the station, it won't skip or reset anything). The speaker icon in the bottom left now shows waves. If it shows an X, sound was muted with M last time: press **M**
- [ ] Press **F** for fullscreen. No browser bars or cursor visible on the wall
- [ ] Press **D** for the debug overlay

## 2. Frame rate (debug overlay, top left)

- [ ] FPS on the attract screen: ____
- [ ] FPS during the brass swell (busiest moment, about 15s into the flight, when the flock swoops in): ____
- [ ] Anything under 30 is worth writing down. The game clock keeps real time down to about 4 fps, so a slow laptop won't make runs longer, but it will look choppy
- [ ] Press **D** again to hide it

## 3. Readable from 15 ft

Stand 15 ft from the wall (measure it), at the far edge of where the line will be.

- [ ] Attract: NEXT FLYER, STEP HERE, RAISE YOUR LIGHT, the three level rows (HATCHLING / FIRST TIME?, FLIER / MOVING HOOPS, STORM RIDER / FOR THE BRAVE) and their best flights, the storybook captions, "N DRAGONS HOME", "N MORE TO THE NEXT CELEBRATION"
- [ ] Can you tell the three level badges apart (egg, wing, storm cloud)? Can you see the small dragons looping along the top?
- [ ] WHO WILL YOU FIND?: the three names and quirks
- [ ] Find: PIP IS LOST! (the dragon's name changes every run), FIND THE EYES, HOLD STILL. Can you see the two glowing eyes in the fog?
- [ ] Flight: PIP FOLLOWS YOUR LIGHT, FLY THROUGH THE HOOPS, SOAR!, the lighthouse-to-home track along the top, the score and stars top left, the "+150" numbers
- [ ] On STORM RIDER: can you see the small hoops, the enemies (grumpy cloud, gust sprite, fog wisp) and the power-up orbs from 15 ft? Do the gust arrows show before the push?
- [ ] Home: PIP IS HOME!, the counter, HEAR IT LIVE IN ACT II
- [ ] Dragon card: the name, THE 9TH EMBERWING HOME TONIGHT, the quirk, LISTEN FOR THE BRASS!. Take a phone photo of it from where a guest would stand. Is it readable in the photo?
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

- [ ] Run 1, someone who knows the game: ____ s (expect about 40)
- [ ] Run 2, someone who "can't find it" (wave the light around the top of the screen): ____ s (expect about 49, around 50 at most)
- [ ] Run 3, a first-timer who has never seen it (grab someone, explain nothing): ____ s, and write down the first moment they looked confused: ____
- [ ] Run 4, a teen or adult on STORM RIDER: ____ s, stars ____. Was it hard but fair? Did anyone feel like they "lost"? (They shouldn't: the dragon always gets home)
- [ ] Run 5, a little kid on HATCHLING: stars ____. Did they get the fireball and pop the puffs?
- [ ] Pick a dragon by holding the light on it, and once let it pick by itself (wait ~5 s)
- [ ] Do the instructions (MOVE YOUR LIGHT / FIND THE EYES / HOLD STILL, then EMBER FOLLOWS YOUR LIGHT / FLY THROUGH THE HOOPS) read from 15 ft? ____
- [ ] Does the first-timer get through the waiting tutorial hoop on their own? ____
- [ ] Ember follows the light without lag or jitter? ____
- [ ] The dragon count went up by one after each run, and one more dragon is circling on the attract screen
- [ ] Each run had a different dragon (name and look) and the routes took turns: sea stacks, rain squall, standing stones
- [ ] Play until the count reaches 8 (or press **S** to skip through runs): the 8th run gets the celebration (spiral of every dragon, fireworks, names rolling past, "8 DRAGONS HOME!"), and afterwards a new bright star stays in the sky on the attract screen
- [ ] The best flight for the level shows up on its attract row after a run

## 6. Idle reset

- [ ] Start a run, then put the prop down mid Find Ember. Back to attract in about 10s? ____ s
- [ ] Same thing during the flight: ____ s
- [ ] Rest the prop on a table pointing at the screen (still, but present). Still resets after about 10s?

## 7. Sound (on by default, nobody has heard it on the real speakers yet)

- [ ] On attract: a soft harp and a quiet drone, the tune on a whistle every other time round. Not annoying after 10 minutes? ____
- [ ] During a run: wind and rain in the fog, a warm chord when the dragon is found, the tune building through the flight, a chime on every hoop, a drum roll and then a big brass chord at SOAR!, chirps from each dragon at home
- [ ] Does the brass swell land right when SOAR! appears (not late)? ____
- [ ] Too loud or too quiet for the lobby? Set the laptop or room volume so it's clear at the footprints but doesn't fight the youth orchestra: ____
- [ ] Press **M**: toast says SOUND OFF, the speaker icon shows an X, silence. Refresh: still off. Press **M** again to turn it back on
- [ ] Click the speaker in the bottom left corner: it toggles. Hold the mocap light on it for about 1.5 s on the attract screen: it toggles (a ring fills and it says HOLD TO MUTE)
- [ ] The celebration fanfare: big enough to make the line cheer, not painful?
- [ ] On a phone: no "press any key" screen, and sound starts on the first touch

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
