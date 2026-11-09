import Phaser from 'phaser';
import { GAME_W, GAME_H } from '../config.js';
import { UI } from '../ui/UIManager.js';
import { Bus } from '../objects/Bus.js';

/** Branded loading screen with an animated progress bar. (All art is generated, so this is a short, smooth intro.) */
export class LoadingScene extends Phaser.Scene {
  constructor() {
    super('Loading');
  }

  create() {
    UI.enter(this);
    this.add.image(0, 0, 'bg_menu').setOrigin(0);
    [[90, 120, 1], [380, 80, 0.7], [250, 300, 0.55]].forEach(([x, y, s], i) => {
      const c = this.add.image(x, y, 'cloud').setScale(s).setAlpha(0.85);
      this.tweens.add({ targets: c, x: x + 60, duration: 4000 + i * 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    UI.logo(this, GAME_W / 2, 250, 1);

    // bus drives along the bar
    const barW = 380;
    const barY = 700;
    this.bar = UI.bar(this, GAME_W / 2, barY, barW, 34, 0xffd23f);
    this.pct = UI.text(this, GAME_W / 2, barY + 48, 'Loading... 0%', 22);
    this.bus = new Bus(this, GAME_W / 2 - barW / 2, barY - 52, { uid: 'load', color: 'orange', cap: 4 }).setBaseScale(0.8);
    this.bus.setFilled(4);

    const progress = { v: 0 };
    this.tweens.add({
      targets: progress,
      v: 1,
      duration: 1500,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        this.bar.setValue(progress.v);
        this.pct.setText(`Loading... ${Math.round(progress.v * 100)}%`);
        this.bus.x = GAME_W / 2 - barW / 2 + barW * progress.v;
      },
      onComplete: () => this.time.delayedCall(150, () => UI.go(this, 'Menu')),
    });
    this.tweens.add({ targets: this.bus, y: this.bus.y - 4, duration: 140, yoyo: true, repeat: -1 });
  }
}

export default LoadingScene;
