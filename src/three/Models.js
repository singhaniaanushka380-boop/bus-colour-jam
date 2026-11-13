// Procedural 3D models: three glossy toy vehicles (Compact Car 4 seats, Minivan 6, Big Bus 10) with windows, wheels,
// headlights and ONE white direction arrow on the roof, a tunnel garage, and the geometry for the instanced
// stickman passengers (pill body, head, swinging arms and legs).
import * as THREE from 'three';
import { COLORS } from '../config.js';

// ---- shared resources (never disposed with a level)
const shared = new Set();
const keep = (o) => { shared.add(o); return o; };
export const isShared = (o) => shared.has(o);

const lambertCache = new Map();
export function lambert(hex) {
  if (!lambertCache.has(hex)) lambertCache.set(hex, keep(new THREE.MeshLambertMaterial({ color: hex })));
  return lambertCache.get(hex);
}

function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Rounded slab: length along X, width along Z, height along Y, centred on the origin. */
export function slab(len, wid, height, radius, bevel = 0.04) {
  const g = new THREE.ExtrudeGeometry(rrShape(len, wid, radius), {
    depth: height, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6,
  });
  g.translate(0, 0, -height / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

const geoCache = new Map();
const geo = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, keep(make()));
  return geoCache.get(key);
};
/** Cached geometry for repeated scenery pieces (kept for the whole session). */
export const sharedGeo = geo;

function arrowShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.4, -0.09);
  s.lineTo(0.0, -0.09);
  s.lineTo(0.0, -0.27);
  s.lineTo(0.42, 0);
  s.lineTo(0.0, 0.27);
  s.lineTo(0.0, 0.09);
  s.lineTo(-0.4, 0.09);
  s.closePath();
  return s;
}

function questionTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff';
  g.font = 'bold 118px "Trebuchet MS", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 10;
  g.strokeStyle = '#1b2a52';
  g.strokeText('?', 64, 70);
  g.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let qTex = null;

const M = {
  glass: keep(new THREE.MeshStandardMaterial({ color: 0x1d2b46, roughness: 0.1, metalness: 0.3 })),
  tyre: keep(new THREE.MeshLambertMaterial({ color: 0x1b1d26 })),
  hub: keep(new THREE.MeshLambertMaterial({ color: 0xd6dcea })),
  arrow: keep(new THREE.MeshBasicMaterial({ color: 0xffffff })),
  arrowEdge: keep(new THREE.MeshBasicMaterial({ color: 0x1b2a52 })),
  head: keep(new THREE.MeshBasicMaterial({ color: 0xfff6c8 })),
  tail: keep(new THREE.MeshBasicMaterial({ color: 0xff4040 })),
  hit: keep(new THREE.MeshBasicMaterial({ visible: false })),
  dark: keep(new THREE.MeshLambertMaterial({ color: 0x2a2f3d })),
  concrete: keep(new THREE.MeshLambertMaterial({ color: 0xc9d0de })),
};
export const MYSTERY_HEX = 0x6b7490;

// per type: body height, cabin height, cabin length factor, cabin x shift, width
const TYPES = {
  2: { name: 'Compact Car', lowerH: 0.3, cabinH: 0.26, cabinK: 0.6, cabinShift: -0.08, wid: 0.78, wheels: 2 },
  3: { name: 'Minivan', lowerH: 0.34, cabinH: 0.42, cabinK: 0.86, cabinShift: -0.04, wid: 0.8, wheels: 2 },
  4: { name: 'Bus', lowerH: 0.4, cabinH: 0.5, cabinK: 0.94, cabinShift: 0, wid: 0.86, wheels: 3 },
  5: { name: 'Coach', lowerH: 0.4, cabinH: 0.5, cabinK: 0.95, cabinShift: 0, wid: 0.86, wheels: 3 },
  6: { name: 'Mega Bus', lowerH: 0.42, cabinH: 0.5, cabinK: 0.96, cabinShift: 0, wid: 0.88, wheels: 4 },
};

/**
 * Vehicle facing +X, centred on the origin, wheels on y=0. `len` = grid cells long (2 car, 3 minivan, 4 bus).
 * `mystery` vehicles are painted slate with a "?" until revealed.
 */
export function buildVehicle(colorName, len, mystery = false) {
  const T = TYPES[len];
  const L = len - 0.14;
  const g = new THREE.Group();
  const real = COLORS[colorName].main;
  const paint = new THREE.MeshStandardMaterial({ color: mystery ? MYSTERY_HEX : real, roughness: 0.24, metalness: 0.08 });
  const baseY = 0.17;
  const lower = new THREE.Mesh(geo(`vl${len}`, () => slab(L, T.wid, T.lowerH, 0.22)), paint);
  lower.position.y = baseY + T.lowerH / 2 + 0.04;
  const cabLen = (L - 0.1) * T.cabinK;
  const cabin = new THREE.Mesh(geo(`vc${len}`, () => slab(cabLen, T.wid - 0.1, T.cabinH, 0.2)), paint);
  const cabY = baseY + T.lowerH + 0.08 + T.cabinH / 2;
  cabin.position.set(L * T.cabinShift, cabY, 0);
  [lower, cabin].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
  const roofY = cabY + T.cabinH / 2 + 0.04;

  const sideGlass = geo(`vg${len}`, () => new THREE.BoxGeometry(cabLen - 0.3, T.cabinH * 0.55, 0.02));
  const halfW = (T.wid - 0.1) / 2 + 0.045;
  [-1, 1].forEach((s) => {
    const w = new THREE.Mesh(sideGlass, M.glass);
    w.position.set(cabin.position.x - 0.02, cabY + 0.01, s * halfW);
    g.add(w);
  });
  const wind = new THREE.Mesh(geo(`vw${len}`, () => new THREE.BoxGeometry(0.02, T.cabinH * 0.55, T.wid - 0.32)), M.glass);
  wind.position.set(cabin.position.x + cabLen / 2 + 0.045, cabY + 0.01, 0);
  g.add(wind);

  // headlights + tail lights
  const lamp = geo('lamp', () => new THREE.SphereGeometry(0.075, 8, 6));
  [-1, 1].forEach((s) => {
    const h = new THREE.Mesh(lamp, M.head);
    h.position.set(L / 2 + 0.03, baseY + 0.2, s * (T.wid / 2 - 0.2));
    g.add(h);
    const t = new THREE.Mesh(lamp, M.tail);
    t.position.set(-L / 2 - 0.03, baseY + 0.2, s * (T.wid / 2 - 0.2));
    t.scale.set(0.7, 0.8, 1.1);
    g.add(t);
  });

  const tyre = geo('tyre', () => new THREE.CylinderGeometry(0.17, 0.17, 0.12, 14).rotateX(Math.PI / 2));
  const hub = geo('hub', () => new THREE.CylinderGeometry(0.08, 0.08, 0.13, 10).rotateX(Math.PI / 2));
  const xs = T.wheels === 4 ? [L / 2 - 0.42, L / 6, -L / 6, -(L / 2 - 0.42)] : T.wheels === 3 ? [L / 2 - 0.42, 0, -(L / 2 - 0.42)] : [L / 2 - 0.4, -(L / 2 - 0.4)];
  xs.forEach((x) => {
    [-1, 1].forEach((s) => {
      const w = new THREE.Mesh(tyre, M.tyre);
      w.position.set(x, 0.17, s * (T.wid / 2 - 0.02));
      w.castShadow = true;
      g.add(w);
      const hb = new THREE.Mesh(hub, M.hub);
      hb.position.set(x, 0.17, s * (T.wid / 2 - 0.02));
      g.add(hb);
    });
  });

  // direction arrow on the roof (white, dark outline)
  const arrowGeo = geo('arrow', () => new THREE.ShapeGeometry(arrowShape()).rotateX(-Math.PI / 2));
  const k = len === 2 ? 0.9 : 1.15;
  const ax = cabin.position.x + (len === 2 ? 0.0 : 0.05);
  const edge = new THREE.Mesh(arrowGeo, M.arrowEdge);
  edge.position.set(ax, roofY + 0.004, 0);
  edge.scale.set(1.2 * k, 1, 1.3 * k);
  g.add(edge);
  const arrow = new THREE.Mesh(arrowGeo, M.arrow);
  arrow.position.set(ax, roofY + 0.012, 0);
  arrow.scale.set(k, 1, k);
  g.add(arrow);

  // "?" decal for mystery vehicles
  if (!qTex) qTex = keep(questionTexture());
  const qMat = new THREE.MeshBasicMaterial({ map: qTex, transparent: true, depthWrite: false });
  const q = new THREE.Mesh(geo('qplane', () => new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2)), qMat);
  q.position.set(-L / 2 + 0.55 + (len === 2 ? 0.1 : 0), roofY + 0.02, 0);
  q.visible = mystery;
  g.add(q);

  const hit = new THREE.Mesh(geo(`hit${len}`, () => new THREE.BoxGeometry(len + 0.1, 1.2, 1.1)), M.hit);
  hit.position.y = 0.55;
  g.add(hit);

  const api = {
    group: g, color: colorName, len, type: T.name, paint, hit, index: -1, mystery, revealed: !mystery, decal: q, decalMat: qMat,
    /** emissive tint (0 = none) used for hint pulse / blocked flash */
    glow(hex, amount) {
      paint.emissive.setHex(hex);
      paint.emissiveIntensity = amount;
    },
    setColor(name) {
      api.color = name;
      if (api.revealed) paint.color.setHex(COLORS[name].main);
    },
    setRevealed(on) {
      api.revealed = on;
      paint.color.setHex(on ? COLORS[api.color].main : MYSTERY_HEX);
      q.visible = !on && api.mystery;
    },
    dispose() { paint.dispose(); qMat.dispose(); },
  };
  hit.userData.bus = api;
  return api;
}

/** Tunnel garage (opening faces +X). */
export function buildGarage() {
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(geo(`gar${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  add(1.2, 1.3, 0.2, -0.5, 0.65, 0, M.dark); // back wall (dark inside)
  add(1.0, 0.18, 1.3, -0.05, 1.3, 0, M.concrete); // lintel
  add(1.0, 1.2, 0.16, -0.05, 0.6, 0.58, M.concrete); // pillars
  add(1.0, 1.2, 0.16, -0.05, 0.6, -0.58, M.concrete);
  add(0.08, 0.12, 1.1, 0.46, 1.32, 0, M.arrow); // white mouth trim
  return g;
}

/** Shared geometry for the instanced stickman crowd (pivots at hip / shoulder for limb swing). */
export function pawnGeometries() {
  return {
    // chubby gummy people: a fat rounded body with a small head, one colour (like the reference crowd)
    body: geo('px-body', () => new THREE.CapsuleGeometry(0.29, 0.26, 5, 14)),
    head: geo('px-head', () => new THREE.SphereGeometry(0.2, 16, 12)),
  };
}
export const SKIN_TONES = [0xffd9b8, 0xf1c08f, 0xd9a066, 0xa8734a, 0x7a4d2e];

/** Frees everything under `obj` that is not a shared cached resource. */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry && !isShared(o.geometry)) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => { if (!isShared(m)) m.dispose(); });
    if (o.isInstancedMesh && o.dispose) o.dispose();
  });
}
