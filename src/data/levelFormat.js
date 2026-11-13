// Level format (v4 "Bus Rush: Cars, Vans & Buses").
//
//   id, name, tip?, challenge?, w, h       parking grid size in cells (max 9 x 9), drawn as a diamond in 3D
//   vehicles: ['r2E10', '?b3N45', ...]     colour code, length (2|3|4), facing (N/E/S/W), head x, head y
//                                          a leading '?' makes it a MYSTERY vehicle (colour hidden while blocked)
//   tunnels:  [[3, 7, 9], ...]             TUNNEL SPAWNERS: vehicle 3 is parked at the garage mouth, 7 drives out
//                                          when 3 has left, then 9 when 7 has left. Members share length, facing and
//                                          head cell. The garage sits just OUTSIDE the grid, behind the first tail.
//   queue:    'rrbyg...'                   ONE winding queue of passengers, front first (colour per character)
//   plan:     'a03...'                     one proven winning tap order (vehicle indices, base 36)
//
// Seats: length 2 = Compact Car (4), length 3 = Minivan (6), length 4 = Big Bus (10).
// For every colour: seats of its vehicles == passengers waiting.

export const COLOR_BY_CODE = {
  r: 'red', y: 'yellow', b: 'blue', g: 'green', k: 'pink',
  o: 'orange', p: 'purple', a: 'grey', n: 'brown', s: 'sky',
};
export const CODE_BY_COLOR = Object.fromEntries(Object.entries(COLOR_BY_CODE).map(([c, n]) => [n, c]));
export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const SEATS_BY_LENGTH = { 2: 4, 3: 6, 4: 10 };
export const VEHICLE_NAMES = { 2: 'Compact Car', 3: 'Minivan', 4: 'Big Bus' };
export const MAX_GRID = 9;
export const MAX_VEHICLES = 30; // vehicles are tracked in a 31-bit mask
export const BAYS = 4; // active parking bays; a 5th (VIP) bay can be unlocked

export function parseBus(str, i) {
  const mystery = str[0] === '?';
  const s = mystery ? str.slice(1) : str;
  const color = COLOR_BY_CODE[s[0]];
  const len = Number(s[1]);
  const dir = s[2];
  const [dx, dy] = DIRS[dir];
  const x = Number(s[3]);
  const y = Number(s[4]);
  const cells = [];
  for (let t = 0; t < len; t++) cells.push([x - dx * t, y - dy * t]); // head first
  return { i, color, len, dir, dx, dy, x, y, mystery, seats: SEATS_BY_LENGTH[len], cells, path: [], block: 0, after: -1, chain: -1 };
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
    let x = b.x + b.dx;
    let y = b.y + b.dy;
    while (inGrid(x, y)) {
      b.path.push([x, y]);
      for (const o of owners.get(`${x},${y}`) || []) if (o !== b.i) b.block |= 1 << o;
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
    if (!/^\??[rybgkopasn][234][NESW]\d\d$/.test(s)) { p.push(`vehicle ${i} bad code "${s}"`); return; }
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
