// Pure puzzle rules + solver. No Phaser, no DOM: used by the game, the hint system and Node tools.
//
// Rules
//  - Waiting buses sit in lanes. Only the FRONT bus of a lane can be tapped.
//  - Tapping parks the bus in the lowest free, unlocked parking slot.
//  - The front passenger of every queue boards a parked bus of the same colour that has a free seat
//    (the fullest matching bus is preferred). This repeats until nobody can board.
//  - A full bus departs immediately, freeing its slot and counting towards slot unlocks.
//  - Win: every queue is empty. Stuck: not won and no bus can be parked.

export function createState(level) {
  return {
    lane: level.lanes.map(() => 0),
    slots: level.slots.map(() => null),
    q: level.queues.map(() => 0),
    departed: 0,
    boarded: 0,
  };
}

export function cloneState(s) {
  return {
    lane: s.lane.slice(),
    slots: s.slots.map((b) => (b ? { ...b } : null)),
    q: s.q.slice(),
    departed: s.departed,
    boarded: s.boarded,
  };
}

export function isSlotOpen(level, state, i) {
  return level.slots[i] <= state.departed;
}

export function findFreeSlot(level, state) {
  for (let i = 0; i < state.slots.length; i++) {
    if (!state.slots[i] && isSlotOpen(level, state, i)) return i;
  }
  return -1;
}

export function legalLanes(level, state) {
  if (findFreeSlot(level, state) < 0) return [];
  const out = [];
  for (let i = 0; i < level.lanes.length; i++) {
    if (state.lane[i] < level.lanes[i].length) out.push(i);
  }
  return out;
}

export function isWon(level, state) {
  return state.boarded >= level.totalPassengers;
}

export function isStuck(level, state) {
  return !isWon(level, state) && legalLanes(level, state).length === 0;
}

export function stateKey(state) {
  let k = state.lane.join(',') + '|' + state.q.join(',') + '|';
  for (const b of state.slots) k += b ? `${b.uid}:${b.filled};` : '-;';
  return k;
}

/** Let waiting passengers board. Mutates state, appends view events. */
export function settle(level, state, events) {
  let moved = true;
  while (moved) {
    moved = false;
    for (let qi = 0; qi < level.queues.length; qi++) {
      const color = level.queues[qi][state.q[qi]];
      if (color === undefined) continue;
      let best = -1;
      for (let si = 0; si < state.slots.length; si++) {
        const b = state.slots[si];
        if (b && b.color === color && b.filled < b.cap && (best < 0 || b.filled > state.slots[best].filled)) best = si;
      }
      if (best < 0) continue;
      const bus = state.slots[best];
      bus.filled++;
      state.q[qi]++;
      state.boarded++;
      moved = true;
      if (events) events.push({ type: 'board', queue: qi, slot: best, seat: bus.filled - 1, color, uid: bus.uid });
      if (bus.filled === bus.cap) {
        state.slots[best] = null;
        state.departed++;
        if (events) {
          events.push({ type: 'depart', slot: best, uid: bus.uid });
          for (let i = 0; i < level.slots.length; i++) {
            if (level.slots[i] > 0 && level.slots[i] === state.departed) events.push({ type: 'unlock', slot: i });
          }
        }
      }
    }
  }
}

/** Park the front bus of `laneIdx`. Mutates state. Returns the event list, or null if illegal. */
export function park(level, state, laneIdx, wantEvents = false) {
  const slot = findFreeSlot(level, state);
  if (slot < 0 || laneIdx < 0 || laneIdx >= level.lanes.length) return null;
  const bus = level.lanes[laneIdx][state.lane[laneIdx]];
  if (!bus) return null;
  const events = wantEvents ? [] : null;
  state.lane[laneIdx]++;
  state.slots[slot] = { uid: bus.uid, color: bus.color, cap: bus.cap, filled: 0 };
  if (events) events.push({ type: 'park', lane: laneIdx, slot, uid: bus.uid });
  settle(level, state, events);
  return events || [];
}

/** Depth-first search for a winning move sequence from `start`. */
export function solve(level, start, opts = {}) {
  const maxNodes = opts.maxNodes ?? 400000;
  const dead = new Set();
  const path = [];
  let nodes = 0;
  let aborted = false;

  function dfs(s) {
    if (isWon(level, s)) return true;
    const key = stateKey(s);
    if (dead.has(key)) return false;
    if (++nodes > maxNodes) { aborted = true; return false; }
    for (const li of legalLanes(level, s)) {
      const n = cloneState(s);
      park(level, n, li);
      path.push(li);
      if (dfs(n)) return true;
      path.pop();
      if (aborted) return false;
    }
    dead.add(key);
    return false;
  }

  const solvable = dfs(start || createState(level));
  return { solvable, path: solvable ? path.slice() : [], nodes, aborted };
}

/**
 * Full state-space analysis used by the level generator.
 * randomWin = probability a player tapping uniformly random legal buses wins (lower = harder).
 */
export function analyze(level, opts = {}) {
  const maxNodes = opts.maxNodes ?? 200000;
  const memo = new Map();
  let aborted = false;

  function visit(s) {
    if (isWon(level, s)) return 1;
    const key = stateKey(s);
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    if (memo.size > maxNodes) { aborted = true; return 0; }
    const lanes = legalLanes(level, s);
    let sum = 0;
    for (const li of lanes) {
      const n = cloneState(s);
      park(level, n, li);
      sum += visit(n);
      if (aborted) return 0;
    }
    const p = lanes.length ? sum / lanes.length : 0;
    memo.set(key, p);
    return p;
  }

  const randomWin = visit(createState(level));
  let dead = 0;
  for (const p of memo.values()) if (p === 0) dead++;
  return { aborted, solvable: !aborted && randomWin > 0, randomWin, states: memo.size, deadStates: dead };
}

/** Replays a solution on a fresh state; returns true if it truly wins. */
export function replay(level, path) {
  const s = createState(level);
  for (const li of path) if (park(level, s, li) === null) return false;
  return isWon(level, s);
}
