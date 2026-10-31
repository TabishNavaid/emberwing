// which side of the a/b test this page is (?v=b, anything else is A) and the level numbers it
// plays with. everything that differs is AB in config.js
import { AB, LEVELS, MUSIC } from '../config.js';

export const version = new URLSearchParams(location.search).get('v')?.toLowerCase() === 'b' ? 'b' : 'a';
export const ab = AB[version];

// a level stretched by ab.length: more hoops on the same beat spacing, the flight longer by just
// the time they take, and as many enemies, puffs and gusts per hoop. star scores for the extra hoops
const stretched = {};
export function levelFor(id) {
  const L = LEVELS[id];
  if (ab.length === 1) return L;
  if (stretched[id]) return stretched[id];
  const hoops = Math.round(L.hoops * ab.length);
  const more = (n) => Math.round((n * hoops) / L.hoops);
  return (stretched[id] = {
    ...L,
    hoops,
    timeline: L.timeline + ((hoops - L.hoops) * L.hoopBeats * 60) / MUSIC.BPM,
    stars: L.stars.map((s) => Math.round(more(s) / 10) * 10),
    enemies: Object.fromEntries(Object.entries(L.enemies).map(([k, n]) => [k, more(n)])),
    puffs: more(L.puffs),
    gusts: more(L.gusts),
  });
}
