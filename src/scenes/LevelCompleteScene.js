import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { LevelManager } from '../systems/LevelManager.js';
import { UI, Fx } from '../ui/UIManager.js';

/** Victory screen: animated stars, coin payout that flies into the wallet, next-level button. */
export class LevelCompleteScene extends Phaser.Scene {
  constructor() {
    super('LevelComplete');
  }

  init(data) {
    this.levelId = data?.levelId || 1;
    this.stars = data?.stars || 1;
    this.result = data?.result || { reward: { total: 0, base: 0, starBonus: 0, perfect: 0 }, prevCoins: gm.coins };
  }

  create() {
    UI.enter(this);
    (this.result.achievements || []).forEach((a, i) => this.time.delayedCall(1400 + i * 1900, () => { gm.audio.sfx('unlock'); UI.toast(this, `Achievement: ${a.name}  +${a.coins}`, 150); }));
    const level = LevelManager.get(this.levelId);
    const reward = this.result.reward;
    this.add.image(0, 0, 'bg_menu').setOrigin(0);
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0b1230, 0.45);

    this.coins = UI.coinCounter(this, GAME_W - 98, 54, 156).setDepth(50);
    this.coins.setValue(this.result.prevCoins);

    const cy = 470;
    const card = UI.card(this, GAME_W / 2, cy, 460, 700);
    card.setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' });

    const ribbon = UI.ribbon(this, GAME_W / 2, cy - 350, 360, 'LEVEL COMPLETE!', 0x3ed16a, 32).setScale(0);
    this.tweens.add({ targets: ribbon, scale: 1, duration: 380, delay: 200, ease: 'Back.easeOut' });

    UI.text(this, GAME_W / 2, cy - 270, `Level ${level.id} - ${level.name}`, 26, { color: '#1b2a52', stroke: '#ffffff', thick: 0 });

    // stars
    const pos = [[-112, 18], [0, -6], [112, 18]];
    const starImgs = pos.map(([dx, dy]) => {
      const off = this.add.image(GAME_W / 2 + dx, cy - 170 + dy, 'star_off').setDisplaySize(dx === 0 ? 124 : 100, dx === 0 ? 124 : 100);
      return off;
    });
    for (let i = 0; i < this.stars; i++) {
      this.time.delayedCall(700 + i * 480, () => {
        const [dx, dy] = pos[i];
        const sz = dx === 0 ? 124 : 100;
        const s = this.add.image(GAME_W / 2 + dx, cy - 170 + dy, 'star').setDisplaySize(sz * 2.2, sz * 2.2).setAlpha(0).setAngle(-40);
        this.tweens.add({ targets: s, displayWidth: sz, displayHeight: sz, alpha: 1, angle: 0, duration: 380, ease: 'Back.easeOut' });
        gm.audio.sfx('star', i);
        Fx.burst(this, s.x, s.y, { color: 0xffe680, count: 14, speed: 90, depth: 60 });
        Fx.ring(this, s.x, s.y, 0xffd23f, 60);
        starImgs[i].setAlpha(0.6);
      });
    }

    const afterStars = 700 + this.stars * 480 + 200;
    this.time.delayedCall(700, () => { gm.audio.sfx('win'); Fx.confetti(this, 80); });

    // payout
    const lines = [];
    const add = (label, v) => lines.push([label, v]);
    add('Level reward', reward.base);
    add(`${this.stars} star${this.stars > 1 ? 's' : ''}`, reward.starBonus);
    if (reward.perfect) add('PERFECT bonus!', reward.perfect);
    const group = this.add.container(GAME_W / 2, cy - 40).setAlpha(0);
    lines.forEach(([label, v], i) => {
      group.add(UI.text(this, -150, i * 32, label, 22, { color: '#1b2a52', stroke: '#ffffff', thick: 0, ox: 0 }));
      group.add(UI.text(this, 150, i * 32, `+${v}`, 22, { color: '#d98a00', stroke: '#ffffff', thick: 0, ox: 1 }));
    });
    if (reward.challenge) {
      const yy = lines.length * 32;
      group.add(UI.text(this, -150, yy, 'CHALLENGE  x2', 22, { color: '#7b3fd6', stroke: '#ffffff', thick: 0, ox: 0 }));
    }
    this.tweens.add({ targets: group, alpha: 1, duration: 300, delay: afterStars });

    const totalY = cy + 100;
    const totalRow = this.add.container(GAME_W / 2, totalY).setScale(0);
    totalRow.add(this.add.image(-64, 0, 'coin').setScale(1.6));
    totalRow.add(UI.text(this, 14, 0, `+${reward.total}`, 56, { color: '#ffd23f' }));
    this.tweens.add({ targets: totalRow, scale: 1, duration: 360, delay: afterStars + 300, ease: 'Back.easeOut' });

    this.time.delayedCall(afterStars + 750, () => {
      const per = Math.max(1, Math.ceil(reward.total / 10));
      let shown = this.result.prevCoins;
      Fx.coinFly(this, GAME_W / 2, totalY, { x: this.coins.x - 50, y: this.coins.y }, 10, () => {
        shown = Math.min(gm.coins, shown + per);
        this.coins.setValue(shown);
      });
      this.time.delayedCall(2000, () => this.coins.setValue(gm.coins));
    });

    // buttons
    const hasNext = LevelManager.hasNext(this.levelId);
    const nextBtn = UI.button(this, GAME_W / 2, cy + 200, 330, 84, hasNext ? 'CONTINUE' : 'ALL LEVELS', {
      color: 0x3ed16a,
      icon: 'play',
      size: 36,
      onClick: () => (hasNext ? UI.go(this, 'Game', { levelId: this.levelId + 1 }) : UI.go(this, 'LevelSelect')),
    });
    nextBtn.setAlpha(0);
    this.tweens.add({ targets: nextBtn, alpha: 1, duration: 300, delay: afterStars + 400 });
    this.tweens.add({ targets: nextBtn, scaleX: 1.04, scaleY: 1.04, duration: 650, yoyo: true, repeat: -1, delay: afterStars + 800 });

    const small = [
      ['restart', 0xff9a3c, () => UI.go(this, 'Game', { levelId: this.levelId })],
      ['levels', 0x3d8bff, () => UI.go(this, 'LevelSelect')],
      ['home', 0xa566ff, () => UI.go(this, 'Menu')],
    ];
    small.forEach(([icon, color, fn], i) => {
      const b = UI.iconButton(this, GAME_W / 2 + (i - 1) * 96, cy + 288, 70, icon, { color, onClick: fn }).setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, duration: 300, delay: afterStars + 500 });
    });

    if (!hasNext) {
      UI.text(this, GAME_W / 2, cy + 340, 'You cleared every level! More coming soon.', 17, { color: '#1b2a52', stroke: '#ffffff', thick: 0 });
    }
  }
}

export default LevelCompleteScene;
