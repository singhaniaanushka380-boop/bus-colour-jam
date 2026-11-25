import { Capacitor } from '@capacitor/core';
import { GAME_W, GAME_H } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { UI } from './UIManager.js';

/**
 * Settings popup built on the artwork public/assets/settings_panel.png.
 * The picture holds the frame, icons and labels; the three ON/OFF switches and the tap areas are live.
 */
export const CONTACT_EMAIL = 'rajatverma8533@gmail.com';

// Coordinates are in artwork pixels of the 1055x1359 picture; (0,0) is its centre.
const ART_W = 1055;
const ART_H = 1359;
const cx = (x) => x - 16 - ART_W / 2;
const cy = (y) => y - 3 - ART_H / 2;
const PANEL_W = 470; // on-screen width inside the 540x960 design space
const S = PANEL_W / ART_W;

const SW = { x: cx(810.5), w: 270, h: 146 }; // switch size and column
const ROWS = [
  { key: 'music', y: cy(479.5), top: cy(385), bot: cy(575) },
  { key: 'sound', y: cy(689.5), top: cy(595), bot: cy(785) },
  { key: 'vibration', y: cy(899.5), top: cy(805), bot: cy(995) },
];
const CLOSE = { x: cx(972), y: cy(208), r: 85 };
const CONTACT = { x: cx(547), y: cy(1137), w: 790, h: 205 };

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => {
  const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t);
  const g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t);
  const b = lerp(c1 & 255, c2 & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};

/** Draws one glossy ON/OFF switch. t = 0 (off, knob left, grey, X) ... 1 (on, knob right, green, check). */
function drawSwitch(g, t) {
  const { w, h } = SW;
  const r = h / 2;
  g.clear();
  g.fillStyle(0x000000, 0.16).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
  g.fillStyle(mix(0x3b3a42, 0x0f6a12, t)).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(mix(0x86818d, 0x2fd10a, t)).fillRoundedRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, r - 8);
  g.fillStyle(mix(0x6d6874, 0x20b800, t)).fillRoundedRect(-w / 2 + 8, 4, w - 16, h / 2 - 12, { tl: 0, tr: 0, bl: r - 8, br: r - 8 });
  g.fillStyle(0xffffff, 0.3).fillRoundedRect(-w / 2 + 26, -h / 2 + 14, w - 52, 26, 13);
  // knob
  const kx = lerp(-w / 2 + r, w / 2 - r, t);
  g.fillStyle(0x000000, 0.2).fillCircle(kx, 6, 56);
  g.fillStyle(0xc5cbe6).fillCircle(kx, 0, 56);
  g.fillStyle(0xf4f6ff).fillCircle(kx, -3, 51);
  g.fillStyle(0xffffff, 0.8).fillEllipse(kx - 12, -22, 46, 20);
  // symbol on the free side: check mark (on) or X (off)
  const sx = lerp(w / 2 - r, -w / 2 + r, t);
  g.lineStyle(15, 0xffffff, 1);
  if (t >= 0.5) {
    g.beginPath(); g.moveTo(sx - 26, 2); g.lineTo(sx - 8, 22); g.lineTo(sx + 28, -22); g.strokePath();
  } else {
    g.beginPath(); g.moveTo(sx - 20, -20); g.lineTo(sx + 20, 20); g.moveTo(sx + 20, -20); g.lineTo(sx - 20, 20); g.strokePath();
  }
}

/** Opens Gmail (compose window) / the phone's mail app with the developer's address already filled in. */
export function openMail() {
  const subject = encodeURIComponent('Bus Color Jam - Feedback');
  const body = encodeURIComponent('Hi Rajat,\n\n');
  let native = false;
  try { native = Capacitor.isNativePlatform(); } catch (e) { native = false; }
  if (native) {
    // Android: opens the mail app (Gmail) with "To" filled in
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  } else {
    // Browser: opens Gmail's compose window in a new tab
    const w = window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${CONTACT_EMAIL}&su=${subject}&body=${body}`, '_blank', 'noopener');
    return !!w;
  }
  return true;
}

export function openSettingsPanel(scene) {
  if (!scene.textures.exists('settings_panel')) return null;
  const root = scene.add.container(0, 0).setDepth(1000);
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0b1230, 0.72).setInteractive();
  root.add(dim);
  const c = scene.add.container(GAME_W / 2, GAME_H / 2 - 20).setScale(0.6 * S).setAlpha(0);
  root.add(c);
  const art = scene.add.image(0, 0, 'settings_panel').setDisplaySize(ART_W, ART_H);
  c.add(art);

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    scene.tweens.add({ targets: c, scale: 0.6 * S, alpha: 0, duration: 160, ease: 'Back.easeIn' });
    scene.tweens.add({ targets: [dim, mailLine], alpha: 0, duration: 160, onComplete: () => root.destroy() });
  };

  // ---- the three switches
  const state = {
    music: { get: () => gm.audio.musicOn, set: (v) => gm.audio.setMusic(v), label: 'Music' },
    sound: { get: () => gm.audio.soundOn, set: (v) => gm.audio.setSound(v), label: 'Sound' },
    vibration: { get: () => gm.vibrationOn, set: (v) => gm.setVibration(v), label: 'Vibration' },
  };
  const switches = {};
  ROWS.forEach((row) => {
    const g = scene.add.graphics({ x: SW.x, y: row.y });
    const sw = { g, t: state[row.key].get() ? 1 : 0, tween: null };
    drawSwitch(g, sw.t);
    c.add(g);
    switches[row.key] = sw;
    // the whole row is the tap area
    const zone = scene.add.zone(0, (row.top + row.bot) / 2, 840, row.bot - row.top).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => {
      const st = state[row.key];
      const on = !st.get();
      st.set(on);
      if (row.key === 'vibration' && on) gm.vibrate(40);
      else if (row.key === 'sound' && on) gm.audio.sfx('click');
      else if (row.key !== 'sound') gm.audio.sfx('click');
      if (sw.tween) sw.tween.stop();
      const proxy = { t: sw.t };
      sw.tween = scene.tweens.add({
        targets: proxy, t: on ? 1 : 0, duration: 160, ease: 'Sine.easeOut',
        onUpdate: () => { sw.t = proxy.t; drawSwitch(g, proxy.t); },
        onComplete: () => { sw.t = on ? 1 : 0; drawSwitch(g, sw.t); },
      });
    });
    c.add(zone);
  });

  // ---- contact: opens Gmail with the address filled in
  const contact = scene.add.zone(CONTACT.x, CONTACT.y, CONTACT.w, CONTACT.h).setInteractive({ useHandCursor: true });
  contact.on('pointerup', () => {
    gm.audio.sfx('click');
    const ok = openMail();
    if (!ok) UI.toast(scene, `Email us: ${CONTACT_EMAIL}`, 130);
  });
  c.add(contact);

  // ---- close button (the red X in the artwork) + tap outside
  const x = scene.add.zone(CLOSE.x, CLOSE.y, CLOSE.r * 2, CLOSE.r * 2).setInteractive({ useHandCursor: true });
  x.on('pointerup', () => { gm.audio.sfx('click'); close(); });
  c.add(x);
  dim.on('pointerup', close);

  // the address is also printed under the panel, so players can see where the mail goes
  const mailLine = UI.text(scene, GAME_W / 2, GAME_H / 2 - 20 + (ART_H * S) / 2 + 28, CONTACT_EMAIL, 20, { thick: 4 });
  mailLine.setAlpha(0);
  root.add(mailLine);

  scene.tweens.add({ targets: c, scale: S, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: mailLine, alpha: 1, duration: 260 });
  dim.setAlpha(0);
  scene.tweens.add({ targets: dim, alpha: 0.72, duration: 200 });
  return { root, close };
}
