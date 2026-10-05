// all the knobs live here so we can tune after playtesting without digging through scenes.
// times are seconds unless it says otherwise

export const VIEW = {
  // everything draws at 480x270 and gets scaled up (4x on a 1080p projector)
  W: 480,
  H: 270,
};

export const DUR = {
  START_DWELL: 1.0, // hold on a level's lantern to start
  CHOOSE: 5.0, // "who will you find?" picks a dragon for you after this, so the line keeps moving
  CHOOSE_DWELL: 1.2, // hold the light on a dragon this long to pick it
  ATTRACT_PAGE: 4.5, // per storybook page
  ATTRACT_DEMO_PAGE: 6.5, // ghost demo needs longer to play out
  YOURS_LABEL: 15, // "YOURS!" points at the newest ribbon after a run, so you can show your friends

  FIND_HOLD: 2.0, // steady light on the eyes this long fills the ring
  PROMPT_MIN: 2.0, // an instruction stays up at least this long before the next one can replace it
  FIND_MOVE_TO_LEARN: 60, // internal px of moving the light before "MOVE YOUR LIGHT" is done
  // hints only get stronger, they never play for you. the clock only runs while someone is pointing.
  // (the old version hopped the dragon into the beam at 4.5s and finished itself at 7s, so a guest who
  // had no idea what was going on still "won" before understanding anything)
  FIND_HINT_BIG: 4.0, // eyes get bigger and brighter
  FIND_HINT_TRAIL: 6.5, // sparkle trail from the light to the eyes
  FIND_HINT_PULL: 9.0, // the beam drifts a little toward the eyes
  FIND_PULL_MAX: 0.35, // ...but only this fraction of the way, you still have to get there
  FIND_LAST_RESORT: 10.5, // the dragon flutters into your beam, you still do the hold (done ~12.5-13s)
  FIND_HARD_CAP: 13.0, // truly stuck (light parked off in a corner), the ring fills anyway
  FIND_BURST: 1.6, // the "YOU FOUND PIP!" moment, everything holds still for this long

  // (how long the flight's timeline runs is per level now, see LEVELS)
  // home was 6.5. the dragon card at the end now carries the act II line for 5s, so home only
  // needs to land the ribbon and the counter. 4.6 and not 5 because the flight timeline now snaps
  // to the beat (up to 0.25s later), and the worst-case run has to stay under 50s
  HOME: 4.6,
  CELEBRATE: 3.6, // every FLOCK.CELEBRATE_EVERY-th dragon, home runs this much longer for the flyover
  END: 5.0, // the dragon card, long enough to snap a photo of it
  END_SKIP_DWELL: 1.0,

  FADE: 0.4, // every scene change. was up to 0.6, that's dead air nobody enjoys
  // title card between scenes ("NOW FLY HOME!"). playtesting the live site, the hard cuts
  // made people think the game had glitched or ended
  TITLE: 1.3,
};

// fractions of the level's timeline (LEVELS), seconds where it says so
export const FLIGHT = {
  WOBBLY_UNTIL: 0.3, // shaky wings, small silver rings
  // brass swell: rays, camera pulls back, flock joins. at 2/3 of the timeline, snapped to the
  // next bar downbeat so the brass chord lands right on the music (12s on hatchling)
  SWELL_AT: 2 / 3,
  SWELL_WINDUP: 0.63, // seconds of "breath in" before the swell
  RISE_AT: 0.9, // climb toward the aurora, no more rings
  // seconds into the timeline. 3s puts the first hoop just off screen while the tutorial hoop is
  // waiting, at 2s it sat frozen on screen and people didn't know which hoop to go for
  FIRST_RING_AT: 3.0,
  TUT_SLIDE: 1.5, // the tutorial hoop glides in this long, then waits for you
  TUT_CAP: 5.0, // ...but never longer than this, then the timeline starts anyway
  FOLLOW: 12, // how tightly the dragon chases the light. 7.5 felt like steering a boat
  X_PLAY: 40, // how far the dragon can drift left/right of the gate (internal px)
  WOBBLE: 3, // px of early wobble, fades out as it gets confident (7 fought the guest's steering)
  ZOOM_START: 1.18,
  ZOOM_END: 0.86,
  CAM_FOLLOW: 0.12, // how much the camera drifts toward the dragon vertically, 0 = locked
};

// three levels, and picking one on the attract screen is how a run starts. hatchling is the
// game as it was (big slow hoops, for little kids and first-timers). everything that makes the
// other two harder is in here so it can be tuned after playtesting
export const LEVELS = {
  hatchling: {
    label: 'HATCHLING',
    hint: 'FIRST TIME?',
    fresh: 'START HERE!', // shown where the best flight goes until somebody sets one
    timeline: 18, // seconds of hoops after the tutorial hoop
    hoops: 8, // including the tutorial hoop
    hoopBeats: 4, // a hoop every 4 beats (2s). at 2 beats first-timers had no time to steer
    ringR: [24, 34], // hoop radius, grows over the flight (was 15, too small for little kids)
    tutR: 30, // the tutorial hoop
    slack: 4, // px of grace past the hoop's edge that still counts
    scroll: 110, // how fast the hoops come at you, internal px/sec
    magnet: 0.35, // gentle pull toward the next hoop, 0 = none
    moving: 0, // share of hoops that bob up and down
    moveAmp: 0, // how far they bob, internal px
    moveSpeed: 0, // bobs per second
    stars: [900, 1500], // score for 2 stars, 3 stars. everybody gets at least 1
    enemies: { cloud: 0, gust: 0, wisp: 0 }, // none on hatchling
    puffs: 5, // harmless smiling clouds to pop with a fireball, just for fun
    gusts: 0, // wind gusts that push the dragon
    gustPush: 0,
    powerups: ['fireball', 'friend', 'magnet'], // in order, spread over the flight
  },
  flier: {
    label: 'FLIER',
    hint: 'MOVING HOOPS',
    fresh: 'NO BEST YET',
    timeline: 24,
    hoops: 13,
    hoopBeats: 3,
    ringR: [14, 18],
    tutR: 24,
    slack: 1,
    scroll: 150,
    magnet: 0.05,
    moving: 0.6,
    moveAmp: 20,
    moveSpeed: 0.55,
    stars: [1760, 3200],
    enemies: { cloud: 2, gust: 3, wisp: 2 },
    puffs: 0,
    gusts: 0,
    gustPush: 0,
    powerups: ['shield', 'fireball', 'speed', 'magnet'],
  },
  storm: {
    label: 'STORM RIDER',
    hint: 'FOR THE BRAVE',
    fresh: 'NO BEST YET',
    timeline: 26,
    hoops: 20,
    hoopBeats: 2,
    ringR: [12, 15],
    tutR: 20,
    slack: 1,
    scroll: 170,
    magnet: 0,
    moving: 0.8,
    moveAmp: 24,
    moveSpeed: 0.6,
    stars: [2200, 3600],
    enemies: { cloud: 4, gust: 5, wisp: 3 },
    puffs: 0,
    gusts: 4,
    gustPush: 150, // px/sec shove, fades out over half a second
    powerups: ['shield', 'fireball', 'magnet', 'friend', 'speed'],
  },
};
export const LEVEL_ORDER = ['hatchling', 'flier', 'storm'];

// enemies are never a fail. a bump makes the dragon tumble for a moment and costs a little score
// and the streak, then it carries on. the dragon always gets home
export const ENEMY = {
  TUMBLE: 0.7, // seconds of tumbling after a bump
  SAFE: 1.3, // can't be bumped again this soon
  HIT_R: 13, // how close counts as a bump (internal px)
  ZAP_AFTER: 0.35, // a grumpy cloud zaps a hoop that slides under it for this long
  WISP_HIDE: 1.6, // a fog wisp hides a hoop this long, then drifts off
  GUST_WARN: 0.8, // wind streaks show this long before a gust pushes
};

// power-ups, collected by flying through them
export const POWER = {
  REACH: 12, // how close the dragon has to fly to an orb
  FIREBALL: 4.0, // seconds of auto-fire
  FIRE_EVERY: 0.3,
  FIRE_NEAR: 70, // the dragon shoots at things within this far of the light
  SPEED: 3.5, // seconds
  SPEED_STEER: 1.8, // steering that much snappier, and hoops worth double
  MAGNET: 5.0, // seconds
  MAGNET_PULL: 0.75,
  FRIEND: 1.4, // seconds a flock friend takes to swoop across
};

// what a flight scores. hoops, streaks, popping enemies and flying clean
export const SCORE = {
  HOOP: 100,
  PERFECT: 50, // extra for going through the middle of a hoop
  PERFECT_ZONE: 0.4, // how much of the radius counts as the middle
  STREAK: 25, // extra per hoop already in the streak...
  STREAK_MAX: 8, // ...up to this many
  POP: 75, // an enemy popped by a fireball or a flock friend
  PUFF: 40, // a harmless puff cloud popped (hatchling)
  POWERUP: 25, // flying through a power-up
  BUMP: -50, // getting bumped by an enemy (never below 0)
  CLEAN: 300, // no bumps and at most one missed hoop
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
  LOCK_RADIUS: 26, // internal px from the dragon's eyes
  // one-euro filter settings per input source. mocap is way jittier so it gets smoothed harder
  FILTER: {
    mouse: { minCutoff: 3.0, beta: 0.02 },
    touch: { minCutoff: 2.5, beta: 0.02 },
    mocap: { minCutoff: 1.0, beta: 0.006 },
    keys: { minCutoff: 5.0, beta: 0.0 },
  },
  KEY_SPEED: 220, // arrow keys, desk testing only
  // on phones the light sits this far above your fingertip (internal px, ~40 css px on a phone)
  // otherwise your finger covers the light and the dragon
  TOUCH_LIFT: 26,
  // mocap calibration (K)
  CAL_INSET: 30, // corner targets sit this far in from the edges, nobody can aim at the very corner
  CAL_HOLD: 1.2, // hold the prop still this long on each corner
  CAL_STEADY: 4, // internal px of wobble that still counts as holding still
};

// the flock is the dragons people actually brought home tonight
export const FLOCK = {
  CLOSE: 12, // this many of the newest get drawn up close, the rest are specks further off
  CELEBRATE_EVERY: 8, // every 8th dragon home gets the whole flock out for a flyover
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
