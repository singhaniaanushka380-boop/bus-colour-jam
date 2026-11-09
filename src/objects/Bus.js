import Phaser from 'phaser';
import { COLORS } from '../config.js';
import { BUS_TEX } from '../ui/TextureFactory.js';

// Local coordinates are relative to the texture centre (54,38).
const GLASS_X0 = 15 - BUS_TEX.cx; // left edge of seat windows
const GLASS_W = 78;
const GLASS_Y = 17 - BUS_TEX.cy;
const GLASS_H = 21;

/** A cartoon bus. Seats show as lit windows; boarded passengers appear in them. */
export class Bus extends Phaser.GameObjects.Container {
  constructor(scene, x, y, { uid, color, cap }) {
    super(scene, x, y);
    this.uid = uid;
    this.colorName = color;
    this.cap = cap;
    this.filled = 0;
    this.baseScale = 1;

    this.hull = scene.add.image(0, 0, `bus_${color}`);
    this.glass = scene.add.graphics();
    this.add([this.hull, this.glass]);
    this.setSize(BUS_TEX.w, BUS_TEX.h);
    this._drawGlass();
    scene.add.existing(this);
  }

  /** Centre x of seat window `i` in local space. */
  _cellGeom(i) {
    const gap = 3;
    const w = (GLASS_W - gap * (this.cap - 1)) / this.cap;
    return { x: GLASS_X0 + i * (w + gap), y: GLASS_Y, w, h: GLASS_H };
  }

  _drawGlass() {
    const g = this.glass;
    g.clear();
    const col = COLORS[this.colorName];
    for (let i = 0; i < this.cap; i++) {
      const c = this._cellGeom(i);
      const taken = i < this.filled;
      g.fillStyle(taken ? 0xd6efff : 0x7da3d8, taken ? 1 : 0.55).fillRoundedRect(c.x, c.y, c.w, c.h, 5);
      if (taken) {
        const cx = c.x + c.w / 2;
        const bodyW = Math.min(c.w - 2, 14);
        g.fillStyle(col.main).fillRoundedRect(cx - bodyW / 2, c.y + 11, bodyW, 10, { tl: 5, tr: 5, bl: 0, br: 0 });
        g.fillStyle(0xffd7b5).fillCircle(cx, c.y + 8, Math.min(5, c.w / 2 - 1));
        g.fillStyle(col.dark).fillRoundedRect(cx - 5, c.y + 2, 10, 4, 2);
      } else {
        g.fillStyle(0xffffff, 0.35).fillRoundedRect(c.x + 2, c.y + 2, c.w - 4, 3, 1.5);
      }
    }
  }

  setFilled(n) {
    this.filled = n;
    this._drawGlass();
  }

  /** World position of the centre of seat `i` (used as passenger boarding target). */
  seatPos(i) {
    const c = this._cellGeom(i);
    return {
      x: this.x + (c.x + c.w / 2) * this.scaleX,
      y: this.y + (c.y + c.h / 2) * this.scaleY,
    };
  }

  setBaseScale(s) {
    this.baseScale = s;
    this.setScale(s);
    return this;
  }

  /** Dim buses that are blocked behind another bus. */
  setBlocked(blocked) {
    if (blocked) this.hull.setTint(0x8b93b0);
    else this.hull.clearTint();
    this.glass.setAlpha(blocked ? 0.75 : 1);
    return this;
  }

  bounce() {
    this.scene.tweens.add({
      targets: this,
      scaleX: this.baseScale * 1.07,
      scaleY: this.baseScale * 0.93,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  /** Slide into a parking slot. */
  arriveAt(x, y, scale, duration = 360) {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        duration,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.baseScale = scale;
          resolve();
        },
      });
    });
  }

  /** Drive off the right edge of the screen, then remove. */
  departAndDestroy(offX) {
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: this, y: this.y - 4, duration: 110, yoyo: true });
      this.scene.tweens.add({
        targets: this,
        x: offX,
        duration: 520,
        delay: 160,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          this.destroy();
          resolve();
        },
      });
    });
  }
}

export default Bus;
