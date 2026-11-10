// Generates every sprite procedurally with Phaser Graphics -> textures. No image files, no copyrighted art.
import { COLORS, COLOR_NAMES, GAME_W, GAME_H } from '../config.js';

const SKIN = [0xffd7b5, 0xf2b48c, 0xc98a5e, 0x8d5a3b];
const HAIR = [0x5a3a2a, 0x2a2a3a, 0xb5651d, 0x1f1f1f];

function gfx(scene) {
  return scene.make.graphics({ x: 0, y: 0, add: false });
}
function bake(g, key, w, h) {
  g.generateTexture(key, w, h);
  g.destroy();
}
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- buses
// Texture 108x76, bus faces right. Windows (seats) are drawn live by the Bus object over the glass band.
export const BUS_TEX = { w: 108, h: 76, cx: 54, cy: 38 };

function makeBus(scene, name) {
  const c = COLORS[name];
  const g = gfx(scene);
  // soft contact shadow
  g.fillStyle(0x000000, 0.14).fillEllipse(54, 68, 104, 14);
  g.fillStyle(0x000000, 0.2).fillEllipse(54, 67, 88, 9);
  // roof air-con pod (gives the 2.5D top)
  g.fillStyle(c.dark).fillRoundedRect(36, 0, 36, 7, 3);
  g.fillStyle(c.light, 0.9).fillRoundedRect(39, 1, 30, 3, 1.5);
  // body: shaded lower slab + main paint
  g.fillStyle(c.dark).fillRoundedRect(5, 9, 98, 52, 17);
  g.fillStyle(c.main).fillRoundedRect(5, 4, 98, 50, 17);
  // glossy highlight + colour stripe + skirt
  g.fillStyle(c.light, 0.6).fillRoundedRect(10, 5, 88, 7, 3.5);
  g.fillStyle(0xffffff, 0.85).fillRoundedRect(9, 43, 90, 3, 1.5);
  g.fillStyle(c.dark).fillRoundedRect(5, 47, 98, 9, { tl: 0, tr: 0, bl: 15, br: 15 });
  // glass band (Bus draws the seat windows over it)
  g.fillStyle(0x1f2a47).fillRoundedRect(11, 14, 86, 28, 9);
  g.fillStyle(0xffffff, 0.14).fillRoundedRect(13, 15, 82, 5, 3);
  // wheels with arches
  [28, 80].forEach((wx) => {
    g.fillStyle(0x1d2130).fillCircle(wx, 58, 12.5);
    g.fillStyle(0x2b2f3a).fillCircle(wx, 58, 10);
    g.fillStyle(0xe3e8f2).fillCircle(wx, 58, 5);
    g.fillStyle(0x8c96b0).fillCircle(wx, 58, 2);
  });
  // lights + bumper + mirror
  g.fillStyle(0xfff3b0, 0.3).fillCircle(99, 47, 8);
  g.fillStyle(0xfff3b0).fillCircle(98, 47, 4);
  g.fillStyle(0xff5a5a).fillCircle(9, 47, 3);
  g.fillStyle(0xdfe6f2).fillRoundedRect(95, 51, 9, 5, 2);
  g.fillStyle(0x2b2f3a).fillRoundedRect(100, 18, 5, 9, 2);
  bake(g, `bus_${name}`, BUS_TEX.w, BUS_TEX.h);
}

// ---------------------------------------------------------------- passengers
// Texture 40x56. 4 hair/hat variants per colour.
function makePassenger(scene, name, v) {
  const c = COLORS[name];
  const g = gfx(scene);
  g.fillStyle(0x000000, 0.22).fillEllipse(20, 52, 26, 7);
  // legs
  g.fillStyle(0x3a3f58).fillRoundedRect(12, 44, 6, 8, 2).fillRoundedRect(22, 44, 6, 8, 2);
  // body
  g.fillStyle(c.dark).fillRoundedRect(7, 26, 26, 22, 9);
  g.fillStyle(c.main).fillRoundedRect(7, 24, 26, 21, 9);
  g.fillStyle(c.light, 0.6).fillRoundedRect(11, 26, 10, 5, 2.5);
  // arms
  g.fillStyle(c.dark).fillCircle(7, 34, 4).fillCircle(33, 34, 4);
  // head
  const skin = SKIN[v % 4];
  g.fillStyle(skin).fillCircle(20, 17, 11);
  // hair / hats
  const hair = HAIR[(v + 1) % 4];
  if (v === 0) {
    g.fillStyle(hair);
    g.beginPath();
    g.arc(20, 16, 11.5, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.fillRoundedRect(8.5, 14, 4, 6, 2);
  } else if (v === 1) {
    g.fillStyle(c.dark);
    g.beginPath();
    g.arc(20, 15, 11.5, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.fillRoundedRect(20, 13, 16, 4, 2);
    g.fillStyle(c.light, 0.7).fillRoundedRect(12, 8, 8, 3, 1.5);
  } else if (v === 2) {
    g.fillStyle(c.light);
    g.beginPath();
    g.arc(20, 14, 11.5, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(c.dark).fillRoundedRect(8.5, 12, 23, 4, 2);
    g.fillStyle(0xffffff).fillCircle(20, 3.5, 3.5);
  } else {
    g.fillStyle(hair);
    g.beginPath();
    g.arc(20, 16, 11.5, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.fillCircle(32, 19, 4.5);
    g.fillStyle(c.main).fillRoundedRect(28, 14, 4, 3, 1);
  }
  // face
  g.fillStyle(0x2a2a3a).fillCircle(16, 18.5, 1.8).fillCircle(24, 18.5, 1.8);
  g.fillStyle(0xff8fa3, 0.55).fillCircle(12.5, 22, 2.4).fillCircle(27.5, 22, 2.4);
  g.lineStyle(1.6, 0x7a3b3b, 1);
  g.beginPath();
  g.arc(20, 21, 3.4, 0.25, Math.PI - 0.25, false);
  g.strokePath();
  bake(g, `pax_${name}_${v}`, 40, 56);
}

// ---------------------------------------------------------------- small sprites
function makeSpark(scene) {
  const g = gfx(scene);
  g.fillStyle(0xffffff, 0.25).fillCircle(8, 8, 8);
  g.fillStyle(0xffffff, 0.6).fillCircle(8, 8, 5.5);
  g.fillStyle(0xffffff, 1).fillCircle(8, 8, 3);
  bake(g, 'spark', 16, 16);
}

function makeConfetti(scene) {
  const g = gfx(scene);
  g.fillStyle(0xffffff).fillRoundedRect(0, 0, 10, 16, 3);
  bake(g, 'confetti', 10, 16);
}

function starPoints(cx, cy, ro, ri) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? ro : ri;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function makeStar(scene) {
  let g = gfx(scene);
  g.fillStyle(0xb8791a).fillPoints(starPoints(32, 36, 28, 13), true);
  g.fillStyle(0xffc933).fillPoints(starPoints(32, 33, 28, 13), true);
  g.fillStyle(0xffe680, 0.9).fillPoints(starPoints(32, 31, 17, 8), true);
  bake(g, 'star', 64, 64);
  g = gfx(scene);
  g.fillStyle(0x5a6482).fillPoints(starPoints(32, 36, 28, 13), true);
  g.fillStyle(0x7b86a8).fillPoints(starPoints(32, 33, 28, 13), true);
  bake(g, 'star_off', 64, 64);
}

function makeCoin(scene) {
  const g = gfx(scene);
  g.fillStyle(0xb8791a).fillCircle(20, 22, 18);
  g.fillStyle(0xffc933).fillCircle(20, 20, 18);
  g.fillStyle(0xe39f12).fillCircle(20, 20, 13);
  g.fillStyle(0xffe680).fillCircle(20, 20, 11);
  g.fillStyle(0xe39f12).fillRoundedRect(17, 12, 6, 16, 3);
  g.fillStyle(0xffffff, 0.6).fillEllipse(13, 11, 8, 4);
  bake(g, 'coin', 40, 42);
}

function makeCloud(scene) {
  const g = gfx(scene);
  g.fillStyle(0xffffff, 0.92);
  g.fillCircle(32, 40, 22).fillCircle(60, 30, 28).fillCircle(90, 40, 22).fillRoundedRect(20, 40, 82, 22, 11);
  bake(g, 'cloud', 124, 66);
}

function makeArrow(scene) {
  const g = gfx(scene);
  g.fillStyle(0x000000, 0.25).fillTriangle(8, 10, 52, 10, 30, 52);
  g.fillStyle(0xffd23f).fillRoundedRect(16, 0, 28, 22, 6);
  g.fillTriangle(6, 18, 54, 18, 30, 50);
  g.lineStyle(3, 0xb8791a, 1).strokeRoundedRect(16, 0, 28, 22, 6);
  bake(g, 'arrow_down', 60, 56);
}

// ---------------------------------------------------------------- icons (white, 48x48)
function arrowHead(g, cx, cy, r, ang, dir, size = 9) {
  // head on a circular arc at angle `ang`, pointing along travel direction `dir` (+1 clockwise, -1 ccw)
  const px = cx + Math.cos(ang) * r;
  const py = cy + Math.sin(ang) * r;
  const tx = -Math.sin(ang) * dir;
  const ty = Math.cos(ang) * dir;
  const nx = Math.cos(ang);
  const ny = Math.sin(ang);
  g.fillTriangle(
    px + tx * size, py + ty * size,
    px + nx * size * 0.8, py + ny * size * 0.8,
    px - nx * size * 0.8, py - ny * size * 0.8,
  );
}

const ICONS = {
  undo(g) {
    g.lineStyle(6, 0xffffff).beginPath().arc(26, 28, 13, Math.PI * 1.05, Math.PI * 2.05, false).strokePath();
    g.lineBetween(39, 28, 39, 34);
    arrowHead(g, 26, 28, 13, Math.PI * 1.05, -1, 10);
  },
  restart(g) {
    g.lineStyle(6, 0xffffff).beginPath().arc(24, 25, 13, 0.1, Math.PI * 1.75, false).strokePath();
    arrowHead(g, 24, 25, 13, Math.PI * 1.75, 1, 10);
  },
  hint(g) {
    g.fillStyle(0xffffff).fillCircle(24, 19, 12);
    g.fillRoundedRect(17, 30, 14, 7, 3).fillRoundedRect(19, 39, 10, 4, 2);
    g.fillStyle(0xffd23f).fillCircle(24, 19, 6);
  },
  pause(g) {
    g.fillStyle(0xffffff).fillRoundedRect(12, 9, 9, 30, 3).fillRoundedRect(27, 9, 9, 30, 3);
  },
  play(g) {
    g.fillStyle(0xffffff).fillTriangle(14, 8, 14, 40, 40, 24);
  },
  home(g) {
    g.fillStyle(0xffffff).fillTriangle(24, 6, 4, 25, 44, 25).fillRoundedRect(10, 24, 28, 19, 3);
    g.fillStyle(0x1b2a52, 0.5).fillRoundedRect(20, 30, 8, 13, 2);
  },
  levels(g) {
    g.fillStyle(0xffffff).fillRoundedRect(6, 6, 16, 16, 4).fillRoundedRect(26, 6, 16, 16, 4);
    g.fillRoundedRect(6, 26, 16, 16, 4).fillRoundedRect(26, 26, 16, 16, 4);
  },
  gear(g) {
    g.fillStyle(0xffffff);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillCircle(24 + Math.cos(a) * 16, 24 + Math.sin(a) * 16, 4.5);
    }
    g.lineStyle(7, 0xffffff).strokeCircle(24, 24, 11);
  },
  sound(g) {
    g.fillStyle(0xffffff).fillRoundedRect(6, 17, 9, 14, 2).fillTriangle(13, 17, 28, 7, 28, 41).fillTriangle(13, 31, 28, 41, 13, 17);
    g.lineStyle(4, 0xffffff);
    g.beginPath().arc(28, 24, 8, -0.9, 0.9, false).strokePath();
    g.beginPath().arc(28, 24, 14, -0.9, 0.9, false).strokePath();
  },
  music(g) {
    g.fillStyle(0xffffff).fillCircle(15, 36, 7).fillCircle(34, 32, 7);
    g.fillRoundedRect(19.5, 8, 5, 28, 2).fillRoundedRect(38.5, 5, 5, 27, 2);
    g.fillTriangle(20, 8, 44, 4, 44, 14).fillTriangle(20, 8, 20, 18, 44, 14);
  },
  gift(g) {
    g.fillStyle(0xffffff).fillRoundedRect(6, 20, 36, 22, 4).fillRoundedRect(4, 13, 40, 9, 3);
    g.fillStyle(0xff4d5e).fillRect(21, 13, 6, 29);
    g.fillCircle(17, 9, 5).fillCircle(31, 9, 5);
  },
  close(g) {
    g.lineStyle(7, 0xffffff).lineBetween(11, 11, 37, 37).lineBetween(37, 11, 11, 37);
  },
  check(g) {
    g.lineStyle(7, 0xffffff).beginPath().moveTo(10, 25).lineTo(20, 35).lineTo(39, 13).strokePath();
  },
  lock(g) {
    g.lineStyle(6, 0xffffff).beginPath().arc(24, 18, 9, Math.PI, 0, false).strokePath();
    g.lineBetween(15, 18, 15, 24).lineBetween(33, 18, 33, 24);
    g.fillStyle(0xffffff).fillRoundedRect(8, 23, 32, 22, 6);
    g.fillStyle(0x1b2a52, 0.55).fillCircle(24, 33, 3.5).fillRect(22.5, 33, 3, 7);
  },
  slash(g) {
    g.lineStyle(9, 0x1b2a52).lineBetween(8, 40, 40, 8);
    g.lineStyle(5, 0xff4d5e).lineBetween(8, 40, 40, 8);
  },
  back(g) {
    g.lineStyle(8, 0xffffff).beginPath().moveTo(30, 8).lineTo(14, 24).lineTo(30, 40).strokePath();
  },
  passenger(g) {
    g.fillStyle(0xffffff).fillCircle(24, 14, 9).fillRoundedRect(9, 27, 30, 18, { tl: 14, tr: 14, bl: 4, br: 4 });
  },
  bulbplus(g) {
    ICONS.hint(g);
  },
};

function makeIcons(scene) {
  for (const [name, draw] of Object.entries(ICONS)) {
    const g = gfx(scene);
    draw(g);
    bake(g, `ic_${name}`, 48, 48);
  }
}

// ---------------------------------------------------------------- backgrounds
function skyGradient(g, top, bottom, h) {
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, GAME_W, h);
}

function skyline(g, baseY, seed, minH, maxH, palette, windows) {
  const r = rand(seed);
  let x = -10;
  while (x < GAME_W) {
    const w = 38 + Math.floor(r() * 46);
    const h = minH + Math.floor(r() * (maxH - minH));
    const col = palette[Math.floor(r() * palette.length)];
    g.fillStyle(col).fillRoundedRect(x, baseY - h, w, h + 40, { tl: 6, tr: 6, bl: 0, br: 0 });
    if (windows) {
      g.fillStyle(0xffffff, 0.35);
      for (let wy = baseY - h + 12; wy < baseY - 10; wy += 16) {
        for (let wx = x + 8; wx < x + w - 12; wx += 14) g.fillRoundedRect(wx, wy, 7, 9, 2);
      }
    }
    x += w + 4 + Math.floor(r() * 8);
  }
}

function makeMenuBackground(scene) {
  const g = gfx(scene);
  skyGradient(g, 0x4cc3ff, 0xcff2ff, GAME_H);
  // sun glow
  g.fillStyle(0xffffff, 0.25).fillCircle(400, 150, 110);
  g.fillStyle(0xfff6c2, 0.9).fillCircle(400, 150, 58);
  // far hills
  g.fillStyle(0x9fe0c4, 0.9).fillEllipse(120, 640, 420, 160).fillEllipse(430, 650, 420, 140);
  skyline(g, 700, 11, 90, 250, [0xa9c7f5, 0xb9b4f0, 0x9dd3f0, 0xc4b0ec], true);
  skyline(g, 740, 23, 60, 160, [0x7fa6ea, 0x8f8ce0, 0x73bde8], true);
  // ground + road
  g.fillStyle(0x6fd49a).fillRect(0, 730, GAME_W, GAME_H - 730);
  g.fillStyle(0x4a526b).fillRect(0, 790, GAME_W, 150);
  g.fillStyle(0x6a738f).fillRect(0, 786, GAME_W, 8);
  g.fillStyle(0xffffff, 0.9);
  for (let x = 10; x < GAME_W; x += 80) g.fillRoundedRect(x, 862, 44, 7, 3);
  g.fillStyle(0x59b680).fillRect(0, 940, GAME_W, 20);
  bake(g, 'bg_menu', GAME_W, GAME_H);
}

function makeTree(scene) {
  const g = gfx(scene);
  g.fillStyle(0x000000, 0.2).fillEllipse(28, 76, 40, 10);
  g.fillStyle(0x8a5a35).fillRoundedRect(24, 48, 9, 28, 3);
  g.fillStyle(0x2f9e57).fillCircle(28, 38, 22);
  g.fillStyle(0x3ed16a).fillCircle(20, 32, 16).fillCircle(37, 30, 15);
  g.fillStyle(0x9cf0b4, 0.7).fillCircle(18, 25, 7).fillCircle(34, 22, 5);
  bake(g, 'tree', 56, 80);
}

function makeStreetlight(scene) {
  const g = gfx(scene);
  g.fillStyle(0x000000, 0.2).fillEllipse(15, 98, 22, 7);
  g.fillStyle(0x55607f).fillRoundedRect(12, 16, 6, 82, 2);
  g.fillStyle(0x55607f).fillRoundedRect(12, 12, 16, 5, 2);
  g.fillStyle(0xfff1a0).fillRoundedRect(20, 15, 14, 8, 4);
  g.fillStyle(0x3b4466).fillRoundedRect(8, 92, 14, 6, 3);
  bake(g, 'streetlight', 40, 100);
}

function makeSignal(scene) {
  const g = gfx(scene);
  g.fillStyle(0x000000, 0.2).fillEllipse(13, 78, 20, 6);
  g.fillStyle(0x55607f).fillRoundedRect(10, 40, 6, 38, 2);
  g.fillStyle(0x1f2438).fillRoundedRect(3, 2, 20, 44, 6);
  g.fillStyle(0x3a4160).fillCircle(13, 13, 5).fillCircle(13, 24, 5).fillCircle(13, 35, 5);
  bake(g, 'signal', 26, 80);
}

function makeGameBackground(scene) {
  const g = gfx(scene);
  // sky + sun + distant city
  skyGradient(g, 0x4fc3ff, 0xdaf4ff, 340);
  g.fillStyle(0xffffff, 0.25).fillCircle(450, 70, 70);
  g.fillStyle(0xfff6c2, 0.95).fillCircle(450, 70, 32);
  skyline(g, 175, 5, 50, 120, [0xa9c7f5, 0xb9b4f0, 0x9dd3f0, 0xc4b0ec], true);

  // terminal building with striped canopy
  g.fillStyle(0x000000, 0.12).fillRoundedRect(54, 132, 440, 76, 14);
  g.fillStyle(0x8fa6cf).fillRoundedRect(50, 126, 440, 78, { tl: 14, tr: 14, bl: 0, br: 0 });
  g.fillStyle(0xe4eefc).fillRoundedRect(58, 134, 424, 70, { tl: 10, tr: 10, bl: 0, br: 0 });
  for (let x = 68; x < 470; x += 34) {
    g.fillStyle(0x62b0e8).fillRoundedRect(x, 164, 26, 40, 4);
    g.fillStyle(0xffffff, 0.4).fillRect(x + 3, 167, 6, 34);
  }
  for (let i = 0; i < 22; i++) {
    g.fillStyle(i % 2 ? 0xffffff : 0xff4d5e).fillRoundedRect(44 + i * 20.5, 118, 21, 16, { tl: 0, tr: 0, bl: 8, br: 8 });
  }
  g.fillStyle(0x1b2a52).fillRoundedRect(150, 140, 240, 24, 9);
  g.lineStyle(2, 0xffd23f).strokeRoundedRect(150, 140, 240, 24, 9);

  // waiting plaza
  g.fillStyle(0xe7edf8).fillRect(0, 204, GAME_W, 130);
  g.fillStyle(0xd5dded);
  for (let y = 204; y < 330; y += 26) g.fillRect(0, y, GAME_W, 2);
  for (let x = 0; x < GAME_W; x += 54) g.fillRect(x, 204, 2, 130);
  // curb (yellow/blue blocks)
  for (let x = 0; x < GAME_W; x += 24) {
    g.fillStyle(x % 48 === 0 ? 0xffd23f : 0x2c3a60).fillRect(x, 332, 24, 8);
  }

  // boarding road
  g.fillGradientStyle(0x5d6684, 0x5d6684, 0x383f56, 0x383f56, 1).fillRect(0, 340, GAME_W, 162);
  g.fillStyle(0xffffff, 0.08).fillRect(0, 340, GAME_W, 6);
  g.fillStyle(0xffd23f, 0.9);
  for (let x = 10; x < GAME_W; x += 46) g.fillRoundedRect(x, 489, 28, 4, 2);

  // green median with bushes
  g.fillStyle(0x59c283).fillRect(0, 502, GAME_W, 16);
  g.fillStyle(0x3ed16a);
  for (let x = 8; x < GAME_W; x += 26) g.fillCircle(x, 506, 8);
  g.fillStyle(0x9cf0b4, 0.5);
  for (let x = 4; x < GAME_W; x += 26) g.fillCircle(x, 502, 3.5);

  // depot ground (grass)
  g.fillGradientStyle(0x7fdc9a, 0x7fdc9a, 0x4fb878, 0x4fb878, 1).fillRect(0, 518, GAME_W, GAME_H - 518);
  g.fillStyle(0x3f9f66, 0.25);
  for (let y = 540; y < GAME_H; y += 36) g.fillRect(0, y, GAME_W, 2);

  // dispatch road in perspective: pavement, asphalt, lighting, edge lines
  g.fillStyle(0xdde4f1).fillPoints([{ x: 28, y: 516 }, { x: 512, y: 516 }, { x: 536, y: 900 }, { x: 4, y: 900 }], true);
  g.fillStyle(0x464e66).fillPoints([{ x: 40, y: 516 }, { x: 500, y: 516 }, { x: 526, y: 900 }, { x: 14, y: 900 }], true);
  g.fillStyle(0x6a7491, 0.35).fillPoints([{ x: 40, y: 516 }, { x: 500, y: 516 }, { x: 514, y: 700 }, { x: 26, y: 700 }], true);
  g.lineStyle(3, 0xffd23f, 0.85);
  g.lineBetween(47, 516, 21, 900).lineBetween(493, 516, 519, 900);

  // soft vignette at the bottom
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.28, 0.28).fillRect(0, 760, GAME_W, 200);
  bake(g, 'bg_game', GAME_W, GAME_H);
}

export function generateAllTextures(scene) {
  COLOR_NAMES.forEach((name) => {
    makeBus(scene, name);
    for (let v = 0; v < 4; v++) makePassenger(scene, name, v);
  });
  makeSpark(scene);
  makeConfetti(scene);
  makeStar(scene);
  makeCoin(scene);
  makeCloud(scene);
  makeArrow(scene);
  makeTree(scene);
  makeStreetlight(scene);
  makeSignal(scene);
  makeIcons(scene);
  makeMenuBackground(scene);
  makeGameBackground(scene);
}
export const TextureFactory = {
  initialize: function(scene) {
    // Agar BootScene initialize dhoondh rahi hai
    generateAllTextures(scene);
  },
  generateAllTextures: generateAllTextures
};
