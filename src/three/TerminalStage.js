// The 3D bus terminal (Three.js): station platform with a winding passenger queue at the top, 4 active bays + 1 VIP bay
// in the middle, and the jammed parking grid (drawn as a diamond) at the bottom. Glossy toy vehicles, stickman
// passengers, soft shadows. The stage knows NOTHING about the rules: GameScene feeds it events from PuzzleValidator.
import * as THREE from 'three';
import { Anim } from './Anim.js';
import {
  buildVehicle, buildGarage, pawnGeometries, SKIN_TONES, MYSTERY_HEX, disposeTree, lambert, sharedGeo,
} from './Models.js';
import { COLORS, GAME_W, GAME_H } from '../config.js';
import { isSpawned, isRevealed, TOTAL_BAYS } from '../systems/PuzzleValidator.js';

// ---- tunable look & feel -------------------------------------------------------------------
export const LIGHT = {
  hemiSky: 0xf2f8ff, hemiGround: 0xa9c58f, hemi: 0.7, // ambient fill
  sun: 0xfff6e2, sunI: 0.62, sunPos: [-6, 16, 7], // key light (casts the soft shadows)
  shadowSize: 1024, // 1024 is kind to phones; 2048 is picked automatically on strong desktops
};
export const CAMERA = { fov: 36, pitchDeg: 64, usable: { top: 0.72, bottom: -0.8, side: 0.97 } };
export const COLORS_UI = { free: 0xffffff, taken: 0xffb02e, vip: 0xffd23f };
const PI = Math.PI;

// ---- layout constants (world units; 1 grid cell = 1 unit) -----------------------------------
const NOSE_Z = -3.3; // north end of the bays
const BAY_LEN = 4.1;
const ROAD_Z = 1.7; // road in front of the bays
const DEP_Z = -4.3; // departure road between bays and the station
const Q_Z0 = -5.75; // z of the first queue row (front)
const ROW_SP = 0.62; // distance between queue rows
const GAP = 0.5; // distance between neighbours in the queue
const ROWS = 5;
const VIS_MAX = 60;
const PAX_Y = 0.06;
const POOL_EXTRA = 24;

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const heading = (dx, dz) => Math.atan2(-dz, dx);
const lerpHex = (a, b, t) => {
  const ar = (a >> 16) & 255; const ag = (a >> 8) & 255; const ab = a & 255;
  const br = (b >> 16) & 255; const bg = (b >> 8) & 255; const bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
};

function smoothPath(pts, radius = 0.6, steps = 7) {
  if (pts.length < 3) return pts.map((p) => p.clone());
  const out = [pts[0].clone()];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const v = pts[i];
    const b = pts[i + 1];
    const da = a.clone().sub(v);
    const db = b.clone().sub(v);
    if (da.length() < 1e-4 || db.length() < 1e-4) continue;
    const ra = Math.min(radius, da.length() / 2);
    const rb = Math.min(radius, db.length() / 2);
    const p1 = v.clone().add(da.normalize().multiplyScalar(ra));
    const p2 = v.clone().add(db.normalize().multiplyScalar(rb));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push(v3(u * u * p1.x + 2 * u * t * v.x + t * t * p2.x, 0, u * u * p1.z + 2 * u * t * v.z + t * t * p2.z));
    }
  }
  out.push(pts[pts.length - 1].clone());
  return out;
}

let tileTex = null;
function tileTexture() {
  if (tileTex) return tileTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#dfe8f5'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
  g.strokeStyle = '#c9d3e4'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64);
  tileTex = new THREE.CanvasTexture(c);
  tileTex.colorSpace = THREE.SRGBColorSpace;
  tileTex.wrapS = THREE.RepeatWrapping;
  tileTex.wrapT = THREE.RepeatWrapping;
  return tileTex;
}

export class TerminalStage {
  constructor(game) {
    this.game = game;
    this.ok = false;
    this.visible = false;
    this.t = 0;
    this.anim = new Anim();
    this.level = null;
    this.lg = null;
    this.buses = [];
    this.qrec = new Map();
    this.q = [];
    this.qNext = 0;
    this.hitList = [];
    this.hint = null;
    this.colorCache = new Map();
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn('[BusColorJam] WebGL unavailable', e);
      return;
    }
    this.ok = true;
    const low = (navigator.hardwareConcurrency || 4) <= 4;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.root = document.createElement('div');
    this.root.id = 'three-root';
    this.root.style.display = 'none';
    const el = this.renderer.domElement;
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.display = 'block';
    this.root.appendChild(el);
    document.body.insertBefore(this.root, document.body.firstChild);
    el.addEventListener('webglcontextlost', (e) => e.preventDefault());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe6ff);
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, GAME_W / GAME_H, 0.5, 200);
    this.raycaster = new THREE.Raycaster();
    this._d = new THREE.Object3D();
    this._mG = new THREE.Matrix4();
    this._mP = new THREE.Matrix4();
    this._mM = new THREE.Matrix4();
    this._vs = new THREE.Vector3();
    this._buildLights();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-PI / 2), lambert(0x7bd957));
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this._onResize = () => this.syncRect();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    game.scale.on('resize', this._onResize);
    this.syncRect();
  }

  // ------------------------------------------------------------------ canvas / camera
  syncRect() {
    if (!this.ok) return;
    const r = this.game.canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const el = this.renderer.domElement;
    el.style.left = `${r.left}px`;
    el.style.top = `${r.top}px`;
    el.style.width = `${r.width}px`;
    el.style.height = `${r.height}px`;
    this.renderer.setSize(r.width, r.height, false);
    const aspect = r.width / r.height;
    if (Math.abs(aspect - this.camera.aspect) > 1e-4) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      if (this.level) this._fitCamera();
    }
  }

  show() {
    if (!this.ok) return;
    this.root.style.display = 'block';
    this.visible = true;
    this.syncRect();
  }

  hide() {
    if (!this.ok) return;
    this.root.style.display = 'none';
    this.visible = false;
  }

  /** Aims the camera so the whole terminal fits inside the area not covered by the HUD. */
  _fitCamera() {
    const { Rr, zMax, zMin } = this.L;
    const cam = this.camera;
    const u = CAMERA.usable;
    const p = (CAMERA.pitchDeg * PI) / 180;
    const up = v3(0, Math.cos(p), -Math.sin(p));
    const corners = [];
    for (const x of [-(Rr + 0.4), Rr + 0.4]) for (const z of [zMin, zMax]) for (const y of [0, 1.2]) corners.push(v3(x, y, z));
    const target = v3(0, 0, (zMin + zMax) / 2);
    let dist = 20;
    const place = () => {
      cam.position.set(target.x, target.y + Math.sin(p) * dist, target.z + Math.cos(p) * dist);
      cam.lookAt(target);
      cam.updateMatrixWorld(true);
    };
    const bbox = () => {
      let minX = 9; let maxX = -9; let minY = 9; let maxY = -9;
      for (const c of corners) {
        const q = c.clone().project(cam);
        minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
        minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
      }
      return { minX, maxX, minY, maxY };
    };
    const fits = () => {
      const b = bbox();
      return b.maxX <= u.side && b.minX >= -u.side && b.maxY <= u.top && b.minY >= u.bottom;
    };
    for (let iter = 0; iter < 3; iter++) {
      let lo = 6;
      let hi = 120;
      for (let k = 0; k < 24; k++) {
        dist = (lo + hi) / 2;
        place();
        if (fits()) hi = dist; else lo = dist;
      }
      dist = hi;
      place();
      const b = bbox();
      const dy = (b.minY + b.maxY) / 2 - (u.top + u.bottom) / 2;
      const H = dist * Math.tan((CAMERA.fov * PI) / 360);
      target.addScaledVector(up, dy * H);
    }
    place();
  }

  /** World point -> design-space (540x960) coordinates for Phaser labels. */
  project(x, y, z) {
    const q = v3(x, y, z).project(this.camera);
    return { x: (q.x * 0.5 + 0.5) * GAME_W, y: (1 - (q.y * 0.5 + 0.5)) * GAME_H };
  }

  _buildLights() {
    const k = PI; // three r155+ uses physical units: x PI matches the classic look
    this.scene.add(new THREE.HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemi * k));
    const sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunI * k);
    sun.position.set(...LIGHT.sunPos);
    sun.target.position.set(0, 0, 4);
    sun.castShadow = true;
    const hi = (navigator.hardwareConcurrency || 4) > 4 && window.devicePixelRatio <= 2;
    sun.shadow.mapSize.set(hi ? 2048 : LIGHT.shadowSize, hi ? 2048 : LIGHT.shadowSize);
    const sc = sun.shadow.camera;
    sc.left = -13; sc.right = 13; sc.top = 17; sc.bottom = -17; sc.near = 2; sc.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  _box(parent, w, h, d, color, x, y, z, { shadow = false, receive = true } = {}) {
    const m = new THREE.Mesh(sharedGeo(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), lambert(color));
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = receive;
    parent.add(m);
    return m;
  }

  // ------------------------------------------------------------------ level
  _clearLevel() {
    this.anim.clear();
    this._clearHint();
    if (this.lg) {
      this.scene.remove(this.lg);
      disposeTree(this.lg);
      this.lg = null;
    }
    this.buses = [];
    this.qrec = new Map();
    this.hitList = [];
    this.garages = [];
  }

  load(level) {
    if (!this.ok) return;
    this._clearLevel();
    this.level = level;
    const { w, h } = level;
    const lotCZ = ROAD_Z + 0.9 + h / 2;
    const Rr = Math.max(w / 2 + 1.5, 4.2);
    const rowLen = Rr - 0.9;
    // winding queue path: starts in the middle of the front row, then snakes back and forth away from the camera
    const pts = [[0, Q_Z0], [rowLen, Q_Z0]];
    for (let r = 1; r < ROWS; r++) {
      const z = Q_Z0 - r * ROW_SP;
      pts.push([r % 2 ? rowLen : -rowLen, z]);
      pts.push([r % 2 ? -rowLen : rowLen, z]);
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const qLen = cum[cum.length - 1];
    this.L = {
      w, h, lotCZ, Rr, zMax: lotCZ + h / 2 + 0.7, zMin: Q_Z0 - (ROWS - 1) * ROW_SP - 0.6,
      bayX: Array.from({ length: TOTAL_BAYS }, (_, i) => (i - (TOTAL_BAYS - 1) / 2) * 1.12),
      qpts: pts, qcum: cum, qLen, vis: Math.min(VIS_MAX, Math.floor(qLen / GAP) + 1),
    };
    const L = this.L;
    const lg = new THREE.Group();
    this.lg = lg;
    this.scene.add(lg);

    // asphalt road area with a tiled border, the parking grid on it, and the tiled station platform
    const slabW = 2 * (Rr + 0.5);
    const z0 = DEP_Z - 0.75;
    const zc0 = (z0 + L.zMax + 0.3) / 2;
    this._box(lg, slabW + 0.6, 0.08, L.zMax + 0.3 - z0 + 0.4, 0xe9e4d2, 0, -0.06, zc0); // tiled kerb border
    this._box(lg, slabW, 0.1, L.zMax + 0.3 - z0, 0x434a5d, 0, -0.05, zc0); // asphalt
    const lot = new THREE.Group();
    lot.position.set(0, 0, lotCZ);
    lg.add(lot);
    this._box(lot, w + 1.1, 0.08, h + 1.1, 0xe9e4d2, 0, 0.0, 0);
    this._box(lot, w + 0.7, 0.1, h + 0.7, 0x565e73, 0, 0.005, 0);
    for (let i = 0; i <= w; i++) this._box(lot, 0.04, 0.02, h, 0x8c95ab, i - w / 2, 0.056, 0, { receive: false });
    for (let j = 0; j <= h; j++) this._box(lot, w, 0.02, 0.04, 0x8c95ab, 0, 0.056, j - h / 2, { receive: false });

    const platW = slabW + 0.6;
    const platD = (ROWS - 1) * ROW_SP + 1.9;
    const platZ = Q_Z0 + 0.55 - platD / 2;
    const tiles = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tileTexture() });
    const plat = new THREE.Mesh(new THREE.BoxGeometry(platW, 0.12, platD), tiles);
    plat.position.set(0, 0.0, platZ);
    plat.receiveShadow = true;
    lg.add(plat);
    this._box(lg, platW, 0.14, 0.16, 0xffd23f, 0, 0.04, Q_Z0 + 0.62, { receive: false }); // yellow edge strip
    this._box(lg, platW, 0.5, 0.14, 0x8fa6cc, 0, 0.3, platZ - platD / 2, { shadow: true }); // back wall
    this._box(lg, 0.14, 0.4, platD, 0x8fa6cc, -platW / 2, 0.25, platZ, { shadow: true });
    this._box(lg, 0.14, 0.4, platD, 0x8fa6cc, platW / 2, 0.25, platZ, { shadow: true });

    // 4 active bays + 1 VIP bay
    this.bayFrames = [];
    for (let i = 0; i < TOTAL_BAYS; i++) {
      const bx = L.bayX[i];
      const zc = NOSE_Z + BAY_LEN / 2;
      const vip = i === TOTAL_BAYS - 1;
      const p = new THREE.Mesh(sharedGeo('baypad', () => new THREE.PlaneGeometry(1.0, BAY_LEN).rotateX(-PI / 2)), lambert(vip ? 0x6b5a2a : 0x5d657b));
      p.position.set(bx, 0.013, zc);
      p.receiveShadow = true;
      lg.add(p);
      const mat = new THREE.MeshBasicMaterial({ color: vip ? COLORS_UI.vip : COLORS_UI.free });
      const bar = (bw, bd, x, z) => {
        const m = new THREE.Mesh(sharedGeo(`bb${bw}|${bd}`, () => new THREE.BoxGeometry(bw, 0.02, bd)), mat);
        m.position.set(x, 0.022, z);
        lg.add(m);
      };
      bar(0.06, BAY_LEN, bx - 0.5, zc);
      bar(0.06, BAY_LEN, bx + 0.5, zc);
      bar(1.06, 0.06, bx, NOSE_Z);
      bar(1.06, 0.06, bx, NOSE_Z + BAY_LEN);
      this.bayFrames.push(mat);
    }
    const cover = new THREE.Mesh(
      sharedGeo('vipcover', () => new THREE.PlaneGeometry(1.0, BAY_LEN).rotateX(-PI / 2)),
      new THREE.MeshBasicMaterial({ color: 0x10172c, transparent: true, opacity: 0.6 }),
    );
    cover.position.set(L.bayX[TOTAL_BAYS - 1], 0.03, NOSE_Z + BAY_LEN / 2);
    lg.add(cover);
    this.vipCover = cover;

    // tunnel garages behind the head of every chain
    this.garages = [];
    level.tunnels.forEach((chain) => {
      const head = level.buses[chain[0]];
      const gx = head.x - head.dx * head.len - (w - 1) / 2;
      const gy = head.y - head.dy * head.len - (h - 1) / 2;
      const pos = this.lotToWorld(gx, gy);
      const gar = buildGarage();
      gar.position.set(pos.x, 0, pos.z);
      gar.rotation.y = heading(head.dx, head.dy);
      lg.add(gar);
      this.garages.push(gar);
    });

    // vehicles
    level.buses.forEach((b, i) => {
      const obj = buildVehicle(b.color, b.len, b.mystery);
      obj.index = i;
      obj.hit.userData.index = i;
      lg.add(obj.group);
      this.buses.push({ obj, where: 'lot', bay: -1 });
    });

    // instanced stickman crowd: 6 draw calls for the whole queue
    const cap = L.vis + POOL_EXTRA;
    const g = pawnGeometries();
    const mk = (geom, shadow) => {
      const m = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: 0xffffff }), cap);
      m.castShadow = shadow;
      m.frustumCulled = false;
      lg.add(m);
      return m;
    };
    this.parts = { body: mk(g.body, true), head: mk(g.head, false), legL: mk(g.leg, false), legR: mk(g.leg, false), armL: mk(g.arm, false), armR: mk(g.arm, false) };
    this.cap = cap;
    this.free = [];
    this._hideAll();
    this._fitCamera();
  }

  _colorOf(name) {
    if (!this.colorCache.has(name)) this.colorCache.set(name, new THREE.Color(COLORS[name].main));
    return this.colorCache.get(name);
  }

  _hideAll() {
    this.free = [];
    this.qrec = new Map();
    this._mM.makeScale(0.0001, 0.0001, 0.0001);
    this._mM.setPosition(0, -50, 0);
    for (let i = this.cap - 1; i >= 0; i--) {
      Object.values(this.parts).forEach((m) => m.setMatrixAt(i, this._mM));
      this.free.push(i);
    }
    this.pawnDirty = true;
  }

  /** Writes the pose of one stickman: position, facing, walking phase/amplitude, scale. */
  _pose(slot, x, y, z, yaw, phase, amp, s = 1, armsUp = 0) {
    const G = this._mG;
    const P = this._mP;
    const M = this._mM;
    G.makeRotationY(yaw);
    G.scale(this._vs.set(s, s, s));
    G.setPosition(x, y, z);
    const part = (mesh, ox, oy, oz, swing) => {
      P.makeRotationZ(swing);
      P.setPosition(ox, oy, oz);
      M.multiplyMatrices(G, P);
      mesh.setMatrixAt(slot, M);
    };
    const sw = Math.sin(phase) * 0.75 * amp;
    part(this.parts.body, 0, 0.36, 0, 0);
    part(this.parts.head, 0, 0.78, 0, 0);
    part(this.parts.legL, 0, 0.22, -0.07, sw);
    part(this.parts.legR, 0, 0.22, 0.07, -sw);
    part(this.parts.armL, 0, 0.55, -0.15, -sw * 0.9 - armsUp);
    part(this.parts.armR, 0, 0.55, 0.15, sw * 0.9 + armsUp);
    this.pawnDirty = true;
  }

  _paint(slot, colorName, seed) {
    const c = this._colorOf(colorName);
    if (!this._navy) { this._navy = new THREE.Color(0x2b3556); this._skin = SKIN_TONES.map((hx) => new THREE.Color(hx)); }
    this.parts.body.setColorAt(slot, c);
    this.parts.armL.setColorAt(slot, c);
    this.parts.armR.setColorAt(slot, c);
    this.parts.legL.setColorAt(slot, this._navy);
    this.parts.legR.setColorAt(slot, this._navy);
    this.parts.head.setColorAt(slot, this._skin[Math.abs(seed) % this._skin.length]);
    Object.values(this.parts).forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  _release(slot) {
    this._mM.makeScale(0.0001, 0.0001, 0.0001);
    this._mM.setPosition(0, -50, 0);
    Object.values(this.parts).forEach((m) => m.setMatrixAt(slot, this._mM));
    this.free.push(slot);
    this.pawnDirty = true;
  }

  /** Point on the winding queue at distance d (world units) from the front, plus the facing along the queue. */
  pathAt(d) {
    const { qpts, qcum, qLen } = this.L;
    const dd = Math.min(Math.max(d, 0), qLen);
    let i = 1;
    while (i < qcum.length - 1 && qcum[i] < dd) i++;
    const a = qpts[i - 1];
    const b = qpts[i];
    const span = qcum[i] - qcum[i - 1] || 1;
    const t = (dd - qcum[i - 1]) / span;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw: heading(a[0] - b[0], a[1] - b[1]) };
  }

  // ------------------------------------------------------------------ positions
  lotToWorld(lx, lz) {
    return { x: lx, z: this.L.lotCZ + lz };
  }
  parkZ(len) { return NOSE_Z + 0.12 + len / 2; }
  busLotPose(i) {
    const b = this.level.buses[i];
    const cx = b.x - (b.dx * (b.len - 1)) / 2 - (this.L.w - 1) / 2;
    const cy = b.y - (b.dy * (b.len - 1)) / 2 - (this.L.h - 1) / 2;
    const p = this.lotToWorld(cx, cy);
    const wdx = b.dx;
    const wdz = b.dy;
    return { x: p.x, z: p.z, rot: heading(wdx, wdz), wdx, wdz, lx: cx, lz: cy };
  }
  busCenter(i) { return this.buses[i].obj.group.position; }
  bayWorld(bay, len) { return v3(this.L.bayX[bay], 0, this.parkZ(len)); }

  // ------------------------------------------------------------------ state sync (start, undo, revive)
  sync(state) {
    if (!this.ok) return;
    this.anim.clear();
    this._clearHint();
    const lvl = this.level;
    this.hitList = [];
    lvl.buses.forEach((b, i) => {
      const e = this.buses[i];
      const g = e.obj.group;
      e.obj.glow(0, 0);
      e.obj.setColor(state.col[i]);
      e.obj.setRevealed(isRevealed(lvl, state, i));
      g.scale.set(1, 1, 1);
      g.visible = true;
      const bay = state.bayBus.indexOf(i);
      if (bay >= 0) {
        const p = this.bayWorld(bay, b.len);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = PI / 2;
        e.where = 'bay'; e.bay = bay;
        e.obj.setRevealed(true);
      } else if (state.removed & (1 << i)) {
        g.visible = false; e.where = 'gone'; e.bay = -1;
      } else {
        const p = this.busLotPose(i);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.rot;
        e.bay = -1;
        if (isSpawned(lvl, state, i)) { e.where = 'lot'; this.hitList.push(e.obj.hit); } else { e.where = 'garage'; g.visible = false; }
      }
    });
    this.bayFrames.forEach((m, k) => {
      if (k === TOTAL_BAYS - 1 && !state.vip) m.color.setHex(COLORS_UI.vip);
      else m.color.setHex(state.bayBus[k] >= 0 ? COLORS_UI.taken : (k === TOTAL_BAYS - 1 ? COLORS_UI.vip : COLORS_UI.free));
    });
    this.vipCover.visible = !state.vip;
    this.resetQueue(state.queue, state.qp);
  }

  /** (Re)builds the visible queue from `queue` starting at passenger `qp`. */
  resetQueue(queue, qp, pop = false) {
    this._hideAll();
    this.q = queue;
    this.qNext = qp;
    for (let k = 0; k < this.L.vis; k++) this._spawn(qp + k, pop);
  }

  _spawn(idx, pop) {
    if (idx >= this.q.length || this.qrec.has(idx)) return null;
    const slot = this.free.pop();
    if (slot === undefined) return null;
    const rec = { idx, slot, d: idx - this.qNext, target: idx - this.qNext, seed: idx * 7, s: pop ? 0.01 : 1, born: pop ? this.t : -9, phase: idx };
    this._paint(slot, this.q[idx], idx * 7 + 3);
    this.qrec.set(idx, rec);
    return rec;
  }

  // ------------------------------------------------------------------ interaction
  pick(x, y) {
    if (!this.ok || !this.hitList.length) return -1;
    this.raycaster.setFromCamera({ x: (x / GAME_W) * 2 - 1, y: -((y / GAME_H) * 2 - 1) }, this.camera);
    this.lg.updateMatrixWorld(true);
    const hits = this.raycaster.intersectObjects(this.hitList, false);
    return hits.length ? hits[0].object.userData.index : -1;
  }

  // ------------------------------------------------------------------ animation
  _follow(group, pts, speed, ease = 'sine') {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[lens.length - 1] || 1;
    let seg = 1;
    return this.anim.tween({
      dur: (total / speed) * 1000, ease,
      update: (e) => {
        const s = e * total;
        while (seg < pts.length - 1 && lens[seg] < s) seg++;
        while (seg > 1 && lens[seg - 1] > s) seg--;
        const a = pts[seg - 1];
        const b = pts[seg];
        const span = lens[seg] - lens[seg - 1] || 1;
        const t = Math.min(1, Math.max(0, (s - lens[seg - 1]) / span));
        group.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        if (dx * dx + dz * dz > 1e-8) group.rotation.y = heading(dx, dz);
      },
    });
  }

  _routeToBay(i, bay) {
    const { Rr, w, h, bayX } = this.L;
    const b = this.level.buses[i];
    const pose = this.busLotPose(i);
    const g = this.buses[i].obj.group.position;
    let t;
    if (b.dx > 0) t = w / 2 + 1.3 - pose.lx;
    else if (b.dx < 0) t = pose.lx + w / 2 + 1.3;
    else if (b.dy > 0) t = h / 2 + 1.3 - pose.lz;
    else t = pose.lz + h / 2 + 1.3;
    const E = this.lotToWorld(pose.lx + b.dx * t, pose.lz + b.dy * t);
    const bx = bayX[bay];
    const pts = [v3(g.x, 0, g.z)];
    if (b.dy < 0) {
      pts.push(v3(E.x, 0, ROAD_Z)); // straight north onto the road in front of the bays
    } else {
      const side = b.dx !== 0 ? b.dx : (E.x >= 0 ? 1 : -1);
      const rx = side * Math.max(Rr, Math.abs(E.x));
      pts.push(v3(E.x, 0, E.z), v3(rx, 0, E.z), v3(rx, 0, ROAD_Z));
    }
    pts.push(v3(bx, 0, ROAD_Z), v3(bx, 0, this.parkZ(b.len)));
    return smoothPath(pts);
  }

  /** Vehicle leaves its grid cell, drives out along its arrow and parks nose-first in `bay`. */
  async driveToBay(i, bay) {
    const e = this.buses[i];
    e.where = 'bay'; e.bay = bay;
    e.obj.setRevealed(true);
    this.hitList = this.hitList.filter((h) => h !== e.obj.hit);
    this.bayFrames[bay].color.setHex(COLORS_UI.taken);
    this._clearHint();
    const pts = this._routeToBay(i, bay);
    const ok = await this._follow(e.obj.group, pts, 8, 'sine');
    if (ok) e.obj.group.rotation.y = PI / 2;
    return ok;
  }

  async departBus(i, bay) {
    const e = this.buses[i];
    const { Rr } = this.L;
    const bx = this.L.bayX[bay];
    const start = e.obj.group.position;
    const pts = smoothPath([v3(start.x, 0, start.z), v3(bx, 0, DEP_Z), v3(Rr + 5, 0, DEP_Z)], 0.8);
    this.bayFrames[bay].color.setHex(bay === TOTAL_BAYS - 1 ? COLORS_UI.vip : COLORS_UI.free);
    e.where = 'gone';
    const ok = await this._follow(e.obj.group, pts, 9, 'in');
    if (ok) e.obj.group.visible = false;
    return ok;
  }

  /** A garage pushes its next vehicle out into the freed cells. */
  async emerge(i) {
    const e = this.buses[i];
    const b = this.level.buses[i];
    const pose = this.busLotPose(i);
    const g = e.obj.group;
    const sx = pose.x - pose.wdx * b.len;
    const sz = pose.z - pose.wdz * b.len;
    g.position.set(sx, 0, sz);
    g.rotation.y = pose.rot;
    g.visible = true;
    e.where = 'lot';
    const ok = await this.anim.tween({ dur: 550, ease: 'out', update: (t) => g.position.set(sx + (pose.x - sx) * t, 0, sz + (pose.z - sz) * t) });
    if (ok) this.hitList.push(e.obj.hit);
    return ok;
  }

  /** The front passenger runs to the vehicle's door, jumps in; resolves true when inside. */
  boardOne(busIdx, bay) {
    const idx = this.qNext++;
    const rec = this.qrec.get(idx);
    this.qrec.delete(idx);
    this.qrec.forEach((r) => { r.target = r.idx - this.qNext; });
    this._spawn(this.qNext + this.L.vis - 1, true);
    const e = this.buses[busIdx];
    const bx = this.L.bayX[bay];
    const squash = () => { this._squash(e.obj.group); return true; };
    if (!rec) return Promise.resolve(squash());
    const from = this.pathAt(rec.d * GAP);
    const door = v3(bx + (Math.random() - 0.5) * 0.3, PAX_Y, NOSE_Z - 0.3);
    const dist = Math.hypot(door.x - from.x, door.z - from.z);
    const run = (dist / 6.5) * 1000;
    const hop = 220;
    const yaw = heading(door.x - from.x, door.z - from.z);
    let phase = rec.phase;
    return this.anim.tween({
      dur: run + hop, ease: 'linear',
      update: (p) => {
        const t = p * (run + hop);
        if (t < run) {
          const u = t / run;
          phase += 0.9;
          this._pose(rec.slot, from.x + (door.x - from.x) * u, PAX_Y + Math.abs(Math.sin(phase)) * 0.08, from.z + (door.z - from.z) * u, yaw, phase, 1.4, 1);
        } else {
          const u = (t - run) / hop;
          this._pose(rec.slot, door.x, PAX_Y + Math.sin(u * PI) * 0.55 + u * 0.3, door.z + (NOSE_Z + 0.25 - door.z) * u, yaw, 0, 0, 1 - u * 0.85, 1.2);
        }
      },
    }).then((ok) => {
      this._release(rec.slot);
      return ok ? squash() : false;
    });
  }

  _squash(group) {
    return this.anim.tween({
      dur: 160, ease: 'sine',
      update: (t) => { const k = Math.sin(t * PI); group.scale.set(1 + k * 0.04, 1 - k * 0.06, 1 + k * 0.04); },
    }).then(() => { group.scale.set(1, 1, 1); });
  }

  bump(i) {
    const e = this.buses[i];
    const g = e.obj.group;
    const base = g.position.clone();
    const pose = this.busLotPose(i);
    e.obj.glow(0xff2a2a, 0.5);
    return this.anim.tween({
      dur: 420, ease: 'linear',
      update: (t) => {
        const k = Math.sin(t * PI * 5) * 0.1 * (1 - t);
        g.position.set(base.x + pose.wdx * k, 0, base.z + pose.wdz * k);
        e.obj.glow(0xff2a2a, 0.5 * (1 - t));
      },
    }).then(() => { g.position.copy(base); e.obj.glow(0, 0); });
  }

  flashBlockers(list) {
    list.forEach((i) => {
      const o = this.buses[i].obj;
      this.anim.tween({ dur: 700, ease: 'linear', update: (t) => o.glow(0xffa000, 0.65 * (1 - t)) }).then(() => o.glow(0, 0));
    });
  }

  flashBays(state) {
    this.bayFrames.forEach((m, k) => {
      if (k === TOTAL_BAYS - 1 && !state?.vip) return;
      this.anim.tween({ dur: 500, ease: 'linear', update: (t) => m.color.setHex(Math.floor(t * 6) % 2 ? 0xffffff : 0xff4b4b) }).then(() => m.color.setHex(COLORS_UI.taken));
    });
  }

  /** Mystery vehicle shows its true colour. */
  async reveal(i) {
    const o = this.buses[i].obj;
    if (o.revealed) return true;
    o.revealed = true;
    o.decal.visible = false;
    const from = MYSTERY_HEX;
    const to = COLORS[o.color].main;
    const g = o.group;
    return this.anim.tween({
      dur: 380, ease: 'out',
      update: (t) => { o.paint.color.setHex(lerpHex(from, to, t)); const k = 1 + Math.sin(t * PI) * 0.1; g.scale.set(k, k, k); },
    }).then(() => { g.scale.set(1, 1, 1); o.paint.color.setHex(to); return true; });
  }

  /** Shuffle Vehicle Colors: every changed vehicle blends to its new colour. */
  recolor(col, state) {
    const jobs = [];
    this.buses.forEach((e, i) => {
      if (e.where === 'gone' || e.obj.color === col[i]) return;
      const o = e.obj;
      const from = o.revealed ? COLORS[o.color].main : MYSTERY_HEX;
      o.color = col[i];
      if (!o.revealed) return;
      const to = COLORS[col[i]].main;
      const g = o.group;
      jobs.push(this.anim.tween({
        dur: 520, ease: 'out',
        update: (t) => { o.paint.color.setHex(lerpHex(from, to, t)); const k = 1 + Math.sin(t * PI) * 0.12; g.scale.set(k, k, k); },
      }).then(() => { g.scale.set(1, 1, 1); o.paint.color.setHex(to); }));
    });
    return Promise.all(jobs);
  }

  /** VIP bay unlocked. */
  setVip(unlocked, animate) {
    const bay = TOTAL_BAYS - 1;
    this.bayFrames[bay].color.setHex(unlocked ? COLORS_UI.free : COLORS_UI.vip);
    if (!animate) { this.vipCover.visible = !unlocked; return Promise.resolve(); }
    return this.anim.tween({
      dur: 500, ease: 'out',
      update: (t) => { this.vipCover.material.opacity = 0.6 * (1 - t); },
    }).then(() => { this.vipCover.visible = !unlocked; this.vipCover.material.opacity = 0.6; });
  }

  // ------------------------------------------------------------------ hint arrow
  setHint(i) {
    this._clearHint();
    if (i == null || i < 0 || !this.ok) return;
    const arrow = new THREE.Mesh(
      sharedGeo('hintcone', () => new THREE.ConeGeometry(0.26, 0.55, 12).rotateX(PI)),
      new THREE.MeshBasicMaterial({ color: 0xffd31a }),
    );
    this.lg.add(arrow);
    this.hint = { i, arrow };
  }

  _clearHint() {
    if (!this.hint) return;
    this.lg?.remove(this.hint.arrow);
    this.buses[this.hint.i]?.obj.glow(0, 0);
    this.hint = null;
  }

  // ------------------------------------------------------------------ frame
  update(dtSec) {
    if (!this.ok || !this.visible || !this.level) return;
    const dt = Math.min(dtSec, 0.05);
    this.t += dt;
    this.anim.update(dt * 1000);
    if (this.hint) {
      const e = this.buses[this.hint.i];
      const c = e.obj.group.position;
      this.hint.arrow.position.set(c.x, 1.9 + Math.sin(this.t * 6) * 0.14, c.z);
      this.hint.arrow.rotation.y = this.t * 2;
      e.obj.glow(0xffd31a, 0.28 + 0.22 * Math.sin(this.t * 6));
    }
    // the queue: shuffle forward, idle bob, the front passenger hops
    const k = Math.min(1, dt * 12);
    this.qrec.forEach((r) => {
      const moving = Math.abs(r.target - r.d) > 0.02;
      if (r.target !== r.d) r.d += (r.target - r.d) * k;
      if (r.s < 1) r.s = Math.min(1, (this.t - r.born) / 0.3);
      const p = this.pathAt(r.d * GAP);
      const front = r.idx === this.qNext;
      if (moving) r.phase += dt * 16;
      const bob = front ? Math.abs(Math.sin(this.t * 5)) * 0.09 : Math.abs(Math.sin(this.t * 2.4 + r.seed)) * 0.015;
      const yaw = front ? heading(0, 1) : p.yaw;
      this._pose(r.slot, p.x, PAX_Y + bob, p.z, yaw, r.phase, moving ? 1.2 : 0, Math.max(0.01, r.s), front ? 1.1 : 0);
    });
    if (this.pawnDirty) {
      Object.values(this.parts).forEach((m) => { m.instanceMatrix.needsUpdate = true; });
      this.pawnDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

let stage = null;
export function getStage(game) {
  if (!stage) stage = new TerminalStage(game);
  return stage;
}
