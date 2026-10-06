// the music: an original folk-style tune in D mixolydian (the flattened 7th gives it the scottish/irish
// lilt the program notes talk about). nothing here is taken from the film score
import { pluck, whistle, pad, brass, drum, bell } from './synth.js';

// 120 bpm, one bar = 4 beats = 2s = one hoop. everything is counted in eighth notes ("steps")

// 8 bars of chords, the tune loops over them
const CHORDS = [
  [50, 54, 57], // D
  [48, 52, 55], // C
  [43, 47, 50], // G
  [50, 54, 57], // D
  [52, 55, 59], // Em
  [48, 52, 55], // C
  [45, 49, 52], // A, pulls back home
  [50, 54, 57], // D
];
const HOME_CHORD = CHORDS[0];

// the tune: [midi, length in eighths], 8 eighths a bar. 0 = rest.
// there's a scotch snap (short-long) in bars 3 and 6
const TUNE = [
  [69, 3], [66, 1], [69, 2], [74, 2],
  [72, 3], [71, 1], [69, 2], [67, 2],
  [67, 1], [71, 3], [74, 3], [72, 1],
  [69, 6], [66, 2],
  [67, 3], [66, 1], [64, 2], [67, 2],
  [72, 1], [71, 3], [72, 2], [74, 2],
  [71, 2], [69, 2], [67, 1], [66, 1], [64, 2],
  [62, 6], [0, 2],
];
// which note of the tune starts on each step of the 8 bars
const TUNE_AT = new Map();
{
  let s = 0;
  for (const [m, len] of TUNE) {
    if (m) TUNE_AT.set(s, [m, len]);
    s += len;
  }
}
const LOOP = 64;

// harp arpeggio inside a bar: root, fifth, octave, tenth, octave, fifth, octave, third
const ARP = [0, 2, 3, 4, 3, 2, 3, 1];
const tones = (c) => [c[0], c[1], c[2], c[0] + 12, c[1] + 12, c[2] + 12];

export const chordAt = (pos) => (pos < 0 ? HOME_CHORD : CHORDS[Math.floor((pos % LOOP) / 8)]);

// one eighth note of music. sec.name = what the game is doing, step = absolute eighth note,
// sec.zero = the step where the tune's bar 1 falls (before that it vamps on D)
export function playStep(ac, out, sec, step, when) {
  const beatLen = 0.5;
  const pos = step - sec.zero;
  const at = step - sec.start; // steps since the section started
  const bar = Math.floor(at / 8);
  const inBar = ((pos % 8) + 8) % 8;
  const chord = chordAt(pos);
  const t = tones(chord);
  const tune = pos >= 0 ? TUNE_AT.get(pos % LOOP) : null;
  const name = sec.name;

  if (name === 'attract') {
    // music box version for the line: soft harp on the beat, the tune every other time round
    if (inBar % 2 === 0) pluck(ac, out, t[ARP[inBar]] + 12, when, 0.17);
    if (inBar === 0) pluck(ac, out, chord[0] - 12, when, 0.14);
    if (tune && Math.floor(pos / LOOP) % 2 === 1) whistle(ac, out, tune[0] + 12, when, tune[1] * beatLen * 0.5, 0.06);
  } else if (name === 'find') {
    // searching in the fog: no tune yet, just a few lonely notes over the drone
    if (inBar === 0 && bar % 2 === 0) pluck(ac, out, [62, 65, 69, 72][(bar / 2) % 4], when, 0.14);
    if (inBar === 4 && bar % 2 === 1) pluck(ac, out, [57, 60, 62, 64][bar % 4], when, 0.09);
  } else if (name === 'flightIntro') {
    // waiting at the first hoop: the harp starts the ostinato
    if (inBar % 2 === 0) pluck(ac, out, t[ARP[inBar]], when, 0.16);
  } else if (name === 'flight' || name === 'climb') {
    const big = sec.swelled;
    // harp all the way through
    pluck(ac, out, t[ARP[inBar]] + (big ? 12 : 0), when, big ? 0.13 : 0.16);
    // bass from bar 2
    if (bar >= 2 && (inBar === 0 || inBar === 4)) pluck(ac, out, chord[0] - 12, when, 0.22);
    // hand drum from bar 1: beats 1 and 3, lighter taps between, busier after the swell
    if (bar >= 1) {
      if (inBar === 0 || inBar === 4) drum(ac, out, when, big ? 0.34 : 0.26);
      else if (inBar === 6 || (big && inBar % 2 === 1)) drum(ac, out, when, 0.12, true);
    }
    // the tune comes in on the whistle after a 2 bar intro. at the swell it starts over from
    // the top in the brass, an octave down
    if (tune) {
      const dur = tune[1] * beatLen * 0.5;
      if (big) brass(ac, out, [tune[0] - 12, tune[0]], when, dur * 0.95, 0.06, { swell: 0.05 });
      else whistle(ac, out, tune[0] + 12, when, dur, 0.09);
    }
    // strings hold the chords from bar 4, warmer after the swell
    if ((bar >= 4 || big) && inBar === 0) pad(ac, out, [chord[0], chord[1] + 12, chord[2] + 12], when, 2.0, big ? 0.045 : 0.02);
    // the climb: a rising run of bells every beat
    if (name === 'climb' && inBar % 2 === 0) bell(ac, out, t[(inBar / 2 + bar) % 6] + 24, when, 0.05);
  } else if (name === 'home') {
    // home: gentle, the start of the tune on the whistle over the harp
    if (inBar % 2 === 0) pluck(ac, out, t[ARP[inBar]] + 12, when, 0.12);
    if (tune && pos < 32) whistle(ac, out, tune[0] + 12, when, tune[1] * beatLen * 0.5, 0.07);
  } else if (name === 'card') {
    // the card: just the harp, letting it settle
    if (inBar % 4 === 0) pluck(ac, out, t[ARP[inBar]] + 12, when, 0.1);
  }
}
