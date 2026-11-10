import Phaser from 'phaser';
import { GAME_W } from '../config.js';
import { UI } from '../ui/UIManager.js';
import { Bus } from '../objects/Bus.js';

/** Branded loading screen. Preloads the main-menu artwork and shows real loading progress. */
export class LoadingScene extends Phaser.Scene {
  constructor() {
    super('LoadingScene');
  }

  preload() {
    // Background mesh generation setup
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x4cc3ff, 0x4cc3ff, 0x9cd9ff, 0x9cd9ff, 1);
    bg.fillRect(0, 0, 540, 960);

    const barW = 380;
    const barY = 700;
    this.barW = barW;
    this.bar = UI.bar(this, GAME_W / 2, barY, barW, 34, 0xffd23f);
    this.pct = UI.text(this, GAME_W / 2, barY + 48, 'Loading... 0%', 22);
    
    this.bus = new Bus(this, GAME_W / 2 - barW / 2, barY - 52, { uid: 'load', color: 'orange', cap: 4 }).setBaseScale(0.8);
    this.bus.setFilled(4);
    this.tweens.add({ targets: this.bus, y: this.bus.y - 4, duration: 140, yoyo: true, repeat: -1 });

    this.shown = 0; 
    this.real = 0; 
    this.loaded = false;
    
    this.load.on('progress', (v) => (this.real = v));
    this.load.once('complete', () => {
      this.loaded = true;
    });

    // Menu artwork loader
    this.load.image('menu_bg', 'assets/menu_bg.jpg');
  }

  create() {
    UI.enter(this);
    this.loaded = this.loaded || !this.load.isLoading();
    this.elapsed = 0;
    this.started = true;
    this.done = false;
  }

  update(_time, delta) {
    if (this.done || !this.started) return;
    this.elapsed += delta;
    
    const minTime = Phaser.Math.Clamp(this.elapsed / 1000, 0, 1);
    const target = this.loaded ? 1 : Math.min(this.real, 0.95);
    this.shown = Math.min(this.shown + delta / 700, target, minTime);
    
    this.bar.setValue(this.shown);
    this.pct.setText(`Loading... ${Math.round(this.shown * 100)}%`);
    this.bus.x = GAME_W / 2 - this.barW / 2 + this.barW * this.shown;
    
    if (this.shown >= 1) {
      this.done = true;
      this.time.delayedCall(150, () => {
        this.scene.start('MenuScene');
      });
    }
  }
}

export default LoadingScene;
