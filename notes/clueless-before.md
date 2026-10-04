# clueless guest, before the fixes

live build, commit `ee42416`, seed 11. pointer wanders to random spots, pauses, never aims.
`node tools/clueless.mjs https://tabishnavaid.github.io/emberwing/ notes/clueless-before 11`
one screenshot per game-second in this folder (00.png to 40.png), contact sheets in sheet-1..5.png

| sec | on screen | what a first-timer actually gets |
|---|---|---|
| 0-1 | "EMBER IS LOST!", dark fog, beam from the lighthouse. the knot ring is already showing around a half-visible Ember because Ember hid right next to where the light was on the attract screen | a title, not an instruction. nothing says "move your light". the ring looks like something is already happening |
| 2 | "FIND THE EYES" | the first real instruction... |
| 3-5 | "FOLLOW THE SPARKS" | ...gone after 1 second. "sparks" are a few tiny dots, easy to miss. two different instructions in 2 seconds |
| 5-6 | Ember hops across the cliff toward the wandering light. "HOLD STEADY" flashes | the game is moving Ember to *you*. you didn't do anything |
| 7-8 | ring done, burst, "EMBER!" | Find Ember finished at about 7s and the guest never aimed once. no idea why it succeeded |
| 9 | whole screen washed pale (mid-fade to white), "FLY!" | abrupt, the scene just changed with no explanation |
| 10 | "FLY!", Ember up top, the first hoop already shrinking away | first hoop was missed 1.1s into the flight, while the screen was still fading in. most people never see it |
| 11-21 | Ember zig-zags after the light (x swings from 80 to 320), hoops come and go, most shrink away (missed). dotted tether sometimes visible | nothing says the light steers Ember or that the hoops are the goal. no count, no sense of progress. when Ember is on the right a hoop is on screen for about a second before it arrives |
| 22-27 | "SOAR!", shockwave, flock, rays, last hoops | pretty, but it reads as a cutscene |
| 28-29 | "HOME IS UP THERE", climbing | clear |
| 30-32 | "HOME!", path draws across the sky, "0 DRAGONS HOME TONIGHT" | the zero (before the counter ticks) reads like you failed |
| 33-36 | counter rolls to 1, "HEAR IT LIVE IN ACT II" | clear |
| 37-39 | end card | clear |
| 40 | attract, "YOURS!" | clear |

the flight log for that run: `mmmhmmmmhmmhhh`, 4 of the first 9 hoops reached Ember as a miss before anything changed.

## takeaways
- the start of Find Ember never tells you what to *do*. the only real instruction is up for 1 second
- assists play the game for you: Ember walks into the beam at 4.5s and the ring fills by itself
- the hold ring isn't on the eyes and decays when the light slips off, so cause and effect is fuzzy
- scene changes are hard cuts (worst one is the white flash into the flight)
- the flight never says what the goal is. the first hoop can arrive in under a second. Ember's x swings so much that hoops arrive at unpredictable times
- watching without moving = autopilot plays for you, then the 10s idle reset kicks you out mid-flight
- separately, a real bug: `Flight.done` is never reset, so every run after the first never reaches Home
