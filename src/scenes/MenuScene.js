import Phaser from 'phaser';
import { GAME_W, GAME_H, DAILY_REWARDS } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { LevelManager } from '../systems/LevelManager.js';
import { UI, Fx } from '../ui/UIManager.js';

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
  levels:       [471, 1255, 570, 120],
  achievements: [130, 1435, 185, 175],
  daily:        [366, 1435, 185, 175],
  sound:        [594, 1435, 185, 175],
  about:        [818, 1435, 185, 175],
};

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

    const go = (scene, data) => () => UI.go(this, scene, data);
    this.hit('settings', () => this.openSettings(), 'round');
    this.hit('play', () => UI.go(this, 'Game', { levelId: gm.currentLevelId }), 'pill');
    this.hit('levels', go('LevelSelect'), 'pill');
    this.hit('achievements', () => this.openAchievements(), 'round');
    this.hit('daily', () => this.openDaily(), 'round');
    this.hit('sound', () => this.toggleSound(), 'round');
    this.hit('about', () => this.openAbout(), 'round');
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
    const d = UI.dialog(this, { title: 'SETTINGS', w: 440, h: 480 });
    const c = d.c;
    const row = (label, yy, icon, get, set, color) => {
      c.add(this.darkText(-150, yy, label, 30, { ox: 0 }));
      c.add(UI.toggleButton(this, 140, yy, 70, icon, get, set, color));
    };
    row('Sound', -110, 'sound', () => gm.audio.soundOn, (v) => gm.audio.setSound(v), 0x3d8bff);
    row('Music', -20, 'music', () => gm.audio.musicOn, (v) => gm.audio.setMusic(v), 0xff7ac8);

    let armed = false;
    const reset = UI.button(this, 0, 90, 320, 64, 'RESET PROGRESS', { color: 0xff4d5e, size: 26 });
    reset.on('pointerup', () => {
      if (!armed) {
        armed = true;
        reset.label.setText('TAP AGAIN TO CONFIRM');
        reset.label.setFontSize(20);
        this.time.delayedCall(2500, () => {
          armed = false;
          if (reset.label && reset.scene) {
            reset.label.setText('RESET PROGRESS');
            reset.label.setFontSize(26);
          }
        });
      } else {
        gm.save.reset();
        gm.audio.setSound(true);
        gm.audio.setMusic(true);
        d.close(true);
        UI.go(this, 'Menu');
      }
    });
    c.add(reset);
    c.add(this.darkText(0, 175, 'BUS COLOR JAM  v1.0', 20, { color: '#6b7699' }));
  }

  openAchievements() {
    const d = UI.dialog(this, { title: 'ACHIEVEMENTS', w: 460, h: 520 });
    const c = d.c;
    const s = gm.save;
    const total = LevelManager.count;
    const cleared = Object.values(s.data.levels).filter((l) => l.stars > 0).length;
    const perfect = Object.values(s.data.levels).filter((l) => l.stars === 3).length;
    const rows = [
      ['Levels cleared', `${cleared} / ${total}`],
      ['Total stars', `${s.totalStars()} / ${total * 3}`],
      ['Perfect levels', `${perfect}`],
      ['Games won', `${s.data.stats.wins}`],
      ['Traffic jams', `${s.data.stats.fails}`],
      ['Coins', `${s.coins}`],
    ];
    rows.forEach(([label, value], i) => {
      const y = -150 + i * 62;
      const g = this.add.graphics();
      g.fillStyle(i % 2 ? 0xf1f4fa : 0xe3ebfa).fillRoundedRect(-190, y - 26, 380, 52, 14);
      c.add(g);
      c.add(this.darkText(-170, y, label, 24, { ox: 0 }));
      c.add(this.darkText(170, y, value, 26, { ox: 1, color: '#d98a00' }));
    });
  }

  openAbout() {
    const d = UI.dialog(this, { title: 'ABOUT', w: 440, h: 440 });
    const c = d.c;
    c.add(this.darkText(0, -110, 'BUS COLOR JAM', 34));
    c.add(this.darkText(0, -60, 'Sort - Match - Clear the Buses!', 20, { color: '#6b7699' }));
    c.add(
      this.darkText(0, 30, 'Park the buses, let the passengers\nboard their colour, and clear the\ntraffic jam. Plan your parking slots\ncarefully!', 22, { align: 'center' }),
    );
    c.add(this.darkText(0, 150, 'Made with Phaser 3  -  v1.0', 18, { color: '#8c96b0' }));
  }

  openDaily() {
    const status = gm.save.dailyStatus();
    const d = UI.dialog(this, { title: 'DAILY REWARD', w: 460, h: 540 });
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
