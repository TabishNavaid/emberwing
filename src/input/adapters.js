// the input adapters: mouse/touch/pen, the mocap rig (websocket or postMessage) and the arrow keys.
// they all just feed one x/y into Input
import { VIEW, INPUT } from '../config.js';

// mouse, touch and pen all come in as pointer events. pressing only sets `holding`,
// nothing actually needs a click
export function attachPointer(input, target, toView) {
  const onMove = (e) => {
    const p = toView(e.clientX, e.clientY);
    if (e.pointerType === 'touch') input.feed(p.x, p.y - INPUT.TOUCH_LIFT, 'touch');
    else input.feed(p.x, p.y, 'mouse');
  };
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerdown', (e) => {
    onMove(e);
    input.setHolding(true);
  });
  window.addEventListener('pointerup', () => input.setHolding(false));
  window.addEventListener('pointercancel', () => input.setHolding(false));
  // otherwise phones scroll/zoom the page instead of moving the light
  target.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
}

// mocap, all in 0..1 across the game image (top-left origin). see README for the formats.
// ?mocap=wss://... for a websocket, or postMessage / window.emberwingPointer(x, y).
// a rig that just moves the OS cursor doesn't need any of this.
// TODO: test with the real mocap rig at cordiner
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
          // one bad frame from the rig shouldn't kill the socket
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

// ws:// gets blocked on https (github pages) so we force wss unless it's localhost
function secureSocketUrl(url, input) {
  const local = /^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url);
  if (location.protocol === 'https:' && url.startsWith('ws://') && !local) {
    const upgraded = 'wss://' + url.slice(5);
    const msg = `https page: ${url} would be blocked, using ${upgraded}`;
    console.warn('[emberwing] ' + msg);
    input.status = msg;
    return upgraded;
  }
  return url;
}

// arrow keys + space, desk testing only
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
