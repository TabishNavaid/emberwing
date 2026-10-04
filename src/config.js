// all the knobs live here so we can tune after playtesting without digging through scenes.
// times are seconds unless it says otherwise

export const VIEW = {
  // everything draws at 480x270 and gets scaled up (4x on a 1080p projector)
  W: 480,
  H: 270,
};

export const DUR = {
  START_DWELL: 1.0, // hold on the lantern to start
  ATTRACT_PAGE: 4.5, // per storybook page
  ATTRACT_DEMO_PAGE: 6.5, // ghost demo needs longer to play out
  YOURS_LABEL: 15, // "YOURS!" points at the newest ribbon after a run, so you can show your friends

  FIND_HOLD: 2.0, // steady light on the eyes this long fills the ring
  PROMPT_MIN: 2.0, // an instruction stays up at least this long before the next one can replace it
  FIND_MOVE_TO_LEARN: 60, // internal px of moving the light before "MOVE YOUR LIGHT" is done
  // hints only get stronger, they never play for you. the clock only runs while someone is pointing.
  // (the old version hopped ember into the beam at 4.5s and finished itself at 7s, so a guest who
  // had no idea what was going on still "won" before understanding anything)
  FIND_HINT_BIG: 4.0, // eyes get bigger and brighter
  FIND_HINT_TRAIL: 6.5, // sparkle trail from the light to the eyes
  FIND_HINT_PULL: 9.0, // the beam drifts a little toward the eyes
  FIND_PULL_MAX: 0.35, // ...but only this fraction of the way, you still have to get there
  FIND_LAST_RESORT: 10.5, // ember flutters into your beam, you still do the hold (done ~12.5-13s)
  FIND_HARD_CAP: 13.0, // truly stuck (light parked off in a corner), the ring fills anyway
  FIND_BURST: 1.6, // the "YOU FOUND EMBER!" moment, everything holds still for this long

  FLIGHT: 18.0, // the timeline after the tutorial hoop. fixed, doesn't depend on how well you fly
  HOME: 6.5,
  END: 3.0,
  END_SKIP_DWELL: 1.0,

  FADE: 0.4, // every scene change. was up to 0.6, that's dead air nobody enjoys
  // title card between scenes ("NOW FLY HOME!"). playtesting the live site, the hard cuts
  // made people think the game had glitched or ended
  TITLE: 1.3,
};

// fractions of DUR.FLIGHT
export const FLIGHT = {
  WOBBLY_UNTIL: 0.3, // shaky wings, small silver rings
  SWELL_AT: 0.62, // brass swell: rays, camera pulls back, flock joins
  SWELL_WINDUP: 0.035, // the "breath in" before the swell (~0.7s)
  RISE_AT: 0.9, // climb toward the aurora, no more rings
  HOOPS: 8, // every guest gets exactly this many: 1 tutorial hoop + the rest on the beat
  HOOP_BEATS: 4, // a hoop every 4 beats (2s). at 2 beats first-timers had no time to steer
  // seconds into the timeline. 3s puts the first hoop just off screen while the tutorial hoop is
  // waiting, at 2s it sat frozen on screen and people didn't know which hoop to go for
  FIRST_RING_AT: 3.0,
  TUT_SLIDE: 1.5, // the tutorial hoop glides in this long, then waits for you
  TUT_CAP: 5.0, // ...but never longer than this, then the timeline starts anyway
  TUT_R: 30, // tutorial hoop radius, extra big
  SCROLL: 110, // internal px/sec
  RING_R_START: 24, // hoop radius in internal px, grows over the flight (was 15, too small to aim for)
  RING_R_END: 34,
  FOLLOW: 12, // how tightly ember chases the light. 7.5 felt like steering a boat
  X_PLAY: 40, // how far ember can drift left/right of the gate (internal px)
  WOBBLE: 3, // px of early wobble, fades out as it gets confident (7 fought the guest's steering)
  MAGNET: 0.35, // gentle pull toward the next ring, 0 turns it off
  ZOOM_START: 1.18,
  ZOOM_END: 0.86,
  CAM_FOLLOW: 0.12, // how much the camera drifts toward ember vertically, 0 = locked
};

// the game clock follows real time even when frames drop. a slow frame gets split into
// several small steps so nothing tunnels through a ring
export const LOOP = {
  MAX_STEP: 1 / 30, // biggest single simulation step
  MAX_CATCHUP: 0.25, // most real time we'll catch up in one frame. past this (frozen or
  // backgrounded tab) we just drop the rest instead of jumping the scene ahead
};

// reduced motion (OS setting or operator key G)
export const MOTION = {
  FLASH_SCALE: 0.35, // flashes get this much of their normal strength
  ZOOM_SCALE: 0.5, // flight zooms half as far
};

export const MUSIC = {
  BPM: 120,
};

export const INPUT = {
  IDLE_RESET: 10.0, // no input this long during play -> back to attract
  IDLE_MOVE_EPS: 3, // internal px. smaller than this is jitter, not a person
  GONE_AFTER: 3.0, // flight autopilot only after the pointer's been still this long (was 1.5)
  STEADY_SPEED: 0.35, // screen-widths/sec. under this counts as holding steady
  LOCK_RADIUS: 26, // internal px from ember's eyes
  // one-euro filter settings per input source. mocap is way jittier so it gets smoothed harder
  FILTER: {
    mouse: { minCutoff: 3.0, beta: 0.02 },
    touch: { minCutoff: 2.5, beta: 0.02 },
    mocap: { minCutoff: 1.0, beta: 0.006 },
    keys: { minCutoff: 5.0, beta: 0.0 },
  },
  KEY_SPEED: 220, // arrow keys, desk testing only
  // on phones the light sits this far above your fingertip (internal px, ~40 css px on a phone)
  // otherwise your finger covers the light and ember
  TOUCH_LIFT: 26,
  // mocap calibration (K)
  CAL_INSET: 30, // corner targets sit this far in from the edges, nobody can aim at the very corner
  CAL_HOLD: 1.2, // hold the prop still this long on each corner
  CAL_STEADY: 4, // internal px of wobble that still counts as holding still
};

export const STORE = {
  KEY: 'emberwing.night.v1',
  MAX_RIBBONS: 500, // past this the oldest ribbons drop off, the count keeps going
  NEW_NIGHT_BY_DATE: true, // new calendar day = fresh sky
};

// storm slate -> sea green -> gold / ember / aurora. the color arc tells the story
export const PAL = {
  sea: '#1d3b4a',
  sea2: '#2a5a66',
  seaGreen: '#3f8a7a',
  foam: '#cfe6e6',
  rock: '#1a2433',
  rock2: '#2b3a4f',
  rock3: '#44587a',
  grass: '#355c4d',
  cream: '#fff3d6',
  gold: '#ffc94a',
  gold2: '#ffe28a',
  amber: '#ff9e3a',
  ember: '#f0762a',
  ember2: '#c8521f',
  ember3: '#ffa654',
  belly: '#ffd99a',
  teal: '#3ff0d8',
  violet: '#9a6cff',
  rose: '#ff8fb0',
  white: '#ffffff',
};
