import { GAME_W, GAME_H } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { UI } from './UIManager.js';

// Pause popup artwork: public/assets/pause_panel.png (1127 x 1260 art pixels, (0,0) of the container = its centre).
const ART_W = 1127;
const ART_H = 1260;
const ax = (x) => x - ART_W / 2;
const ay = (y) => y - ART_H / 2;
const PANEL_W = 450; // on-screen width in the 540x960 design space
const SC = PANEL_W / ART_W;

const ZONES = {
  resume: [240, 425, 975, 570],
  restart: [240, 590, 975, 725],
  levels: [240, 745, 975, 870],
  menu: [240, 885, 975, 1015],
  soundOn: [255, 1040, 610, 1185],
  soundOff: [615, 1040, 970, 1185],
};
const CLOSE = { x: 1030, y: 235, r: 70 };
const PILL = { x: 615, y: 376, w: 520 };

/**
 * Opens the pause popup. Same actions as the old one: Resume, Restart, Levels, Menu and Sound ON / OFF.
 * Returns { close } or null when the artwork is not loaded (the caller then shows the old popup).
 */
export function openPausePanel(scene, { levelText, onClose, onRestart }) {
  if (!scene.textures.exists('pause_panel')) return null;
  const root = scene.add.container(0, 0).setDepth(1000);
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0b1230, 0.72).setInteractive();
  root.add(dim);
  const c = scene.add.container(GAME_W / 2, GAME_H / 2 - 10).setScale(0.6 * SC).setAlpha(0);
  root.add(c);
  c.add(scene.add.image(0, 0, 'pause_panel').setDisplaySize(ART_W, ART_H));

  // "Level 31 - Metro Stop": the level number in yellow, the name in white
  const [lv, ...rest] = levelText.split(' - ');
  const t1 = UI.text(scene, 0, ay(PILL.y), lv, 50, { color: '#ffd21a', thick: 8 }).setOrigin(0, 0.5);
  const t2 = UI.text(scene, 0, ay(PILL.y), rest.length ? `- ${rest.join(' - ')}` : '', 50, { thick: 8 }).setOrigin(0, 0.5);
  const gap = 18;
  const total = t1.width + (t2.text ? gap + t2.width : 0);
  const k = Math.min(1, PILL.w / total);
  t1.setScale(k); t2.setScale(k);
  const left = ax(PILL.x) - (total * k) / 2;
  t1.setX(left);
  t2.setX(left + (t1.width + gap) * k);
  c.add([t1, t2]);

  // the sound button that is NOT active is dimmed
  const dimOn = scene.add.graphics();
  const dimOff = scene.add.graphics();
  c.add([dimOn, dimOff]);
  const shade = (g, z, on) => {
    g.clear();
    if (!on) return;
    const [x0, y0, x1, y1] = z;
    g.fillStyle(0x0b1230, 0.55).fillRoundedRect(ax(x0), ay(y0), x1 - x0, y1 - y0, 60);
  };
  const refreshSound = () => {
    shade(dimOn, ZONES.soundOn, !gm.audio.soundOn);
    shade(dimOff, ZONES.soundOff, gm.audio.soundOn);
  };

  let closing = false;
  const close = (instant = false) => {
    if (closing) return;
    closing = true;
    scene.input.keyboard?.off('keydown-ESC', onEsc);
    if (onClose) onClose();
    if (instant) { root.destroy(); return; }
    scene.tweens.add({ targets: c, scale: 0.6 * SC, alpha: 0, duration: 150, ease: 'Back.easeIn' });
    scene.tweens.add({ targets: dim, alpha: 0, duration: 150, onComplete: () => root.destroy() });
  };
  const onEsc = () => close();
  scene.input.keyboard?.on('keydown-ESC', onEsc);

  const zone = (z, fn) => {
    const [x0, y0, x1, y1] = z;
    const zn = scene.add.zone(ax((x0 + x1) / 2), ay((y0 + y1) / 2), x1 - x0, y1 - y0).setInteractive({ useHandCursor: true });
    zn.on('pointerup', () => { gm.audio.sfx('click'); fn(); });
    c.add(zn);
  };
  zone(ZONES.resume, () => close());
  zone(ZONES.restart, () => { close(true); onRestart(); });
  zone(ZONES.levels, () => UI.go(scene, 'LevelSelect'));
  zone(ZONES.menu, () => UI.go(scene, 'Menu'));
  zone(ZONES.soundOn, () => { gm.audio.setSound(true); refreshSound(); });
  zone(ZONES.soundOff, () => { gm.audio.setSound(false); refreshSound(); });
  zone([CLOSE.x - CLOSE.r, CLOSE.y - CLOSE.r, CLOSE.x + CLOSE.r, CLOSE.y + CLOSE.r], () => close());
  dim.on('pointerup', () => close());

  dim.setAlpha(0);
  scene.tweens.add({ targets: dim, alpha: 0.72, duration: 180 });
  scene.tweens.add({ targets: c, scale: SC, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  refreshSound();
  return { root, close };
}
