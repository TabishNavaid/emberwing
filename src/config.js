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

  FIND_HOLD: 2.0, // steady light on the eyes this long fills the ring
  // the assist clock only runs while someone is pointing, so a walked-away game idles out instead
  // these were 4 / 6.5 / 9.5 and the worst run hit 44.3s, right at the 45s ceiling.
  // most people find ember in ~5s so pulling them in only changes things for people who are stuck
  FIND_ASSIST_GLOW: 3.0, // sparks start leading to the eyes
  FIND_ASSIST_HOP: 4.5, // ember hops toward the beam on its own
  FIND_AUTO_COMPLETE: 7.0, // hard cap so nobody gets stuck
  FIND_AUTO_FILL: 0.4, // once the cap hits, the ring fills in this long
  FIND_BURST: 1.5, // wing-glow celebration before takeoff

  FLIGHT: 20.0, // fixed, doesn't depend on how well you fly
  HOME: 6.5,
  END: 3.0,
  END_SKIP_DWELL: 1.0,

  FADE: 0.4, // every scene change. was up to 0.6, that's dead air nobody enjoys
};

// fractions of DUR.FLIGHT
export const FLIGHT = {
  WOBBLY_UNTIL: 0.3, // shaky wings, small silver rings
  SWELL_AT: 0.62, // brass swell: rays, camera pulls back, flock joins
  RISE_AT: 0.9, // climb toward the aurora, no more rings
  RING_BEATS_EARLY: 3, // wobbly part gets more time between rings
  RING_BEATS_LATE: 2,
  FIRST_RING_AT: 2.0, // seconds, gives people a moment to get their bearings
  SCROLL: 110, // internal px/sec
  RING_R_START: 15, // ring radius in internal px, grows over the flight
  RING_R_END: 30,
  FOLLOW: 7.5, // how tightly ember chases the light
  WOBBLE: 7, // px of early wobble, fades out as it gets confident
  MAGNET: 0.35, // gentle pull toward the next ring, 0 turns it off
  ZOOM_START: 1.18,
  ZOOM_END: 0.86,
};

export const MUSIC = {
  BPM: 120,
};

export const INPUT = {
  IDLE_RESET: 10.0, // no input this long during play -> back to attract
  IDLE_MOVE_EPS: 3, // internal px. smaller than this is jitter, not a person
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
