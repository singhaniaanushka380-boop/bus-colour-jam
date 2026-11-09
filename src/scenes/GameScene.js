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
    const clouds = [
      [60, 70, 0.7, 70000],
      [330, 40, 0.5, 90000],
    ];
    clouds.forEach(([x, y, s, d]) => {
      const c = this.add.image(x, y, 'cloud').setScale(s).setAlpha(0.8).setDepth(-9);
      this.tweens.add({ targets: c, x: x + 140, duration: d / 4, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  buildSlots() {
    const n = this.level.slots.length;
    const sw = Math.min(108, (GAME_W - 20) / n);
    this.slotW = sw - 8;
    this.slotScale = Math.min(1, (this.slotW - 4) / 108);
    this.slotViews = [];
    this.slotBus = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const x = GAME_W / 2 + (i - (n - 1) / 2) * sw;
      const slot = new ParkingSlot(this, x, LAYOUT.slotY, this.slotW, LAYOUT.slotH, i, this.level.slots[i]).setDepth(3);
      this.slotViews.push(slot);
    }
    UI.text(this, GAME_W / 2, 358, 'PARKING', 16, { color: '#ffffff', thick: 3 }).setAlpha(0.6).setDepth(3);
  }

  slotPos(i) {
    return { x: this.slotViews[i].x, y: this.slotViews[i].y };
  }

  buildQueues() {
    this.queues = this.level.queues.map((colors, i) =>
      new PassengerQueue(this, i, colors, LAYOUT.queueX, LAYOUT.queueY + i * LAYOUT.queueRowGap, {
        spacing: LAYOUT.queueSpacing,
        maxVisible: LAYOUT.queueVisible,
      }),
    );
  }

  buildLanes() {
    const n = this.level.lanes.length;
    this.laneW = (GAME_W - 20) / n;
    this.laneScale = Math.min(1, (this.laneW - 10) / 108);
    this.laneBuses = this.level.lanes.map(() => []);
    this.laneNext = this.level.lanes.map(() => 0);
    this.laneMore = [];
    const bottom = LAYOUT.laneTop + (LAYOUT.laneMaxVisible - 1) * LAYOUT.laneGap + 40;
    const bg = this.add.graphics().setDepth(1);
    UI.text(this, GAME_W / 2, LAYOUT.laneTop - 54, 'WAITING BUSES', 16, { thick: 3 }).setAlpha(0.7).setDepth(2);
    for (let i = 0; i < n; i++) {
      const x = this.laneX(i);
      const w = this.laneW - 8;
      bg.fillStyle(0x2c3a52, 0.55).fillRoundedRect(x - w / 2, LAYOUT.laneTop - 44, w, bottom - LAYOUT.laneTop + 52, 18);
      bg.lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(x - w / 2, LAYOUT.laneTop - 44, w, bottom - LAYOUT.laneTop + 52, 18);
      this.laneMore.push(UI.text(this, x, bottom + 14, '', 16, { thick: 3 }).setDepth(2));

      // tap target over the FRONT bus, and a "blocked" target over the rest of the lane
      const front = this.add.zone(x, LAYOUT.laneTop, this.laneW - 4, 76).setInteractive({ useHandCursor: true }).setDepth(20);
      front.on('pointerdown', () => this.onTapLane(i));
      const backH = bottom - LAYOUT.laneTop - 40;
      const back = this.add.zone(x, LAYOUT.laneTop + 38 + backH / 2, this.laneW - 4, backH).setInteractive().setDepth(20);
      back.on('pointerdown', () => this.onTapBlocked(i));
    }
  }

  laneX(i) {
    return 10 + this.laneW * (i + 0.5);
  }

  laneY(k) {
    return LAYOUT.laneTop + k * LAYOUT.laneGap;
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
    const bus = new Bus(this, this.laneX(li), this.laneY(k), data).setBaseScale(this.laneScale);
    bus.setDepth(5 - k * 0.1);
    bus.setBlocked(k > 0);
    return bus;
  }

  /** Rebuild every moving piece from the logical state (used at start, undo and restart). */
  syncFromState() {
    this.clearBuses();
    const s = this.state;
    this.slotViews.forEach((sv) => sv.setLockProgress(s.departed));
    this.queues.forEach((q, i) => q.build(s.q[i]));
    s.slots.forEach((b, i) => {
      if (!b) return;
      const p = this.slotPos(i);
      const bus = new Bus(this, p.x, p.y, b).setBaseScale(this.slotScale).setDepth(6);
      bus.setFilled(b.filled);
      this.slotBus[i] = bus;
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
    this.laneMore[li].setText(hidden > 0 ? `+${hidden}` : '');
  }

  introAnimation() {
    this.laneBuses.forEach((lane, li) =>
      lane.forEach((b, k) => {
        const ty = b.y;
        b.y = GAME_H + 80;
        this.tweens.add({ targets: b, y: ty, duration: 420, delay: li * 70 + k * 45, ease: 'Back.easeOut' });
      }),
    );
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
    const t = UI.text(this, GAME_W / 2, 535, text, 18, { wrap: 440, thick: 4 }).setDepth(30);
    const w = Math.min(GAME_W - 30, t.width + 36);
    const h = t.height + 18;
    const bg = this.add.graphics().setDepth(29);
    bg.fillStyle(0x1b2a52, 0.9).fillRoundedRect(GAME_W / 2 - w / 2, 535 - h / 2, w, h, 18);
    bg.lineStyle(2, 0xffffff, 0.25).strokeRoundedRect(GAME_W / 2 - w / 2, 535 - h / 2, w, h, 18);
    [t, bg].forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: [t, bg], alpha: 1, duration: 400, delay: 500 });
  }

  showPointer(li) {
    this.clearPointer();
    if (li == null || !this.laneBuses[li] || !this.laneBuses[li][0]) return;
    const bus = this.laneBuses[li][0];
    const img = this.add.image(bus.x, bus.y - 62, 'arrow_down').setDepth(700).setScale(0.8);
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
    lane.slice(1).forEach((b) => this.tweens.add({ targets: b, x: b.x + 4, duration: 45, yoyo: true, repeat: 2, onComplete: () => (b.x = this.laneX(li)) }));
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
      b.setBlocked(k > 0).setDepth(5 - k * 0.1);
      this.tweens.add({ targets: b, y: this.laneY(k), duration: 300, ease: 'Cubic.easeOut' });
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
    await bus.arriveAt(p.x, p.y, this.slotScale, 340);
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
