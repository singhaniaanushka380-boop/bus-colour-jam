import { SaveManager } from './SaveManager.js';
import { AudioManager } from './AudioManager.js';
import { LevelManager } from './LevelManager.js';
import { solve, createState } from './PuzzleValidator.js';

// short buzz per sound effect name (milliseconds, or [buzz, pause, buzz...])
const HAPTICS = { click: 10, park: 25, depart: 20, unlock: 35, coin: 8, star: 15, error: 60, win: [50, 50, 120], fail: [120, 60, 120] };

/** Single shared hub: save data, audio, level info, coins. Scenes import the `gm` singleton. */
class GameManager {
  constructor() {
    this.save = new SaveManager();
    this.audio = new AudioManager(this.save);
    this.levels = LevelManager;
    this._listeners = new Set();
    // Phone vibration: every game sound effect that matters also gives a short buzz (when Vibration is ON in Settings).
    const sfx = this.audio.sfx.bind(this.audio);
    this.audio.sfx = (name, ...args) => {
      const pattern = HAPTICS[name];
      if (pattern) this.vibrate(pattern);
      return sfx(name, ...args);
    };
  }

  get vibrationOn() { return !!this.save.settings.vibration; }
  setVibration(on) { this.save.setSetting('vibration', on); }
  /** Buzz the phone (number of ms or a pattern). Does nothing when Vibration is OFF or the device cannot vibrate. */
  vibrate(pattern = 15) {
    if (!this.vibrationOn) return;
    try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
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

  // ---- booster tokens (prizes of the Lucky Spin)
  get inv() { return this.save.inv; }
  addItem(kind, n = 1) { this.save.addItem(kind, n); this._emitInv(); }
  useItem(kind) {
    const ok = this.save.useItem(kind);
    if (ok) this._emitInv();
    return ok;
  }
  onInv(fn) {
    this._invListeners = this._invListeners || new Set();
    this._invListeners.add(fn);
    return () => this._invListeners.delete(fn);
  }
  _emitInv() {
    (this._invListeners || []).forEach((fn) => fn(this.save.inv));
  }

  // ---- lucky spin: 1 free spin per 10 cleared levels
  get clearedLevels() { return Object.values(this.save.data.levels).filter((l) => l.stars > 0).length; }
  get freeSpins() { return Math.max(0, Math.floor(this.clearedLevels / 10) - this.save.data.spin.freeUsed); }
  levelsToNextSpin() { return 10 - (this.clearedLevels % 10); }
  useFreeSpin() {
    if (this.freeSpins <= 0) return false;
    this.save.data.spin.freeUsed++;
    this.save.save();
    return true;
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
    return { reward, firstClear, improved, prevCoins };
  }

  failLevel() {
    this.save.recordFail();
  }
}

export const gm = new GameManager();
export default gm;
