import Phaser from 'phaser';
import { GAME_W, GAME_H, DAILY_REWARDS } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { UI, Fx } from '../ui/UIManager.js';
import { openSpinPanel } from '../ui/SpinPanel.js';
import { openSettingsPanel } from '../ui/SettingsPanel.js';

// The menu artwork (public/assets/menu_bg.jpg) is 941 x 1672 px. Hit areas below are written in
// IMAGE pixels, so you can tune them straight from an image editor; they are scaled to 540 x 960.
const IMG_W = 941;
const IMG_H = 1672;
const KX = GAME_W / IMG_W;
const KY = GAME_H / IMG_H;

// [name, centreX, centreY, width, height] in image pixels
const HITBOXES = {
  settings:     [80, 78, 110, 110],
  play:         [470, 1082, 625, 180],
  spin:         [130, 1435, 185, 175],
  daily:        [366, 1435, 185, 175],
  sound:        [594, 1435, 185, 175],
  about:        [818, 1435, 185, 175],
};

const rad = (d) => (d * Math.PI) / 180;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    UI.enter(this);

    // full-screen artwork stretched to the 540x960 design resolution
    const key = this.textures.exists('menu_bg') ? 'menu_bg' : 'bg_menu'; // generated fallback if the file is missing
    this.add.image(0, 0, key).setOrigin(0).setDisplaySize(GAME_W, GAME_H);

    this.buildCoinReadout();

    this.hit('settings', () => this.openSettings(), 'round');
    this.hit('play', () => UI.go(this, 'Game', { levelId: gm.currentLevelId }), 'pill');
    this.hit('spin', () => this.openSpin(), 'round');
    this.hit('daily', () => this.openDaily(), 'round');
    this.hit('sound', () => this.toggleSound(), 'round');
    this.hit('about', () => this.openAbout(), 'round');

    this.buildLevelLabel();
    this.buildSpinTile();
    this.buildCheckInLabel();
    this.refreshBadges();
  }

  // ---- helpers: image pixels -> game pixels
  px(x) { return x * KX; }
  py(y) { return y * KY; }

  /** The big green button shows the level the player is about to play ("LEVEL 7"). */
  buildLevelLabel() {
    const t = UI.text(this, this.px(538), this.py(1074), `LEVEL ${gm.currentLevelId}`, 34, { thick: 6, stroke: '#1d6a05' });
    const maxW = this.px(285);
    let size = 34;
    while (t.width > maxW && size > 12) { size -= 2; t.setFontSize(size); }
    this.levelTxt = t;
    this.tweens.add({ targets: t, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Lucky Spin button (artwork public/assets/menu_spin.png; the old painted Achievements button was removed from menu_bg.jpg). */
  buildSpinTile() {
    if (this.textures.exists('menu_spin')) {
      const img = this.add.image(this.px(130), this.py(1436), 'menu_spin');
      const w = this.px(204);
      img.setDisplaySize(w, w * (img.height / img.width));
      this.spinBtn = img;
      this.tweens.add({ targets: img, scaleX: img.scaleX * 1.04, scaleY: img.scaleY * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }
    // fallback (artwork missing): simple painted tile
    const g = this.add.graphics();
    const cx = this.px(131.5);
    const cy = this.py(1409);
    const w = this.px(158);
    const h = this.py(129);
    g.fillStyle(0x1b2a6b, 1).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 24);
    g.fillStyle(0x9b5cff, 1).fillRoundedRect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6, 21);
    this.plate(this.px(130), this.py(1493), this.px(170), 'LUCKY SPIN', 17);
  }

  buildCheckInLabel() {
    this.plate(this.px(366), this.py(1493), this.px(160), 'CHECK IN', 18);
  }

  /** Paints over the text on a painted label plate and writes `str` instead. */
  plate(x, y, w, str, size) {
    const g = this.add.graphics();
    g.fillStyle(0x1f3763, 1).fillRoundedRect(x - w / 2, y - this.py(15), w, this.py(30), 6);
    const t = UI.text(this, x, y, str, size, { thick: 4 });
    const maxW = w - 6;
    let sz = size;
    while (t.width > maxW && sz > 8) { sz -= 1; t.setFontSize(sz); }
    return t;
  }

  /** Red "!" bubble on the top-right corner of a button. */
  makeBadge(x, y) {
    const c = this.add.container(x, y).setDepth(20);
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1).fillCircle(0, 0, 15);
    g.fillStyle(0xe5202f, 1).fillCircle(0, 0, 12.5);
    c.add(g);
    c.add(UI.text(this, 0, -1, '!', 20, { thick: 3 }));
    this.tweens.add({ targets: c, scale: 1.18, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  }

  /** Shows/hides the red "!" marks: Check In while today's gift is unclaimed, Lucky Spin while a free spin is waiting. */
  refreshBadges() {
    const showDaily = gm.save.dailyStatus().available;
    if (showDaily && !this.dailyBadge) this.dailyBadge = this.makeBadge(this.px(427.5), this.py(1363));
    if (!showDaily && this.dailyBadge) { this.dailyBadge.destroy(); this.dailyBadge = null; }
    const showSpin = gm.freeSpins > 0;
    if (showSpin && !this.spinBadge) this.spinBadge = this.makeBadge(this.px(208), this.py(1352));
    if (!showSpin && this.spinBadge) { this.spinBadge.destroy(); this.spinBadge = null; }
  }

  openSpin() {
    openSpinPanel(this, { onChange: () => this.refreshBadges() });
  }

  /** Invisible, clickable area over a button that is painted on the artwork. */
  hit(name, onClick, shape) {
    const [cx, cy, w, h] = HITBOXES[name];
    const x = cx * KX;
    const y = cy * KY;
    const zw = w * KX;
    const zh = h * KY;
    const zone = this.add.zone(x, y, zw, zh).setInteractive({ useHandCursor: true });
    let down = false;
    // soft white flash gives press feedback although the button itself is a picture
    const flash = this.add.graphics({ x, y }).setAlpha(0);
    flash.fillStyle(0xffffff, 0.28);
    if (shape === 'pill') flash.fillRoundedRect(-zw / 2, -zh / 2, zw, zh, zh / 2);
    else flash.fillRoundedRect(-zw / 2, -zh / 2, zw, zh, 22);
    zone.on('pointerdown', () => {
      down = true;
      flash.setAlpha(1);
    });
    const up = () => {
      down = false;
      this.tweens.add({ targets: flash, alpha: 0, duration: 160 });
    };
    zone.on('pointerout', () => down && up());
    zone.on('pointerup', () => {
      if (!down) return;
      up();
      gm.audio.sfx('click');
      onClick();
    });
    return zone;
  }

  /** The artwork shows a fixed "100"; cover it and print the player's real coin balance. */
  buildCoinReadout() {
    const cx = 796 * KX;
    const cy = 62 * KY;
    const patch = this.add.graphics();
    patch.fillStyle(0x042a57, 1).fillRoundedRect(740 * KX, 36 * KY, 112 * KX, 52 * KY, 8);
    const text = UI.text(this, cx, cy, String(gm.coins), 22, { thick: 4 });
    this.coins = {
      x: cx + 50, // coin icon sits ~50px left of this point (used as the coin-fly target)
      y: cy,
      setValue: (v) => text.setText(String(v)),
    };
    const off = gm.onCoins((v) => this.coins.setValue(v));
    this.events.once('shutdown', off);
  }

  toggleSound() {
    const on = !(gm.audio.soundOn || gm.audio.musicOn);
    gm.audio.setSound(on);
    gm.audio.setMusic(on);
    if (on) gm.audio.sfx('click');
    UI.toast(this, on ? 'Sound & music ON' : 'Sound & music OFF', 130);
  }

  // ------------------------------------------------------------------ dialogs
  darkText(x, y, str, size, o = {}) {
    return UI.text(this, x, y, str, size, { color: '#1b2a52', stroke: '#ffffff', thick: 0, ...o });
  }

  openSettings() {
    openSettingsPanel(this);
  }

  openAbout() {
    const d = UI.dialog(this, { title: 'ABOUT', w: 440, h: 440 });
    const c = d.c;
    c.add(this.darkText(0, -110, 'BUS COLOR JAM', 34));
    c.add(this.darkText(0, -60, 'Sort - Match - Clear the Buses!', 20, { color: '#6b7699' }));
    c.add(
      this.darkText(0, 30, 'Park the buses, let the passengers\nboard their colour, and clear the\ntraffic jam. Plan your parking slots\ncarefully!', 22, { align: 'center' }),
    );
    c.add(this.darkText(0, 150, 'Made with Phaser 3  -  v2.0 - 3D', 18, { color: '#8c96b0' }));
  }

  openDaily() {
    const status = gm.save.dailyStatus();
    const d = UI.dialog(this, { title: 'CHECK IN', w: 460, h: 540 });
    const c = d.c;
    c.add(this.darkText(0, -190, status.available ? 'Your gift is ready!' : 'Come back tomorrow!', 28));

    const claimedUpTo = status.available ? status.day - 1 : status.day;
    DAILY_REWARDS.forEach((amount, i) => {
      const col = i % 4;
      const rowI = Math.floor(i / 4);
      const perRow = rowI === 0 ? 4 : 3;
      const x = (col - (perRow - 1) / 2) * 98;
      const yy = -105 + rowI * 124;
      const isToday = status.available && i === status.day;
      const done = i <= claimedUpTo;
      const g = this.add.graphics();
      const base = done ? 0x3ed16a : isToday ? 0xffc933 : 0xdde3f0;
      g.fillStyle(UI.shade(base, -0.25)).fillRoundedRect(x - 42, yy - 52 + 4, 84, 108, 16);
      g.fillStyle(base).fillRoundedRect(x - 42, yy - 52, 84, 104, 16);
      c.add(g);
      c.add(this.darkText(x, yy - 34, `DAY ${i + 1}`, 17));
      c.add(this.add.image(x, yy + 2, 'coin').setScale(i === 6 ? 1.4 : 1.1));
      c.add(UI.text(this, x, yy + 38, `${amount}`, 22, { thick: 4 }));
      if (done) c.add(this.add.image(x + 26, yy - 40, 'ic_check').setDisplaySize(24, 24));
      if (isToday) this.tweens.add({ targets: g, alpha: 0.6, duration: 450, yoyo: true, repeat: -1 });
    });

    const claim = UI.button(this, 0, 195, 300, 72, status.available ? `CLAIM ${status.reward}` : 'CLAIMED', {
      color: status.available ? 0x3ed16a : 0x8c96b0,
      size: 34,
      onClick: () => {
        if (!status.available) return;
        const prev = gm.coins;
        const res = gm.claimDaily();
        if (!res) return;
        claim.setDisabled(true);
        claim.label.setText('CLAIMED');
        this.refreshBadges(); // the red "!" goes away as soon as check-in is done
        this.coins.setValue(prev);
        const per = Math.ceil(res.reward / 8);
        let shown = prev;
        Fx.coinFly(this, GAME_W / 2, 480, { x: this.coins.x - 50, y: this.coins.y }, 8, () => {
          shown = Math.min(gm.coins, shown + per);
          this.coins.setValue(shown);
        });
        this.time.delayedCall(1700, () => {
          this.coins.setValue(gm.coins);
          d.close();
        });
      },
    });
    claim.setDisabled(!status.available);
    c.add(claim);
  }
}

export default MenuScene;
