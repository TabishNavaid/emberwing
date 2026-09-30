// a scripted "guest". only ever moves the pointer, never clicks, same as the mocap rig
export async function boot(page, query = '') {
  await page.goto('./?seed=5' + query);
  await page.waitForFunction(() => document.body.classList.contains('ready'));
}
export const state = (page) => page.evaluate(() => window.__emberwing.state());
export const toScreen = (page, x, y) => page.evaluate(([x, y]) => window.__emberwing.toScreen(x, y), [x, y]);

export async function moveTo(page, x, y, steps = 4) {
  const p = await toScreen(page, x, y);
  await page.mouse.move(p.x, p.y, { steps });
}

export async function waitScene(page, name, timeout = 30_000) {
  await page.waitForFunction((n) => window.__emberwing.state().scene === n, name, { timeout, polling: 100 });
}

// tiny tremble like a real hand, still under the steady threshold
export async function hover(page, x, y, seconds) {
  const end = Date.now() + seconds * 1000;
  let i = 0;
  while (Date.now() < end) {
    await moveTo(page, x + Math.sin(i) * 1.5, y + Math.cos(i * 1.3) * 1.5, 1);
    await page.waitForTimeout(80);
    i++;
  }
}

export async function startRun(page) {
  await moveTo(page, 250, 200, 10);
  await page.waitForTimeout(300);
  await moveTo(page, 372, 152, 12);
  await page.waitForFunction(() => window.__emberwing.state().scene === 'find', null, { timeout: 5000, polling: 50 }).catch(() => {});
  const deadline = Date.now() + 4000;
  while ((await state(page)).scene !== 'find' && Date.now() < deadline) await hover(page, 372, 152, 0.3);
}

export async function findEmber(page, { searchSeconds = 2.5, neverFind = false } = {}) {
  const t0 = Date.now();
  let i = 0;
  while ((await state(page)).scene === 'find') {
    const s = await state(page);
    const el = (Date.now() - t0) / 1000;
    if (neverFind || el < searchSeconds) {
      // neverFind stays up in the top-left corner so it can't stumble onto ember by accident
      const x = neverFind ? 60 + ((i * 7) % 60) : 60 + ((Math.sin(i * 0.15) + 1) / 2) * 360;
      const y = neverFind ? 40 + Math.sin(i * 0.3) * 20 : 90 + Math.sin(i * 0.23) * 60;
      await moveTo(page, x, y, 2);
      await page.waitForTimeout(60);
    } else if (s.target) {
      await hover(page, s.target.x + 2, s.target.y + 2, 0.4);
    }
    i++;
  }
}

// lags behind the target a bit like a real hand would
export async function fly(page) {
  let cx = 240;
  let cy = 150;
  while ((await state(page)).scene === 'flight') {
    const s = await state(page);
    if (s.target) {
      cx += (s.target.x - cx) * 0.5;
      cy += (s.target.y - cy) * 0.5;
    }
    await moveTo(page, cx, cy, 2);
    await page.waitForTimeout(50);
  }
}

// keeps wiggling so nothing idles out, and stays away from the end card's skip lantern
export async function watch(page, until) {
  let i = 0;
  while ((await state(page)).scene !== until) {
    await moveTo(page, 200 + Math.sin(i * 0.2) * 30, 120, 2);
    await page.waitForTimeout(120);
    i++;
  }
}
