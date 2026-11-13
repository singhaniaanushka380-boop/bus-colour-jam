import { SaveManager } from './SaveManager.js';
import { AudioManager } from './AudioManager.js';
import { LevelManager } from './LevelManager.js';
import { solve, createState } from './PuzzleValidator.js';
import { ACHIEVEMENTS } from '../data/achievements.js';

/** Single shared hub: save data, audio, level info, coins. Scenes import the `gm` singleton. */
class GameManager {
  constructor() {
    this.save = new SaveManager();
    this.audio = new AudioManager(this.save);
    this.levels = LevelManager;
    this._listeners = new Set();
  }

  // ---- tiny event hook for coin changes (HUD counters subscribe)
  onCoins(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
  _emitCoins() {
    this._listeners.forEach((fn) => fn(this.save.coins));
  }

  get coins() { return this.save.coins; }
  addCoins(n) { this.save.addCoins(n); this._emitCoins(); }
  spendCoins(n) {
    const ok = this.save.spendCoins(n);
    if (ok) this._emitCoins();
    return ok;
  }

  claimDaily() {
    const res = this.save.claimDaily();
    if (res) this._emitCoins();
    return res;
  }

  get currentLevelId() { return this.save.current; }

  /** Dev-only sanity check so a bad hand-edited level is noticed immediately. */
  checkLevel(level) {
    if (!import.meta.env?.DEV) return;
    const r = solve(level, createState(level), { maxNodes: 500000 });
    if (!r.solvable) console.warn(`[BusColorJam] Level ${level.id} has no solution!`);
  }

  /** Persists a win and pays out. Coins are added immediately; scenes animate the counter. */
  completeLevel(level, stars) {
    const prevCoins = this.save.coins;
    const colors = [...new Set(level.buses.map((b) => b.color))];
    const { firstClear, improved } = this.save.recordWin(level.id, stars, this.levels.count, colors, level.totalPassengers);
    const reward = this.levels.rewardFor(level, stars, { firstClear });
    this.addCoins(reward.total);
    const achievements = this.checkAchievements();
    return { reward, firstClear, improved, prevCoins, achievements };
  }

  /** Grants any newly reached achievements (coins included) and returns them. */
  checkAchievements() {
    const view = {
      data: this.save.data,
      wins: () => this.save.data.stats.wins,
      cleared: () => Object.values(this.save.data.levels).filter((l) => l.stars > 0).length,
      perfect: () => Object.values(this.save.data.levels).filter((l) => l.stars === 3).length,
      totalStars: () => this.save.totalStars(),
    };
    const got = [];
    ACHIEVEMENTS.forEach((a) => {
      if (a.value(view) >= a.goal && this.save.grantAch(a.id, a.coins)) got.push(a);
    });
    if (got.length) this._emitCoins();
    return got;
  }

  failLevel() {
    this.save.recordFail();
  }
}

export const gm = new GameManager();
export default gm;
