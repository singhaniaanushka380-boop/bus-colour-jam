import { GAME_W, LAYOUT, HINT_COST } from '../config.js';
import { UI } from './UIManager.js';

/**
 * Premium in-game HUD: glossy pause button, level badge, coin counter, passenger progress bar and a
 * bottom control dock with round Undo / Hint / Restart buttons.
 */
export class HUD {
  constructor(scene, level, handlers) {
    this.scene = scene;
    this.total = level.totalPassengers;
    const depth = 500;
    this.parts = [];
    const keep = (o) => {
      this.parts.push(o);
      return o;
    };

    // ---- top row
    this.pause = keep(UI.iconButton(scene, 44, 46, 56, 'pause', { color: 0xff9a3c, round: true, onClick: handlers.onPause }).setDepth(depth));

    const badge = keep(scene.add.container(GAME_W / 2, 46).setDepth(depth));
    const inner = level.challenge ? 0x6a35c9 : 0x1b2a52;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-108, -22, 216, 54, 27);
    g.fillStyle(0xb8791a).fillRoundedRect(-108, -27, 216, 54, 27);
    g.fillStyle(0xffc933).fillRoundedRect(-108, -27, 216, 50, 25);
    g.fillStyle(inner).fillRoundedRect(-102, -22, 204, 42, 21);
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(-92, -19, 184, 12, 6);
    badge.add(g);
    badge.add(scene.add.image(-80, -1, 'star').setDisplaySize(30, 30));
    this.levelText = UI.text(scene, 10, -2, `LEVEL ${level.id}`, 27, { thick: 4 });
    badge.add(this.levelText);
    keep(UI.text(scene, GAME_W / 2, 84, level.challenge ? 'CHALLENGE  x2 COINS' : level.name.toUpperCase(), 13, { color: level.challenge ? '#ffd23f' : '#ffffff', thick: 3 }).setDepth(depth));

    this.coins = keep(UI.coinCounter(scene, GAME_W - 94, 46, 148).setDepth(depth));
    this.coinTarget = { x: GAME_W - 94 - 48, y: 46 };

    // ---- passenger progress
    const by = 108;
    this.bar = keep(UI.bar(scene, GAME_W / 2 + 22, by, 410, 22, 0x3ed16a).setDepth(depth));
    const icon = keep(scene.add.container(60, by).setDepth(depth + 1));
    const ig = scene.add.graphics();
    ig.fillStyle(0x000000, 0.25).fillCircle(0, 3, 17);
    ig.fillStyle(0x3ed16a).fillCircle(0, 0, 17);
    ig.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, 17);
    icon.add([ig, scene.add.image(0, 0, 'ic_passenger').setDisplaySize(22, 22)]);
    this.barText = keep(UI.text(scene, GAME_W / 2 + 22, by, '', 15, { thick: 3 }).setDepth(depth + 1));
    this.setProgress(0);

    // ---- bottom dock
    const dock = keep(scene.add.graphics().setDepth(depth - 10));
    dock.fillStyle(0x000000, 0.25).fillRoundedRect(0, 880, GAME_W, 90, { tl: 28, tr: 28, bl: 0, br: 0 });
    dock.fillStyle(0x16244f, 0.96).fillRoundedRect(0, 886, GAME_W, 90, { tl: 28, tr: 28, bl: 0, br: 0 });
    dock.fillStyle(0x3d8bff, 0.9).fillRoundedRect(0, 886, GAME_W, 5, { tl: 3, tr: 3, bl: 0, br: 0 });
    dock.fillStyle(0xffffff, 0.06).fillRoundedRect(8, 894, GAME_W - 16, 20, 10);

    const y = LAYOUT.controlsY;
    this.undo = keep(UI.button(scene, 126, y, 60, 60, '', { color: 0x3d8bff, icon: 'undo', round: true, onClick: handlers.onUndo }).setDepth(depth));
    this.hint = keep(UI.button(scene, 270, y - 2, 72, 72, '', { color: 0xffb62e, icon: 'hint', round: true, onClick: handlers.onHint }).setDepth(depth));
    this.restart = keep(UI.button(scene, 414, y, 60, 60, '', { color: 0xff4d5e, icon: 'restart', round: true, onClick: handlers.onRestart }).setDepth(depth));
    const cap = (x, str) => keep(UI.text(scene, x, 952, str, 11, { color: '#bcd0ff', thick: 2 }).setDepth(depth));
    cap(126, 'UNDO');
    cap(270, 'HINT');
    cap(414, 'RESTART');

    // hint price tag
    const tag = keep(scene.add.container(270 + 30, y - 36).setDepth(depth + 1));
    const tg = scene.add.graphics();
    tg.fillStyle(0x1b2a52).fillRoundedRect(-24, -11, 48, 22, 11);
    tg.lineStyle(2, 0xffffff, 0.8).strokeRoundedRect(-24, -11, 48, 22, 11);
    tag.add([tg, scene.add.image(-12, 0, 'coin').setDisplaySize(15, 15)]);
    this.hintCost = UI.text(scene, 8, 0, `${HINT_COST}`, 13, { thick: 3 });
    tag.add(this.hintCost);

    this.setUndoEnabled(false);
  }

  setProgress(boarded) {
    const v = this.total ? boarded / this.total : 0;
    this.bar.setValue(v);
    this.barText.setText(`${boarded} / ${this.total}`);
  }

  setUndoEnabled(on) {
    this.undo.setDisabled(!on);
  }

  setHintCost(n) {
    this.hintCost.setText(n > 0 ? `${n}` : '0');
  }

  /** Gameplay buttons off while an animation plays. */
  setBusy(busy, canUndo) {
    this.undo.setDisabled(busy || !canUndo);
    this.hint.setDisabled(busy);
    this.restart.setDisabled(false);
  }

  destroy() {
    this.parts.forEach((o) => o && o.destroy());
    this.parts = [];
  }
}

export default HUD;
