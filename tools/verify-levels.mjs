// Verifies every level: structure is valid, passengers == seats per colour, and a real winning
// move sequence exists (found by the solver and replayed on a fresh state).
//   npm run verify
import { LEVELS } from '../src/data/levels.js';
import { parseLevel, validateRaw } from '../src/data/levelFormat.js';
import { solve, createState, replay } from '../src/systems/PuzzleValidator.js';

let bad = 0;
const ids = new Set();
for (const raw of LEVELS) {
  const problems = validateRaw(raw);
  if (ids.has(raw.id)) problems.push(`duplicate id ${raw.id}`);
  ids.add(raw.id);
  const level = parseLevel(raw);
  const res = solve(level, createState(level), { maxNodes: 2000000 });
  if (!res.solvable) problems.push('no solution found');
  else if (!replay(level, res.path)) problems.push('solution replay did not win');
  if (problems.length) {
    bad++;
    console.error(`✗ Level ${raw.id}: ${problems.join('; ')}`);
  } else {
    console.log(`✓ Level ${String(raw.id).padStart(2)} ${raw.name.padEnd(15)} solvable in ${res.path.length} moves`);
  }
}
if (LEVELS.some((l, i) => l.id !== i + 1)) { bad++; console.error('✗ level ids must be sequential from 1'); }
console.log(bad ? `\n${bad} level(s) failed.` : `\nAll ${LEVELS.length} levels are valid and solvable.`);
process.exit(bad ? 1 : 0);
