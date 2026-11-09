import Phaser from 'phaser';
import { COLORS } from '../config.js';
import { UI, Fx } from '../ui/UIManager.js';

/** A numbered boarding bay: painted lines, bus-stop sign, colour indicator lamp, optional padlock. */
export class ParkingSlot extends Phaser.GameObjects.Container {
  constructor(scene, x, y, w, h, index, lockNeeded = 0) {
    super(scene, x, y);
    this.w = w;
    this.h = h;
    this.index = index;
    this.lockNeeded = lockNeeded;
    this.locked = lockNeeded > 0;

    this.base = scene.add.graphics();
    this.ind = scene.add.graphics();
    this.add([this.base, this.ind]);
    this._drawBay();

    this.num = UI.text(scene, 0, h / 2 - 11, String(index + 1), 17, { thick: 3 });
    this.label = UI.text(scene, 0, 2, 'P', Math.round(h * 0.42), { color: '#ffffff', stroke: '#2e3550', thick: 4 }).setAlpha(0.2);
    this.add([this.label, this.num]);

    this.cover = scene.add.container(0, 0);
    const shade = scene.add.graphics();
    shade.fillStyle(0x1b2234, 0.8).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.lockIcon = scene.add.image(0, -9, 'ic_lock').setDisplaySize(36, 36);
    this.lockText = UI.text(scene, 0, 24, '', 20, { thick: 4 });
    this.cover.add([shade, this.lockIcon, this.lockText]);
    this.add(this.cover);

    this.glow = scene.add.graphics();
    this.add(this.glow);
    scene.add.existing(this);
    this.setIndicator(null);
    this.setLockProgress(0);
  }

  _drawBay() {
    const { w, h } = this;
    const g = this.base;
    g.clear();
    // asphalt pad with soft depth
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 14);
    g.fillStyle(0x2a3047).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(0x3a4262).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 11);
    // painted bay lines
    g.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 9);
    // number plate badge
    g.fillStyle(0x000000, 0.3).fillCircle(0, h / 2 - 8, 13);
    g.fillStyle(0x3d8bff).fillCircle(0, h / 2 - 11, 13);
    g.lineStyle(2, 0xffffff, 1).strokeCircle(0, h / 2 - 11, 13);
    // bus-stop sign on the kerb side
    const sx = -w / 2 + 12;
    g.fillStyle(0x000000, 0.2).fillEllipse(sx + 1, -h / 2 + 4, 10, 4);
    g.fillStyle(0xb8c2d8).fillRoundedRect(sx - 1.5, -h / 2 - 22, 3, 26, 1);
    g.fillStyle(0x1f5fd6).fillRoundedRect(sx - 10, -h / 2 - 36, 20, 17, 4);
    g.lineStyle(1.5, 0xffffff, 1).strokeRoundedRect(sx - 10, -h / 2 - 36, 20, 17, 4);
    g.fillStyle(0xffffff).fillRoundedRect(sx - 6, -h / 2 - 32, 12, 7, 2);
    g.fillStyle(0x1f5fd6).fillCircle(sx - 3, -h / 2 - 24.5, 1.6).fillCircle(sx + 3, -h / 2 - 24.5, 1.6);
  }

  /** Colour lamp along the top of the bay: lights up with the colour of the parked bus. */
  setIndicator(colorName) {
    const { w, h } = this;
    const g = this.ind;
    g.clear();
    const x = -w / 2 + 22;
    const y = -h / 2 + 10;
    const lw = w - 44;
    if (!colorName) {
      g.fillStyle(0x59627e).fillRoundedRect(x, y, lw, 8, 4);
      return;
    }
    const c = COLORS[colorName];
    g.fillStyle(c.main, 0.35).fillRoundedRect(x - 4, y - 4, lw + 8, 16, 8);
    g.fillStyle(c.main).fillRoundedRect(x, y, lw, 8, 4);
    g.fillStyle(0xffffff, 0.55).fillRoundedRect(x + 4, y + 1, lw - 8, 2.5, 1.2);
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
