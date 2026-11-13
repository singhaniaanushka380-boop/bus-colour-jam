// Tiny promise-based tween engine driven by the scene's update(): no timers, nothing left running after clear().
export const Ease = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  back: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
};

export class Anim {
  constructor() {
    this.list = [];
  }

  /** update(p) gets eased progress 0..1. Resolves true when finished, false when cleared early. */
  tween({ dur = 300, delay = 0, ease = 'out', update = null }) {
    return new Promise((resolve) => {
      this.list.push({ t: -delay, dur: Math.max(1, dur), ease: Ease[ease] || Ease.out, update, resolve });
    });
  }

  wait(ms) {
    return this.tween({ dur: ms, ease: 'linear' });
  }

  update(dtMs) {
    if (!this.list.length) return;
    const keep = [];
    const done = [];
    for (const a of this.list) {
      a.t += dtMs;
      if (a.t < 0) { keep.push(a); continue; }
      const p = Math.min(1, a.t / a.dur);
      if (a.update) a.update(a.ease(p));
      if (p >= 1) done.push(a); else keep.push(a);
    }
    this.list = keep;
    done.forEach((a) => a.resolve(true));
  }

  clear() {
    const old = this.list;
    this.list = [];
    old.forEach((a) => a.resolve(false));
  }
}
