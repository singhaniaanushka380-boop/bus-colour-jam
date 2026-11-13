import Phaser from 'phaser';
import { GAME_W, GAME_H } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { LoadingScene } from './scenes/LoadingScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { LevelCompleteScene } from './scenes/LevelCompleteScene.js';

/** Creates the Phaser game. The 540x960 design space is scaled to fit every screen (phones, tablets, desktops). */
export function createGame(parent) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_W,
    height: GAME_H,
    transparent: true, // the 3D (Three.js) canvas sits behind the Phaser canvas during gameplay
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: { antialias: true, powerPreference: 'high-performance' },
    input: { activePointers: 2 },
    banner: false,
    scene: [BootScene, LoadingScene, MenuScene, LevelSelectScene, GameScene, LevelCompleteScene],
  });
}
