import { Passenger } from './Passenger.js';
import { UI } from '../ui/UIManager.js';
import { COLORS, COLOR_NAMES } from '../config.js';

const ACCENTS = [0xff4d5e, 0xffc933, 0x3d8bff];
const COL_ORDER = [1, 2, 0, 3]; // fill order inside a row: the front passenger stands near the middle
const COLS = 4;
const ROWS = 3;

/**
 * One passenger platform: a raised tile pad with queue barriers, a destination board and the waiting
 * passengers standing in a loose group (front row nearest the road). The front passenger boards first.
 */
export class PassengerQueue {
  constructor(scene, index, colors, cx, { pw = 168, top = 198, bottom = 318 } = {}) {
    this.scene = scene;
    this.index = index;
    this.colors = colors;
    this.cx = cx;
    this.pw = pw;
    this.top = top;
    this.bottom = bottom;
    this.accent = ACCENTS[index % ACCENTS.length];
    this.maxVisible = COLS * ROWS;
    this.sp = Math.min(40, (pw - 44) / (COLS - 1));
    this.items = [];
    this.ptr = 0;
    this.bob = null;
    this._drawPlatform();
    this._buildBoard();
  }

  _drawPlatform() {
    const { scene, cx, pw, top, bottom, accent } = this;
    const x0 = cx - pw / 2;
    const g = scene.add.graphics().setDepth(2);
    this.gfx = g;
    // ground shadow, front face, top face
    g.fillStyle(0x000000, 0.18).fillRoundedRect(x0 + 5, bottom + 8, pw, 18, 9);
    g.fillStyle(0x9aa7c4).fillRoundedRect(x0, bottom - 10, pw, 26, { tl: 0, tr: 0, bl: 12, br: 12 });
    g.fillStyle(0xf6f8fe).fillRoundedRect(x0, top, pw, bottom - top, { tl: 16, tr: 16, bl: 6, br: 6 });
    g.lineStyle(1, 0xdfe6f3, 1);
    for (let y = top + 26; y < bottom - 8; y += 26) g.lineBetween(x0 + 4, y, x0 + pw - 4, y);
    for (let x = x0 + 28; x < x0 + pw - 4; x += 28) g.lineBetween(x, top + 4, x, bottom - 8);
    // coloured edge trim + hazard blocks on the front face
    g.fillStyle(accent).fillRoundedRect(x0 + 3, bottom - 9, pw - 6, 8, 4);
    for (let x = x0 + 10; x < x0 + pw - 16; x += 22) g.fillStyle(0xffd23f).fillRoundedRect(x, bottom + 3, 12, 6, 2);

    // queue barriers: red ropes between chrome posts (open at the front so people can walk to the buses)
    const topY = top + 12;
    const frontY = bottom - 18;
    const lx = x0 + 9;
    const rx = x0 + pw - 9;
    g.lineStyle(3, 0xff4d5e, 1);
    g.lineBetween(lx, topY - 14, rx, topY - 14);
    g.lineBetween(lx, topY - 14, lx, frontY - 14);
    g.lineBetween(rx, topY - 14, rx, frontY - 14);
    const post = (px, py) => {
      g.fillStyle(0x000000, 0.2).fillEllipse(px, py + 4, 12, 5);
      g.fillStyle(0xb8c2d8).fillRoundedRect(px - 2.5, py - 16, 5, 20, 2);
      g.fillStyle(0xffd23f).fillCircle(px, py - 17, 4.5);
    };
    post(lx, topY);
    post(rx, topY);
    post(lx, frontY);
    post(rx, frontY);
  }

  _buildBoard() {
    const { scene, cx, top, accent } = this;
    const w = Math.min(150, this.pw - 8);
    const c = scene.add.container(cx, top - 10).setDepth(4);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -9, w, 26, 9);
    g.fillStyle(0x1b2a52).fillRoundedRect(-w / 2, -12, w, 26, 9);
    g.lineStyle(2, accent, 1).strokeRoundedRect(-w / 2, -12, w, 26, 9);
    g.fillStyle(0xffffff, 0.12).fillRoundedRect(-w / 2 + 4, -10, w - 8, 7, 4);
    c.add(g);
    c.add(UI.text(scene, -w / 2 + 22, 1, `P${this.index + 1}`, 15, { color: '#ffd23f', thick: 3 }));
    this.lamp = scene.add.circle(0, 1, 7, 0x58607a).setStrokeStyle(2, 0xffffff);
    c.add(this.lamp);
    this.countText = UI.text(scene, w / 2 - 24, 1, '', 15, { thick: 3 });
    c.add(this.countText);
    this.board = c;
  }

  /** Position of the i-th person in line (i = 0 is the front). */
  slotPos(i) {
    const row = Math.floor(i / COLS);
    const col = COL_ORDER[i % COLS];
    const jx = ((i * 37) % 7) - 3;
    const jy = ((i * 53) % 5) - 2;
    return {
      x: this.cx + (col - (COLS - 1) / 2) * this.sp + jx + (row % 2 ? 4 : -4) * 0.5,
      y: this.bottom - 17 - row * 32 + jy,
    };
  }

  _variant(idx) {
    return idx * 3 + this.index * 5 + COLOR_NAMES.indexOf(this.colors[idx]);
  }

  _make(idx, i) {
    const p = this.slotPos(i);
    return new Passenger(this.scene, p.x, p.y, this.colors[idx], this._variant(idx)).setScale(0.8).setDepth(10 + p.y * 0.01);
  }

  /** (Re)build the visible group starting at passenger number `ptr`. */
  build(ptr) {
    this._stopBob();
    this.items.forEach((p) => p.destroy());
    this.items = [];
    this.ptr = ptr;
    for (let i = 0; i < this.maxVisible && ptr + i < this.colors.length; i++) this.items.push(this._make(ptr + i, i));
    this._updateBoard();
    this._startBob();
  }

  /** Little pop-in when a level starts. */
  intro() {
    this.items.forEach((p, i) => {
      const s = p.scaleX;
      p.setScale(0);
      this.scene.tweens.add({ targets: p, scaleX: s, scaleY: s, duration: 260, delay: 120 + i * 35, ease: 'Back.easeOut' });
    });
  }

  get remaining() {
    return this.colors.length - this.ptr;
  }

  _startBob() {
    this._stopBob();
    const front = this.items[0];
    if (!front) return;
    const y0 = this.slotPos(0).y;
    this.bob = this.scene.tweens.add({ targets: front, y: y0 - 4, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  _stopBob() {
    if (this.bob) {
      this.bob.stop();
      this.bob = null;
    }
    if (this.items[0]) this.items[0].y = this.slotPos(0).y;
  }

  /** Remove the front passenger (caller animates it); everyone else steps forward. */
  popFront() {
    this._stopBob();
    const p = this.items.shift();
    this.ptr++;
    this.items.forEach((it, i) => {
      const pos = this.slotPos(i);
      this.scene.tweens.add({ targets: it, x: pos.x, y: pos.y, duration: 220, ease: 'Sine.easeOut' });
      it.setDepth(10 + pos.y * 0.01);
    });
    const nextIdx = this.ptr + this.items.length;
    if (this.items.length < this.maxVisible && nextIdx < this.colors.length) {
      const np = this._make(nextIdx, this.items.length).setAlpha(0);
      this.scene.tweens.add({ targets: np, alpha: 1, duration: 240 });
      this.items.push(np);
    }
    this._updateBoard();
    this._startBob();
    return p;
  }

  /** Destination board: lamp shows the colour of the next passenger, number = people left. */
  _updateBoard() {
    const next = this.colors[this.ptr];
    this.lamp.setFillStyle(next ? COLORS[next].main : 0x58607a);
    this.countText.setText(this.remaining > 0 ? `${this.remaining}` : 'OK');
  }

  destroy() {
    this._stopBob();
    this.items.forEach((p) => p.destroy());
    this.items = [];
    this.gfx.destroy();
    this.board.destroy();
  }
}

export default PassengerQueue;
