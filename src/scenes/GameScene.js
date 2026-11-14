import Phaser from 'phaser';
import { GAME_W, GAME_H, HINT_COST, BOOST_COST, COLORS } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { LevelManager } from '../systems/LevelManager.js';
import {
  createState, cloneState, exitBus, whyBlocked, isWon, isStuck, hintMove, findFreeBay, isRevealed, isSpawned,
  settle, unlockVip, shufflePassengers, shuffleColors, TOTAL_BAYS,
} from '../systems/PuzzleValidator.js';
import { getStage } from '../three/TerminalStage.js';
import { HUD } from '../ui/HUD.js';
import { UI, Fx } from '../ui/UIManager.js';

const NOSE_Z_BADGE = 0.78; // z just below the bays (world units)
const FAIL_TIPS = [
  'Only the FRONT passenger boards. Park the vehicle whose colour matches him!',
  'A vehicle nobody is waiting for blocks a precious bay. Keep one bay free!',
  'Vehicles cannot drive through other vehicles. Free the one in front first.',
  'Shuffle People or Shuffle Colors can rescue a bad jam.',
  'Stuck? Undo is free. Hint shows a move that still leads to victory.',
];

/**
 * Gameplay scene: a real 3D terminal (TerminalStage, Three.js) underneath, Phaser HUD / labels / dialogs on top.
 * Rules come from PuzzleValidator; this scene only translates rule events into 3D animations.
 */
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
    this.labels = [];

    this.stage = getStage(this.game);
    if (!this.stage.ok) {
      UI.toast(this, 'Your browser does not support WebGL', 480);
      this.time.delayedCall(1800, () => UI.go(this, 'Menu'));
      return;
    }

    this.level = LevelManager.get(this.levelId);
    gm.checkLevel(this.level);
    gm.save.setCurrent(this.level.id);
    this.state = createState(this.level);
    this.undoStack = [];
    this.assists = { undos: 0, hints: 0, restarts: this.carriedRestarts, mistakes: 0 };

    this.stage.load(this.level);
    this.stage.sync(this.state);
    this.stage.show();
    this.shownBoarded = 0;

    this.input.setTopOnly(true);
    this.tapZone = this.add.zone(0, 0, GAME_W, GAME_H).setOrigin(0).setInteractive().setDepth(1);
    this.tapZone.on('pointerdown', (p) => this.onTap(p.x, p.y));

    this.hud = new HUD(this, this.level, {
      onPause: () => this.openPause(),
      onUndo: () => this.undo(),
      onHint: () => this.hint(),
      onRestart: () => this.restart(true),
      onVip: () => this.boostVip(),
      onShufflePax: () => this.boostPeople(),
      onShuffleColors: () => this.boostColors(),
    });

    this.buildLabels();
    this.refreshLabels();
    this.hud.setProgress(0);
    this.hud.setVipUsed(false);

    this.events.once('shutdown', () => {
      this.dead = true;
      this.token++;
      this.hud?.destroy();
      this.stage.anim.clear();
      this.stage.hide();
    });

    if (this.level.tip) this.showTip(this.level.tip);
    if (this.level.id === 1) this.time.delayedCall(900, () => this.stage.setHint(hintMove(this.level, this.state)));
  }

  update(_t, dt) {
    if (this.dead || !this.stage?.ok) return;
    this.stage.update(dt / 1000);
  }

  // ------------------------------------------------------------------ labels projected from 3D
  buildLabels() {
    const st = this.stage;
    const L = st.L;
    const mk = (x, y, z, size, color = '#ffffff') => {
      const p = st.project(x, y, z);
      return UI.text(this, p.x, p.y, '', size, { color, thick: 4 }).setDepth(20);
    };
    // remaining-seat badge under every bay (coloured like the vehicle), as in the reference
    this.pills = Array.from({ length: TOTAL_BAYS }, (_, i) => {
      const p = st.project(L.bayX[i], 0.05, NOSE_Z_BADGE);
      return { x: p.x, y: p.y, g: this.add.graphics().setDepth(20), t: UI.text(this, p.x, p.y, '', 13, { thick: 3 }).setDepth(21) };
    });
    this.labels = this.pills.flatMap((q) => [q.g, q.t]);
    this.pills.forEach((q) => { q.g.setVisible(false); q.t.setVisible(false); });
  }

  setPill(bay, busIdx, fill) {
    const q = this.pills[bay];
    const b = this.level.buses[busIdx];
    const col = COLORS[this.stage.buses[busIdx].obj.color].main;
    q.g.clear().fillStyle(col, 1).fillRoundedRect(q.x - 17, q.y - 9, 34, 18, 6).lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(q.x - 17, q.y - 9, 34, 18, 6);
    q.g.setVisible(true);
    q.t.setText(`${b.seats - fill}`).setVisible(true);
  }

  refreshLabels() {
    const st = this.state;
    this.pills.forEach((q, bay) => {
      const bi = st.bayBus[bay];
      if (bi < 0) { q.g.setVisible(false); q.t.setVisible(false); return; }
      this.setPill(bay, bi, st.bayFill[bay]);
    });
    this.hud.setVipUsed(!!st.vip);
  }

  // ------------------------------------------------------------------ helpers
  alive(tk) { return !this.dead && tk === this.token; }
  wait(ms) { return new Promise((res) => this.time.delayedCall(ms, res)); }

  setBusy(b) {
    this.busy = b;
    this.hud.setBusy(b, this.undoStack.length > 0);
  }

  showTip(text) {
    const y = 160;
    const t = UI.text(this, GAME_W / 2, y, text, 17, { wrap: 440, thick: 4 }).setDepth(30);
    const w = Math.min(GAME_W - 30, t.width + 36);
    const h = t.height + 18;
    const bg = this.add.graphics().setDepth(29);
    bg.fillStyle(0x1b2a52, 0.9).fillRoundedRect(GAME_W / 2 - w / 2, y - h / 2, w, h, 18);
    bg.lineStyle(2, 0xffffff, 0.25).strokeRoundedRect(GAME_W / 2 - w / 2, y - h / 2, w, h, 18);
    const items = [t, bg];
    items.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: items, alpha: 1, duration: 400, delay: 400 });
    this.tweens.add({ targets: items, alpha: 0, duration: 500, delay: 8000, onComplete: () => items.forEach((o) => o.destroy()) });
  }

  // ------------------------------------------------------------------ input
  onTap(x, y) {
    if (this.busy || this.over || this.paused || this.dead) return;
    const i = this.stage.pick(x, y);
    if (i < 0) return;
    gm.audio.unlock?.();
    const why = whyBlocked(this.level, this.state, i);
    if (why) return this.deny(i, why);
    return this.doMove(i);
  }

  deny(i, why) {
    gm.audio.sfx('error');
    this.assists.mistakes++;
    this.stage.bump(i);
    if (why.reason === 'bus') {
      this.stage.flashBlockers(why.blockers);
      UI.toast(this, 'Blocked! Move the vehicle in front first.');
    } else if (why.reason === 'bay') {
      this.stage.flashBays(this.state);
      UI.toast(this, 'All bays are full!');
    }
  }

  async doMove(i) {
    const tk = this.token;
    this.stage.setHint(null);
    this.undoStack.push(cloneState(this.state));
    this.setBusy(true);
    const before = this.state.removed;
    const res = exitBus(this.level, this.state, i);
    const ok = await this.playEvents(res.events, tk, before);
    if (!ok) return;
    this.refreshLabels();
    this.setBusy(false);
    this.afterMove();
  }

  afterMove() {
    if (isWon(this.level, this.state)) return this.win();
    if (isStuck(this.level, this.state)) return this.fail();
    return null;
  }

  // ------------------------------------------------------------------ rule events -> 3D animation
  async playEvents(events, tk) {
    const st = this.stage;
    let pending = [];
    let shown = this.shownBoarded;
    const aftermath = async () => {
      // vehicles that left the grid unlock garages and reveal mystery vehicles
      const jobs = [];
      this.level.buses.forEach((b, j) => {
        const e = st.buses[j];
        if (e.where === 'garage' && isSpawned(this.level, this.state, j)) jobs.push(st.emerge(j));
        else if (e.where === 'lot' && !e.obj.revealed && isRevealed(this.level, this.state, j)) jobs.push(st.reveal(j));
      });
      await Promise.all(jobs);
    };
    for (const ev of events) {
      if (!this.alive(tk)) return false;
      if (ev.type === 'park') {
        gm.audio.sfx('park');
        const ok = await st.driveToBay(ev.bus, ev.bay);
        if (!ok || !this.alive(tk)) return false;
        this.labelBay(ev.bay, ev.bus, 0);
        pending.push(aftermath());
      } else if (ev.type === 'board') {
        const col = COLORS[ev.color];
        pending.push(
          st.boardOne(ev.bus, ev.bay).then((ok) => {
            if (!ok || !this.alive(tk)) return;
            shown++;
            this.shownBoarded = shown;
            this.hud.setProgress(shown);
            this.labelBay(ev.bay, ev.bus, ev.seat + 1);
            gm.audio.sfx('board', Math.min(7, ev.seat));
            const p = st.project(st.L.bayX[ev.bay], 1, st.parkZ(3));
            Fx.burst(this, p.x, p.y, { color: col.light, count: 5, speed: 45, life: 350 });
          }),
        );
        await this.wait(60);
      } else if (ev.type === 'depart') {
        const waitFor = pending.splice(0);
        pending.push(Promise.all(waitFor).then(async () => {
          if (!this.alive(tk)) return;
          gm.audio.sfx('depart');
          this.pills[ev.bay].g.setVisible(false);
          this.pills[ev.bay].t.setVisible(false);
          const p = st.project(st.L.bayX[ev.bay], 1, st.parkZ(3));
          Fx.burst(this, p.x, p.y, { color: 0xffffff, count: 12, speed: 70, life: 520 });
          Fx.ring(this, p.x, p.y, COLORS[st.buses[ev.bus].obj.color].main);
          await st.departBus(ev.bus, ev.bay);
        }));
      }
    }
    await Promise.all(pending);
    if (!this.alive(tk)) return false;
    this.shownBoarded = this.state.boarded;
    this.hud.setProgress(this.state.boarded);
    return true;
  }

  labelBay(bay, busIdx, fill) {
    this.setPill(bay, busIdx, fill);
  }

  // ------------------------------------------------------------------ boosters
  pay(cost) {
    if (gm.spendCoins(cost)) return true;
    gm.audio.sfx('error');
    UI.toast(this, `Not enough coins (${cost} needed)`);
    return false;
  }

  async boostVip() {
    if (this.busy || this.over) return;
    if (this.state.vip) { UI.toast(this, 'VIP slot is already open'); return; }
    if (!this.pay(BOOST_COST.vip)) return;
    await this.applyVip();
  }

  async applyVip() {
    const tk = this.token;
    this.setBusy(true);
    unlockVip(this.state);
    gm.audio.sfx('unlock');
    this.refreshLabels();
    await this.stage.setVip(true, true);
    if (!this.alive(tk)) return;
    this.setBusy(false);
    UI.toast(this, 'VIP slot unlocked!');
  }

  async boostPeople() {
    if (this.busy || this.over) return;
    if (this.state.queue.length - this.state.qp < 2) { UI.toast(this, 'Nobody to shuffle'); return; }
    if (!this.pay(BOOST_COST.pax)) return;
    const tk = this.token;
    this.setBusy(true);
    const changed = shufflePassengers(this.level, this.state);
    if (!changed) { gm.addCoins(BOOST_COST.pax); UI.toast(this, 'Queue is already ideal - coins refunded'); this.setBusy(false); return; }
    this.undoStack = [];
    gm.audio.sfx('unlock');
    this.stage.resetQueue(this.state.queue, this.state.qp, true);
    UI.toast(this, 'Passengers shuffled!');
    await this.wait(500);
    const events = settle(this.level, this.state);
    if (events.length && !(await this.playEvents(events, tk))) return;
    if (!this.alive(tk)) return;
    this.refreshLabels();
    this.setBusy(false);
    this.afterMove();
  }

  async boostColors() {
    if (this.busy || this.over) return;
    if (!this.pay(BOOST_COST.colors)) return;
    const tk = this.token;
    this.setBusy(true);
    const changed = shuffleColors(this.level, this.state);
    if (!changed) { gm.addCoins(BOOST_COST.colors); UI.toast(this, 'No better colours - coins refunded'); this.setBusy(false); return; }
    this.undoStack = [];
    gm.audio.sfx('unlock');
    await this.stage.recolor(this.state.col, this.state);
    if (!this.alive(tk)) return;
    this.refreshLabels();
    this.setBusy(false);
    UI.toast(this, 'Vehicle colours shuffled!');
  }

  // ------------------------------------------------------------------ player tools
  undo() {
    if (this.busy || this.over || !this.undoStack.length) return;
    this.token++;
    const keepVip = this.state.vip;
    this.state = this.undoStack.pop();
    if (keepVip) this.state.vip = true; // a bought VIP bay stays open
    this.assists.undos++;
    gm.audio.sfx('click');
    this.stage.sync(this.state);
    this.shownBoarded = this.state.boarded;
    this.refreshLabels();
    this.hud.setProgress(this.state.boarded);
    this.setBusy(false);
  }

  hint() {
    if (this.busy || this.over) return;
    const m = hintMove(this.level, this.state);
    if (m === null) {
      gm.audio.sfx('error');
      UI.toast(this, 'Dead end! Use Undo, a booster or Restart.');
      return;
    }
    if (!gm.spendCoins(HINT_COST)) {
      gm.audio.sfx('error');
      UI.toast(this, `Hints cost ${HINT_COST} coins`);
      return;
    }
    this.assists.hints++;
    this.stage.setHint(m);
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
    const d = UI.dialog(this, { title: 'PAUSED', w: 420, h: 560, onClose: () => (this.paused = false) });
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
    const result = gm.completeLevel(this.level, stars, this.assists);
    gm.audio.sfx('win');
    Fx.confetti(this, 60);
    await this.wait(1200);
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
    const noBay = findFreeBay(this.state) < 0;
    const d = UI.dialog(this, { title: 'OUT OF SPACE!', w: 440, h: 650, depth: 1100, closable: false });
    const c = d.c;
    c.add(UI.text(this, 0, -170, 'TRAFFIC JAM', 30, { color: '#e23a3a', stroke: '#ffffff', thick: 0 }));
    c.add(UI.text(this, 0, -120, noBay ? 'Every bay is full and\nno passenger can board!' : 'No vehicle can drive out\nany more!', 22, { color: '#1b2a52', stroke: '#ffffff', thick: 0 }));
    const tip = FAIL_TIPS[(this.level.id + this.assists.undos) % FAIL_TIPS.length];
    const box = this.add.graphics();
    box.fillStyle(0xfff2c2).fillRoundedRect(-185, -75, 370, 80, 18);
    c.add(box);
    c.add(UI.text(this, 0, -35, `Tip: ${tip}`, 16, { color: '#6b4a00', stroke: '#fff2c2', thick: 0, wrap: 330 }));
    if (!this.state.vip) {
      c.add(UI.button(this, 0, 50, 330, 68, `REVIVE  ${BOOST_COST.vip}`, {
        color: 0xffb62e, icon: 'lock', size: 24,
        onClick: () => {
          if (!this.pay(BOOST_COST.vip)) return;
          d.close(true);
          this.over = false;
          this.applyVip().then(() => this.afterMove());
        },
      }));
      c.add(UI.text(this, 0, 94, 'Unlock the VIP slot', 14, { color: '#6b4a00', stroke: '#ffffff', thick: 0 }));
    }
    c.add(UI.button(this, 0, 150, 330, 64, 'RETRY', { color: 0x3ed16a, icon: 'restart', size: 26, onClick: () => UI.go(this, 'Game', { levelId: this.level.id, restarts: 0 }) }));
    const ub = UI.button(this, 0, 222, 330, 56, 'UNDO MOVE', { color: 0x3d8bff, icon: 'undo', size: 22, onClick: () => { d.close(true); this.over = false; this.undo(); } });
    ub.setDisabled(this.undoStack.length === 0);
    c.add(ub);
    c.add(UI.button(this, 0, 286, 330, 48, 'MENU', { color: 0xa566ff, icon: 'home', size: 20, onClick: () => UI.go(this, 'Menu') }));
  }
}

export default GameScene;
