// Pure rules engine (no Phaser / Three) shared by the game, the hint system, the boosters and the Node level tools.
//
// RULES
//  1. Tap a vehicle: it drives straight ahead (the way its roof arrow points) out of the grid. Every cell ahead
//     must be free of other vehicles, otherwise it bumps.
//  2. It then parks in a free ACTIVE BAY (4 bays; a 5th VIP bay can be unlocked). No free bay = it cannot leave.
//  3. Only the FRONT passenger of the single queue can board. If a parked vehicle of exactly that colour has a free
//     seat, he/she boards - and the next passenger tries immediately (chain reaction).
//  4. A vehicle with every seat taken departs and frees its bay.
//  5. Win: every vehicle has departed. Lose ("Out of Space"): no vehicle can leave and nobody can board.
//  Tunnels: a vehicle waiting in a garage drives out when the vehicle in front of it has left.
//  Mystery vehicles hide their colour while another vehicle blocks them (display only - rules use the real colour).

import { BAYS } from '../data/levelFormat.js';

export const TOTAL_BAYS = BAYS + 1; // 4 active + VIP

export function createState(level) {
  return {
    removed: 0, // vehicles that have left the grid (parked or departed)
    bayBus: new Array(TOTAL_BAYS).fill(-1),
    bayFill: new Array(TOTAL_BAYS).fill(0),
    queue: level.queue, // colour per passenger (replaced by the Shuffle Passengers booster)
    qp: 0, // passengers already boarded
    col: level.buses.map((b) => b.color), // current colour per vehicle (Shuffle Colors booster may change it)
    vip: false,
    departed: 0,
    boarded: 0,
  };
}

export function cloneState(s) {
  return {
    removed: s.removed, bayBus: s.bayBus.slice(), bayFill: s.bayFill.slice(), queue: s.queue, qp: s.qp,
    col: s.col, vip: s.vip, departed: s.departed, boarded: s.boarded,
  };
}

const bayOpen = (state, i) => i < BAYS || state.vip;
export const findFreeBay = (state) => {
  for (let i = 0; i < TOTAL_BAYS; i++) if (bayOpen(state, i) && state.bayBus[i] < 0) return i;
  return -1;
};

/** Has this vehicle been pushed out of its garage yet (always true for normal vehicles)? */
export const isSpawned = (level, state, i) => {
  const a = level.buses[i].after;
  return a < 0 || (state.removed & (1 << a)) !== 0;
};

export function isBusFree(level, state, i) {
  const b = level.buses[i];
  if (state.removed & (1 << i)) return false;
  if (!isSpawned(level, state, i)) return false;
  return (b.block & ~state.removed) === 0;
}

/** Mystery vehicles show their colour once nothing blocks them any more. */
export const isRevealed = (level, state, i) => !level.buses[i].mystery || (level.buses[i].block & ~state.removed) === 0;

/** Why can't this vehicle leave? -> { reason: 'bus'|'bay'|'gone', blockers: [idx] } or null when it can. */
export function whyBlocked(level, state, i) {
  const b = level.buses[i];
  if (state.removed & (1 << i)) return { reason: 'gone' };
  const left = b.block & ~state.removed;
  if (left) {
    const blockers = [];
    for (let k = 0; k < level.buses.length; k++) if ((left & (1 << k)) && isSpawned(level, state, k)) blockers.push(k);
    return { reason: 'bus', blockers };
  }
  if (findFreeBay(state) < 0) return { reason: 'bay' };
  return null;
}

export function legalMoves(level, state) {
  if (findFreeBay(state) < 0) return [];
  const m = [];
  for (let i = 0; i < level.buses.length; i++) if (isBusFree(level, state, i)) m.push(i);
  return m;
}

export const isWon = (level, state) => state.departed === level.buses.length;
export const isStuck = (level, state) => !isWon(level, state) && legalMoves(level, state).length === 0;

/** The front passenger boards (chain reaction) until nobody can. Mutates state, returns events. */
export function settle(level, state) {
  const events = [];
  for (;;) {
    const colour = state.queue[state.qp];
    if (!colour) break;
    let best = -1;
    for (let bay = 0; bay < TOTAL_BAYS; bay++) {
      const bi = state.bayBus[bay];
      if (bi < 0) continue;
      if (state.col[bi] !== colour || state.bayFill[bay] >= level.buses[bi].seats) continue;
      if (best < 0 || state.bayFill[bay] > state.bayFill[best] || (state.bayFill[bay] === state.bayFill[best] && bi < state.bayBus[best])) best = bay;
    }
    if (best < 0) break;
    const bus = state.bayBus[best];
    const seat = state.bayFill[best];
    state.qp++;
    state.bayFill[best]++;
    state.boarded++;
    events.push({ type: 'board', bus, bay: best, seat, color: colour });
    if (state.bayFill[best] >= level.buses[bus].seats) {
      state.bayBus[best] = -1;
      state.bayFill[best] = 0;
      state.departed++;
      events.push({ type: 'depart', bus, bay: best });
    }
  }
  return events;
}

/** Sends vehicle `i` out of the grid. Returns { ok, reason?, events } and mutates state when ok. */
export function exitBus(level, state, i) {
  const why = whyBlocked(level, state, i);
  if (why) return { ok: false, ...why, events: [] };
  const bay = findFreeBay(state);
  state.removed |= 1 << i;
  state.bayBus[bay] = i;
  state.bayFill[bay] = 0;
  const events = [{ type: 'park', bus: i, bay }];
  events.push(...settle(level, state));
  return { ok: true, events };
}

export function stateKey(state) {
  const bays = [];
  for (let k = 0; k < TOTAL_BAYS; k++) if (state.bayBus[k] >= 0) bays.push(state.bayBus[k] * 16 + state.bayFill[k]);
  bays.sort((a, b) => a - b);
  return `${state.removed}|${bays.join(',')}|${state.qp}`;
}

/** Depth-first search with a dead-state memo. Moves are vehicle indices; a winning line has one move per vehicle. */
export function solve(level, start, { maxNodes = 400000 } = {}) {
  const dead = new Set();
  let nodes = 0;
  const path = [];
  const rec = (s) => {
    if (isWon(level, s)) return true;
    if (++nodes > maxNodes) return false;
    const key = stateKey(s);
    if (dead.has(key)) return false;
    const front = s.queue[s.qp];
    const moves = legalMoves(level, s).sort((a, b) => {
      const sa = s.col[a] === front ? 0 : 1;
      const sb = s.col[b] === front ? 0 : 1;
      return sa - sb || a - b;
    });
    for (const m of moves) {
      const n = cloneState(s);
      exitBus(level, n, m);
      path.push(m);
      if (rec(n)) return true;
      path.pop();
    }
    dead.add(key);
    return false;
  };
  const ok = rec(cloneState(start));
  return { solvable: ok, path: ok ? path.slice() : [], nodes, exhausted: !ok && nodes > maxNodes };
}

/** Next move that still leads to victory (null when none). Falls back to the stored plan on big searches. */
export function hintMove(level, state) {
  if (isWon(level, state)) return null;
  const r = solve(level, state, { maxNodes: 60000 });
  if (r.solvable && r.path.length) return r.path[0];
  if (r.exhausted && level.plan) {
    const legal = legalMoves(level, state);
    const next = level.plan.find((b) => !(state.removed & (1 << b)));
    if (next !== undefined && legal.includes(next)) return next;
    return legal.length ? legal[0] : null;
  }
  return null;
}

export function replay(level, path) {
  const s = createState(level);
  for (const m of path) if (!exitBus(level, s, m).ok) return false;
  return isWon(level, s);
}

/** Share of uniformly-random playthroughs that win (difficulty gauge used by the level generator). */
export function randomWinRate(level, trials, rnd = Math.random) {
  let wins = 0;
  for (let t = 0; t < trials; t++) {
    const s = createState(level);
    for (;;) {
      if (isWon(level, s)) { wins++; break; }
      const m = legalMoves(level, s);
      if (!m.length) break;
      exitBus(level, s, m[Math.floor(rnd() * m.length)]);
    }
  }
  return wins / trials;
}

export function jamCount(level) {
  return level.buses.filter((b) => b.block !== 0).length;
}

// ------------------------------------------------------------------ boosters
/** Booster 1: unlock the 5th (VIP) bay. */
export function unlockVip(state) {
  state.vip = true;
  return state;
}

const shuffled = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * Booster 2: re-orders the waiting queue so colours that parked vehicles need come to the front, and the rest follows
 * a winning order. The result is always checked with the solver; the state stays winnable whenever it was winnable.
 * Returns true when the queue changed.
 */
export function shufflePassengers(level, state, rnd = Math.random) {
  const remaining = state.queue.length - state.qp;
  if (remaining < 2) return false;
  const base = solve(level, state, { maxNodes: 80000 });
  const lotOrder = base.solvable ? base.path : level.buses.map((b) => b.i).filter((i) => !(state.removed & (1 << i)));
  const parked = [];
  state.bayBus.forEach((bi, bay) => { if (bi >= 0) parked.push({ bi, free: level.buses[bi].seats - state.bayFill[bay], fill: state.bayFill[bay] }); });
  parked.sort((a, b) => b.fill - a.fill);
  const build = (window) => {
    const pending = lotOrder.slice();
    const order = [];
    while (pending.length) {
      const pickIdx = Math.floor(rnd() * Math.min(window, pending.length));
      order.push(pending.splice(pickIdx, 1)[0]);
    }
    const q = [];
    parked.forEach((p) => { for (let k = 0; k < p.free; k++) q.push(state.col[p.bi]); });
    order.forEach((bi) => { for (let k = 0; k < level.buses[bi].seats; k++) q.push(state.col[bi]); });
    return q;
  };
  const same = (a, b) => a.length === b.length && a.every((c, i) => c === b[i]);
  const current = state.queue.slice(state.qp);
  for (const window of [3, 3, 2, 2, 1]) {
    const q = build(window);
    if (q.length !== current.length || same(q, current)) continue;
    const trial = cloneState(state);
    trial.queue = q;
    trial.qp = 0;
    if (!base.solvable || solve(level, trial, { maxNodes: 80000 }).solvable) {
      state.queue = q;
      state.qp = 0;
      return true;
    }
  }
  return false;
}

/**
 * Booster 3: randomly re-assigns the colours of the vehicles that are still in the parking grid so that they fit
 * the upcoming queue (every colour keeps exactly as many seats as people waiting). Returns true when changed.
 */
export function shuffleColors(level, state, rnd = Math.random) {
  const lot = [];
  level.buses.forEach((b, i) => { if (!(state.removed & (1 << i))) lot.push(i); });
  if (lot.length < 2) return false;
  const need = {};
  for (let k = state.qp; k < state.queue.length; k++) need[state.queue[k]] = (need[state.queue[k]] || 0) + 1;
  state.bayBus.forEach((bi, bay) => { if (bi >= 0) need[state.col[bi]] = (need[state.col[bi]] || 0) - (level.buses[bi].seats - state.bayFill[bay]); });
  const colours = Object.keys(need).filter((c) => need[c] > 0);
  const results = [];
  let nodes = 0;
  const rec = (order, k, left, assign) => {
    if (results.length >= 12 || ++nodes > 60000) return;
    if (k === order.length) { if (colours.every((c) => left[c] === 0)) results.push(assign.slice()); return; }
    const seats = level.buses[order[k]].seats;
    for (const c of shuffled(colours, rnd)) {
      if (left[c] >= seats) { left[c] -= seats; assign[k] = c; rec(order, k + 1, left, assign); left[c] += seats; }
    }
  };
  const order = shuffled(lot, rnd);
  rec(order, 0, { ...need }, []);
  const apply = (assign) => { const col = state.col.slice(); order.forEach((bi, k) => { col[bi] = assign[k]; }); return col; };
  const differs = (col) => lot.some((bi) => col[bi] !== state.col[bi]);
  const wasSolvable = solve(level, state, { maxNodes: 60000 }).solvable;
  for (const assign of results) {
    const col = apply(assign);
    if (!differs(col)) continue;
    const trial = cloneState(state);
    trial.col = col;
    if (!wasSolvable || solve(level, trial, { maxNodes: 60000 }).solvable) { state.col = col; return true; }
  }
  return false;
}
