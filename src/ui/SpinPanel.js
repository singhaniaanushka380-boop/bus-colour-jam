import { GAME_W, GAME_H } from '../config.js';
import { gm } from '../systems/GameManager.js';
import { UI, Fx } from './UIManager.js';
import { adManager } from '../systems/AdManager.js';

/**
 * Lucky Spin. The wheel has 6 equal segments (clockwise from the top):
 * 550 coins, 1 Jumble, 40 coins, 1 VIP slot, 150 coins, 1 Arrange.
 * `w` = how likely a segment is (out of 100). Edit here to rebalance.
 */
export const SPIN_PRIZES = [
  { id: 'c550', coins: 550, label: '550', color: 0xffb62e, w: 4 },
  { id: 'jumble', item: 'colors', label: 'JUMBLE', sub: 'x1', color: 0x8e5bff, w: 18 },
  { id: 'c40', coins: 40, label: '40', color: 0x3d8bff, w: 34 },
  { id: 'vip', item: 'vip', label: 'VIP', sub: 'SLOT', color: 0xff4d5e, w: 14 },
  { id: 'c150', coins: 150, label: '150', color: 0x2fc46a, w: 15 },
  { id: 'arrange', item: 'pax', label: 'ARRANGE', sub: 'x1', color: 0xff8a2e, w: 15 },
];

export function pickPrize(rnd = Math.random()) {
  const total = SPIN_PRIZES.reduce((n, p) => n + p.w, 0);
  let r = rnd * total;
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    r -= SPIN_PRIZES[i].w;
    if (r < 0) return i;
  }
  return SPIN_PRIZES.length - 1;
}

/** Gives the prize to the player. */
export function grantPrize(prize) {
  if (prize.coins) gm.addCoins(prize.coins);
  else if (prize.item) gm.addItem(prize.item, 1);
}

const rad = (d) => (d * Math.PI) / 180;
const SEG = 360 / SPIN_PRIZES.length;

function openPlainSpinPanel(scene, { onChange } = {}) {
  const d = UI.dialog(scene, { title: 'LUCKY SPIN', w: 470, h: 640 });
  const c = d.c;
  let spinning = false;
  let alive = true;
  const origClose = d.close;
  d.close = (instant) => { if (!spinning) origClose(instant); };

  const R = 168;
  const WY = -60;
  // pointer + wheel rim
  const rim = scene.add.graphics();
  rim.fillStyle(0x1b2a52, 1).fillCircle(0, WY, R + 14);
  rim.fillStyle(0xffd23a, 1).fillCircle(0, WY, R + 8);
  c.add(rim);

  const wheel = scene.add.container(0, WY);
  const g = scene.add.graphics();
  SPIN_PRIZES.forEach((p, i) => {
    const a0 = rad(-90 + i * SEG);
    const a1 = rad(-90 + (i + 1) * SEG);
    g.fillStyle(i % 2 ? UI.shade(p.color, -0.12) : p.color, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, R, a0, a1, false);
    g.closePath();
    g.fillPath();
  });
  g.lineStyle(4, 0xffffff, 0.9);
  SPIN_PRIZES.forEach((p, i) => {
    const a = rad(-90 + i * SEG);
    g.lineBetween(0, 0, Math.cos(a) * R, Math.sin(a) * R);
  });
  wheel.add(g);
  SPIN_PRIZES.forEach((p, i) => {
    const mid = rad(-90 + i * SEG + SEG / 2);
    const holder = scene.add.container(Math.cos(mid) * R * 0.66, Math.sin(mid) * R * 0.66);
    holder.setRotation(mid + Math.PI / 2); // text reads outward from the centre
    if (p.coins) {
      holder.add(scene.add.image(0, -16, 'coin').setDisplaySize(34, 34));
      holder.add(UI.text(scene, 0, 16, p.label, 28, { thick: 5 }));
    } else {
      holder.add(UI.text(scene, 0, -12, p.label, p.label.length > 5 ? 20 : 26, { thick: 5 }));
      holder.add(UI.text(scene, 0, 14, p.sub, 18, { thick: 4 }));
    }
    wheel.add(holder);
  });
  const hub = scene.add.graphics();
  hub.fillStyle(0x1b2a52, 1).fillCircle(0, 0, 26);
  hub.fillStyle(0xffd23a, 1).fillCircle(0, 0, 18);
  wheel.add(hub);
  c.add(wheel);

  // fixed pointer at the top
  const ptr = scene.add.graphics();
  ptr.fillStyle(0x1b2a52, 1).fillTriangle(-20, WY - R - 26, 20, WY - R - 26, 0, WY - R + 22);
  ptr.fillStyle(0xff4d5e, 1).fillTriangle(-14, WY - R - 22, 14, WY - R - 22, 0, WY - R + 14);
  c.add(ptr);

  const info = UI.text(scene, 0, 178, '', 19, { color: '#1b2a52', stroke: '#ffffff', thick: 0, align: 'center' });
  c.add(info);
  const resultTxt = UI.text(scene, 0, 214, '', 24, { color: '#1b2a52', stroke: '#ffffff', thick: 0, align: 'center' });
  c.add(resultTxt);

  const btn = UI.button(scene, 0, 262, 330, 70, 'SPIN', { color: 0x3ed16a, size: 28, onClick: () => spin() });
  c.add(btn);

  function refresh() {
    const free = gm.freeSpins;
    if (free > 0) {
      btn.label.setText(`FREE SPIN${free > 1 ? ` (${free})` : ''}`);
      info.setText('You earned a free spin!');
    } else {
      btn.label.setText('WATCH AD - SPIN');
      info.setText(`Next FREE spin after ${gm.levelsToNextSpin()} more level${gm.levelsToNextSpin() === 1 ? '' : 's'}`);
    }
    btn.setDisabled(spinning);
    if (onChange) onChange();
  }

  async function spin() {
    if (spinning) return;
    if (gm.freeSpins > 0) {
      if (!gm.useFreeSpin()) return;
    } else {
      spinning = true; btn.setDisabled(true);
      let ok = false;
      try { ok = await adManager.showRewarded(); } catch (e) { ok = false; }
      spinning = false;
      if (!alive) return;
      if (!ok) { UI.toast(scene, 'Watch the full ad to spin', 130); refresh(); return; }
    }
    spinning = true;
    btn.setDisabled(true);
    resultTxt.setText('');
    const idx = pickPrize();
    const prize = SPIN_PRIZES[idx];
    grantPrize(prize); // paid out (and saved) immediately, so closing the app mid-spin never loses it
    gm.audio.sfx('click');
    const jitter = (Math.random() - 0.5) * (SEG * 0.6);
    const base = Math.ceil(wheel.angle / 360) * 360;
    const target = base + 360 * 5 - (idx * SEG + SEG / 2) + jitter;
    scene.tweens.add({
      targets: wheel,
      angle: target,
      duration: 4200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        spinning = false;
        if (!alive) return;
        gm.audio.sfx('win');
        const txt = prize.coins ? `You won ${prize.coins} coins!` : `You won 1 ${prize.id === 'vip' ? 'VIP slot' : prize.id === 'jumble' ? 'Jumble' : 'Arrange'}!`;
        resultTxt.setText(txt);
        Fx.burst(scene, GAME_W / 2, 400, { color: 0xffd23a, count: 18, speed: 160 });
        refresh();
      },
    });
  }

  scene.events.once('shutdown', () => { alive = false; });
  refresh();
  return d;
}

// =====================================================================================================
// Artwork version (public/assets/spin_panel.png, spin_wheel.png, spin_ptr.png)
// Coordinates are pixels of the original 1536x1024 picture. (0,0) of the container = centre of the cropped panel.
// =====================================================================================================
const ART_W = 1168;
const ART_H = 992;
const ax = (x) => x - 200 - ART_W / 2;
const ay = (y) => y - ART_H / 2;
const PANEL_W = 500; // on-screen width inside the 540x960 design space
const SC = PANEL_W / ART_W;
const WHEEL = { x: ax(770), y: ay(468.5), w: 484, h: 456 }; // the rotating disc (a circle, squashed to the artwork's ellipse)
const PTR = { x: ax(770), y: ay(256) };
const PILL = { x: ax(768), y: ay(754), w: 740 };
const BTN = { x: ax(768), y: ay(868), w: 800, h: 152 };
const CLOSE = { x: ax(1285), y: ay(125), r: 70 };

const lerp = (a, b, t) => a + (b - a) * t;

/** One line of text made of differently coloured words, centred on x. */
function colourLine(scene, parent, x, y, parts, size, thick) {
  const objs = parts.map((p) => UI.text(scene, 0, y, p.t, size, { color: p.c || '#ffffff', thick }).setOrigin(0, 0.5));
  const gap = size * 0.28;
  const total = objs.reduce((n, o) => n + o.width, 0) + gap * (objs.length - 1);
  const maxW = PILL.w;
  const k = total > maxW ? maxW / total : 1;
  let cx = x - (total * k) / 2;
  objs.forEach((o) => {
    o.setScale(k);
    o.setX(cx);
    cx += (o.width + gap) * k;
    parent.add(o);
  });
  return objs;
}

export function openSpinPanel(scene, opts = {}) {
  const { onChange } = opts;
  if (!scene.textures.exists('spin_panel') || !scene.textures.exists('spin_wheel')) return openPlainSpinPanel(scene, opts);

  const root = scene.add.container(0, 0).setDepth(1000);
  const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0b1230, 0.72).setInteractive();
  root.add(dim);
  const OX = GAME_W / 2;
  const OY = GAME_H / 2 - 20;
  const c = scene.add.container(OX, OY).setScale(0.6 * SC).setAlpha(0);
  root.add(c);
  c.add(scene.add.image(0, 0, 'spin_panel').setDisplaySize(ART_W, ART_H));

  // wheel: a circular disc that is rotated, inside a container squashed to the ellipse of the artwork
  const wheelBox = scene.add.container(WHEEL.x, WHEEL.y).setScale(1, WHEEL.h / WHEEL.w);
  const disc = scene.add.image(0, 0, 'spin_wheel').setDisplaySize(WHEEL.w, WHEEL.w);
  wheelBox.add(disc);
  c.add(wheelBox);
  if (scene.textures.exists('spin_ptr')) {
    const tip = scene.add.image(PTR.x, PTR.y, 'spin_ptr');
    tip.setDisplaySize(tip.width / 0.75, tip.height / 0.75);
    c.add(tip);
  }

  const pillLayer = scene.add.container(0, 0);
  const btnLayer = scene.add.container(0, 0);
  c.add([pillLayer, btnLayer]);

  let spinning = false;
  let alive = true;
  let closing = false;
  const stamp = { n: 0 };

  const close = () => {
    if (closing || spinning) return;
    closing = true;
    alive = false;
    scene.tweens.add({ targets: c, scale: 0.6 * SC, alpha: 0, duration: 160, ease: 'Back.easeIn' });
    scene.tweens.add({ targets: dim, alpha: 0, duration: 160, onComplete: () => root.destroy() });
    scene.input.keyboard?.off('keydown-ESC', onEsc);
  };
  const onEsc = () => close();
  scene.input.keyboard?.on('keydown-ESC', onEsc);
  scene.events.once('shutdown', () => { alive = false; scene.input.keyboard?.off('keydown-ESC', onEsc); });

  function setPill(parts) {
    pillLayer.removeAll(true);
    colourLine(scene, pillLayer, PILL.x, PILL.y, parts, 50, 9);
  }

  function drawButton() {
    btnLayer.removeAll(true);
    const free = gm.freeSpins;
    const txt = spinning ? 'SPINNING...' : free > 0 ? `FREE SPIN${free > 1 ? ` (${free})` : ''}` : 'WATCH AD - SPIN';
    const showIcon = !spinning && free <= 0;
    const t = UI.text(scene, 0, BTN.y, txt, 84, { thick: 13 });
    const iconW = showIcon ? 74 : 0;
    const gap = showIcon ? 30 : 0;
    const maxW = BTN.w - 130;
    const k = Math.min(1, maxW / (t.width + iconW + gap));
    t.setScale(k);
    const total = (t.width * k) + (iconW + gap) * k;
    const left = BTN.x - total / 2;
    if (showIcon) {
      const g = scene.add.graphics();
      const ix = left + (iconW * k) / 2;
      const s = k;
      g.fillStyle(0x0b1a52, 1).fillRoundedRect(ix - 40 * s, BTN.y - 46 * s, 88 * s, 92 * s, 16 * s);
      g.fillStyle(0xffffff, 1).fillTriangle(ix - 26 * s, BTN.y - 32 * s, ix - 26 * s, BTN.y + 32 * s, ix + 34 * s, BTN.y);
      btnLayer.add(g);
    }
    t.setX(left + (iconW + gap) * k + (t.width * k) / 2);
    btnLayer.add(t);
    btnLayer.setAlpha(spinning ? 0.6 : 1);
  }

  function showInfo() {
    const free = gm.freeSpins;
    if (free > 0) setPill([{ t: 'You have' }, { t: String(free), c: '#ffd21a' }, { t: free > 1 ? 'FREE spins!' : 'FREE spin!', c: '#ffd21a' }]);
    else {
      const n = gm.levelsToNextSpin();
      setPill([{ t: 'Next' }, { t: 'FREE', c: '#ffd21a' }, { t: 'spin after' }, { t: String(n), c: '#ffd21a' }, { t: n === 1 ? 'more level' : 'more levels' }]);
    }
  }

  function refresh() {
    drawButton();
    if (!spinning) showInfo();
    if (onChange) onChange();
  }

  const world = (x, y) => ({ x: OX + x * SC, y: OY + y * SC });

  async function spin() {
    if (spinning || closing) return;
    if (gm.freeSpins > 0) {
      if (!gm.useFreeSpin()) return;
    } else {
      spinning = true; drawButton();
      let ok = false;
      try { ok = await adManager.showRewarded(); } catch (e) { ok = false; }
      spinning = false;
      if (!alive) return;
      if (!ok) { gm.audio.sfx('error'); UI.toast(scene, 'Watch the full ad to spin', 130); refresh(); return; }
    }
    spinning = true;
    drawButton();
    stamp.n++;
    const mine = stamp.n;
    const idx = pickPrize();
    const prize = SPIN_PRIZES[idx];
    grantPrize(prize); // paid and saved immediately, so closing the app in the middle never loses it
    gm.audio.sfx('click');
    const jitter = (Math.random() - 0.5) * (SEG * 0.6);
    const base = Math.ceil(disc.angle / 360) * 360;
    const target = base + 360 * 5 - (idx * SEG + SEG / 2) + jitter;
    scene.tweens.add({
      targets: disc,
      angle: target,
      duration: 4200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        spinning = false;
        if (!alive) { return; }
        gm.audio.sfx('win');
        gm.vibrate?.(60);
        const what = prize.coins ? [{ t: 'You won' }, { t: String(prize.coins), c: '#ffd21a' }, { t: 'coins!' }]
          : [{ t: 'You won' }, { t: `1 ${prize.id === 'vip' ? 'VIP slot' : prize.id === 'jumble' ? 'Jumble' : 'Arrange'}!`, c: '#ffd21a' }];
        setPill(what);
        const p = world(WHEEL.x, WHEEL.y);
        Fx.burst(scene, p.x, p.y, { color: 0xffd23a, count: 22, speed: 190 });
        Fx.ring(scene, p.x, p.y, 0xffd23a);
        drawButton();
        if (onChange) onChange();
        scene.time.delayedCall(2600, () => { if (alive && !spinning && mine === stamp.n) showInfo(); });
      },
    });
  }

  // tap areas: the green button and the red X of the artwork (+ tap outside)
  const bz = scene.add.zone(BTN.x, BTN.y, BTN.w, BTN.h).setInteractive({ useHandCursor: true });
  bz.on('pointerup', () => spin());
  c.add(bz);
  const xz = scene.add.zone(CLOSE.x, CLOSE.y, CLOSE.r * 2, CLOSE.r * 2).setInteractive({ useHandCursor: true });
  xz.on('pointerup', () => { gm.audio.sfx('click'); close(); });
  c.add(xz);
  dim.on('pointerup', close);

  dim.setAlpha(0);
  scene.tweens.add({ targets: dim, alpha: 0.72, duration: 200 });
  scene.tweens.add({ targets: c, scale: SC, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  refresh();
  return { root, close };
}
