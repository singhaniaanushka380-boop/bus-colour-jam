import { Passenger } from './Passenger.js';
import { UI } from '../ui/UIManager.js';
import { COLOR_NAMES } from '../config.js';

/** One horizontal waiting line. Front passenger is on the left; the rest shuffle forward as people board. */
export class PassengerQueue {
  constructor(scene, index, colors, x, y, { spacing = 34, maxVisible = 12 } = {}) {
    this.scene = scene;
    this.index = index;
    this.colors = colors;
    this.x = x;
    this.y = y;
    this.spacing = spacing;
    this.maxVisible = maxVisible;
    this.items = [];
    this.ptr = 0;
    this.bob = null;
    this.more = UI.text(scene, x + maxVisible * spacing + 8, y - 12, '', 22, { thick: 4 });
    this.badge = scene.add.graphics();
    this.marker = scene.add.graphics();
    this._drawMarker();
  }

  _drawMarker() {
    // small "front of the line" arrow on the pavement
    this.marker.clear();
    this.marker.fillStyle(0xffd23f, 0.9).fillTriangle(this.x - 34, this.y - 14, this.x - 34, this.y + 4, this.x - 22, this.y - 5);
  }

  slotX(i) {
    return this.x + i * this.spacing;
  }

  _variant(idx) {
    return idx * 3 + this.index * 5 + COLOR_NAMES.indexOf(this.colors[idx]);
  }

  _make(idx, i) {
    return new Passenger(this.scene, this.slotX(i), this.y, this.colors[idx], this._variant(idx)).setDepth(10 - i * 0.01);
  }

  /** (Re)build the visible part of the queue starting at passenger number `ptr`. */
  build(ptr) {
    this._stopBob();
    this.items.forEach((p) => p.destroy());
    this.items = [];
    this.ptr = ptr;
    for (let i = 0; i < this.maxVisible && ptr + i < this.colors.length; i++) {
      this.items.push(this._make(ptr + i, i));
    }
    this._updateMore();
    this._startBob();
  }

  get remaining() {
    return this.colors.length - this.ptr;
  }

  peekFront() {
    return this.items[0] || null;
  }

  _startBob() {
    this._stopBob();
    const front = this.items[0];
    if (!front) return;
    this.bob = this.scene.tweens.add({ targets: front, y: this.y - 4, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  _stopBob() {
    if (this.bob) {
      this.bob.stop();
      this.bob = null;
    }
    if (this.items[0]) this.items[0].y = this.y;
  }

  /** Remove the front passenger (caller animates it) and slide everyone forward. */
  popFront() {
    this._stopBob();
    const p = this.items.shift();
    this.ptr++;
    this.items.forEach((it, i) => {
      this.scene.tweens.add({ targets: it, x: this.slotX(i), duration: 170, ease: 'Sine.easeOut' });
      it.setDepth(10 - i * 0.01);
    });
    const nextIdx = this.ptr + this.items.length;
    if (this.items.length < this.maxVisible && nextIdx < this.colors.length) {
      const np = this._make(nextIdx, this.items.length).setAlpha(0);
      this.scene.tweens.add({ targets: np, alpha: 1, duration: 200 });
      this.items.push(np);
    }
    this._updateMore();
    this._startBob();
    return p;
  }

  _updateMore() {
    const hidden = this.colors.length - this.ptr - this.items.length;
    this.more.setText(hidden > 0 ? `+${hidden}` : '');
    this.more.setVisible(hidden > 0);
    this.marker.setVisible(this.remaining > 0);
  }

  destroy() {
    this._stopBob();
    this.items.forEach((p) => p.destroy());
    this.items = [];
    this.more.destroy();
    this.badge.destroy();
    this.marker.destroy();
  }
}

export default PassengerQueue;
