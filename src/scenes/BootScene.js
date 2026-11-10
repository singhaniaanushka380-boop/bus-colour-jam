import Phaser from 'phaser';
import { generateAllTextures } from '../ui/TextureFactory.js';
import { gm } from '../systems/GameManager.js';

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

    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.classList.add('hide');
      window.setTimeout(() => splash.remove(), 500);
    }
    this.scene.start('Loading');
  }
}

export default BootScene;
