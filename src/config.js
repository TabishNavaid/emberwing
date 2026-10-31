// all the knobs live here so we can tune after playtesting without digging through scenes.
// times are seconds unless it says otherwise

export const VIEW = {
  // everything draws at 480x270 and gets scaled up (4x on a 1080p projector)
  W: 480,
  H: 270,
  // round the scale down to whole pixels when that costs less than this much of the picture.
  // uneven pixel sizes look wobbly on the projector. not more than 5%: at 8% a sideways iphone
  // shrank to 4x with black bars all round, and on its tiny pixels the unevenness can't be seen
  SNAP: 0.05,
};

// the only three text sizes a guest ever sees (font scale, 7px letters times this). S is 56px tall on
// the projector, which is the smallest that reads from 15ft, so nothing a guest reads goes below it.
// if a line doesn't fit, cut words before shrinking it
export const TEXT = { S: 2, M: 3, L: 4 };

export const DUR = {
  START_DWELL: 1.5, // hold the light on a level this long to start it (a phone just taps)
  START_CANCEL: 0.3, // a full ring drains back this fast once the light slides off the level
  // when the start screen comes back the last guest is often still holding the prop or has just put
  // it down. for this long nothing can start, and a level the light is resting on when it's over
  // stays dead until the light moves INPUT.START_ARM_PX away and comes back
  HANDOFF: 2.0,
  CHOOSE: 8.0, // "who will you find?" picks a dragon for you after this, so the line keeps moving
  CHOOSE_DWELL: 1.5, // hold the light on a dragon this long to pick it (same as a level)
  // the light is still wherever the level was, which is over a dragon card. for this long nothing
  // counts, and a card the light is resting on when it's over stays dead until the light moves off
  // it and back. testers kept getting the middle dragon 1.2s in, before they'd picked anything
  CHOOSE_LOCK: 1.0,
  PICKED: 1.8, // after a pick: the name pops and the other two say NEXT TIME (0.9 was too quick to read)
  ATTRACT_PAGE: 4.5, // per storybook page
  ATTRACT_DEMO_PAGE: 6.5, // ghost demo needs longer to play out

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
  FIND_BURST: 2.1, // the "YOU FOUND PIP!" moment, everything holds still for this long (1.6 was too quick to read)

  // (how long the flight runs is set per level, see LEVELS)
  // home was 6.5. the dragon card carries the act II line too, so home only has to land the
  // ribbon and the counter. at 4.6 the act II line was only up for a second before it faded, so
  // it's longer now and the act II line comes in earlier (Home.js). 5.6 took a hatchling run past
  // 50s, at 5.4 every line is still up about 2.5s. a hatchling run is ~49s
  HOME: 5.4,
  CELEBRATE: 7.6, // every FLOCK.CELEBRATE_EVERY-th dragon gets its own celebration after home
  END: 5.4, // the dragon card, long enough to read it and snap a photo (NEXT skips it)
  END_SKIP_DWELL: 1.0,

  // every scene change. playtesters said the menus moved too fast to follow at 0.4, so it's a
  // little slower again. 0.6 took a hatchling run past 50s (each fade out adds to the run, the fade
  // in plays over the next scene), so keep an eye on that
  FADE: 0.5,
  // title card between scenes ("NOW FLY HOME!"). playtesting the live site, the hard cuts
  // made people think the game had glitched or ended
  TITLE: 2.2, // 1.3 was gone before people had read it
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
  // where the light can steer the dragon, in screen px so it stays the same while the camera zooms.
  // it used to be in world px, and as the camera pulled back for the swell the band shrank on
  // screen: the top of the screen stopped doing anything and steering felt mushy halfway through
  X_PLAY: 46, // how far it can drift left/right of the gate
  STEER_TOP: 16, // highest it goes on screen (just under the hud)
  FLOOR: 212, // lowest it goes, in world px: just above the sea (routes SEA_Y is 222), wherever the sea is on screen
  WOBBLE: 3, // px of early wobble, fades out as it gets confident (7 fought the guest's steering)
  ZOOM_START: 1.18,
  ZOOM_END: 0.86,
  CAM_FOLLOW: 0.12, // how much the camera drifts toward the dragon vertically, 0 = locked
  ROLL_THIN: 0.25, // a barrel roll never squashes the dragon thinner than this, so it never disappears
};

// three levels, and picking one on the attract screen is how a run starts. hatchling is big slow
// hoops for little kids and first-timers. everything that makes the other two harder is in here
// so it can be tuned after playtesting
export const LEVELS = {
  hatchling: {
    label: 'HATCHLING',
    hint: 'START HERE', // the line under each name on the start screen
    timeline: 18, // seconds of hoops after the tutorial hoop
    hoops: 8, // including the tutorial hoop
    hoopBeats: 4, // a hoop every 4 beats (2s). at 2 beats first-timers had no time to steer
    ringR: [24, 34], // hoop radius, grows over the flight (was 15, too small for little kids)
    tutR: 30, // the tutorial hoop
    slack: 4, // px of grace past the outside of the drawn hoop that still counts
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
  // hoops count from this much further out while it lasts. it used to steer the dragon toward the
  // hoop instead, which took the light away from the guest for 5s mid-flight
  MAGNET_REACH: 10,
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

// automatic low detail for a weak laptop. when frames stay slow the expensive extras (particles,
// aurora strips, rays, trails, a huge celebration flock) get toned down. the game plays the same
export const DETAIL = {
  SLOW_MS: 30, // average frame time that counts as slow (about 33 fps)
  SLOW_FOR: 1.5, // seconds of slow frames before switching to low detail
  FAST_MS: 18, // back to full detail once frames are this quick...
  FAST_FOR: 8, // ...for this long, and only on the start screen so it doesn't flicker mid-run
  CROWD: 30, // in low detail the celebration draws this many dragons up close, the rest as specks
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
  START_ARM_PX: 10, // internal px off a level before it can start again (see DUR.HANDOFF). a prop resting on the table jitters 2-3px
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

// the operator's Q key puts a code for the live site on the start screen, for people in line
export const QR = {
  URL: 'https://tabishnavaid.github.io/emberwing/',
  MODULE: 2, // internal px per square, so 8 real px on the projector. bigger reads from further
};

export const STORE = {
  KEY: 'emberwing.night.v1',
  MAX_RIBBONS: 500, // past this the oldest ribbons drop off, the count keeps going
  NEW_NIGHT_BY_DATE: true, // new calendar day = fresh sky
};

// the a/b test from the usability rounds. the normal url (and ?v=a) is A, ?v=b is B. every
// difference between the two is in here
export const AB = {
  a: {
    story: true, // the storybook tells the story and a ghost player shows how to play
    length: 1, // hoops (and enemies, and seconds of flight) per level, times this
    saveAs: '', // added to STORE.KEY. A keeps the key saves already use
  },
  b: {
    story: false, // only the music page: no guide, no demo
    length: 1.3, // about 30% longer, same spacing, size and speed so it plays as hard
    saveAs: '.b', // its own sky, dragons and best scores
  },
};

// the run log for the a/b test: one line per run, both versions in one list. the operator's L shows
// it as a table, X clears it
export const LOG = {
  KEY: 'emberwing.runs.v1',
  MAX: 500, // the oldest runs drop off past this
  // a light this still this long on the start screen is nobody (same as INPUT.IDLE_RESET), so the next
  // guest's start screen time counts from when it moves again. 5s cut off people reading the book
  AWAY: 10.0,
};

// storm slate -> sea green -> gold / ember / aurora. the color arc tells the story
export const PAL = {
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
  ember3: '#ffa654',
  teal: '#3ff0d8',
  violet: '#9a6cff',
  rose: '#ff8fb0',
  white: '#ffffff',
};
