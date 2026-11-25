// Level format (v5 "Bus Rush": cars, minivans & coaches, 4 + 4 facing directions).
//
//   id, name, tip?, challenge?, w, h       parking grid size in cells (max 12 x 12), drawn as a diamond in 3D
//   vehicles: ['r2E10', '?b5A45', ...]     colour code, CAPACITY CLASS (1-7), facing, head x, head y
//                                          a leading '?' makes it a MYSTERY vehicle (colour hidden while blocked)
//   tunnels:  [[3, 7, 9], ...]             TUNNEL SPAWNERS: vehicle 3 is parked at the garage mouth, 7 drives out
//                                          when 3 has left, then 9 when 7 has left. Members share length, facing and
//                                          head cell. The garage sits just OUTSIDE the grid, behind the first tail.
//   queue:    'rrbyg...'                   ONE winding queue of passengers, front first (colour per character)
//   plan:     'a03...'                     one proven winning tap order (vehicle indices, base 36)
//
// Capacity class -> seats (cells the vehicle covers):
//   1 = Small car 4 (2)   2 = Small car 8 (2)   3 = Minivan 12 (3)   4 = Minivan 16 (3)
//   5 = Coach 24 (4)      6 = Coach 32 (5)      7 = Coach 40 (6)
// Facing: N E S W = 0/90/180/270 degrees, and the four 45-degree diagonals
//   A = north-east, B = south-east, C = south-west, D = north-west   (a diagonal vehicle also needs the two
//   corner cells next to every step of its road to be free).
// For every colour: seats of its vehicles == passengers waiting.

export const COLOR_BY_CODE = {
  r: 'red', y: 'yellow', b: 'blue', g: 'green', k: 'pink',
  o: 'orange', p: 'purple', a: 'grey', n: 'brown', s: 'sky',
};
export const CODE_BY_COLOR = Object.fromEntries(Object.entries(COLOR_BY_CODE).map(([c, n]) => [n, c]));
export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0], A: [1, -1], B: [1, 1], C: [-1, 1], D: [-1, -1] };
export const DIAGONALS = ['A', 'B', 'C', 'D'];
export const SEATS_BY_CAP = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 40 };
export const CELLS_BY_CAP = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 4, 6: 5, 7: 6 };
export const VEHICLE_NAMES = { 4: 'Small Car', 8: 'Small Car', 12: 'Minivan', 16: 'Minivan', 24: 'Coach', 32: 'Coach', 40: 'Coach' };
export const MAX_GRID = 12;
export const MAX_VEHICLES = 30; // vehicles are tracked in a 31-bit mask
export const BAYS = 4; // active parking bays; a 5th (VIP) bay can be unlocked

/** Cells a vehicle at (x,y) moving by (dx,dy) must find empty for its next step. Diagonal steps also need the two corner cells. */
export function stepCells(x, y, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  return dx !== 0 && dy !== 0 ? [[nx, ny], [nx, y], [x, ny]] : [[nx, ny]];
}

/** Corner cells beside the body of a diagonal vehicle (they must stay free so two vehicles never overlap visually). */
export function bodyCorners(cells, dx, dy) {
  const out = [];
  if (dx === 0 || dy === 0) return out;
  for (let t = 0; t + 1 < cells.length; t++) {
    const [x, y] = cells[t];
    out.push([x - dx, y], [x, y - dy]);
  }
  return out;
}

export function parseBus(str, i) {
  const mystery = str[0] === '?';
  const s = mystery ? str.slice(1) : str;
  const color = COLOR_BY_CODE[s[0]];
  const cap = Number(s[1]);
  const len = CELLS_BY_CAP[cap];
  const dir = s[2];
  const [dx, dy] = DIRS[dir];
  const x = parseInt(s[3], 36);
  const y = parseInt(s[4], 36);
  const cells = [];
  for (let t = 0; t < len; t++) cells.push([x - dx * t, y - dy * t]); // head first
  return { i, color, len, cap, dir, dx, dy, diag: dx !== 0 && dy !== 0, x, y, mystery, seats: SEATS_BY_CAP[cap], cells, path: [], block: 0, after: -1, chain: -1 };
}

/** Raw level -> ready-to-play level with precomputed blockers (bitmasks), tunnel chains and the queue. */
export function parseLevel(raw) {
  const buses = raw.vehicles.map(parseBus);
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < raw.w && y < raw.h;
  (raw.tunnels || []).forEach((chain, c) => {
    chain.forEach((vi, k) => {
      buses[vi].chain = c;
      if (k > 0) buses[vi].after = chain[k - 1];
    });
  });
  const owners = new Map();
  buses.forEach((b) => b.cells.forEach(([x, y]) => {
    const k = `${x},${y}`;
    if (!owners.has(k)) owners.set(k, []);
    owners.get(k).push(b.i);
  }));
  for (const b of buses) {
    let x = b.x;
    let y = b.y;
    for (;;) {
      const step = stepCells(x, y, b.dx, b.dy);
      const live = step.filter(([cx, cy]) => inGrid(cx, cy));
      if (!live.length) break;
      for (const [cx, cy] of live) for (const o of owners.get(`${cx},${cy}`) || []) if (o !== b.i) b.block |= 1 << o;
      if (inGrid(step[0][0], step[0][1])) b.path.push(step[0]);
      x += b.dx;
      y += b.dy;
    }
  }
  const queue = [...raw.queue].map((c) => COLOR_BY_CODE[c]);
  return {
    id: raw.id,
    name: raw.name,
    tip: raw.tip || null,
    challenge: !!raw.challenge,
    w: raw.w,
    h: raw.h,
    bays: BAYS,
    buses,
    tunnels: raw.tunnels || [],
    queue,
    plan: raw.plan ? [...raw.plan].map((c) => parseInt(c, 36)) : null,
    totalBuses: buses.length,
    totalPassengers: queue.length,
    raw,
  };
}

/** Returns a list of problems (empty = structurally valid). Solvability is checked separately. */
export function validateRaw(raw) {
  const p = [];
  if (!raw.name) p.push('missing name');
  if (!(raw.w >= 3 && raw.w <= MAX_GRID && raw.h >= 3 && raw.h <= MAX_GRID)) p.push('bad grid size');
  if (!Array.isArray(raw.vehicles) || raw.vehicles.length < 1 || raw.vehicles.length > MAX_VEHICLES) p.push(`1-${MAX_VEHICLES} vehicles required`);
  if (typeof raw.queue !== 'string' || !raw.queue.length) p.push('queue missing');
  if (p.length) return p;
  const seats = {};
  const occupied = new Map();
  const inChain = new Set();
  (raw.tunnels || []).forEach((ch) => ch.forEach((v) => inChain.add(v)));
  const parsed = [];
  raw.vehicles.forEach((s, i) => {
    if (!/^\??[rybgkopasn][1-7][NESWABCD][0-9a-z]{2}$/.test(s)) { p.push(`vehicle ${i} bad code "${s}"`); return; }
    const b = parseBus(s, i);
    parsed[i] = b;
    seats[b.color] = (seats[b.color] || 0) + b.seats;
    const followers = (raw.tunnels || []).some((ch) => ch.indexOf(i) > 0);
    b.cells.forEach(([x, y]) => {
      if (x < 0 || y < 0 || x >= raw.w || y >= raw.h) p.push(`vehicle ${i} outside grid`);
      if (followers) return; // shares the cells of the chain head
      const k = `${x},${y}`;
      if (occupied.has(k)) p.push(`vehicle ${i} overlaps vehicle ${occupied.get(k)}`);
      occupied.set(k, i);
    });
  });
  parsed.forEach((b) => {
    if (!b || !b.diag) return;
    if ((raw.tunnels || []).some((ch) => ch.includes(b.i))) p.push(`vehicle ${b.i}: tunnels need a straight (N/E/S/W) vehicle`);
    bodyCorners(b.cells, b.dx, b.dy).forEach(([x, y]) => {
      const o = occupied.get(`${x},${y}`);
      if (o !== undefined && o !== b.i) p.push(`vehicle ${b.i} (diagonal) touches vehicle ${o} beside its body`);
    });
  });
  (raw.tunnels || []).forEach((ch, c) => {
    const h = parsed[ch[0]];
    if (!h || ch.length < 2) { p.push(`tunnel ${c} needs 2+ vehicles`); return; }
    const gx = h.x - h.dx * h.len;
    const gy = h.y - h.dy * h.len;
    if (!(gx < 0 || gy < 0 || gx >= raw.w || gy >= raw.h)) p.push(`tunnel ${c}: garage cell must be outside the grid`);
    ch.forEach((v) => {
      const b = parsed[v];
      if (!b || b.len !== h.len || b.dir !== h.dir || b.x !== h.x || b.y !== h.y) p.push(`tunnel ${c}: vehicle ${v} must share length, facing and head cell`);
    });
  });
  const pass = {};
  [...raw.queue].forEach((c) => {
    const n = COLOR_BY_CODE[c];
    if (!n) p.push(`bad passenger code "${c}"`);
    else pass[n] = (pass[n] || 0) + 1;
  });
  new Set([...Object.keys(seats), ...Object.keys(pass)]).forEach((c) => {
    if ((seats[c] || 0) !== (pass[c] || 0)) p.push(`${c}: ${seats[c] || 0} seats but ${pass[c] || 0} passengers`);
  });
  return p;
}
