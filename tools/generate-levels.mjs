// Level generator ("Bus Rush": cars 4 seats, minivans 6, big buses 10; mystery vehicles; tunnel spawners).
// 1. Vehicles are placed one by one so each new one has a clear road ahead (=> the grid can always be emptied).
//    Some vehicles whose tail touches the grid edge get a TUNNEL: extra vehicles queued in a garage behind them.
// 2. A random valid tap order T is chosen. The passenger queue is written in a "fill order" F that is T with
//    limited shuffling (window 1-4), so the 4 bays are always enough. T is stored as `plan` and proven by replay.
// 3. Difficulty is matched to a target random-play win rate for the level number.
//
//   node tools/generate-levels.mjs                      -> rewrites src/data/levels.js (200 levels)
//   node tools/generate-levels.mjs --from 1 --to 50 --json part1.json
//   node tools/generate-levels.mjs --merge part1.json part2.json ...
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLevel, validateRaw, SEATS_BY_LENGTH } from '../src/data/levelFormat.js';
import { randomWinRate, jamCount, replay } from '../src/systems/PuzzleValidator.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data/levels.js');
const TOTAL = 200;
const INTRO = ['r', 'b', 'y', 'g', 'k', 'o', 's', 'p', 'a', 'n']; // order in which colours appear
const DIRS = ['N', 'E', 'S', 'W'];
const D = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, r) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

const PLACES = ['Central', 'Harbour', 'Sunny Park', 'Old Town', 'Market', 'Airport', 'Stadium', 'Museum', 'Riverside', 'Hilltop',
  'Garden', 'Uptown', 'Lakeview', 'Station', 'Plaza', 'Campus', 'Seaside', 'Metro', 'Bridge', 'Downtown'];
const KINDS = ['Depot', 'Stop', 'Terminal', 'Junction', 'Rush', 'Square', 'Gate', 'Loop', 'Crossing', 'Hub'];
const levelName = (id) => `${PLACES[(id * 7) % PLACES.length]} ${KINDS[Math.floor((id - 1) / 20) % KINDS.length]}`;


// Parking-lot silhouettes (every level gets its own shape, like in the reference game).
const TEMPLATES = ['frame', 'circle', 'diamond', 'ring', 'cross', 'dframe', 'hourglass', 'blocks', 'tri', 'rect', 'circle', 'frame', 'ring', 'diamond'];
function maskFor(tpl, n) {
  const c = (n - 1) / 2;
  const t = Math.max(2, Math.round(n / 4));
  switch (tpl) {
    case 'frame': return (x, y) => Math.min(x, y, n - 1 - x, n - 1 - y) < t;
    case 'dframe': return (x, y) => { const m = Math.min(x, y, n - 1 - x, n - 1 - y); return m < 2 || (m >= 3 && m < 5); };
    case 'circle': return (x, y) => Math.hypot(x - c, y - c) <= n / 2;
    case 'ring': return (x, y) => { const d = Math.hypot(x - c, y - c); return d <= n / 2 && d >= n / 4; };
    case 'diamond': return (x, y) => Math.abs(x - c) + Math.abs(y - c) <= n / 2 + 0.5;
    case 'cross': return (x, y) => Math.abs(x - c) <= n / 6 + 0.6 || Math.abs(y - c) <= n / 6 + 0.6;
    case 'blocks': return (x, y) => (x < n * 0.5 && y < n * 0.5 - 0.5) || (x >= n * 0.5 && y >= n * 0.5 + 0.5) || (x < n * 0.3 && y >= n * 0.5 + 0.5) || (x >= n * 0.7 && y < n * 0.5 - 0.5);
    case 'tri': return (x, y) => x <= y;
    case 'hourglass': return (x, y) => Math.abs(x - c) <= Math.abs(y - c) + 0.6;
    default: return () => true;
  }
}

function spec(id) {
  const p = (id - 1) / (TOTAL - 1);
  let A = Math.round(3 + 21 * Math.pow(p, 0.6));
  if (id <= 6) A = [3, 3, 4, 4, 5, 5][id - 1];
  const challenge = id % 10 === 0;
  if (challenge) A += 1;
  A = Math.min(A, 26);
  const tpl = id <= 5 ? 'rect' : TEMPLATES[(id * 7 + Math.floor(id / 9)) % TEMPLATES.length];
  // smallest square grid whose silhouette offers ~3.1 cells per vehicle (dense, like the reference game)
  let n = 5;
  for (; n < 12; n++) {
    const m = maskFor(tpl, n);
    let cells = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m(x, y)) cells++;
    if (cells >= A * 3.1 + 2) break;
  }
  const w = n;
  const h = n;
  const tunnels = id < 20 ? 0 : Math.min(3, 1 + Math.floor((id - 20) / 55)) + (challenge && id >= 40 ? 1 : 0);
  const mysteryFrac = id < 12 ? 0 : Math.min(0.45, 0.1 + p * 0.4);
  let nCol = id <= 6 ? [2, 2, 2, 3, 3, 3][id - 1] : Math.round(2 + 8 * Math.pow(p, 0.7));
  nCol = Math.max(2, Math.min(nCol, 10));
  const window = id <= 3 ? 1 : id <= 10 ? 2 : id <= 40 ? 3 : 4;
  const target = (0.7 * Math.pow(1 - p, 1.4) + 0.05) * (challenge ? 0.7 : 1);
  return { A, w, h, tpl, tunnels, mysteryFrac, nCol, window, challenge, target };
}

function chooseColours(s, count, r) {
  const idx = Math.max(2, Math.min(10, s.nCol, count));
  const newest = INTRO[idx - 1];
  const pool = INTRO.slice(0, Math.min(10, idx + 2)).filter((c) => c !== newest);
  shuffle(pool, r);
  return [newest, ...pool.slice(0, idx - 1)];
}

function placeVehicles(s, r) {
  const inMask = maskFor(s.tpl, s.w);
  const occ = new Set();
  const out = [];
  for (let i = 0; i < s.A; i++) {
    const roll = r();
    const len = roll < 0.5 ? 2 : roll < 0.8 ? 3 : 4;
    let placed = null;
    let bestScore = -1;
    let found = 0;
    for (let t = 0; t < 900 && found < 10; t++) {
      const x = Math.floor(r() * s.w);
      const y = Math.floor(r() * s.h);
      let dir = pick(DIRS, r);
      if (r() < 0.6) { // mostly point at the nearest edge: neat, readable patterns
        const dd = [['W', x], ['E', s.w - 1 - x], ['N', y], ['S', s.h - 1 - y]];
        dd.sort((p, q) => p[1] - q[1]);
        dir = dd[r() < 0.75 ? 0 : 1][0];
      }
      const [dx, dy] = D[dir];
      const cells = [];
      let ok = true;
      for (let k = 0; k < len && ok; k++) {
        const cx = x - dx * k;
        const cy = y - dy * k;
        if (cx < 0 || cy < 0 || cx >= s.w || cy >= s.h || !inMask(cx, cy) || occ.has(`${cx},${cy}`)) ok = false;
        cells.push(`${cx},${cy}`);
      }
      if (!ok) continue;
      let px = x + dx;
      let py = y + dy;
      while (px >= 0 && py >= 0 && px < s.w && py < s.h) {
        if (occ.has(`${px},${py}`)) { ok = false; break; }
        px += dx; py += dy;
      }
      if (ok) {
        // prefer spots next to vehicles that are already there => dense, readable clusters
        let nb = 0;
        for (const c of cells) {
          const [cx, cy] = c.split(',').map(Number);
          for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) if (occ.has(`${cx + ax},${cy + ay}`)) nb++;
        }
        const score = (i === 0 ? 0 : nb) + r() * 1.5;
        found++;
        if (score > bestScore) { bestScore = score; placed = { len, dir, x, y, cells }; }
      }
    }
    if (!placed) return null;
    placed.cells.forEach((c) => occ.add(c));
    out.push(placed);
  }
  return out;
}

function build(id, s, r) {
  const lay = placeVehicles(s, r);
  if (!lay) return null;
  // tunnels: heads whose garage cell (one behind the tail) lies outside the grid
  const veh = lay.map((v) => ({ ...v }));
  const chains = [];
  const eligible = shuffle(lay.map((v, i) => i).filter((i) => {
    const v = lay[i]; const [dx, dy] = D[v.dir];
    const gx = v.x - dx * v.len; const gy = v.y - dy * v.len;
    return gx < 0 || gy < 0 || gx >= s.w || gy >= s.h;
  }), r);
  for (let c = 0; c < s.tunnels && c < eligible.length; c++) {
    const head = eligible[c];
    const members = [head];
    const extra = r() < 0.35 ? 2 : 1;
    for (let e = 0; e < extra; e++) { veh.push({ ...lay[head], follower: true }); members.push(veh.length - 1); }
    chains.push(members);
  }
  const total = veh.length;
  const cols = chooseColours(s, total, r);
  const colour = [...cols];
  while (colour.length < total) colour.push(pick(cols, r));
  shuffle(colour, r);
  const mystery = veh.map(() => r() < s.mysteryFrac);
  const vehicles = veh.map((v, i) => `${mystery[i] ? '?' : ''}${colour[i]}${v.len}${v.dir}${v.x.toString(36)}${v.y.toString(36)}`);
  const raw0 = { id, name: 'x', w: s.w, h: s.h, vehicles, tunnels: chains, queue: 'r' };
  const tmp = parseLevel(raw0);
  // random valid tap order
  const T = [];
  let mask = 0;
  while (T.length < total) {
    const free = tmp.buses.filter((b) => !(mask & (1 << b.i)) && (b.block & ~mask) === 0 && (b.after < 0 || (mask & (1 << b.after))));
    if (!free.length) return null;
    const b = pick(free, r);
    T.push(b.i);
    mask |= 1 << b.i;
  }
  // fill order = T with limited shuffling => at most `window` vehicles wait in bays at once
  const pending = T.slice();
  const F = [];
  while (pending.length) F.push(pending.splice(Math.floor(r() * Math.min(s.window, pending.length)), 1)[0]);
  const queue = F.map((vi) => colour[vi].repeat(tmp.buses[vi].seats)).join('');
  return { vehicles, tunnels: chains, queue, plan: T.map((i) => i.toString(36)).join('') };
}

const TIPS = {
  1: 'Tap a vehicle whose roof arrow points to a clear road. It drives to a bay and passengers of its colour hop in!',
  2: 'Vehicles cannot drive through other vehicles. Free the way first.',
  3: 'Only the FRONT passenger of the queue can board. Send the colour they are waiting for.',
  4: 'There are only 4 bays! A vehicle keeps its bay until every seat is taken.',
  5: 'Cars have 4 seats, minivans 6 and big buses 10. Boosters can help when you are stuck.',
};

export function generateLevel(id, onProgress) {
  const s = spec(id);
  const seedBase = id * 7919 + 13;
  const seen = new Set();
  let best = null;
  const why = { nolay: 0, dup: 0, invalid: 0, jam: 0, noplan: 0, ok: 0 };
  for (let a = 0; a < 4000; a++) {
    const r = mulberry(seedBase + a * 104729);
    const sp = { ...s };
    if (a > 1500) sp.A = Math.max(3, s.A - 1);
    if (a > 2500) { sp.tunnels = Math.max(0, s.tunnels - 1); sp.nCol = Math.max(2, s.nCol - 2); }
    const b = build(id, sp, r);
    if (!b) { why.nolay++; continue; }
    const key = b.vehicles.join() + b.queue;
    if (seen.has(key)) { why.dup++; continue; }
    seen.add(key);
    const raw = { id, name: levelName(id), w: sp.w, h: sp.h, vehicles: b.vehicles, queue: b.queue, plan: b.plan };
    if (b.tunnels.length) raw.tunnels = b.tunnels;
    if (s.challenge) raw.challenge = true;
    if (TIPS[id]) raw.tip = TIPS[id];
    if (validateRaw(raw).length) { why.invalid++; continue; }
    const level = parseLevel(raw);
    if (id > 2 && jamCount(level) / level.totalBuses < (id <= 6 ? 0.3 : 0.45)) { why.jam++; continue; }
    if (!replay(level, level.plan)) { why.noplan++; continue; }
    why.ok++;
    const rate = randomWinRate(level, 100, r);
    const tol = 0.08 + Math.floor(a / 300) * 0.04;
    const err = Math.abs(rate - s.target);
    if (!best || err < best.err) best = { raw, err, rate, a };
    if (err <= tol) break;
    if (a > 1500 && best) break;
  }
  if (!best) throw new Error(`could not generate level ${id} ${JSON.stringify(why)}`);
  if (onProgress) onProgress(id, best);
  return best.raw;
}

const fmt = (raw) => {
  const o = { id: raw.id, name: raw.name, w: raw.w, h: raw.h, vehicles: raw.vehicles };
  if (raw.tunnels) o.tunnels = raw.tunnels;
  o.queue = raw.queue; o.plan = raw.plan;
  if (raw.challenge) o.challenge = true;
  if (raw.tip) o.tip = raw.tip;
  return '  ' + JSON.stringify(o).replace(/"(\w+)":/g, '$1:').replace(/"/g, "'") + ',';
};

function writeLevels(levels) {
  const body = levels.map(fmt).join('\n');
  fs.writeFileSync(OUT, `// 200 levels (see levelFormat.js for the format).\n// Generated by tools/generate-levels.mjs - every level is proven solvable by replaying its stored \`plan\`\n// (npm run verify). Feel free to hand-edit levels, then run \`npm run verify\`.\nexport const LEVELS = [\n${body}\n];\n`);
  console.log(`wrote ${levels.length} levels -> ${OUT}`);
}

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
if (import.meta.url === `file://${process.argv[1]}`) {
  if (argv.includes('--merge')) {
    const files = argv.slice(argv.indexOf('--merge') + 1);
    const all = files.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8'))).sort((a, b) => a.id - b.id);
    all.forEach((l, i) => { if (l.id !== i + 1) throw new Error(`gap before level ${l.id}`); });
    const firstMystery = all.find((l) => l.vehicles.some((v) => v[0] === '?'));
    const firstTunnel = all.find((l) => l.tunnels);
    if (firstMystery && !firstMystery.tip) firstMystery.tip = 'Vehicles marked ? hide their colour until the vehicle blocking them drives away.';
    if (firstTunnel && !firstTunnel.tip) firstTunnel.tip = 'A garage pushes out a new vehicle as soon as the one in front of it leaves.';
    all.forEach((l) => { const lv = parseLevel(l); if (!replay(lv, lv.plan)) throw new Error(`bad ${l.id}`); });
    writeLevels(all);
  } else {
    const from = Number(arg('--from') || 1);
    const to = Number(arg('--to') || TOTAL);
    const res = [];
    for (let id = from; id <= to; id++) res.push(generateLevel(id, (i, b) => console.log(`level ${i}: win-rate ${(b.rate * 100).toFixed(0)}% (attempt ${b.a})`)));
    if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(res));
    else writeLevels(res);
  }
}
