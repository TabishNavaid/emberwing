// Every tunable number lives here so the team can adjust after playtesting
// without digging through scene code. Times are in seconds unless noted.

export const VIEW = {
  W: 480, // internal pixel-art resolution (scaled up with nearest-neighbor)
  H: 270,
};

export const DUR = {
  // Attract
  START_DWELL: 1.0, // hold the light on the lantern to start
  ATTRACT_PAGE: 4.5, // seconds per storybook page
  ATTRACT_DEMO_PAGE: 6.5, // the ghost flight demo page lingers longer

  // 1. Find Ember (target ~10s)
  FIND_HOLD: 2.0, // steady light on the eyes fills the knotwork ring
  FIND_ASSIST_GLOW: 4.0, // eyes glow brighter + sparkles lead to them
  FIND_ASSIST_HOP: 6.5, // Ember hops into the beam by itself
  FIND_AUTO_COMPLETE: 9.5, // hard cap: nobody gets stuck
  FIND_BURST: 1.5, // wing-glow burst celebration before takeoff

  // 2. Flight (fixed timeline)
  FLIGHT: 20.0,

  // 3. Home
  HOME: 7.0,

  // 4. End card
  END: 3.0,
  END_SKIP_DWELL: 1.0,

  // Transitions
  FADE: 0.45,
};

// Flight story arc, as fractions of DUR.FLIGHT
export const FLIGHT = {
  WOBBLY_UNTIL: 0.3, // shaky wings, small silver rings
  SWELL_AT: 0.62, // brass swell: gold rays, camera pulls back, flock joins
  RISE_AT: 0.9, // climb toward the aurora
  RING_BEATS_EARLY: 3, // wobbly phase: a ring arrives every N beats
  RING_BEATS_LATE: 2, // confident + swell: a ring every N beats
  FIRST_RING_AT: 2.0, // seconds into the flight
  SCROLL: 110, // world scroll speed, internal px/sec
  RING_R_START: 15, // ring radius (internal px) early...
  RING_R_END: 30, // ...and at the end
  FOLLOW: 7.5, // how tightly Ember follows the pointer (spring)
  WOBBLE: 7, // px of early-flight wobble (fades as confidence grows)
  MAGNET: 0.35, // gentle pull toward the next ring (0 = none)
  ZOOM_START: 1.18,
  ZOOM_END: 0.86,
};

export const MUSIC = {
  BPM: 120, // the world breathes in time
};

export const INPUT = {
  IDLE_RESET: 10.0, // seconds with no input -> back to attract (interactive scenes only)
  IDLE_MOVE_EPS: 3, // internal px of movement that counts as "someone is there"
  STEADY_SPEED: 0.35, // screen-widths/sec; slower than this counts as "holding steady"
  LOCK_RADIUS: 26, // internal px from Ember's eyes to count as "on target"
  // One-Euro filter (jitter smoothing). Mocap gets heavier smoothing.
  FILTER: {
    mouse: { minCutoff: 3.0, beta: 0.02 },
    touch: { minCutoff: 2.5, beta: 0.02 },
    mocap: { minCutoff: 1.0, beta: 0.006 },
    keys: { minCutoff: 5.0, beta: 0.0 },
  },
  KEY_SPEED: 220, // internal px/sec for arrow-key testing
};

export const STORE = {
  KEY: 'emberwing.night.v1',
  MAX_RIBBONS: 500, // oldest ribbons fade out of storage after this (the count keeps going)
  NEW_NIGHT_BY_DATE: true, // a new calendar day starts a fresh sky
};

// Story palette: slate storm -> sea green -> gold / ember / aurora
export const PAL = {
  ink: '#0b0f1a',
  night: '#101a2c',
  slate: '#22324a',
  slate2: '#344a66',
  fog: '#5c728c',
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
  teal2: '#1fb5a8',
  tealDim: '#2c4f5a',
  violet: '#9a6cff',
  violet2: '#5b3fb0',
  rose: '#ff8fb0',
  white: '#ffffff',
};
