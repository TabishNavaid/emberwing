import { MOTION } from '../config.js';

// reduced motion: follows the OS "reduce motion" setting unless the operator forces it with G.
// saved so a refresh keeps whatever the operator picked
const KEY = 'emberwing.motion.v1';
const MODES = ['auto', 'on', 'off'];

export class Motion {
  constructor() {
    this.query = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.force = 'auto';
    try {
      const v = localStorage.getItem(KEY);
      if (MODES.includes(v)) this.force = v;
    } catch {
      // storage blocked, just stay on auto
    }
  }
  get os() {
    return !!this.query?.matches;
  }
  get reduced() {
    return this.force === 'on' || (this.force === 'auto' && this.os);
  }
  // multiply any flash alpha by this
  get flash() {
    return this.reduced ? MOTION.FLASH_SCALE : 1;
  }
  cycle() {
    this.force = MODES[(MODES.indexOf(this.force) + 1) % MODES.length];
    try {
      localStorage.setItem(KEY, this.force);
    } catch {
      // fine, it just won't survive a refresh
    }
    return this.force;
  }
  label() {
    if (this.force === 'auto') return `AUTO (OS ${this.os ? 'REDUCED' : 'FULL'})`;
    return this.force === 'on' ? 'FORCED REDUCED' : 'FORCED FULL';
  }
}
