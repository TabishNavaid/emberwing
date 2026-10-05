// regenerates the pitch images in design/ (960x540). needs npm run dev on :5173
//   node tools/pitch.mjs
import { chromium } from '@playwright/test';

const URL = 'http://localhost:5173/';
const b = await chromium.launch();
const errs = [];

// one game frame: scene at t seconds, with `home` dragons already saved tonight.
// ptr: 'follow' (steer at the hoops), 'target' (aim at the dragon), 'wander', or [x, y]
async function frame({ scene, t, home = 0, ptr = null, route = 0, level = 'hatchling', run = null, size = [960, 540] }) {
  const page = await b.newPage({ viewport: { width: size[0], height: size[1] } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL}?seed=3&scene=attract&route=${route}&level=${level}`);
  await page.waitForFunction(() => document.body.classList.contains('ready'));
  await page.keyboard.press('Enter'); // start the station like the operator, so the speaker icon shows sound on
  await page.evaluate(([scene, t, home, ptr, run]) => {
    const w = window.__emberwing;
    const g = w.game;
    w.pause(true);
    g.gate = false;
    g.store.clear();
    for (let i = 0; i < home; i++) g.store.add([[0, 0.5], [0.25, 0.3 + (i % 4) * 0.1], [0.55, 0.62], [0.8, 0.35], [1, 0.45]], i % 6, null, i === 2 ? { flown: true, level: 'hatchling', score: 2280 } : i === 4 ? { flown: true, level: 'storm', score: 3460 } : null);
    if (run) g.lastRun = run;
    const lvl = g.level;
    w.goto('attract');
    g.level = lvl;
    if (scene !== 'attract') w.goto(scene);
    const inp = g.input;
    inp.feed(300, 250, 'mouse');
    for (let i = 0; i < t * 20; i++) {
      const s = w.state();
      if ((ptr === 'follow' || ptr === 'target') && s.target) inp.feed(s.target.x, s.target.y, 'mouse');
      else if (ptr === 'wander') inp.feed(70 + Math.sin(i * 0.15) * 40, 50 + Math.cos(i * 0.11) * 25, 'mouse');
      else if (Array.isArray(ptr)) inp.feed(ptr[0] + (i % 2), ptr[1], 'mouse');
      w.step(0.05);
    }
  }, [scene, t, home, ptr, run]);
  const png = await page.screenshot();
  await page.close();
  return png;
}

async function save(name, png) {
  const page = await b.newPage();
  await page.setContent(`<img src="data:image/png;base64,${png.toString('base64')}">`);
  await page.locator('img').screenshot({ path: `design/${name}` });
  await page.close();
  console.log('design/' + name);
}

// several frames on one 960x540 sheet
async function sheet(name, frames, cols, labels = []) {
  const imgs = frames.map((f) => `data:image/png;base64,${f.toString('base64')}`);
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  const w = 960 / cols;
  const h = w * 9 / 16;
  await page.setContent(`<body style="margin:0;background:#05070d;width:960px;height:540px;display:flex;flex-wrap:wrap;align-content:center">
    ${imgs.map((src, i) => `<div style="position:relative;width:${w}px;height:${h}px"><img src="${src}" style="width:100%;height:100%;image-rendering:pixelated">
    ${labels[i] ? `<div style="position:absolute;right:8px;bottom:6px;font:700 15px system-ui;color:#ffe28a;text-shadow:0 2px 0 #000">${labels[i]}</div>` : ''}</div>`).join('')}</body>`);
  await page.screenshot({ path: `design/${name}` });
  await page.close();
  console.log('design/' + name);
}

await save('01-attract-next-flyer.png', await frame({ scene: 'attract', t: 6, home: 5 }));
await save('02-find-the-eyes.png', await frame({ scene: 'find', t: 7.5, ptr: 'wander' }));
await save('03-wing-glow-burst.png', await frame({ scene: 'find', t: 2.8, ptr: 'target' }));
await save('04-brass-swell.png', await frame({ scene: 'flight', t: 15.6, home: 5, ptr: 'follow' }));
await save('05-your-path-in-the-aurora.png', await frame({ scene: 'home', t: 4.6, home: 9 }));
await save('06-end-card.png', await frame({ scene: 'end', t: 1.8, home: 8, run: { flown: true, level: 'flier', score: 2875, stars: 2 } }));
await save('07-celebration.png', await frame({ scene: 'party', t: 3.2, home: 16 }));
await save('10-who-will-you-find.png', await frame({ scene: 'choose', t: 1.2, home: 5, ptr: [240, 104] }));
await sheet('11-three-levels.png', [
  await frame({ scene: 'attract', t: 0.7, home: 5, ptr: [292, 132] }),
  await frame({ scene: 'flight', t: 6, home: 3, ptr: 'follow', level: 'hatchling' }),
  await frame({ scene: 'flight', t: 8, home: 3, ptr: 'follow', level: 'flier' }),
  await frame({ scene: 'flight', t: 9, home: 3, ptr: 'follow', level: 'storm' }),
], 2, ['PICK A LEVEL', 'HATCHLING: BIG HOOPS, PUFFS TO POP', 'FLIER: MOVING HOOPS, GUSTS', 'STORM RIDER: SMALL HOOPS, CLOUDS, WIND']);
await sheet('08-three-routes.png', [
  await frame({ scene: 'flight', t: 15.4, home: 3, ptr: 'follow', route: 0 }),
  await frame({ scene: 'flight', t: 4, home: 3, ptr: 'follow', route: 1 }),
  await frame({ scene: 'flight', t: 15.4, home: 3, ptr: 'follow', route: 1 }),
  await frame({ scene: 'flight', t: 8, home: 3, ptr: 'follow', route: 2 }),
], 2, ['SEA STACKS AT DUSK', 'INTO THE RAIN SQUALL...', '...OUT INTO CLEAR SKY', 'PAST THE STANDING STONES']);

// a lineup of the first 12 dragons a night would get
{
  const page = await b.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${URL}?seed=3`);
  await page.waitForFunction(() => document.body.classList.contains('ready'));
  await page.evaluate(async () => {
    const D = await import('/src/core/dragons.js');
    const A = await import('/src/art/dragon.js');
    const F = await import('/src/art/font.js');
    const W = await import('/src/art/world.js');
    const U = await import('/src/core/util.js');
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 270;
    c.style = 'position:fixed;inset:0;width:960px;height:540px;image-rendering:pixelated;z-index:9';
    document.body.appendChild(c);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    W.drawSky(g, W.SKY.aurora, 0, 270);
    W.drawStars(g, W.makeStars(5, 90, 270), 1);
    F.drawText(g, 'EVERY GUEST RESCUES A DIFFERENT DRAGON', 240, 5, { scale: 2, align: 'center', color: '#ffe28a' });
    const rng = U.mulberry32(11);
    const recent = [];
    for (let i = 0; i < 12; i++) {
      const d = D.pickDragon(rng, recent, recent.map((x) => x.name));
      recent.push(d);
      const x = 70 + (i % 4) * 113;
      const y = 68 + Math.floor(i / 4) * 74;
      U.glow(g, x, y - 8, 34, d.colors.wingLit, 0.25);
      A.drawDragon(g, x, y, d, { mood: i % 3 ? 'joy' : 'happy', wing: ['up', 'mid', 'burst', 'down'][i % 4], glow: 2 });
      F.drawText(g, d.name, x, y + 26, { scale: 1, align: 'center', color: '#fff3d6' });
      F.drawText(g, D.QUIRK_TEXT[d.quirk], x, y + 36, { scale: 1, align: 'center', color: '#bff8ee' });
    }
  });
  await page.screenshot({ path: 'design/09-every-dragon-is-different.png' });
  console.log('design/09-every-dragon-is-different.png');
  await page.close();
}

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok');
await b.close();
