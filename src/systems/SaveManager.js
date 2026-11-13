import { SAVE_KEY, SAVE_VERSION, START_COINS, DAILY_REWARDS } from '../config.js';

export const UPGRADE_GIFT = 100; // one-time thank-you coins when an old (v1) save is upgraded to the 3D version

const defaults = () => ({
  v: SAVE_VERSION,
  coins: START_COINS,
  unlocked: 1,
  current: 1,
  levels: {}, // { [id]: { stars, plays } }
  settings: { sound: true, music: true },
  daily: { last: null, streak: 0 },
  stats: { wins: 0, fails: 0, boarded: 0 },
  ach: {}, // { [achievementId]: true }
  colors: [], // colour names seen in cleared levels (Rainbow achievement)
  migrated: null, // { from, gift } when an older save was upgraded
});

const dayString = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Upgrades a parsed save of any older version to the current one WITHOUT touching progress:
 * coins, unlocked/current level, stars, settings and the daily streak are all kept.
 * v1 -> v2 (3D update): new fields are added, values are sanitised, and a one-time gift is granted.
 */
export function migrateSave(raw, totalLevels = 200) {
  const out = merge(defaults(), raw);
  const from = Number(raw && raw.v) || 1;
  if (from < SAVE_VERSION) {
    out.migrated = { from, gift: UPGRADE_GIFT };
    out.coins += UPGRADE_GIFT;
  }
  out.v = SAVE_VERSION;
  out.coins = Math.max(0, Math.round(Number(out.coins) || 0));
  out.unlocked = Math.min(Math.max(1, Math.round(Number(out.unlocked) || 1)), totalLevels);
  out.current = Math.min(Math.max(1, Math.round(Number(out.current) || 1)), out.unlocked);
  Object.keys(out.levels).forEach((id) => {
    const l = out.levels[id];
    const stars = Math.min(3, Math.max(0, Math.round(Number(l && l.stars) || 0)));
    out.levels[id] = { stars, plays: Math.max(0, Math.round(Number(l && l.plays) || 0)) };
    if (stars > 0 && Number(id) >= out.unlocked && Number(id) < totalLevels) out.unlocked = Number(id) + 1;
  });
  return out;
}

function merge(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in extra)) continue;
    const b = base[k];
    const e = extra[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && k !== 'levels' && k !== 'ach') base[k] = merge(b, e);
    else if (b === null || typeof e === typeof b || k === 'levels' || k === 'ach') base[k] = e;
  }
  return base;
}

/** LocalStorage-backed save. Falls back to memory if storage is blocked (private mode, etc.). */
export class SaveManager {
  constructor() {
    this.data = this._load();
    if (this._pendingSave) this.save();
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrate = !parsed || (Number(parsed.v) || 1) < SAVE_VERSION;
        const data = migrateSave(parsed);
        if (migrate) this._pendingSave = true;
        return data;
      }
    } catch (e) {
      /* corrupt or blocked storage: start fresh */
    }
    return defaults();
  }

  save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      /* storage full / blocked: progress lives in memory for this session */
    }
  }

  // ---- coins
  get coins() { return this.data.coins; }
  addCoins(n) { this.data.coins = Math.max(0, this.data.coins + Math.round(n)); this.save(); }
  spendCoins(n) {
    if (this.data.coins < n) return false;
    this.data.coins -= n;
    this.save();
    return true;
  }

  // ---- progress
  get unlocked() { return this.data.unlocked; }
  get current() { return Math.min(this.data.current, this.data.unlocked); }
  setCurrent(id) { this.data.current = id; this.save(); }
  getStars(id) { return this.data.levels[id]?.stars || 0; }
  isCompleted(id) { return this.getStars(id) > 0; }

  /** Stores a win. Returns { firstClear, improved }. */
  recordWin(id, stars, totalLevels, colors = [], boarded = 0) {
    const prev = this.data.levels[id];
    const firstClear = !prev || !prev.stars;
    const improved = !!prev && stars > prev.stars;
    this.data.levels[id] = { stars: Math.max(stars, prev?.stars || 0), plays: (prev?.plays || 0) + 1 };
    if (id >= this.data.unlocked && id < totalLevels) this.data.unlocked = id + 1;
    this.data.current = Math.min(id + 1, totalLevels);
    this.data.stats.wins++;
    this.data.stats.boarded += boarded;
    colors.forEach((c) => { if (!this.data.colors.includes(c)) this.data.colors.push(c); });
    this.save();
    return { firstClear, improved };
  }

  recordFail() { this.data.stats.fails++; this.save(); }

  totalStars() {
    return Object.values(this.data.levels).reduce((n, l) => n + (l.stars || 0), 0);
  }

  // ---- achievements
  hasAch(id) { return !!this.data.ach[id]; }
  grantAch(id, coins) {
    if (this.data.ach[id]) return false;
    this.data.ach[id] = true;
    this.data.coins += coins;
    this.save();
    return true;
  }

  // ---- settings
  get settings() { return this.data.settings; }
  setSetting(key, value) { this.data.settings[key] = !!value; this.save(); }

  // ---- daily reward
  dailyStatus() {
    const today = dayString();
    const { last, streak } = this.data.daily;
    if (last === today) {
      return { available: false, day: (streak - 1 + 7) % 7, streak, reward: 0 };
    }
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const nextStreak = last === dayString(y) ? streak + 1 : 1;
    const day = (nextStreak - 1) % DAILY_REWARDS.length;
    return { available: true, day, streak: nextStreak, reward: DAILY_REWARDS[day] };
  }

  claimDaily() {
    const s = this.dailyStatus();
    if (!s.available) return null;
    this.data.daily = { last: dayString(), streak: s.streak };
    this.data.coins += s.reward;
    this.save();
    return s;
  }

  reset() {
    this.data = defaults();
    this.save();
  }
}

export default SaveManager;
