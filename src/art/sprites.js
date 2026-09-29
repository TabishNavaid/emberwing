// Cropped sprites from licensed packs (see CREDITS.md). Loaded from public/
// with the Vite base URL so it works under /<repo-name>/ on GitHub Pages.
const BASE = import.meta.env.BASE_URL;
const files = {
  gull: 'sprites/gull.png', // 4 frames 18x18: idle a, idle b, peck a, peck b
  pine: 'sprites/pine.png',
  oak: 'sprites/oak_dead.png',
  bare: 'sprites/tree_bare.png',
};
export const SPR = {};
export function loadSprites() {
  return Promise.all(
    Object.entries(files).map(
      ([k, f]) =>
        new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            SPR[k] = img;
            res();
          };
          img.onerror = () => res(); // a missing sprite never blocks the game
          img.src = BASE + f;
        }),
    ),
  );
}
export function drawGull(ctx, x, y, frame = 0, flip = false) {
  const img = SPR.gull;
  if (!img) return;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, (frame % 4) * 18, 0, 18, 18, -9, -17, 18, 18);
  ctx.restore();
}
// Silhouette tint cache (trees become dark island shapes)
const tintCache = new Map();
export function tinted(name, color) {
  const key = name + color;
  let c = tintCache.get(key);
  if (!c && SPR[name]) {
    const img = SPR[name];
    c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
  }
  return c;
}
export function drawTree(ctx, name, x, baseY, color = null, alpha = 1) {
  const img = color ? tinted(name, color) : SPR[name];
  if (!img) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(baseY - img.height));
  ctx.globalAlpha = 1;
}
