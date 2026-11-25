import Phaser from 'phaser';
import { generateAllTextures } from '../ui/TextureFactory.js';
import { gm } from '../systems/GameManager.js';

const SPLASH_MS = 2500; // RJ GAMES logo, from app start
const SPLASH2_MS = 3000; // then the BUS COLOR JAM artwork with a loading bar, before the fade-out onto the game

/** Fills the splash loading bar from 0 to 100 % in `ms` milliseconds. */
function runLoadBar(splash, ms) {
  const fill = splash.querySelector('.loadbar .fill');
  const pct = splash.querySelector('.loadbar .pct');
  if (!fill || !pct) return;
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // ease in-out, feels like real loading
    const v = Math.round(e * 100);
    fill.style.width = `${v}%`;
    pct.textContent = v >= 100 ? 'READY!' : `LOADING ${v}%`;
    if (k < 1 && splash.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Generates all procedural textures once, wires global audio unlock, then hands over to the loader. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    generateAllTextures(this);
    // Browsers only allow audio after a user gesture: unlock on the first touch / click / key.
    const unlock = () => gm.audio.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard?.on('keydown', unlock);
    this.game.events.once('destroy', () => gm.audio.destroy());

    // Splash (index.html): RJ GAMES for SPLASH_MS, then BUS COLOR JAM with a loading bar for SPLASH2_MS, then a smooth fade-out.
    const splash = document.getElementById('boot-splash');
    if (splash) {
      const shown = Date.now() - (window.__splashT0 || Date.now());
      window.setTimeout(() => {
        splash.classList.add('stage2');
        runLoadBar(splash, SPLASH2_MS * 0.9); // full a moment before the fade starts
        window.setTimeout(() => {
          splash.classList.add('hide');
          window.setTimeout(() => splash.remove(), 1000);
        }, SPLASH2_MS);
      }, Math.max(0, SPLASH_MS - shown));
    }
    this.scene.start('Loading');
  }
}

export default BootScene;
