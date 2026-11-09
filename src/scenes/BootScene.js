import Phaser from 'phaser';
import { TextureFactory } from '../ui/TextureFactory.js';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Game shuru hone ke zaroori assets yahan load hote hain
    }

    create() {
        TextureFactory.initialize(this);
        this.scene.start('LoadingScene');
    }
}
