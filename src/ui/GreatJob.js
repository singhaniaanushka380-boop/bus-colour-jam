import { GAME_W, GAME_H } from '../config.js';
import { UI, Fx } from './UIManager.js';
import { gm } from '../systems/GameManager.js';

// "GREAT JOB!" celebration popup: 9-frame animation (public/assets/great_job.png, a 3x3 sheet of 512x341 frames)
// that pops up when a level is completed. Below it: the coins won and a NEXT button, which opens the Level Complete screen.
const W = 440; // on-screen width in the 540x960 design space

/** Shows the popup with the coins won (`coins`). Resolves when NEXT was pressed. Resolves false at once if the picture is missing. */
export function showGreatJob(scene, opts = {}) {
  // a problem with the popup must never block the Level Complete screen
  try { return build(scene, opts); } catch (e) { console.warn('GreatJob popup failed', e); return Promise.resolve(false); }
}

function build(scene, { coins = 0 } = {}) {
  if (!scene.textures.exists('great_job')) return Promise.resolve(false);
  if (!scene.anims.exists('great_job_loop')) {
    scene.anims.create({
      key: 'great_job_loop',
      frames: scene.anims.generateFrameNumbers('great_job', { start: 0, end: 8 }),
      frameRate: 1000 / 180,
      repeat: -1,
    });
  }
  return new Promise((resolve) => {
    const root = scene.add.container(0, 0).setDepth(1500);
    const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0b1230, 0.6).setInteractive().setAlpha(0);
    root.add(dim);
    const spr = scene.add.sprite(GAME_W / 2, GAME_H / 2 - 130, 'great_job', 0);
    const k = W / 512;
    spr.setScale(k * 0.4).setAlpha(0);
    spr.play('great_job_loop');
    root.add(spr);

    // coins won
    const plate = scene.add.container(GAME_W / 2, GAME_H / 2 + 100).setScale(0).setAlpha(0);
    const bg = scene.add.graphics();
    bg.fillStyle(0x1b2a52, 0.92).fillRoundedRect(-130, -38, 260, 76, 38);
    bg.lineStyle(4, 0xffd23f, 1).strokeRoundedRect(-130, -38, 260, 76, 38);
    plate.add(bg);
    plate.add(scene.add.image(-76, 0, 'coin').setScale(1.35));
    const amount = UI.text(scene, 26, 0, '+0', 50, { color: '#ffd23f', thick: 8 });
    plate.add(amount);
    root.add(plate);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      gm.audio.sfx('click');
      scene.tweens.add({ targets: [spr, plate, next], alpha: 0, duration: 160 });
      scene.tweens.add({ targets: dim, alpha: 0, duration: 160, onComplete: () => { root.destroy(); resolve(true); } });
    };
    const next = UI.button(scene, GAME_W / 2, GAME_H / 2 + 210, 300, 80, 'NEXT', { color: 0x3ed16a, icon: 'play', size: 38, onClick: finish });
    next.setAlpha(0);
    root.add(next);

    scene.tweens.add({ targets: dim, alpha: 0.6, duration: 200 });
    scene.tweens.add({ targets: spr, scale: k, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: plate, scale: 1, alpha: 1, duration: 360, delay: 450, ease: 'Back.easeOut' });
    // the amount counts up
    const counter = { v: 0 };
    scene.tweens.add({
      targets: counter, v: coins, duration: 700, delay: 600, ease: 'Cubic.easeOut',
      onUpdate: () => amount.setText(`+${Math.round(counter.v)}`),
      onComplete: () => { amount.setText(`+${coins}`); Fx.burst(scene, GAME_W / 2, GAME_H / 2 + 100, { color: 0xffd23f, count: 14, speed: 120 }); },
    });
    scene.tweens.add({ targets: next, alpha: 1, duration: 260, delay: 800 });
    scene.tweens.add({ targets: next, scaleX: 1.05, scaleY: 1.05, duration: 650, yoyo: true, repeat: -1, delay: 1200 });
    scene.events.once('shutdown', () => { done = true; resolve(false); });
  });
}
