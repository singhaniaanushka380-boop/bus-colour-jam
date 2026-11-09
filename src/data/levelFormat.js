// Pure level-format helpers (no Phaser) so the game AND the Node tools can share them.
//
// Compact level format (see src/data/levels.js):
//   id        number
//   name      string
//   tip       string (optional tutorial text)
//   challenge boolean (special challenge level: double coins)
//   slots     number[]  one entry per parking slot. 0 = open. N = locked until N buses have departed.
//   lanes     string[][] waiting buses per lane, FRONT FIRST. "r3" = red bus with 3 seats.
//   queues    string[]  passenger queues, FRONT FIRST. "rrbg" = red, red, blue, green.

export const COLOR_BY_CODE = {
  r: 'red', b: 'blue', g: 'green', y: 'yellow', p: 'purple', o: 'orange', k: 'pink', c: 'cyan',
};
export const CODE_BY_COLOR = Object.fromEntries(Object.entries(COLOR_BY_CODE).map(([k, v]) => [v, k]));

export function parseLevel(raw) {
  const lanes = raw.lanes.map((lane, li) =>
    lane.map((code, pi) => ({
      uid: `L${li}-${pi}`,
      color: COLOR_BY_CODE[code[0]],
      cap: parseInt(code.slice(1), 10),
    })),
  );
  const queues = raw.queues.map((s) => s.split('').map((ch) => COLOR_BY_CODE[ch]));
  const totalPassengers = queues.reduce((n, q) => n + q.length, 0);
  const totalBuses = lanes.reduce((n, l) => n + l.length, 0);
  return {
    id: raw.id,
    name: raw.name || `Level ${raw.id}`,
    tip: raw.tip || '',
    challenge: !!raw.challenge,
    slots: raw.slots.slice(),
    lanes,
    queues,
    totalPassengers,
    totalBuses,
  };
}

/** Returns a list of human-readable problems (empty = structurally valid). */
export function validateRaw(raw) {
  const errors = [];
  const tag = `Level ${raw.id}`;
  if (!Array.isArray(raw.slots) || raw.slots.length < 1) errors.push(`${tag}: needs at least one slot`);
  if (!raw.slots.some((n) => n === 0)) errors.push(`${tag}: needs at least one unlocked slot`);
  const seats = {};
  const folk = {};
  for (const lane of raw.lanes) {
    for (const code of lane) {
      const c = COLOR_BY_CODE[code[0]];
      const cap = parseInt(code.slice(1), 10);
      if (!c || !(cap >= 1 && cap <= 6)) errors.push(`${tag}: bad bus code "${code}"`);
      else seats[c] = (seats[c] || 0) + cap;
    }
  }
  for (const q of raw.queues) {
    for (const ch of q) {
      const c = COLOR_BY_CODE[ch];
      if (!c) errors.push(`${tag}: bad passenger code "${ch}"`);
      else folk[c] = (folk[c] || 0) + 1;
    }
  }
  const all = new Set([...Object.keys(seats), ...Object.keys(folk)]);
  for (const c of all) {
    if ((seats[c] || 0) !== (folk[c] || 0)) {
      errors.push(`${tag}: ${c} has ${seats[c] || 0} seats but ${folk[c] || 0} passengers`);
    }
  }
  return errors;
}
