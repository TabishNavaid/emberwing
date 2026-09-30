# phase 2: make it better

| thing | after phase 1 | after phase 2 |
|---|---|---|
| playwright suite | 30 tests | 51 tests (story.spec + more screenshots) |
| typical run | 39.0s | ~37.9s |
| assisted run (never finds ember) | 44.3s | ~40.5s (test now fails above 41s) |
| idle reset | 10.5s | 10.5s (now measured on the game clock) |

## what changed, in the order we did it
1. headroom: assists at 3 / 4.5 / 7s (were 4 / 6.5 / 9.5), fades 0.4s everywhere, home 6.5s
2. end card: "HEAR IT LIVE IN ACT II" banner during home, end card down to 3 big lines, full orchestra credit on the storybook music page
3. story: "EMBER IS LOST!" opener, lighthouse-to-home journey track in flight, dotted light tether to ember
4. readability: no guest text under scale 2, outline capped at 2px so big words stop looking like slabs, bigger eye glints, stronger unfilled rings, demo fog matches the real scene
5. juice: random natural blinks, flap squash and stretch, crouch-pop-wiggle when found, cheer hop on rings, barrel roll every 3 in a row, sine camera rumble, gentle vertical camera follow, brass swell wind-up + shockwave + confetti + flock trails, home comet + lift sparkles + aurora shimmer + odometer counter

## known caveat
if the lobby laptop drops under 20fps the game clock runs slow (dt is capped at 50ms so nothing
teleports). runs just take longer, nothing breaks. D shows FPS, worth checking on the real laptop.
