import Phaser from 'phaser';
import { GAME_W, DAILY_REWARDS, COLOR_NAMES } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { UI, Fx } from '../ui/UIManager.js';
import { Bus } from '../objects/Bus.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    UI.enter(this);
    this.add.image(0, 0, 'bg_menu').setOrigin(0);
    [[80, 90, 0.9, 5200], [390, 60, 0.6, 6400], [300, 330, 0.5, 5800]].forEach(([x, y, s, d]) => {
      const c = this.add.image(x, y, 'cloud').setScale(s).setAlpha(0.85);
      this.tweens.add({ targets: c, x: x + 70, duration: d, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    this.buildTraffic();
    UI.logo(this, GAME_W / 2, 215, 1);

    this.coins = UI.coinCounter(this, GAME_W - 98, 54, 156);

    const lvl = gm.currentLevelId;
    const playBtn = UI.button(this, GAME_W / 2, 500, 330, 104, 'PLAY', { color: 0x3ed16a, icon: 'play', size: 54, onClick: () => UI.go(this, 'Game', { levelId: gm.currentLevelId }) });
    this.tweens.add({ targets: playBtn, scaleX: 1.04, scaleY: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // keep the press animation's base scale in sync with the idle pulse
    UI.text(this, GAME_W / 2, 568, `Level ${lvl}  -  ${gm.save.totalStars()} stars`, 22);

    UI.button(this, GAME_W / 2, 650, 290, 72, 'LEVELS', { color: 0x3d8bff, icon: 'levels', size: 36, onClick: () => UI.go(this, 'LevelSelect') });

    const y = 748;
    UI.iconButton(this, 120, y, 76, 'gear', { color: 0x8c96b0, onClick: () => this.openSettings() });
    this.giftBtn = UI.iconButton(this, 220, y, 76, 'gift', { color: 0xff9a3c, onClick: () => this.openDaily() });
    UI.toggleButton(this, 320, y, 76, 'sound', () => gm.audio.soundOn, (v) => gm.audio.setSound(v), 0x3d8bff);
    UI.toggleButton(this, 420, y, 76, 'music', () => gm.audio.musicOn, (v) => gm.audio.setMusic(v), 0xff7ac8);

    if (gm.save.dailyStatus().available) {
      const dot = this.add.circle(this.giftBtn.x + 28, this.giftBtn.y - 28, 11, 0xff3b4e).setStrokeStyle(3, 0xffffff).setDepth(5);
      this.tweens.add({ targets: dot, scale: 1.3, duration: 500, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: this.giftBtn, angle: 6, duration: 160, yoyo: true, repeat: -1, repeatDelay: 1100 });
      this.dot = dot;
    }
  }

  /** Buses cruising along the road at the bottom. */
  buildTraffic() {
    for (let i = 0; i < 4; i++) {
      const color = COLOR_NAMES[(i * 2 + 1) % COLOR_NAMES.length];
      const bus = new Bus(this, -150, 850 + (i % 2) * 40, { uid: `m${i}`, color, cap: 3 + (i % 3) }).setBaseScale(0.95);
      bus.setFilled(2 + (i % 3));
      this.tweens.add({ targets: bus, x: GAME_W + 160, duration: 9000 + i * 1300, delay: i * 2300, repeat: -1, onRepeat: () => (bus.x = -150) });
      this.tweens.add({ targets: bus, y: bus.y - 3, duration: 160 + i * 20, yoyo: true, repeat: -1 });
    }
  }

  openSettings() {
    const d = UI.dialog(this, { title: 'SETTINGS', w: 440, h: 480 });
    const c = d.c;
    const row = (label, yy, icon, get, set, color) => {
      c.add(UI.text(this, -150, yy, label, 30, { color: '#1b2a52', stroke: '#ffffff', thick: 0, ox: 0 }));
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
    c.add(UI.text(this, 0, 175, 'BUS COLOR JAM  v1.0', 20, { color: '#6b7699', stroke: '#ffffff', thick: 0 }));
    c.add(UI.text(this, 0, 202, 'Original art & sound, made with Phaser 3', 16, { color: '#8c96b0', stroke: '#ffffff', thick: 0 }));
  }

  openDaily() {
    const status = gm.save.dailyStatus();
    const d = UI.dialog(this, { title: 'DAILY REWARD', w: 460, h: 540 });
    const c = d.c;
    c.add(UI.text(this, 0, -190, status.available ? 'Your gift is ready!' : 'Come back tomorrow!', 28, { color: '#1b2a52', stroke: '#ffffff', thick: 0 }));

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
      c.add(UI.text(this, x, yy - 34, `DAY ${i + 1}`, 17, { color: '#1b2a52', stroke: '#ffffff', thick: 0 }));
      c.add(this.add.image(x, yy + 2, 'coin').setScale(i === 6 ? 1.4 : 1.1));
      c.add(UI.text(this, x, yy + 38, `${amount}`, 22, { thick: 4 }));
      if (done) c.add(this.add.image(x + 26, yy - 40, 'ic_check').setDisplaySize(24, 24).setTint(0xffffff));
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
        if (this.dot) this.dot.destroy();
        this.giftBtn.setAngle(0);
        this.tweens.killTweensOf(this.giftBtn);
      },
    });
    claim.setDisabled(!status.available);
    c.add(claim);
  }
}

export default MenuScene;
