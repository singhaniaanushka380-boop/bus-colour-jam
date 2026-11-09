import Phaser from 'phaser';
import { GAME_W, GAME_H, LAYOUT, HINT_COST, COLORS } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { LevelManager } from '../systems/LevelManager.js';
import {
  createState, cloneState, park, legalLanes, findFreeSlot, isWon, isStuck, solve,
} from '../systems/PuzzleValidator.js';
import { Bus } from '../objects/Bus.js';
import { ParkingSlot } from '../objects/ParkingSlot.js';
import { PassengerQueue } from '../objects/PassengerQueue.js';
import { HUD } from '../ui/HUD.js';
import { UI, Fx } from '../ui/UIManager.js';

const FAIL_TIPS = [
  'Look at the FIRST passenger of every queue and park a bus in their colour.',
  'Do not park a colour nobody needs yet - it just blocks a precious slot.',
  'Buses hidden behind others cannot move. Plan which lane to open first!',
  'Padlocked slots open once enough buses have driven away.',
  'Stuck? Undo is free. Hint shows a move that still leads to victory.',
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.levelId = data?.levelId || gm.currentLevelId;
    this.carriedRestarts = data?.restarts || 0;
  }

  create() {
    UI.enter(this);
    this.dead = false;
    this.token = 0;
    this.busy = false;
    this.over = false;
    this.paused = false;
    this.pointer = null;

    this.level = LevelManager.get(this.levelId);
    gm.checkLevel(this.level);
    gm.save.setCurrent(this.level.id);
    this.state = createState(this.level);
    this.undoStack = [];
    this.assists = { undos: 0, hints: 0, restarts: this.carriedRestarts };
    this.shownBoarded = 0;

    this.buildBackdrop();
    this.buildSlots();
    this.buildQueues();
    this.buildLanes();

    this.hud = new HUD(this, this.level, {
      onPause: () => this.openPause(),
      onUndo: () => this.undo(),
      onHint: () => this.hint(),
      onRestart: () => this.restart(true),
    });

    this.events.once('shutdown', () => {
      this.dead = true;
      this.token++;
      this.hud?.destroy();
    });

    this.syncFromState();
    this.introAnimation();

    if (this.level.tip) this.showTip(this.level.tip);
    if (this.level.id === 1) this.time.delayedCall(700, () => this.showPointer(0));
  }

  // ------------------------------------------------------------------ static scenery
  buildBackdrop() {
    this.add.image(0, 0, 'bg_game').setOrigin(0).setDepth(-10);
    // drifting clouds
    [[60, 70, 0.7, 70000], [330, 36, 0.5, 90000]].forEach(([x, y, sc, d]) => {
      const c = this.add.image(x, y, 'cloud').setScale(sc).setAlpha(0.8).setDepth(-9);
      this.tweens.add({ targets: c, x: x + 140, duration: d / 4, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    // terminal sign
    UI.text(this, GAME_W / 2, 152, 'CITY BUS TERMINAL', 15, { color: '#ffd23f', thick: 3 }).setDepth(-8);

    // trees (gently swaying) and street lights along the depot road
    [[14, 612, 0.78], [526, 622, 0.78], [12, 742, 0.95], [528, 752, 0.95]].forEach(([x, y, sc], i) => {
      const t = this.add.image(x, y, 'tree').setOrigin(0.5, 1).setScale(sc).setDepth(1 + y * 0.001);
      this.tweens.add({ targets: t, angle: i % 2 ? -2.5 : 2.5, duration: 1800 + i * 250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    [[8, 566], [532, 566], [8, 690], [532, 690]].forEach(([x, y], i) => {
      const flip = x > GAME_W / 2;
      this.add.image(x, y, 'streetlight').setOrigin(0.5, 1).setFlipX(flip).setScale(0.8).setDepth(1.5);
      const lampX = x + (flip ? -9 : 9);
      const glow = this.add.image(lampX, y - 80, 'spark').setTint(0xfff1a0).setScale(2.4).setAlpha(0.5).setDepth(1.6);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 1400 + i * 200, yoyo: true, repeat: -1 });
    });

    // two little traffic signals on the median that cycle red <-> green
    this.signals = [];
    [[24, 516], [516, 516]].forEach(([x, y]) => {
      this.add.image(x, y, 'signal').setOrigin(0.5, 1).setScale(0.62).setDepth(1.7);
      const lamp = (dy, color) => this.add.image(x, y - 80 * 0.62 + dy * 0.62, 'spark').setTint(color).setScale(0.55).setDepth(1.8);
      this.signals.push({ red: lamp(13, 0xff4d5e), green: lamp(35, 0x3ed16a) });
    });
    let go = false;
    const flip = () => {
      go = !go;
      this.signals.forEach((sg) => {
        sg.red.setAlpha(go ? 0.15 : 1);
        sg.green.setAlpha(go ? 1 : 0.15);
      });
    };
    flip();
    this.time.addEvent({ delay: 2600, loop: true, callback: flip });
  }

  buildSlots() {
    const n = this.level.slots.length;
    const sw = Math.min(150, (GAME_W - 20) / n);
    this.slotW = sw - 10;
    this.slotScale = Math.min(1, (this.slotW - 6) / 108);
    this.slotViews = [];
    this.slotBus = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const x = GAME_W / 2 + (i - (n - 1) / 2) * sw;
      const slot = new ParkingSlot(this, x, LAYOUT.slotY, this.slotW, LAYOUT.slotH, i, this.level.slots[i]).setDepth(3);
      this.slotViews.push(slot);
    }
  }

  slotPos(i) {
    return { x: this.slotViews[i].x, y: this.slotViews[i].y };
  }

  buildQueues() {
    const n = this.level.queues.length;
    const pw = n >= 3 ? 168 : n === 2 ? 224 : 300;
    this.queues = this.level.queues.map(
      (colors, i) =>
        new PassengerQueue(this, i, colors, GAME_W / 2 + (i - (n - 1) / 2) * (pw + 12), {
          pw,
          top: LAYOUT.platformTop,
          bottom: LAYOUT.platformBottom,
        }),
    );
  }

  buildLanes() {
    const n = this.level.lanes.length;
    this.nLanes = n;
    this.laneBuses = this.level.lanes.map(() => []);
    this.laneNext = this.level.lanes.map(() => 0);
    this.laneMore = [];

    // perspective lane dividers (dashes grow towards the viewer)
    const road = this.add.graphics().setDepth(1.2);
    road.lineStyle(3, 0xffffff, 0.7);
    for (let j = 1; j < n; j++) {
      const f = (yy) => this.roadL(yy) + ((GAME_W - 2 * this.roadL(yy)) * j) / n;
      for (let y = LAYOUT.roadTop + 10; y < LAYOUT.roadBottom - 20; ) {
        const len = 12 + (y - LAYOUT.roadTop) * 0.03;
        const y2 = Math.min(y + len, LAYOUT.roadBottom - 10);
        road.lineBetween(f(y), y, f(y2), y2);
        y += len * 2;
      }
    }

    const bottom = LAYOUT.laneTop + (LAYOUT.laneMaxVisible - 1) * LAYOUT.laneGap + 30;
    for (let i = 0; i < n; i++) {
      const p0 = this.lanePose(i, 0);
      const w0 = (GAME_W - 2 * this.roadL(p0.y)) / n;
      // "+n more buses" badge on the lane
      const badge = this.add.container(p0.x + w0 / 2 - 16, LAYOUT.laneTop - 42).setDepth(8);
      const bg = this.add.graphics();
      bg.fillStyle(0x1b2a52, 0.95).fillRoundedRect(-18, -11, 36, 22, 11);
      bg.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(-18, -11, 36, 22, 11);
      const t = UI.text(this, 0, 0, '', 14, { thick: 3 });
      badge.add([bg, t]);
      badge.setVisible(false);
      this.laneMore.push({ badge, t });

      // tap target over the FRONT bus, and a "blocked" target over the rest of the lane
      const front = this.add.zone(p0.x, LAYOUT.laneTop + 6, w0 - 4, 92).setInteractive({ useHandCursor: true }).setDepth(20);
      front.on('pointerdown', () => this.onTapLane(i));
      const backTop = LAYOUT.laneTop + 52;
      const back = this.add.zone(p0.x, (backTop + bottom) / 2, w0 - 4, bottom - backTop).setInteractive().setDepth(20);
      back.on('pointerdown', () => this.onTapBlocked(i));
    }
  }

  roadL(y) {
    return 40 - (26 * (y - LAYOUT.roadTop)) / (LAYOUT.roadBottom - LAYOUT.roadTop);
  }

  /** Where (and how big / tilted) the k-th waiting bus of lane `li` stands: a staggered perspective queue. */
  lanePose(li, k) {
    const y = LAYOUT.laneTop + k * LAYOUT.laneGap + (li % 2) * 12;
    const L = this.roadL(y);
    const w = (GAME_W - 2 * L) / this.nLanes;
    const wobble = k === 0 ? 0 : k % 2 ? 4 : -4;
    return {
      x: L + w * (li + 0.5) + wobble,
      y,
      s: Math.min(1, (w - 10) / 108),
      a: k === 0 ? 0 : k % 2 ? 1.3 : -1.3,
    };
  }

  // ------------------------------------------------------------------ view <-> state
  clearBuses() {
    this.laneBuses.forEach((l) => l.forEach((b) => b.destroy()));
    this.laneBuses = this.level.lanes.map(() => []);
    this.slotBus.forEach((b) => b && b.destroy());
    this.slotBus = new Array(this.level.slots.length).fill(null);
  }

  makeLaneBus(li, idx, k) {
    const data = this.level.lanes[li][idx];
    const p = this.lanePose(li, k);
    const bus = new Bus(this, p.x, p.y, data).setBaseScale(p.s);
    bus.setAngle(p.a);
    bus.setDepth(5 - k * 0.1);
    bus.setBlocked(k > 0);
    return bus;
  }

  /** Rebuild every moving piece from the logical state (used at start, undo and restart). */
  syncFromState() {
    this.clearBuses();
    const s = this.state;
    this.slotViews.forEach((sv) => {
      sv.setLockProgress(s.departed);
      sv.setIndicator(null);
    });
    this.queues.forEach((q, i) => q.build(s.q[i]));
    s.slots.forEach((b, i) => {
      if (!b) return;
      const p = this.slotPos(i);
      const bus = new Bus(this, p.x, p.y, b).setBaseScale(this.slotScale).setDepth(6);
      bus.setFilled(b.filled);
      this.slotBus[i] = bus;
      this.slotViews[i].setIndicator(b.color);
    });
    this.level.lanes.forEach((lane, li) => {
      const remaining = lane.length - s.lane[li];
      const vis = Math.min(LAYOUT.laneMaxVisible, remaining);
      for (let k = 0; k < vis; k++) this.laneBuses[li].push(this.makeLaneBus(li, s.lane[li] + k, k));
      this.laneNext[li] = s.lane[li] + vis;
      this.updateLaneMore(li);
    });
    this.shownBoarded = s.boarded;
    this.hud.setProgress(s.boarded);
    this.clearPointer();
  }

  updateLaneMore(li) {
    const hidden = this.level.lanes[li].length - this.laneNext[li];
    const m = this.laneMore[li];
    m.t.setText(`+${hidden}`);
    m.badge.setVisible(hidden > 0);
  }

  introAnimation() {
    this.laneBuses.forEach((lane, li) =>
      lane.forEach((b, k) => {
        const ty = b.y;
        b.y = GAME_H + 80;
        this.tweens.add({ targets: b, y: ty, duration: 460, delay: li * 70 + k * 45, ease: 'Back.easeOut' });
      }),
    );
    this.queues.forEach((q) => q.intro());
  }

  // ------------------------------------------------------------------ helpers
  alive(tk) {
    return !this.dead && tk === this.token;
  }

  wait(ms) {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  setBusy(b) {
    this.busy = b;
    this.hud.setBusy(b, this.undoStack.length > 0);
  }

  showTip(text) {
    const t = UI.text(this, GAME_W / 2, 540, text, 18, { wrap: 440, thick: 4 }).setDepth(30);
    const w = Math.min(GAME_W - 30, t.width + 36);
    const h = t.height + 18;
    const bg = this.add.graphics().setDepth(29);
    bg.fillStyle(0x1b2a52, 0.9).fillRoundedRect(GAME_W / 2 - w / 2, 540 - h / 2, w, h, 18);
    bg.lineStyle(2, 0xffffff, 0.25).strokeRoundedRect(GAME_W / 2 - w / 2, 540 - h / 2, w, h, 18);
    [t, bg].forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: [t, bg], alpha: 1, duration: 400, delay: 500 });
  }

  showPointer(li) {
    this.clearPointer();
    if (li == null || !this.laneBuses[li] || !this.laneBuses[li][0]) return;
    const bus = this.laneBuses[li][0];
    const img = this.add.image(bus.x, bus.y - 64, 'arrow_down').setDepth(700).setScale(0.8);
    this.pointer = {
      img,
      tween: this.tweens.add({ targets: img, y: img.y - 12, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
    };
    const free = findFreeSlot(this.level, this.state);
    if (free >= 0) {
      this.slotViews[free].setHighlight(true);
      this.pointer.slot = free;
    }
  }

  clearPointer() {
    if (!this.pointer) return;
    this.pointer.tween.stop();
    this.pointer.img.destroy();
    if (this.pointer.slot != null && this.slotViews[this.pointer.slot]) this.slotViews[this.pointer.slot].setHighlight(false);
    this.pointer = null;
  }

  // ------------------------------------------------------------------ input
  onTapBlocked(li) {
    if (this.busy || this.over || this.paused) return;
    const lane = this.laneBuses[li];
    if (lane.length < 2) return;
    gm.audio.sfx('error');
    lane.slice(1).forEach((b) => this.tweens.add({ targets: b, x: b.x + 4, duration: 45, yoyo: true, repeat: 2, onComplete: () => (b.x = this.lanePose(li, this.laneBuses[li].indexOf(b)).x) }));
    UI.toast(this, 'Blocked! Move the bus in front first.');
  }

  onTapLane(li) {
    if (this.busy || this.over || this.paused) return;
    if (this.state.lane[li] >= this.level.lanes[li].length) return;
    if (!legalLanes(this.level, this.state).includes(li)) {
      gm.audio.sfx('error');
      this.slotViews.forEach((s) => !this.slotBus[s.index] && s.denyFlash());
      UI.toast(this, 'No free parking slot!');
      return;
    }
    this.doPark(li);
  }

  async doPark(li) {
    const tk = this.token;
    this.clearPointer();
    this.undoStack.push(cloneState(this.state));
    this.setBusy(true);
    const events = park(this.level, this.state, li, true);
    const ok = await this.playEvents(events, tk);
    if (!ok) return;
    this.setBusy(false);
    this.afterMove();
  }

  afterMove() {
    if (isWon(this.level, this.state)) return this.win();
    if (isStuck(this.level, this.state)) return this.fail();
    return null;
  }

  // ------------------------------------------------------------------ animation of logic events
  async playEvents(events, tk) {
    const pending = [];
    let boards = 0;
    for (const ev of events) {
      if (!this.alive(tk)) return false;
      if (ev.type === 'park') await this.animPark(ev);
      else if (ev.type === 'board') await this.animBoard(ev, boards++);
      else if (ev.type === 'depart') pending.push(this.animDepart(ev));
      else if (ev.type === 'unlock') {
        gm.audio.sfx('unlock');
        this.slotViews[ev.slot]?.unlockAnim();
      }
    }
    await Promise.all(pending);
    return this.alive(tk);
  }

  async animPark(ev) {
    const li = ev.lane;
    const lane = this.laneBuses[li];
    const bus = lane.shift();
    if (!bus) return;
    bus.setBlocked(false).setDepth(6);
    // rest of the lane rolls forward
    lane.forEach((b, k) => {
      const pose = this.lanePose(li, k);
      b.setBlocked(k > 0).setDepth(5 - k * 0.1);
      b.baseScale = pose.s;
      this.tweens.add({ targets: b, x: pose.x, y: pose.y, scaleX: pose.s, scaleY: pose.s, angle: pose.a, duration: 320, ease: 'Cubic.easeOut' });
    });
    if (this.laneNext[li] < this.level.lanes[li].length && lane.length < LAYOUT.laneMaxVisible) {
      const nb = this.makeLaneBus(li, this.laneNext[li]++, lane.length).setAlpha(0);
      this.tweens.add({ targets: nb, alpha: 1, duration: 300 });
      lane.push(nb);
      this.updateLaneMore(li);
    }
    gm.audio.sfx('park');
    const p = this.slotPos(ev.slot);
    this.slotBus[ev.slot] = bus;
    this.tweens.add({ targets: bus, angle: 0, duration: 340 });
    await bus.arriveAt(p.x, p.y, this.slotScale, 340);
    this.slotViews[ev.slot].setIndicator(bus.colorName);
    bus.bounce();
  }

  async animBoard(ev, n) {
    const q = this.queues[ev.queue];
    const bus = this.slotBus[ev.slot];
    if (!q || !bus) return;
    const pax = q.popFront();
    if (!pax) return;
    const seat = bus.seatPos(ev.seat);
    const dist = Phaser.Math.Distance.Between(pax.x, pax.y, seat.x, seat.y);
    await pax.walkTo(seat.x, seat.y + 16, Phaser.Math.Clamp(dist * 0.9, 240, 430));
    pax.destroy();
    bus.setFilled(ev.seat + 1);
    bus.bounce();
    gm.audio.sfx('board', n);
    Fx.burst(this, seat.x, seat.y, { color: COLORS[ev.color].light, count: 6, speed: 34, life: 380 });
    this.shownBoarded++;
    this.hud.setProgress(this.shownBoarded);
  }

  animDepart(ev) {
    const bus = this.slotBus[ev.slot];
    this.slotBus[ev.slot] = null;
    this.slotViews[ev.slot]?.setIndicator(null);
    if (!bus) return Promise.resolve();
    gm.audio.sfx('depart');
    Fx.burst(this, bus.x, bus.y - 10, { color: 0xffd23f, count: 12, speed: 80 });
    Fx.ring(this, bus.x, bus.y, COLORS[bus.colorName].main);
    return bus.departAndDestroy(GAME_W + 150);
  }

  // ------------------------------------------------------------------ player tools
  undo() {
    if (this.busy || this.over || !this.undoStack.length) return;
    this.token++;
    this.state = this.undoStack.pop();
    this.assists.undos++;
    gm.audio.sfx('click');
    this.syncFromState();
    this.setBusy(false);
  }

  hint() {
    if (this.busy || this.over) return;
    const res = solve(this.level, this.state, { maxNodes: 300000 });
    if (!res.solvable || !res.path.length) {
      gm.audio.sfx('error');
      UI.toast(this, 'Dead end! Use Undo or Restart.');
      return;
    }
    if (!gm.spendCoins(HINT_COST)) {
      gm.audio.sfx('error');
      UI.toast(this, `Hints cost ${HINT_COST} coins`);
      return;
    }
    this.assists.hints++;
    this.showPointer(res.path[0]);
  }

  restart(countAsAssist) {
    if (this.over) return;
    const restarts = this.assists.restarts + (countAsAssist && this.undoStack.length ? 1 : 0);
    UI.go(this, 'Game', { levelId: this.level.id, restarts });
  }

  // ------------------------------------------------------------------ pause
  openPause() {
    if (this.paused || this.over) return;
    this.paused = true;
    const d = UI.dialog(this, {
      title: 'PAUSED',
      w: 420,
      h: 560,
      onClose: () => (this.paused = false),
    });
    const c = d.c;
    c.add(UI.text(this, 0, -170, `Level ${this.level.id} - ${this.level.name}`, 24, { thick: 4 }).setColor('#1b2a52').setStroke('#ffffff', 0));
    c.add(UI.button(this, 0, -100, 300, 70, 'RESUME', { color: 0x3ed16a, icon: 'play', onClick: () => d.close() }));
    c.add(UI.button(this, 0, -10, 300, 64, 'RESTART', { color: 0xff9a3c, icon: 'restart', size: 26, onClick: () => { d.close(true); this.restart(false); } }));
    c.add(UI.button(this, 0, 76, 300, 64, 'LEVELS', { color: 0x3d8bff, icon: 'levels', size: 26, onClick: () => UI.go(this, 'LevelSelect') }));
    c.add(UI.button(this, 0, 162, 300, 64, 'MENU', { color: 0xa566ff, icon: 'home', size: 26, onClick: () => UI.go(this, 'Menu') }));
    c.add(UI.toggleButton(this, -60, 238, 62, 'sound', () => gm.audio.soundOn, (v) => gm.audio.setSound(v), 0x3d8bff));
    c.add(UI.toggleButton(this, 60, 238, 62, 'music', () => gm.audio.musicOn, (v) => gm.audio.setMusic(v), 0xff7ac8));
  }

  // ------------------------------------------------------------------ end states
  async win() {
    if (this.over) return;
    this.over = true;
    const tk = this.token;
    const stars = LevelManager.starsFor(this.assists);
    const result = gm.completeLevel(this.level, stars);
    gm.audio.sfx('win');
    Fx.confetti(this, 40);
    await this.wait(900);
    if (!this.alive(tk)) return;
    UI.go(this, 'LevelComplete', { levelId: this.level.id, stars, result, assists: this.assists });
  }

  async fail() {
    if (this.over) return;
    this.over = true;
    gm.failLevel();
    gm.audio.sfx('fail');
    const tk = this.token;
    await this.wait(500);
    if (!this.alive(tk)) return;
    const noSlot = findFreeSlot(this.level, this.state) < 0;
    const d = UI.dialog(this, { title: 'TRAFFIC JAM!', w: 440, h: 520, depth: 1100, closable: false });
    const c = d.c;
    c.add(UI.text(this, 0, -150, noSlot ? 'Every parking slot is full and\nno passenger can board!' : 'No bus left for the\nwaiting passengers!', 26, { color: '#1b2a52', stroke: '#ffffff', thick: 0 }));
    const tip = FAIL_TIPS[(this.level.id + this.assists.undos) % FAIL_TIPS.length];
    const box = this.add.graphics();
    box.fillStyle(0xfff2c2).fillRoundedRect(-185, -95, 370, 100, 18);
    c.add(box);
    c.add(UI.text(this, 0, -45, `Tip: ${tip}`, 19, { color: '#6b4a00', stroke: '#fff2c2', thick: 0, wrap: 330 }));
    c.add(UI.button(this, 0, 60, 300, 70, 'RETRY', { color: 0x3ed16a, icon: 'restart', onClick: () => UI.go(this, 'Game', { levelId: this.level.id, restarts: 0 }) }));
    const canUndo = this.undoStack.length > 0;
    const ub = UI.button(this, 0, 150, 300, 64, 'UNDO MOVE', { color: 0x3d8bff, icon: 'undo', size: 26, onClick: () => { d.close(true); this.over = false; this.undo(); } });
    ub.setDisabled(!canUndo);
    c.add(ub);
    c.add(UI.button(this, 0, 226, 300, 56, 'MENU', { color: 0xa566ff, icon: 'home', size: 24, onClick: () => UI.go(this, 'Menu') }));
  }
}

export default GameScene;
