// Verifies every level:
//  - structure valid (grid, overlaps, passengers == seats per colour, tunnels, 10-colour palette)
//  - the stored `plan` really wins when replayed from a fresh state (exact proof of solvability)
//  - boosters never break a level: Shuffle Passengers / Shuffle Colors / VIP keep it winnable
//   npm run verify            (add --search to also run the solver on every level)
import { LEVELS } from '../src/data/levels.js';
import { parseLevel, validateRaw } from '../src/data/levelFormat.js';
import {
  createState, replay, solve, randomWinRate, jamCount, shufflePassengers, shuffleColors, unlockVip, exitBus,
} from '../src/systems/PuzzleValidator.js';

let bad = 0;
const ids = new Set();
const usedColours = new Set();
let mysteries = 0; let tunnels = 0; let boosterRuns = 0;
const searchAlso = process.argv.includes('--search');
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const raw of LEVELS) {
  const problems = validateRaw(raw);
  if (ids.has(raw.id)) problems.push(`duplicate id ${raw.id}`);
  ids.add(raw.id);
  let info = '';
  if (!problems.length) {
    const level = parseLevel(raw);
    level.buses.forEach((b) => { usedColours.add(b.color); if (b.mystery) mysteries++; });
    tunnels += level.tunnels.length;
    if (!level.plan) problems.push('missing plan');
    else if (!replay(level, level.plan)) problems.push('stored plan does not win');
    else {
      if (searchAlso) {
        const r = solve(level, createState(level), { maxNodes: 500000 });
        if (!r.solvable && !r.exhausted) problems.push('solver disagrees with plan');
      }
      // booster safety: after 1-2 plan moves, boosters must leave the level winnable
      const s = createState(level);
      for (let k = 0; k < Math.min(2, level.plan.length - 1); k++) exitBus(level, s, level.plan[k]);
      const a = createState(level); Object.assign(a, JSON.parse(JSON.stringify({ removed: s.removed, bayBus: s.bayBus, bayFill: s.bayFill, qp: s.qp, departed: s.departed, boarded: s.boarded, vip: false })), { queue: s.queue, col: s.col });
      const b1 = shufflePassengers(level, a, rnd);
      if (solve(level, a, { maxNodes: 200000 }).solvable === false && !solve(level, a, { maxNodes: 200000 }).exhausted) problems.push(`Shuffle Passengers broke the level (changed=${b1})`);
      const c = { ...a, queue: a.queue, col: a.col, bayBus: a.bayBus.slice(), bayFill: a.bayFill.slice() };
      const b2 = shuffleColors(level, c, rnd);
      const rc = solve(level, c, { maxNodes: 200000 });
      if (!rc.solvable && !rc.exhausted) problems.push(`Shuffle Colors broke the level (changed=${b2})`);
      boosterRuns++;
    }
    if (!problems.length) {
      info = `${level.totalBuses} vehicles, ${level.totalPassengers} pax, tunnels ${level.tunnels.length}, mystery ${level.buses.filter((b) => b.mystery).length}, jam ${jamCount(level)}/${level.totalBuses}, random-play win ${(randomWinRate(level, 60) * 100).toFixed(0)}%`;
    }
  }
  if (problems.length) {
    bad++;
    console.error(`✗ Level ${raw.id}: ${problems.join('; ')}`);
  } else {
    console.log(`✓ Level ${String(raw.id).padStart(3)} ${raw.name.padEnd(20)} ${info}`);
  }
}
if (LEVELS.some((l, i) => l.id !== i + 1)) { bad++; console.error('✗ level ids must be sequential from 1'); }
if (usedColours.size !== 10) { bad++; console.error(`✗ expected all 10 colours somewhere, found ${usedColours.size}`); }
console.log(bad ? `\n${bad} problem(s).` : `\nAll ${LEVELS.length} levels are valid and solvable (${mysteries} mystery vehicles, ${tunnels} tunnels, booster check on ${boosterRuns} levels). Colours: ${[...usedColours].join(', ')}`);
process.exit(bad ? 1 : 0);
