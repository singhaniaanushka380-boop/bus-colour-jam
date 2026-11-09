import { LEVELS } from '../data/levels.js';
import { parseLevel } from '../data/levelFormat.js';

const cache = new Map();

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

  /** 3 stars = no help used, 2 = at most two assists, 1 = otherwise. */
  starsFor({ undos = 0, hints = 0, restarts = 0 }) {
    const assists = undos + hints + restarts;
    if (assists === 0) return 3;
    if (assists <= 2) return 2;
    return 1;
  },

  /** Coins for finishing a level. Replays pay half so farming is not worthwhile. */
  rewardFor(level, stars, { firstClear = true } = {}) {
    const base = 25 + Math.min(level.id, 30);
    const starBonus = stars * 10;
    const perfect = stars === 3 ? 25 : 0;
    let total = base + starBonus + perfect;
    if (level.challenge) total *= 2;
    if (!firstClear) total = Math.ceil(total / 2);
    return { total, base, starBonus, perfect, challenge: level.challenge };
  },
};

export default LevelManager;
