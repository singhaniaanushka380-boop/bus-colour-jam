import { LEVELS } from '../data/levels.js';
import { parseLevel } from '../data/levelFormat.js';

const cache = new Map();

export const COINS_PER_WIN = 40;

export const LevelManager = {
  get count() {
    return LEVELS.length;
  },

  /** Parsed, ready-to-play level (cached). */
  get(id) {
    const n = Math.min(Math.max(1, id | 0), LEVELS.length);
    if (!cache.has(n)) cache.set(n, parseLevel(LEVELS[n - 1]));
    return cache.get(n);
  },

  hasNext(id) {
    return id < LEVELS.length;
  },

  tier(id) {
    if (id <= 5) return { key: 'tutorial', name: 'Beginner', color: 0x3ed16a };
    if (id <= 10) return { key: 'easy', name: 'Easy', color: 0x3d8bff };
    if (id <= 20) return { key: 'medium', name: 'Medium', color: 0xff9a3c };
    return { key: 'hard', name: 'Challenging', color: 0xa566ff };
  },

  /**
   * 3 stars = no help used and at most 2 mistakes (blocked taps), 2 = at most two assists and 6 mistakes,
   * 1 = otherwise. Assists = undos + hints + restarts.
   */
  starsFor({ undos = 0, hints = 0, restarts = 0, mistakes = 0 }) {
    const assists = undos + hints + restarts;
    if (assists === 0 && mistakes <= 2) return 3;
    if (assists <= 2 && mistakes <= 6) return 2;
    return 1;
  },

  // Rule: every level win pays a flat 40 coins (no star / perfect / challenge / replay bonus).
  rewardFor() {
    const total = COINS_PER_WIN;
    return { total, base: total, starBonus: 0, perfect: 0, challenge: false };
  },
};

export default LevelManager;
