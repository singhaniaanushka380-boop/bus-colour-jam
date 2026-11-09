import Phaser from 'phaser';
import { UI, Fx } from '../ui/UIManager.js';

/** One painted parking bay. Can be padlocked until N buses have departed. */
export class ParkingSlot extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, index, lockNeeded = 0) {
    super(scene, x, y);
    this.w = w;
    this.h = h;
    this.index = index;
    this.lockNeeded = lockNeeded;
    this.locked = lockNeeded > 0;

    this.base = scene.add.graphics();
    this.add(this.base);
    this._drawBay();

    this.label = UI.text(scene, 0, 0, 'P', Math.round(h * 0.5), { color: '#ffffff', stroke: '#2e3550', thick: 4 }).setAlpha(0.28);
    this.add(this.label);

    this.cover = scene.add.container(0, 0);
    const shade = scene.add.graphics();
    shade.fillStyle(0x1b2234, 0.78).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.lockIcon = scene.add.image(0, -9, 'ic_lock').setDisplaySize(36, 36);
    this.lockText = UI.text(scene, 0, 22, '', 20, { thick: 4 });
    this.cover.add([shade, this.lockIcon, this.lockText]);
    this.add(this.cover);

    this.glow = scene.add.graphics();
    this.add(this.glow);
    scene.add.existing(this);
    this.setLockProgress(0);
  }

  _drawBay() {
    const { w, h } = this;
    const g = this.base;
    g.clear();
    g.fillStyle(0x363d52).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(0x2c3245, 0.7).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 11);
    g.lineStyle(3, 0xffffff, 0.8);
    // dashed bay outline
    const dash = 10;
    const gap = 8;
    for (let x = -w / 2 + 12; x < w / 2 - 12; x += dash + gap) {
      const x2 = Math.min(x + dash, w / 2 - 12);
      g.lineBetween(x, -h / 2 + 3, x2, -h / 2 + 3);
      g.lineBetween(x, h / 2 - 3, x2, h / 2 - 3);
    }
  }

  /** Update padlock overlay: `departed` buses have left so far. */
  setLockProgress(departed) {
    const left = this.lockNeeded - departed;
    this.locked = left > 0;
    this.cover.setVisible(this.locked);
    this.lockText.setText(this.locked ? `${left}` : '');
    this.label.setVisible(!this.locked);
  }

  unlockAnim() {
    this.locked = false;
    this.label.setVisible(true);
    this.scene.tweens.add({
      targets: this.cover,
      alpha: 0,
      scale: 1.35,
      duration: 380,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.cover.setVisible(false).setAlpha(1).setScale(1);
      },
    });
    Fx.burst(this.scene, this.x, this.y, { color: 0xffd23f, count: 12, speed: 70 });
  }

  setHighlight(on) {
    this.glow.clear();
    if (this._glowTween) {
      this._glowTween.stop();
      this._glowTween = null;
    }
    this.glow.setAlpha(1);
    if (!on) return;
    this.glow.lineStyle(5, 0xffd23f, 1).strokeRoundedRect(-this.w / 2 - 2, -this.h / 2 - 2, this.w + 4, this.h + 4, 16);
    this._glowTween = this.scene.tweens.add({ targets: this.glow, alpha: 0.25, duration: 380, yoyo: true, repeat: -1 });
  }

  /** Brief red flash when the player has no room. */
  denyFlash() {
    const g = this.scene.add.graphics();
    g.lineStyle(5, 0xff4d5e, 1).strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, 14);
    this.add(g);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
    this.scene.tweens.add({ targets: this, x: this.x + 5, duration: 45, yoyo: true, repeat: 3 });
  }
}

export default ParkingSlot;
