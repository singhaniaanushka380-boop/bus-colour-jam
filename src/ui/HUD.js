import { GAME_W, LAYOUT, HINT_COST } from '../config.js';
import { UI } from './UIManager.js';

/**
 * In-game heads-up display: pause button, level label, coin counter, progress bar and the
 * bottom control bar (undo / hint / restart). Built once per GameScene.
 */
export class HUD {
  constructor(scene, level, handlers) {
    this.scene = scene;
    this.total = level.totalPassengers;
    const depth = 500;

    // top bar
    this.pause = UI.iconButton(scene, 48, 54, 56, 'pause', { color: 0xff9a3c, onClick: handlers.onPause }).setDepth(depth);

    this.levelPill = UI.pill(scene, GAME_W / 2, 52, 190, 48, { color: level.challenge ? 0x7b3fd6 : 0x1b2a52 }).setDepth(depth);
    this.levelText = UI.text(scene, 0, -2, `LEVEL ${level.id}`, 26, { thick: 4 });
    this.levelPill.add(this.levelText);

    this.coins = UI.coinCounter(scene, GAME_W - 98, 54, 156).setDepth(depth);
    this.coinTarget = { x: GAME_W - 98 - 48, y: 54 };

    if (level.challenge) {
      this.tag = UI.text(scene, GAME_W / 2, 84, 'CHALLENGE  x2 COINS', 15, { color: '#ffd23f', thick: 4 }).setDepth(depth);
    }

    // progress
    this.bar = UI.bar(scene, GAME_W / 2, 110, 420, 22, 0x3ed16a).setDepth(depth);
    this.barText = UI.text(scene, GAME_W / 2, 110, '', 15, { thick: 3 }).setDepth(depth + 1);
    this.setProgress(0);

    // bottom bar
    const y = LAYOUT.controlsY;
    this.undo = UI.button(scene, 138, y, 112, 62, '', { color: 0x3d8bff, icon: 'undo', onClick: handlers.onUndo }).setDepth(depth);
    this.hint = UI.button(scene, GAME_W / 2, y, 128, 62, `${HINT_COST}`, { color: 0xffb62e, icon: 'hint', size: 26, onClick: handlers.onHint }).setDepth(depth);
    this.restart = UI.button(scene, GAME_W - 138, y, 112, 62, '', { color: 0xff4d5e, icon: 'restart', onClick: handlers.onRestart }).setDepth(depth);
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
    if (this.hint.label) this.hint.label.setText(n > 0 ? `${n}` : 'FREE');
  }

  /** All gameplay buttons off while an animation plays. */
  setBusy(busy, canUndo) {
    this.undo.setDisabled(busy || !canUndo);
    this.hint.setDisabled(busy);
    this.restart.setDisabled(false);
  }

  destroy() {
    [this.pause, this.levelPill, this.coins, this.tag, this.bar, this.barText, this.undo, this.hint, this.restart].forEach((o) => o && o.destroy());
  }
}

export default HUD;
