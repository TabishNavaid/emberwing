import { VIEW, INPUT } from '../config.js';

// ---------------------------------------------------------------------------
// Mouse, touch and pen all arrive as Pointer Events. Clicks are never needed:
// the pointer position is the whole interaction. Pressing only sets `holding`,
// which is an optional shortcut.
export function attachPointer(input, target, toView) {
  const onMove = (e) => {
    const p = toView(e.clientX, e.clientY);
    input.feed(p.x, p.y, e.pointerType === 'touch' ? 'touch' : 'mouse');
  };
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerdown', (e) => {
    onMove(e);
    input.setHolding(true);
  });
  window.addEventListener('pointerup', () => input.setHolding(false));
  window.addEventListener('pointercancel', () => input.setHolding(false));
  // Stop the page from scrolling / zooming under a finger.
  target.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

// ---------------------------------------------------------------------------
// Motion capture. Three ways in, all taking normalized coordinates (0..1
// across the game image, origin top-left):
//   1. WebSocket: add ?mocap=wss://host:port (or ws://localhost:port) to the
//      URL. Messages: {"x":0.5,"y":0.4,"hold":false}  or  "0.5,0.4"
//   2. postMessage from a parent frame or extension:
//      window.postMessage({ type: 'emberwing-pointer', x, y, hold }, '*')
//   3. A script on the same page: window.emberwingPointer(x, y, hold)
// A rig that drives the OS mouse cursor needs none of this; it just works.
// ?mocapFlipX=1 mirrors x (for a camera that faces the guest).
export function attachMocap(input, params) {
  const flipX = params.get('mocapFlipX') === '1';
  const flipY = params.get('mocapFlipY') === '1';
  const push = (nx, ny, hold) => {
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    if (flipX) nx = 1 - nx;
    if (flipY) ny = 1 - ny;
    input.feed(nx * VIEW.W, ny * VIEW.H, 'mocap');
    if (hold !== undefined) input.setHolding(hold);
  };

  window.emberwingPointer = (x, y, hold) => push(+x, +y, hold);
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.type === 'emberwing-pointer') push(+d.x, +d.y, d.hold);
  });

  let url = params.get('mocap');
  if (!url) return;
  url = secureSocketUrl(url, input);
  let delay = 500;
  const connect = () => {
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      input.status = `mocap blocked: ${err.message}`;
      return;
    }
    ws.onopen = () => {
      delay = 500;
      input.status = `mocap connected ${url}`;
    };
    ws.onmessage = (e) => {
      const s = typeof e.data === 'string' ? e.data.trim() : '';
      if (s.startsWith('{')) {
        try {
          const d = JSON.parse(s);
          push(+d.x, +d.y, d.hold);
        } catch {
          /* ignore malformed frame */
        }
      } else {
        const [x, y] = s.split(/[ ,;]+/).map(Number);
        push(x, y);
      }
    };
    ws.onclose = () => {
      input.status = `mocap retrying ${url}`;
      setTimeout(connect, delay);
      delay = Math.min(delay * 2, 8000);
    };
  };
  connect();
}

// Pages served over HTTPS (GitHub Pages) may not open plain ws:// sockets to
// other hosts: browsers block it as mixed content. ws://localhost and
// ws://127.0.0.1 are allowed. So on HTTPS we upgrade remote ws:// to wss://.
export function secureSocketUrl(url, input) {
  const local = /^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
  if (location.protocol === 'https:' && url.startsWith('ws://') && !local) {
    const upgraded = 'wss://' + url.slice(5);
    const msg = `https page: ${url} would be blocked, using ${upgraded}`;
    console.warn('[emberwing] ' + msg);
    if (input) input.status = msg;
    return upgraded;
  }
  return url;
}

// ---------------------------------------------------------------------------
// Arrow keys + Space: for testing at a desk only.
export function attachKeys(input) {
  const down = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.key.startsWith('Arrow')) {
      down.add(e.key);
      e.preventDefault();
    }
    if (e.key === ' ') {
      input.setHolding(true);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    down.delete(e.key);
    if (e.key === ' ') input.setHolding(false);
  });
  return (dt) => {
    if (!down.size) return;
    const s = INPUT.KEY_SPEED * dt;
    let { rawX: x, rawY: y } = input;
    if (down.has('ArrowLeft')) x -= s;
    if (down.has('ArrowRight')) x += s;
    if (down.has('ArrowUp')) y -= s;
    if (down.has('ArrowDown')) y += s;
    input.feed(x, y, 'keys');
  };
}
