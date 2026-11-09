// Level generator: builds candidate puzzles with a seeded RNG, analyses the FULL state space with the
// solver, rejects anything unsolvable and keeps the candidate whose difficulty is closest to the target.
//
//   npm run generate-levels      ->  rewrites src/data/levels.js
//
// To add levels: append a row to SPECS, run the generator, commit the new levels.js.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseLevel, validateRaw } from '../src/data/levelFormat.js';
import { analyze, solve, createState, replay } from '../src/systems/PuzzleValidator.js';

const here = dirname(fileURLToPath(import.meta.url));
const ALL = 'rbgypokc';

// target = desired chance that a player who taps at random still wins (lower = harder).
// colors/lanes/buses/slots/queues/caps describe the shape of the puzzle.
const S = (name, o) => ({ name, ...o });
const SPECS = [
  S('First Stop',     { colors: 2, lanes: 2, buses: 2,  slots: [0, 0, 0],       queues: 1, caps: [2],       target: 1,    tip: 'Tap a bus to park it. Passengers of the same colour hop on!' }),
  S('Rush Hour',      { colors: 2, lanes: 2, buses: 4,  slots: [0, 0, 0],       queues: 1, caps: [2, 3],    target: 0.95, tip: 'A full bus drives away and frees its parking slot.' }),
  S('Colour Wheel',   { colors: 3, lanes: 3, buses: 5,  slots: [0, 0, 0],       queues: 1, caps: [2, 3],    target: 0.9,  tip: 'Watch the FIRST passenger in the queue and park their colour.' }),
  S('Three Lanes',    { colors: 3, lanes: 3, buses: 6,  slots: [0, 0, 0],       queues: 1, caps: [2, 3],    target: 0.85, tip: 'Only the front bus of each lane can move. Buses behind are blocked!' }),
  S('Double Queue',   { colors: 3, lanes: 3, buses: 6,  slots: [0, 0, 0],       queues: 2, caps: [2, 3, 4], target: 0.8,  tip: 'Two queues: both front passengers can board at once.' }),
  S('Downtown',       { colors: 4, lanes: 3, buses: 8,  slots: [0, 0, 0],       queues: 1, caps: [2, 3],    target: 0.6 }),
  S('Market Street',  { colors: 4, lanes: 3, buses: 8,  slots: [0, 0, 0],       queues: 2, caps: [2, 3],    target: 0.55 }),
  S('Tight Squeeze',  { colors: 4, lanes: 3, buses: 9,  slots: [0, 0, 0],       queues: 2, caps: [2, 3, 4], target: 0.5 }),
  S('Four Corners',   { colors: 4, lanes: 4, buses: 10, slots: [0, 0, 0, 0],    queues: 2, caps: [2, 3, 4], target: 0.45 }),
  S('Locked Garage',  { colors: 5, lanes: 4, buses: 11, slots: [0, 0, 0, 2],    queues: 2, caps: [2, 3, 4], target: 0.4, challenge: true, tip: 'CHALLENGE! The padlocked slot opens after 2 buses depart.' }),
  S('Harbor Road',    { colors: 4, lanes: 3, buses: 10, slots: [0, 0, 0],       queues: 2, caps: [2, 3, 4], target: 0.38 }),
  S('Old Town',       { colors: 5, lanes: 4, buses: 11, slots: [0, 0, 0, 0],    queues: 2, caps: [2, 3, 4], target: 0.36 }),
  S('Night Shift',    { colors: 5, lanes: 4, buses: 12, slots: [0, 0, 0, 1],    queues: 2, caps: [2, 3, 4], target: 0.34 }),
  S('Airport Run',    { colors: 5, lanes: 4, buses: 12, slots: [0, 0, 0, 0],    queues: 2, caps: [2, 3, 4], target: 0.3 }),
  S('Rainbow Rally',  { colors: 6, lanes: 4, buses: 13, slots: [0, 0, 0, 2],    queues: 2, caps: [2, 3, 4], target: 0.28, challenge: true }),
  S('Bridge Jam',     { colors: 5, lanes: 4, buses: 13, slots: [0, 0, 0, 0],    queues: 2, caps: [2, 3, 4], target: 0.26 }),
  S('Stadium Day',    { colors: 6, lanes: 4, buses: 14, slots: [0, 0, 0, 2],    queues: 2, caps: [2, 3, 4], target: 0.24 }),
  S('Mountain Pass',  { colors: 6, lanes: 4, buses: 14, slots: [0, 0, 0, 0],    queues: 2, caps: [2, 3, 4], target: 0.22 }),
  S('Ferry Terminal', { colors: 6, lanes: 5, buses: 15, slots: [0, 0, 0, 3],    queues: 2, caps: [2, 3, 4], target: 0.2 }),
  S('Grand Central',  { colors: 6, lanes: 5, buses: 16, slots: [0, 0, 0, 3],    queues: 3, caps: [2, 3, 4], target: 0.18, challenge: true }),
  S('Sunset Strip',   { colors: 6, lanes: 4, buses: 15, slots: [0, 0, 0, 0],    queues: 3, caps: [2, 3, 4], target: 0.16 }),
  S('Big Bus Energy', { colors: 6, lanes: 5, buses: 16, slots: [0, 0, 0, 2],    queues: 3, caps: [2, 3, 5], target: 0.14 }),
  S('Rooftop Lot',    { colors: 7, lanes: 5, buses: 17, slots: [0, 0, 0, 2],    queues: 3, caps: [2, 3, 4], target: 0.12 }),
  S('City Limits',    { colors: 7, lanes: 5, buses: 18, slots: [0, 0, 0, 0, 3], queues: 3, caps: [2, 3, 4], target: 0.1 }),
  S('Double Lock',    { colors: 7, lanes: 5, buses: 18, slots: [0, 0, 0, 2, 4], queues: 3, caps: [2, 3, 4], target: 0.09, challenge: true, tip: 'CHALLENGE! Two padlocks: plan which buses leave first.' }),
  S('Gridlock',       { colors: 7, lanes: 5, buses: 19, slots: [0, 0, 0, 0, 2], queues: 3, caps: [2, 3, 4], target: 0.08 }),
  S('Express Lane',   { colors: 7, lanes: 5, buses: 19, slots: [0, 0, 0, 2, 3], queues: 3, caps: [2, 3, 5], target: 0.07 }),
  S('Grand Prix',     { colors: 8, lanes: 5, buses: 20, slots: [0, 0, 0, 0, 3], queues: 3, caps: [2, 3, 4], target: 0.06 }),
  S('Rush Master',    { colors: 8, lanes: 5, buses: 21, slots: [0, 0, 0, 2, 4], queues: 3, caps: [2, 3, 4], target: 0.05 }),
  S('Jam Legend',     { colors: 8, lanes: 5, buses: 22, slots: [0, 0, 0, 2, 4], queues: 3, caps: [2, 3, 5], target: 0.04, challenge: true, tip: 'FINAL CHALLENGE! Park wisely, legend.' }),
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rand) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];

function candidate(id, spec, rand) {
  const colors = shuffle(ALL.split(''), rand).slice(0, spec.colors);
  let buses = [];
  for (let i = 0; i < spec.buses; i++) {
    const c = i < colors.length ? colors[i] : pick(colors, rand);
    buses.push(c + pick(spec.caps, rand));
  }
  shuffle(buses, rand);
  // deal into lanes: every lane gets at least one bus
  const lanes = Array.from({ length: spec.lanes }, () => []);
  buses.forEach((b, i) => (i < spec.lanes ? lanes[i] : lanes[Math.floor(rand() * spec.lanes)]).push(b));
  // passengers = exactly the seats of each colour, shuffled, dealt into queues
  const folk = [];
  for (const b of buses) for (let i = 0; i < parseInt(b.slice(1), 10); i++) folk.push(b[0]);
  shuffle(folk, rand);
  const queues = Array.from({ length: spec.queues }, () => []);
  folk.forEach((p, i) => queues[i % spec.queues].push(p));
  return {
    id,
    name: spec.name,
    tip: spec.tip || '',
    challenge: !!spec.challenge,
    slots: spec.slots.slice(),
    lanes,
    queues: queues.map((q) => q.join('')),
  };
}

function build(id, spec) {
  let best = null;
  const tries = spec.target >= 0.9 ? 60 : 400;
  for (let t = 0; t < tries; t++) {
    const rand = rng(id * 7919 + t * 104729 + 17);
    const raw = candidate(id, spec, rand);
    if (validateRaw(raw).length) continue;
    const level = parseLevel(raw);
    const a = analyze(level, { maxNodes: 120000 });
    if (a.aborted || !a.solvable) continue;
    const score = Math.abs(Math.log(a.randomWin) - Math.log(spec.target));
    if (!best || score < best.score) best = { raw, score, a };
    if (score < 0.04) break;
  }
  return best;
}

const out = [];
for (let i = 0; i < SPECS.length; i++) {
  const id = i + 1;
  const r = build(id, SPECS[i]);
  if (!r) throw new Error(`Could not generate a solvable level ${id}`);
  const level = parseLevel(r.raw);
  const sol = solve(level, createState(level));
  if (!sol.solvable || !replay(level, sol.path)) throw new Error(`Level ${id} failed verification`);
  console.log(`L${String(id).padStart(2)} ${SPECS[i].name.padEnd(15)} buses=${level.totalBuses} folk=${level.totalPassengers} randomWin=${r.a.randomWin.toFixed(3)} (target ${SPECS[i].target}) states=${r.a.states}`);
  out.push(r.raw);
}

const lines = out.map((l) => {
  const lanes = '[' + l.lanes.map((ln) => '[' + ln.map((b) => `'${b}'`).join(', ') + ']').join(', ') + ']';
  const queues = '[' + l.queues.map((q) => `'${q}'`).join(', ') + ']';
  return `  { id: ${l.id}, name: ${JSON.stringify(l.name)}, tip: ${JSON.stringify(l.tip)}, challenge: ${l.challenge}, slots: [${l.slots.join(', ')}],\n    lanes: ${lanes},\n    queues: ${queues} },`;
});
const file = `// Level data. Compact format documented in src/data/levelFormat.js.
// Generated by tools/generate-levels.mjs and verified solvable by src/systems/PuzzleValidator.js.
// Bus code "r3" = red bus with 3 seats. Passenger string "rrb" = red, red, blue (front first).
// Slots: 0 = open, N = padlocked until N buses have departed.
// Hand-edit freely, then run \`npm run verify\` to re-check every level.
export const LEVELS = [
${lines.join('\n')}
];
`;
writeFileSync(join(here, '../src/data/levels.js'), file);
console.log(`\nWrote ${out.length} levels.`);
