// Reusable UI toolkit: buttons, panels, dialogs, toasts, particles and screen transitions.
// Every widget is built from the same palette/shape language so the game feels like one design system.
import { FONT, GAME_W, GAME_H, COLORS } from '../config.js';
import { gm } from '../systems/GameManager.js';

function shade(color, amt) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

export const UI = {
  shade,

  text(scene, x, y, str, size = 28, o = {}) {
    return scene.add
      .text(x, y, str, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color: o.color || '#ffffff',
        stroke: o.stroke || '#1b2a52',
        strokeThickness: o.thick ?? Math.max(3, Math.round(size / 7)),
        align: o.align || 'center',
        wordWrap: o.wrap ? { width: o.wrap } : undefined,
      })
      .setOrigin(o.ox ?? 0.5, o.oy ?? 0.5);
  },

  /** Chunky rounded button with a press animation. onClick fires on release. */
  button(scene, x, y, w, h, label, o = {}) {
    const c = scene.add.container(x, y);
    const col = o.color ?? 0x3ed16a;
    const r = o.round ? h / 2 : Math.min(h / 2.6, 26);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
    g.fillStyle(shade(col, -0.38)).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
    g.fillStyle(col).fillRoundedRect(-w / 2, -h / 2, w, h - 5, r);
    g.fillStyle(0xffffff, 0.32).fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, (h - 5) * 0.32, r / 2);
    c.add(g);
    let iconW = 0;
    if (o.icon) {
      const s = Math.min(h * 0.55, 44);
      iconW = s + 8;
      const ic = scene.add.image(label ? -w / 2 + s / 2 + h * 0.28 : 0, -2, `ic_${o.icon}`).setDisplaySize(s, s);
      c.add(ic);
      c.icon = ic;
    }
    if (label) {
      const t = UI.text(scene, iconW ? iconW / 2 + 4 : 0, -3, label, o.size ?? Math.round(h * 0.42));
      c.add(t);
      c.label = t;
    }
    c.setSize(w, h + 4);
    c.setInteractive({ useHandCursor: true });
    let down = false;
    c.on('pointerdown', () => {
      if (c.disabled) return;
      down = true;
      scene.tweens.add({ targets: c, scaleX: 0.94, scaleY: 0.94, y: y + 3, duration: 70 });
    });
    const release = () => {
      scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, y, duration: 110, ease: 'Back.easeOut' });
    };
    c.on('pointerout', () => {
      if (down) release();
      down = false;
    });
    c.on('pointerup', () => {
      if (!down) return;
      down = false;
      release();
      if (c.disabled) return;
      gm.audio.sfx('click');
      if (o.onClick) o.onClick();
    });
    c.setDisabled = (v) => {
      c.disabled = v;
      c.setAlpha(v ? 0.45 : 1);
    };
    return c;
  },

  /** Round icon button (HUD / toolbars). */
  iconButton(scene, x, y, size, icon, o = {}) {
    return UI.button(scene, x, y, size, size, '', { ...o, icon, color: o.color ?? 0x3d8bff });
  },

  /** Rounded info pill (coins, level label...). Returns a container with .value text. */
  pill(scene, x, y, w, h, o = {}) {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.22).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, h / 2);
    g.fillStyle(o.color ?? 0x1b2a52, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(3, 0xffffff, 0.25).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    c.add(g);
    return c;
  },

  /** Coin counter pill that follows the wallet. Call .destroyCounter() (done automatically on shutdown). */
  coinCounter(scene, x, y, w = 150) {
    const c = UI.pill(scene, x, y, w, 46);
    const coin = scene.add.image(-w / 2 + 24, 0, 'coin').setScale(0.95);
    const t = UI.text(scene, 10, -1, String(gm.coins), 24, { thick: 4 });
    c.add([coin, t]);
    c.value = t;
    c.coinIcon = coin;
    c.shown = gm.coins;
    c.setValue = (v) => {
      c.shown = v;
      t.setText(String(v));
    };
    const off = gm.onCoins((v) => c.setValue(v));
    scene.events.once('shutdown', off);
    c.once('destroy', off);
    return c;
  },

  /** Round on/off icon button (sound / music). `get`/`set` read and write the boolean. */
  toggleButton(scene, x, y, size, icon, get, set, color = 0x3d8bff) {
    const b = UI.iconButton(scene, x, y, size, icon, { color });
    const slash = scene.add.image(0, -2, 'ic_slash').setDisplaySize(size * 0.55, size * 0.55);
    b.add(slash);
    const refresh = () => {
      slash.setVisible(!get());
      b.icon.setAlpha(get() ? 1 : 0.6);
    };
    b.on('pointerup', () => {
      set(!get());
      refresh();
    });
    refresh();
    return b;
  },

  /** Banner ribbon with title text. */
  ribbon(scene, x, y, w, str, color = 0xff4d5e, size = 34) {
    const c = scene.add.container(x, y);
    const h = 58;
    const g = scene.add.graphics();
    g.fillStyle(shade(color, -0.4)).fillTriangle(-w / 2 - 22, -h / 2 + 12, -w / 2 + 14, -h / 2 + 12, -w / 2 + 14, h / 2 + 12);
    g.fillTriangle(w / 2 + 22, -h / 2 + 12, w / 2 - 14, -h / 2 + 12, w / 2 - 14, h / 2 + 12);
    g.fillStyle(shade(color, -0.4)).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 12);
    g.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h - 4, 12);
    g.fillStyle(0xffffff, 0.3).fillRoundedRect(-w / 2 + 8, -h / 2 + 5, w - 16, 14, 7);
    c.add(g);
    c.add(UI.text(scene, 0, -2, str, size));
    return c;
  },

  /** White card with soft shadow. */
  card(scene, x, y, w, h, color = 0xffffff) {
    const g = scene.add.graphics({ x, y });
    g.fillStyle(0x000000, 0.28).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, 30);
    g.fillStyle(shade(color, -0.12)).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, 30);
    g.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h - 4, 30);
    return g;
  },

  /**
   * Modal dialog. Returns { c, close, dim } where `c` is a container centred on (0,0) of the card.
   * Add your own content to `c`. Taps outside never fall through to the scene below.
   */
  dialog(scene, { title, w = 440, h = 520, depth = 1000, closable = true, onClose } = {}) {
    const root = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0b1230, 0.72).setInteractive();
    root.add(dim);
    const c = scene.add.container(GAME_W / 2, GAME_H / 2);
    root.add(c);
    c.add(UI.card(scene, 0, 0, w, h));
    if (title) c.add(UI.ribbon(scene, 0, -h / 2 - 4, Math.min(w - 90, 300), title, 0xff4d5e, 30));
    let closing = false;
    const api = {
      root,
      c,
      dim,
      close: (instant) => {
        if (closing) return;
        closing = true;
        if (onClose) onClose();
        if (instant) return root.destroy();
        scene.tweens.add({ targets: c, scale: 0.6, alpha: 0, duration: 160, ease: 'Back.easeIn' });
        scene.tweens.add({ targets: dim, alpha: 0, duration: 160, onComplete: () => root.destroy() });
      },
    };
    if (closable) {
      const x = UI.iconButton(scene, w / 2 - 14, -h / 2 + 8, 52, 'close', { color: 0xff4d5e, onClick: () => api.close() });
      c.add(x);
    }
    c.setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    dim.setAlpha(0);
    scene.tweens.add({ targets: dim, alpha: 0.72, duration: 200 });
    return api;
  },

  /** Brief message near the top of the screen. */
  toast(scene, msg, y = 215) {
    const t = UI.text(scene, GAME_W / 2, y, msg, 24, { thick: 5 }).setDepth(2000);
    const bg = scene.add.graphics().setDepth(1999);
    const w = t.width + 44;
    bg.fillStyle(0x1b2a52, 0.92).fillRoundedRect(GAME_W / 2 - w / 2, y - 24, w, 48, 24);
    bg.lineStyle(3, 0xffffff, 0.25).strokeRoundedRect(GAME_W / 2 - w / 2, y - 24, w, 48, 24);
    const items = [t, bg];
    items.forEach((o) => o.setAlpha(0));
    scene.tweens.add({ targets: items, alpha: 1, duration: 140 });
    scene.tweens.add({
      targets: items,
      alpha: 0,
      delay: 1500,
      duration: 300,
      onComplete: () => items.forEach((o) => o.destroy()),
    });
  },

  /** Fade out, then start another scene. Safe to call twice. */
  go(scene, key, data) {
    if (scene._leaving) return;
    scene._leaving = true;
    scene.input.enabled = false;
    scene.cameras.main.fadeOut(220, 20, 30, 70);
    scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
  },

  /** Call at the top of create(). */
  enter(scene) {
    scene._leaving = false;
    scene.input.enabled = true;
    // the Phaser canvas is transparent (the 3D terminal shows through in the Game scene): other scenes get a solid sky
    if (scene.scene.key !== 'Game') scene.cameras.main.setBackgroundColor('#4cc3ff');
    scene.cameras.main.fadeIn(260, 20, 30, 70);
  },

  /** Animated logo built from text so no image asset is needed. */
  logo(scene, x, y, scale = 1) {
    const c = scene.add.container(x, y);
    const line1 = ['B', 'U', 'S'];
    const line2 = ['C', 'O', 'L', 'O', 'R'];
    const line3 = ['J', 'A', 'M'];
    const pal = [0xff4d5e, 0xffd23f, 0x3ed16a, 0x3d8bff, 0xa566ff, 0xff9a3c, 0xff7ac8];
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const row = (letters, cy, size, offset, gap) => {
      const items = letters.map((ch, i) =>
        UI.text(scene, 0, 0, ch, size, { color: hex(pal[(i + offset) % pal.length]), stroke: '#1b2a52', thick: Math.round(size / 5) }),
      );
      const total = items.reduce((n, t) => n + t.width + gap, -gap);
      let px = -total / 2;
      items.forEach((t, i) => {
        t.setPosition(px + t.width / 2, cy);
        t.setAngle((i % 2 ? 1 : -1) * 3);
        px += t.width + gap;
        c.add(t);
        scene.tweens.add({ targets: t, y: cy - 6, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 110 });
      });
    };
    row(line1, -66, 98, 0, 4);
    row(line2, 24, 70, 2, 0);
    row(line3, 100, 70, 5, 2);
    c.setScale(scale);
    return c;
  },

  /** A pill-shaped progress bar (0..1). */
  bar(scene, x, y, w, h, color = 0xffd23f) {
    const c = scene.add.container(x, y);
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const fill = scene.add.graphics();
    c.add([bg, fill]);
    c.value = 0;
    c.setValue = (v) => {
      c.value = Math.max(0, Math.min(1, v));
      fill.clear();
      const fw = Math.max(c.value > 0 ? h : 0, (w - 6) * c.value);
      if (fw > 0) {
        fill.fillStyle(shade(color, -0.3)).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, fw, h - 4, (h - 4) / 2);
        fill.fillStyle(color).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, fw, h - 7, (h - 7) / 2);
        fill.fillStyle(0xffffff, 0.35).fillRoundedRect(-w / 2 + 8, -h / 2 + 5, Math.max(0, fw - 10), 4, 2);
      }
    };
    return c;
  },
};

// ------------------------------------------------------------------ particles (tween based, self cleaning)
export const Fx = {
  burst(scene, x, y, { color = 0xffffff, count = 10, speed = 90, life = 520, depth = 900, scale = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const d = speed * (0.5 + Math.random() * 0.7);
      const s = scene.add.image(x, y, 'spark').setTint(color).setDepth(depth).setScale(0.4 * scale);
      scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d - 10,
        alpha: 0,
        scale: 0.05,
        duration: life * (0.7 + Math.random() * 0.5),
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
  },

  ring(scene, x, y, color = 0xffffff, depth = 900) {
    const g = scene.add.graphics({ x, y }).setDepth(depth);
    g.lineStyle(5, color, 1).strokeCircle(0, 0, 18);
    scene.tweens.add({ targets: g, scale: 2.6, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  },

  confetti(scene, count = 70) {
    const keys = Object.keys(COLORS);
    for (let i = 0; i < count; i++) {
      const col = COLORS[keys[i % keys.length]].main;
      const x = Math.random() * GAME_W;
      const p = scene.add.image(x, -30 - Math.random() * 200, 'confetti').setTint(col).setDepth(3000).setAngle(Math.random() * 360).setScale(0.8 + Math.random() * 0.6);
      scene.tweens.add({
        targets: p,
        y: GAME_H + 40,
        x: x + (Math.random() - 0.5) * 160,
        angle: p.angle + (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 400),
        duration: 1800 + Math.random() * 1400,
        delay: Math.random() * 600,
        ease: 'Sine.easeIn',
        onComplete: () => p.destroy(),
      });
    }
  },

  floatText(scene, x, y, str, color = '#ffd23f', size = 28) {
    const t = UI.text(scene, x, y, str, size, { color }).setDepth(1500);
    scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 800, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  },

  /** Coins that fly from a point to the wallet counter, then call onArrive(i) for each coin. */
  coinFly(scene, fromX, fromY, to, count = 8, onArrive) {
    for (let i = 0; i < count; i++) {
      const coin = scene.add.image(fromX, fromY, 'coin').setDepth(3500).setScale(0);
      const ox = fromX + (Math.random() - 0.5) * 120;
      const oy = fromY + (Math.random() - 0.5) * 70;
      scene.tweens.add({
        targets: coin,
        x: ox,
        y: oy,
        scale: 1,
        duration: 220,
        delay: i * 55,
        ease: 'Back.easeOut',
        onComplete: () => {
          scene.tweens.add({
            targets: coin,
            x: to.x,
            y: to.y,
            scale: 0.6,
            duration: 520,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              coin.destroy();
              gm.audio.sfx('coin');
              if (onArrive) onArrive(i);
            },
          });
        },
      });
    }
  },
};

export default UI;
