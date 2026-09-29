// Quick screenshot helper for art iteration:
//   node tools/shoot.mjs <scene> <seconds> [name] [--phone] [--x=240 --y=150]
// Needs `npm run dev` running on :5173.
import { chromium } from '@playwright/test';
const [scene = 'attract', t = '2', name = `${scene}-${t}`] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); const k = i < 0 ? a.slice(2) : a.slice(2, i); const v = i < 0 ? undefined : a.slice(i + 1); return [k, v ?? true]; }));
const phone = !!flags.phone;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: phone ? { width: 844, height: 390 } : { width: 1920, height: 1080 }, deviceScaleFactor: phone ? 2 : 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:5173/?seed=3&scene=${scene}`);
await page.waitForFunction(() => document.body.classList.contains('ready'));
await page.evaluate(() => window.__emberwing.pause(true));
if (flags.x) await page.evaluate(([x, y]) => { const i = window.__emberwing.game.input; i.feed(+x, +y, 'mouse'); }, [flags.x, flags.y]);
if (flags.setup) await page.evaluate(flags.setup);
await page.evaluate((t) => window.__emberwing.step(+t), t);
const out = `tests/screens/${name}${phone ? '-phone' : ''}.png`;
await page.screenshot({ path: out });
console.log(out, errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok');
await browser.close();
