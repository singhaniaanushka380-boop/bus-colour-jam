import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { LevelManager } from '../systems/LevelManager.js';
import { UI } from '../ui/UIManager.js';

const SPACING = 104;
const HEADER = 112;

/** Scrollable level map (level 1 at the bottom). Drag, swipe or use the mouse wheel. */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelect');
  }

  create() {
    UI.enter(this);
    const total = LevelManager.count;
    this.worldH = 200 + total * SPACING + 120;
    this.add.image(0, 0, 'bg_menu').setOrigin(0).setDepth(-5).setScrollFactor(0);

    this.layer = this.add.container(0, 0);
    this.nodePos = [];
    for (let i = 0; i < total; i++) {
      this.nodePos.push({ x: GAME_W / 2 + Math.sin(i * 0.95) * 140, y: this.worldH - 120 - i * SPACING });
    }
    this.drawPath();
    this.drawTierBanners();
    for (let i = 0; i < total; i++) this.makeNode(i + 1);

    this.buildHeader();

    // scrolling
    this.minY = Math.min(0, GAME_H - this.worldH);
    const focus = Math.min(gm.save.unlocked, total) - 1;
    this.setScroll(GAME_H * 0.55 - this.nodePos[focus].y);
    this.moved = 0;
    this.input.on('pointerdown', (p) => {
      this.dragStartY = p.y;
      this.layerStartY = this.layer.y;
      this.moved = 0;
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown) return;
      const dy = p.y - this.dragStartY;
      this.moved = Math.max(this.moved, Math.abs(dy));
      if (this.moved > 8) this.setScroll(this.layerStartY + dy);
    });
    this.input.on('wheel', (_p, _o, _dx, dy) => this.setScroll(this.layer.y - dy));
  }

  setScroll(y) {
    this.layer.y = Phaser.Math.Clamp(y, this.minY, 0);
  }

  drawPath() {
    const g = this.add.graphics();
    const pts = this.nodePos;
    g.lineStyle(20, 0x2e8f6a, 0.35);
    for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1].x, pts[i - 1].y + 4, pts[i].x, pts[i].y + 4);
    g.lineStyle(14, 0xffffff, 0.7);
    for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    this.layer.add(g);
  }

  drawTierBanners() {
    const tiers = [
      { at: 0, label: 'BEGINNER', color: 0x3ed16a },
      { at: 5, label: 'EASY', color: 0x3d8bff },
      { at: 10, label: 'MEDIUM', color: 0xff9a3c },
      { at: 20, label: 'CHALLENGING', color: 0xa566ff },
    ];
    tiers.forEach((t) => {
      const y = t.at === 0 ? this.nodePos[0].y + 78 : (this.nodePos[t.at - 1].y + this.nodePos[t.at].y) / 2;
      this.layer.add(UI.ribbon(this, GAME_W / 2, y, 210, t.label, t.color, 24).setScale(0.85));
    });
  }

  makeNode(id) {
    const { x, y } = this.nodePos[id - 1];
    const level = LevelManager.get(id);
    const unlocked = id <= gm.save.unlocked;
    const stars = gm.save.getStars(id);
    const isCurrent = unlocked && stars === 0;
    const tier = LevelManager.tier(id);
    const r = level.challenge ? 40 : 34;
    const col = !unlocked ? 0x8c96b0 : level.challenge ? 0xa566ff : tier.color;

    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillCircle(0, 7, r + 3);
    g.fillStyle(UI.shade(col, -0.4)).fillCircle(0, 5, r + 3);
    g.fillStyle(0xffffff).fillCircle(0, 0, r + 3);
    g.fillStyle(col).fillCircle(0, 0, r - 2);
    g.fillStyle(0xffffff, 0.3).fillEllipse(0, -r * 0.45, r * 1.1, r * 0.5);
    c.add(g);
    if (unlocked) c.add(UI.text(this, 0, -2, `${id}`, level.challenge ? 34 : 30));
    else c.add(this.add.image(0, -2, 'ic_lock').setDisplaySize(32, 32));

    if (unlocked && (stars > 0 || isCurrent)) {
      for (let i = 0; i < 3; i++) c.add(this.add.image((i - 1) * 24, r + 12 - (i === 1 ? 0 : 5), i < stars ? 'star' : 'star_off').setDisplaySize(24, 24));
    }
    if (level.challenge) c.add(UI.text(this, 0, -r - 14, 'x2', 18, { color: '#ffd23f' }));

    if (isCurrent) {
      const ring = this.add.graphics();
      ring.lineStyle(6, 0xffd23f, 1).strokeCircle(0, 0, r + 9);
      c.add(ring);
      this.tweens.add({ targets: ring, scale: 1.18, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      const arrow = this.add.image(0, -r - 38, 'arrow_down').setScale(0.7);
      c.add(arrow);
      this.tweens.add({ targets: arrow, y: arrow.y - 10, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    c.setSize(r * 2 + 12, r * 2 + 12);
    c.setInteractive({ useHandCursor: unlocked });
    c.on('pointerup', () => {
      if (this.moved > 10) return;
      if (!unlocked) {
        gm.audio.sfx('error');
        this.tweens.add({ targets: c, x: x + 6, duration: 50, yoyo: true, repeat: 2, onComplete: () => (c.x = x) });
        UI.toast(this, 'Finish the previous level to unlock!', 150);
        return;
      }
      gm.audio.sfx('click');
      UI.go(this, 'Game', { levelId: id });
    });
    this.layer.add(c);
  }

  buildHeader() {
    const g = this.add.graphics().setDepth(100);
    g.fillStyle(0x1b2a52, 0.97).fillRect(0, 0, GAME_W, HEADER - 14);
    g.fillStyle(0x3d8bff).fillRect(0, HEADER - 20, GAME_W, 6);
    // swallow taps on the header so nodes scrolled underneath cannot be hit
    this.add.zone(GAME_W / 2, (HEADER - 14) / 2, GAME_W, HEADER - 14).setInteractive().setDepth(101);
    UI.button(this, 48, 52, 58, 58, '', { color: 0xff9a3c, icon: 'back', onClick: () => UI.go(this, 'Menu') }).setDepth(102);
    UI.text(this, GAME_W / 2 - 20, 38, 'LEVELS', 34).setDepth(102);
    UI.text(this, GAME_W / 2 - 20, 74, `${gm.save.totalStars()} / ${LevelManager.count * 3} stars`, 17, { color: '#ffd23f', thick: 3 }).setDepth(102);
    UI.coinCounter(this, GAME_W - 94, 52, 148).setDepth(102);
  }
}

export default LevelSelectScene;
