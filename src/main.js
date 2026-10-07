// the entry point: builds the game, scales the tiny 480x270 picture up to the screen, runs the
// loop, and hangs a few hooks on window for the tests
import { VIEW, LOOP, LEVELS, DETAIL, PAL } from './config.js';
import { Input } from './input/Input.js';
import { attachPointer, attachMocap, attachKeys } from './input/adapters.js';
import { Beat } from './core/Beat.js';
import { Particles } from './core/Particles.js';
import { SceneManager } from './core/SceneManager.js';
import { Camera } from './core/Camera.js';
import { NightStore } from './core/NightStore.js';
import { Audio } from './audio/Audio.js';
import { Operator } from './core/Operator.js';
import { Motion } from './core/Motion.js';
import { Calibration } from './input/Calibration.js';
import { SoundButton } from './input/SoundButton.js';
import { mulberry32, detail } from './core/util.js';
import { fillLost } from './core/dragons.js';
import { loadSprites } from './art/sprites.js';
import { AuroraWall } from './art/aurora.js';
import { warmSome, drawDragon } from './art/dragon.js';
import { drawText, textWidth, textLog } from './art/font.js';
import { Attract } from './scenes/Attract.js';
import { FindDragon } from './scenes/FindDragon.js';
import { Choose } from './scenes/Choose.js';
import { Celebration } from './scenes/Celebration.js';
import { Flight } from './scenes/Flight.js';
import { Home } from './scenes/Home.js';
import { EndCard } from './scenes/EndCard.js';

const { W, H } = VIEW;
const params = new URLSearchParams(location.search);

// everything draws into a tiny 480x270 canvas and css scales it up with no smoothing. it used to be
// redrawn into a full-screen canvas every frame, which on a weak laptop cost more than the game itself
const display = document.getElementById('screen');
display.width = W;
display.height = H;
const ctx = display.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

// fit = where the picture sits on the screen, in device pixels
let fit = { x: 0, y: 0, w: W, h: H, dpr: 1 };
// the picture stays inside the safe area, clear of a phone's notch and home bar (read off #safe)
const safe = document.getElementById('safe');
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const inset = getComputedStyle(safe);
  const l = parseFloat(inset.paddingLeft) || 0;
  const t = parseFloat(inset.paddingTop) || 0;
  const cw = (window.innerWidth - l - (parseFloat(inset.paddingRight) || 0)) * dpr;
  const ch = (window.innerHeight - t - (parseFloat(inset.paddingBottom) || 0)) * dpr;
  let s = Math.min(cw / W, ch / H);
  if (s >= 2 && (s - Math.floor(s)) / s < VIEW.SNAP) s = Math.floor(s);
  const w = Math.round(W * s);
  const h = Math.round(H * s);
  fit = { x: Math.round(l * dpr + (cw - w) / 2), y: Math.round(t * dpr + (ch - h) / 2), w, h, dpr };
  Object.assign(display.style, { width: w / dpr + 'px', height: h / dpr + 'px', left: fit.x / dpr + 'px', top: fit.y / dpr + 'px' });
}
window.addEventListener('resize', resize);
resize();

const toView = (cx, cy) => ({
  x: ((cx * fit.dpr - fit.x) / fit.w) * W,
  y: ((cy * fit.dpr - fit.y) / fit.h) * H,
});

const input = new Input();
attachPointer(input, window, toView);
attachMocap(input, params);
const keys = attachKeys(input);

const seed = params.has('seed') ? +params.get('seed') : (Date.now() & 0xffffffff);
const beat = new Beat();
const game = {
  input,
  beat,
  particles: new Particles(),
  cam: new Camera(),
  store: new NightStore(),
  rng: mulberry32(seed),
  time: 0,
  runStart: 0,
  runs: [], // finished run lengths, the tests read these
};
// the three dragons that are lost right now. the guest picks one of them (Choose), anything that
// skips the picking (?scene=find, S) gets the first one
game.lost = [];
fillLost(game);
game.dragon = game.lost[0];
// which flight route the next run gets. they take turns, ?route=0..2 pins one for testing
game.routePin = params.has('route') ? +params.get('route') : null;
game.route = game.routePin ?? 0;
// picked on the attract screen. ?level=flier or storm for testing a scene on its own
game.level = LEVELS[params.get('level')] ? params.get('level') : 'hatchling';
game.cal = new Calibration();
input.cal = game.cal;
game.motion = new Motion();
game.cam.motion = game.motion;
game.audio = new Audio(beat);
game.wall = new AuroraWall(game.store);
game.scenes = new SceneManager(game, {
  attract: new Attract(),
  choose: new Choose(),
  find: new FindDragon(),
  flight: new Flight(),
  home: new Home(),
  celebration: new Celebration(),
  end: new EndCard(),
});
game.op = new Operator(game);
game.soundBtn = new SoundButton(game);

// clicking or tapping the speaker toggles sound. registered before the gate below, so while
// "press any key" is up a click only starts the station. touches use the real finger spot,
// not the light (which sits above the fingertip)
window.addEventListener('pointerdown', (e) => {
  if (game.gate) return;
  const p = toView(e.clientX, e.clientY);
  // a finger gets a bigger target, at least 44 css px on a small phone
  if (game.soundBtn.contains(p.x, p.y, e.pointerType === 'touch' ? 9 : 3)) game.soundBtn.press();
});
// ios safari ignores user-scalable=no, this stops pinch zoom there
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// browsers keep sound locked until someone presses a key or touches the screen. on the lobby
// laptop the operator presses any key once to start the station (M starts it silent instead).
// phones skip that, the first touch turns the sound on
const touchFirst = !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
game.touch = touchFirst; // a phone or tablet: tap to pick, no queue to stand in
game.gate = !touchFirst && game.audio.status === 'locked';
game.audio.ctx?.addEventListener('statechange', () => {
  if (game.audio.ctx.state === 'running') game.gate = false;
});
const NOT_A_PRESS = ['Shift', 'Control', 'Alt', 'Meta', 'Escape', 'CapsLock', 'Fn'];
window.addEventListener('keydown', (e) => {
  if (NOT_A_PRESS.includes(e.key)) return;
  game.audio.unlock();
  if (!game.gate) return;
  game.gate = false;
  // the key that starts the station doesn't also do its hotkey (S would start a run), except M
  if (e.key.toLowerCase() !== 'm') {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
}, { capture: true });
for (const ev of ['pointerdown', 'touchend']) {
  window.addEventListener(ev, () => {
    game.audio.unlock();
    game.gate = false;
  }, { passive: true });
}

function step(dt) {
  game.time += dt;
  keys(dt);
  input.update(dt);
  beat.update(dt);
  // the game holds still while the operator calibrates, so aiming at corners can't start a run
  if (!game.op.cal) {
    game.scenes.update(dt);
    game.particles.update(dt);
    game.cam.update(dt);
  }
  input.tap = null; // a tap only counts for the step right after it
  game.audio.update();
  game.soundBtn.update(dt);
  game.op.update(dt);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, W, H);
  game.scenes.draw(ctx);
  game.soundBtn.draw(ctx);
  game.op.draw(ctx);
  // a short delay so a browser that starts audio a moment late doesn't flash the gate
  if (game.gate && game.time > 0.5) game.op.drawGate(ctx);

  // screen shake moves the whole picture, in real screen pixels so it stays smooth
  const k = fit.w / W;
  const shake = `translate(${Math.round(game.cam.ox * k) / fit.dpr}px, ${Math.round(game.cam.oy * k) / fit.dpr}px)`;
  if (display.style.transform !== shake) display.style.transform = shake;
  warmSome(2); // a couple of ms a frame making dragon sprites before they're needed
}

// it used to cap dt at 50ms, so below 20fps the whole game ran in slow motion and a run on
// a weak laptop took way longer. now we catch up in small steps instead
let last = performance.now();
let paused = false;
// a phone held upright gets the turn-your-phone screen and the game waits underneath
const portrait = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
function frame(now) {
  // ask for the next frame first, so one bad frame can't stop the loop and freeze the station
  requestAnimationFrame(frame);
  if (portrait.matches) {
    last = now;
    return;
  }
  const gap = now - last;
  watchDetail(gap);
  let left = Math.min(Math.max(0, gap / 1000), LOOP.MAX_CATCHUP);
  last = now;
  while (!paused && left > 1e-6) {
    const dt = Math.min(left, LOOP.MAX_STEP);
    step(dt);
    left -= dt;
  }
  render();
}

// switches to low detail when frames stay slow, and back once they're quick again on the start
// screen. a gap over 250ms is a frozen or hidden tab, that says nothing about the laptop
function watchDetail(ms) {
  if (ms <= 0 || ms > 250 || paused) return;
  const d = detail;
  d.avg += (ms - d.avg) * 0.1;
  d.slowT = d.avg > DETAIL.SLOW_MS ? d.slowT + ms / 1000 : 0;
  d.fastT = d.avg < DETAIL.FAST_MS ? d.fastT + ms / 1000 : 0;
  if (!d.low && d.slowT > DETAIL.SLOW_FOR) d.low = true;
  if (d.low && d.fastT > DETAIL.FAST_FOR && game.scenes.name === 'attract') d.low = false;
}

// hooks for the playwright tests, guests never touch these
window.__emberwing = {
  game,
  LEVELS,
  goto: (name, data) => game.scenes.enter(name, data || {}),
  pause: (p = true) => (paused = p),
  // fresh random numbers and a fresh beat clock, so a test that steps the game by hand gets the
  // same hoops at the same moments every time (the real-time frames before it paused have already
  // used up a different amount of both)
  reseed: (s) => {
    game.rng = mulberry32(s);
    beat.t = 0;
  },
  toScreen: (x, y) => ({ x: (fit.x + (x / W) * fit.w) / fit.dpr, y: (fit.y + (y / H) * fit.h) / fit.dpr }),
  // draw = false skips the render, for tests that simulate whole flights frame by frame
  step: (seconds, fps = 60, draw = true) => {
    const n = Math.round(seconds * fps);
    for (let i = 0; i < n; i++) step(1 / fps);
    if (draw) render();
  },
  // every line of text the next frame draws, as [text, size]. operator overlays aren't guest text
  words: () => {
    textLog.lines = [];
    textLog.on = true;
    game.scenes.draw(ctx);
    game.soundBtn.draw(ctx);
    textLog.on = false;
    return textLog.lines;
  },
  state: () => ({
    scene: game.scenes.name,
    title: game.scenes.title?.text ?? null,
    t: game.scenes.current?.t ?? 0,
    count: game.store.count,
    dragon: game.dragon.name,
    lost: game.lost.map((d) => d.name),
    route: game.route,
    level: game.level,
    gate: game.gate,
    sound: game.audio.status,
    lowDetail: detail.low,
    runs: game.runs.slice(),
    target: game.scenes.current?.target?.(game) ?? null,
  }),
};

// the turn-your-phone screen, drawn with the game's own dragon and font so it looks like part of it
function drawTurnHint() {
  const pixels = (id, w, h, draw) => {
    const c = document.getElementById(id);
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    draw(g);
  };
  pixels('turn-dragon', 64, 50, (g) => drawDragon(g, 30, 36, game.dragon, { mood: 'curious', wing: 'folded', glow: 2, look: 1 }));
  pixels('turn-phone', 14, 22, (g) => {
    g.fillStyle = PAL.gold;
    g.fillRect(1, 0, 12, 22);
    g.fillStyle = '#05070d';
    g.fillRect(3, 2, 8, 16);
    g.fillStyle = PAL.teal;
    g.fillRect(4, 3, 6, 14);
    g.fillStyle = '#05070d';
    g.fillRect(6, 19, 2, 1);
  });
  const msg = 'TURN YOUR PHONE';
  pixels('turn-text', textWidth(msg, 1) + 2, 10, (g) => drawText(g, msg, 1, 1, { color: PAL.gold }));
}

loadSprites().then(() => {
  const start = params.get('scene') || 'attract';
  game.scenes.enter(start);
  drawTurnHint();
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
});
