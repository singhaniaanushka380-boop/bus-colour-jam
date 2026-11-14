// The 3D bus terminal (Three.js): station platform with a winding passenger queue at the top, 4 active bays + 1 VIP bay
// in the middle, and the jammed parking grid (drawn as a diamond) at the bottom. Glossy toy vehicles, stickman
// passengers, soft shadows. The stage knows NOTHING about the rules: GameScene feeds it events from PuzzleValidator.
import * as THREE from 'three';
import { Anim } from './Anim.js';
import {
  buildVehicle, buildGarage, pawnGeometries, MYSTERY_HEX, disposeTree, lambert, sharedGeo,
} from './Models.js';
import { COLORS, GAME_W, GAME_H } from '../config.js';
import { isSpawned, isRevealed, TOTAL_BAYS } from '../systems/PuzzleValidator.js';

// ---- tunable look & feel -------------------------------------------------------------------
export const LIGHT = {
  hemiSky: 0xf2f8ff, hemiGround: 0xa9c58f, hemi: 0.7, // ambient fill
  sun: 0xfff6e2, sunI: 0.62, sunPos: [-6, 16, 7], // key light (casts the soft shadows)
  shadowSize: 1024, // 1024 is kind to phones; 2048 is picked automatically on strong desktops
};
export const CAMERA = { fov: 36, pitchDeg: 58, usable: { top: 0.72, bottom: -0.8, side: 0.97 } };
export const COLORS_UI = { free: 0xffffff, taken: 0xffb02e, vip: 0xffd23f };
const PI = Math.PI;

// ---- layout constants (world units; 1 grid cell = 1 unit) -----------------------------------
const NOSE_Z = -3.1; // north end of the bays
const BAY_LEN = 3.7;
const ROAD_Z = 1.7; // road in front of the bays
const DEP_Z = -3.75; // departure lane in front of the queue
const Q_BOT = -4.85; // z of the queue exit (bottom of the crowd loop)
const QW = 5; // passengers side by side in the crowd lane
const LAT = 0.56; // sideways spacing
const ALONG = 0.56; // spacing along the lane
const PS = 1; // passenger scale (small, like the reference)
const PAX_Y = 0.04;
const POOL_EXTRA = 12;


const THEMES = [
  { name: 'park', sky: 0xc9ecff, top: 0x7ccd52, low: 0xdde1ee, grid: 0xcdd2e3, bush: 0x3ea34a, path: 0xf1e2b6, shelter: false },
  { name: 'city', sky: 0xcfd8ee, top: 0xd4d9ea, low: 0xdde1ee, grid: 0xcdd2e3, bush: 0x4aa35a, path: 0xc2c8dc, shelter: true },
  { name: 'meadow', sky: 0xd8f3ff, top: 0x9bd95a, low: 0xe2e5ef, grid: 0xcdd2e3, bush: 0x2f9a56, path: 0xf3dfa8, shelter: false },
  { name: 'autumn', sky: 0xffefd2, top: 0xd7b05a, low: 0xe9e1d2, grid: 0xd6cdb9, bush: 0xc8641e, path: 0xf1dcae, shelter: false },
  { name: 'snow', sky: 0xe3f1ff, top: 0xeaf4fc, low: 0xe3ecf6, grid: 0xcad7e6, bush: 0x4a9a74, path: 0xffffff, shelter: true },
];

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


const bayTex = {};
function bayTexture(key) {
  const vip = key === 'vip';
  if (bayTex[key]) return bayTex[key];
  const c = document.createElement('canvas');
  c.width = 96; c.height = 352;
  const g = c.getContext('2d');
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.beginPath();
  const x = 5; const y = 5; const w = 86; const h = 342; const r = 24;
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
  g.stroke();
  if (vip) {
    g.save();
    g.translate(48, 176);
    g.rotate(-Math.PI / 2);
    g.fillStyle = '#ffffff';
    g.font = 'bold 52px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('VIP', 0, 0);
    g.restore();
  }
  if (key === 'plus') {
    g.lineWidth = 9;
    g.beginPath(); g.moveTo(48, 150); g.lineTo(48, 202); g.moveTo(22, 176); g.lineTo(74, 176); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  bayTex[key] = t;
  return t;
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
    this.ground = ground;

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
    const Rr = Math.max(w / 2 + 1.5, 5.6);
    const theme = THEMES[(level.id * 5 + Math.floor(level.id / 4)) % THEMES.length];
    // two thick crowd lanes (5 abreast) come down from the top of the screen on both sides, curve round the island
    // and meet at the exit gap in the bottom centre - passengers stand in colour blocks across the lane
    const sx = Math.max(0.5, (Rr - 1.75) / 4.9);
    const baseLane = [[-0.35, -1.7], [-2.4, -1.7], [-4.0, -2.4], [-4.9, -4.6], [-4.6, -7.5], [-3.6, -10], [-3.0, -14.5]];
    const lanes = [1, -1].map((sgn) => {
      const raw = baseLane.map(([x, z]) => v3(sgn * (Math.abs(x) > 0.5 ? x * sx : x), 0, Q_BOT + z));
      const sm = smoothPath(raw, 1.3, 9);
      const pts = []; const cum = [0];
      // resample every ~0.1 along the curve
      let acc = 0;
      pts.push([sm[0].x, sm[0].z]);
      for (let i = 1; i < sm.length; i++) {
        const dx = sm[i].x - sm[i - 1].x; const dz = sm[i].z - sm[i - 1].z;
        const d = Math.hypot(dx, dz);
        if (d < 1e-6) continue;
        acc += d;
        pts.push([sm[i].x, sm[i].z]);
        cum.push(acc);
      }
      return { pts, cum, len: acc };
    });
    const visLane = Math.floor((lanes[0].len - 0.8) / ALONG) * QW;
    this.L = {
      w, h, lotCZ, Rr, zMax: lotCZ + h / 2 + 0.7, zMin: Q_BOT - 6.6,
      bayX: Array.from({ length: TOTAL_BAYS }, (_, i) => ((i === TOTAL_BAYS - 1 ? 0 : i + 1) - 3.5) * 1.12),
      lanes, visLane, theme,
    };
    const L = this.L;
    const lg = new THREE.Group();
    this.lg = lg;
    this.scene.add(lg);
    this.scene.background.setHex(theme.sky);
    this.ground.material.color.setHex(theme.top);

    // the world: themed ground behind, asphalt road band with the bays, pavement for the parking grid
    const roadTop = Q_BOT + 0.45;
    const roadBot = ROAD_Z + 0.5;
    this._box(lg, 80, 0.1, roadBot - roadTop, 0x454b5f, 0, -0.05, (roadTop + roadBot) / 2);
    this._box(lg, 80, 0.12, 0.12, 0xf1f3f8, 0, 0.0, roadTop, { receive: false }); // kerbs
    this._box(lg, 80, 0.12, 0.12, 0xf1f3f8, 0, 0.0, roadBot, { receive: false });
    this._box(lg, 80, 0.1, 40, theme.low, 0, -0.05, roadBot + 20);
    const lot = new THREE.Group();
    lot.position.set(0, 0, lotCZ);
    lg.add(lot);
    for (let i = 0; i <= w; i++) this._box(lot, 0.025, 0.02, h, theme.grid, i - w / 2, 0.01, 0, { receive: false });
    for (let j = 0; j <= h; j++) this._box(lot, w, 0.02, 0.025, theme.grid, 0, 0.01, j - h / 2, { receive: false });

    // white curbs along both edges of both lanes (open at the exit gap)
    const edge = QW * LAT / 2 + 0.3;
    const curbPts = [];
    lanes.forEach((ln) => {
      for (let d = 0; d < ln.len; d += 0.3) {
        const p = this._lanePtOf(ln, d);
        for (const sgn of [-1, 1]) {
          const x = p.x + -p.tz * edge * sgn; const z = p.z + p.tx * edge * sgn;
          if (z < Q_BOT - 12) continue;
          curbPts.push([x, z, Math.atan2(p.tz, p.tx)]);
        }
      }
    });
    const curb = new THREE.InstancedMesh(sharedGeo('curb', () => new THREE.BoxGeometry(0.34, 0.2, 0.16)), lambert(0xf3f5fa), curbPts.length);
    curbPts.forEach((c, i) => {
      this._d.position.set(c[0], 0.05, c[1]);
      this._d.rotation.y = -c[2];
      this._d.updateMatrix();
      curb.setMatrixAt(i, this._d.matrix);
    });
    curb.receiveShadow = true;
    lg.add(curb);
    this._buildProps(lg, theme, Rr);

    // 4 active bays + 1 VIP bay (leftmost): thin rounded outlines painted on the asphalt
    this.bayFrames = [];
    for (let i = 0; i < TOTAL_BAYS; i++) {
      const vip = i === TOTAL_BAYS - 1;
      const mat = new THREE.MeshBasicMaterial({ map: bayTexture(vip ? 'vip' : 'bay'), transparent: true, color: vip ? COLORS_UI.vip : COLORS_UI.free });
      const m = new THREE.Mesh(sharedGeo('bayplane', () => new THREE.PlaneGeometry(1.0, BAY_LEN).rotateX(-PI / 2)), mat);
      m.position.set(L.bayX[i], 0.03, NOSE_Z + BAY_LEN / 2);
      lg.add(m);
      this.bayFrames.push(mat);
    }
    // three extra "+" slots (not in use in this version, just like the locked ones in the reference)
    for (let k = 5; k < 8; k++) {
      const m = new THREE.Mesh(sharedGeo('bayplane', () => new THREE.PlaneGeometry(1.0, BAY_LEN).rotateX(-PI / 2)), new THREE.MeshBasicMaterial({ map: bayTexture('plus'), transparent: true, color: 0x5fe07a, opacity: 0.8 }));
      m.position.set((k - 3.5) * 1.12, 0.03, NOSE_Z + BAY_LEN / 2);
      lg.add(m);
    }
    this.vipCover = { visible: false, material: { opacity: 0 } }; // (the locked VIP slot is simply drawn in gold)

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
    const cap = L.visLane * 2 + POOL_EXTRA;
    const g = pawnGeometries();
    const mk = (geom, shadow) => {
      const m = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ color: 0xffffff }), cap);
      m.castShadow = shadow;
      m.frustumCulled = false;
      lg.add(m);
      return m;
    };
    this.parts = { body: mk(g.body, true), head: mk(g.head, true) };
    this.cap = cap;
    this.free = [];
    this._hideAll();
    this._fitCamera();
  }


  /** Benches and flowering bushes on the lawn round the crowd lanes. */
  _buildProps(lg, th, Rr) {
    const bush = (x, z, k, flowers) => {
      const m = new THREE.Mesh(sharedGeo('bush', () => new THREE.SphereGeometry(0.34, 12, 9)), lambert(th.bush));
      m.position.set(x, 0.18 * k, z);
      m.scale.set(k, 0.75 * k, k);
      m.castShadow = true;
      lg.add(m);
      if (flowers) {
        [[0.25, 0.3, 0xff7ac0], [-0.2, 0.35, 0xffffff], [0.05, 0.42, 0xffd23f]].forEach(([dx, dz, c]) => {
          const f = new THREE.Mesh(sharedGeo('flower', () => new THREE.SphereGeometry(0.06, 6, 5)), lambert(c));
          f.position.set(x + dx * k, 0.4 * k, z + dz * k * 0.5);
          lg.add(f);
        });
      }
    };
    for (const sgn of [-1, 1]) {
      const x = sgn * (Rr - 0.55);
      bush(x, Q_BOT - 0.7, 1.0, true);
      bush(x - sgn * 0.6, Q_BOT - 1.4, 0.7, false);
      if (Rr > 6.6) {
        this._box(lg, 0.8, 0.07, 0.26, 0x9b6a3c, x - sgn * 1.4, 0.3, Q_BOT - 0.9, { shadow: true });
        this._box(lg, 0.8, 0.24, 0.05, 0x9b6a3c, x - sgn * 1.4, 0.46, Q_BOT - 1.05);
      }
      // island between the lanes
      bush(sgn * 0.9, Q_BOT - 4.2, 0.8, sgn > 0);
    }
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
  _pose(slot, x, y, z, yaw, phase, amp, s = 1) {
    const G = this._mG;
    const P = this._mP;
    const M = this._mM;
    const k = Math.sin(phase * 2) * 0.07 * amp; // squash & stretch while walking
    G.makeRotationY(yaw);
    G.scale(this._vs.set(s * PS * (1 + k), s * PS * (1 - k), s * PS * (1 + k)));
    G.setPosition(x, y, z);
    const part = (mesh, oy) => {
      P.makeTranslation(0, oy, 0);
      M.multiplyMatrices(G, P);
      mesh.setMatrixAt(slot, M);
    };
    part(this.parts.body, 0.42);
    part(this.parts.head, 0.86);
    this.pawnDirty = true;
  }

  _paint(slot, colorName) {
    const c = this._colorOf(colorName);
    this.parts.body.setColorAt(slot, c);
    this.parts.head.setColorAt(slot, c);
    Object.values(this.parts).forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  }

  _release(slot) {
    this._mM.makeScale(0.0001, 0.0001, 0.0001);
    this._mM.setPosition(0, -50, 0);
    Object.values(this.parts).forEach((m) => m.setMatrixAt(slot, this._mM));
    this.free.push(slot);
    this.pawnDirty = true;
  }

  _lanePtOf(ln, d) {
    const { pts, cum, len } = ln;
    const dd = Math.min(Math.max(d, 0), len);
    let lo = 1; let hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < dd) lo = mid + 1; else hi = mid; }
    const a = pts[lo - 1]; const b = pts[lo];
    const span = cum[lo] - cum[lo - 1] || 1;
    const t = (dd - cum[lo - 1]) / span;
    const tx = b[0] - a[0]; const tz = b[1] - a[1];
    const tl = Math.hypot(tx, tz) || 1;
    return { x: a[0] + tx * t, z: a[1] + tz * t, tx: tx / tl, tz: tz / tl };
  }

  /** World position of slot k (0 = front) of a lane: rows across the lane in snake order, so neighbours stay adjacent. */
  _slot(lane, k) {
    const row = Math.floor(k / QW);
    const c = k - row * QW;
    const lat = row % 2 ? QW - 1 - c : c;
    const p = this._lanePtOf(this.L.lanes[lane], 0.45 + row * ALONG);
    const off = (lat - (QW - 1) / 2) * LAT;
    return { x: p.x - p.tz * off, z: p.z + p.tx * off, yaw: heading(-p.tx, -p.tz) };
  }

  slotXZ(lane, k) {
    const kk = Math.max(0, k);
    const i0 = Math.floor(kk);
    const f = kk - i0;
    const a = this._slot(lane, i0);
    if (f < 1e-3) return a;
    const b = this._slot(lane, i0 + 1);
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: a.yaw };
  }

  // ------------------------------------------------------------------ positions
  lotToWorld(lx, lz) {
    return { x: lx, z: this.L.lotCZ + lz };
  }
  parkScale(len) { return Math.min(1, 3.3 / len); }
  parkZ(len) { return NOSE_Z + 0.2 + (len * this.parkScale(len)) / 2; }
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
      g.userData.ps = 1;
      g.visible = true;
      const bay = state.bayBus.indexOf(i);
      if (bay >= 0) {
        const p = this.bayWorld(bay, b.len);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = PI / 2;
        g.scale.setScalar(this.parkScale(b.len));
        g.userData.ps = this.parkScale(b.len);
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

  /** (Re)builds the visible crowd from `queue` starting at passenger `qp`. Colour runs alternate between the two lanes. */
  resetQueue(queue, qp, pop = false) {
    this._hideAll();
    this.q = queue;
    this.qNext = qp;
    const n = queue.length;
    this.laneOf = new Int8Array(n);
    this.rankOf = new Int32Array(n);
    this.laneList = [[], []];
    let lane = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0 && queue[i] !== queue[i - 1]) lane ^= 1;
      this.laneOf[i] = lane;
      this.rankOf[i] = this.laneList[lane].length;
      this.laneList[lane].push(i);
    }
    this.laneHead = [0, 0];
    for (let i = 0; i < qp; i++) this.laneHead[this.laneOf[i]]++;
    this.laneNext = [this.laneHead[0], this.laneHead[1]];
    this._topUp(0, pop);
    this._topUp(1, pop);
  }

  _topUp(lane, pop) {
    const list = this.laneList[lane];
    while (this.laneNext[lane] < list.length && this.laneNext[lane] - this.laneHead[lane] < this.L.visLane) {
      this._spawn(list[this.laneNext[lane]], pop);
      this.laneNext[lane]++;
    }
  }

  _spawn(idx, pop) {
    if (idx >= this.q.length || this.qrec.has(idx)) return null;
    const slot = this.free.pop();
    if (slot === undefined) return null;
    const lane = this.laneOf[idx];
    const rel = this.rankOf[idx] - this.laneHead[lane];
    const rec = { idx, slot, lane, d: rel, target: rel, seed: idx * 7, s: pop ? 0.01 : 1, born: pop ? this.t : -9, phase: idx };
    this._paint(slot, this.q[idx]);
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
  _follow(group, pts, speed, ease = 'sine', scaleTo = null) {
    const s0 = group.scale.x;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[lens.length - 1] || 1;
    let seg = 1;
    return this.anim.tween({
      dur: (total / speed) * 1000, ease,
      update: (e) => {
        if (scaleTo != null) group.scale.setScalar(s0 + (scaleTo - s0) * e);
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
    const ps = this.parkScale(this.level.buses[i].len);
    const ok = await this._follow(e.obj.group, pts, 8, 'sine', ps);
    if (ok) { e.obj.group.rotation.y = PI / 2; e.obj.group.userData.ps = ps; }
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
    const lane = this.laneOf[idx];
    this.laneHead[lane]++;
    this.qrec.forEach((r) => { if (r.lane === lane) r.target = this.rankOf[r.idx] - this.laneHead[lane]; });
    this._topUp(lane, true);
    const e = this.buses[busIdx];
    const bx = this.L.bayX[bay];
    const squash = () => { this._squash(e.obj.group); return true; };
    if (!rec) return Promise.resolve(squash());
    const from = this.slotXZ(lane, rec.d);
    const door = v3(bx + (Math.random() - 0.5) * 0.3, PAX_Y, NOSE_Z - 0.3);
    // run out through the exit gap, then straight to the vehicle's door
    const pts = [v3(from.x, 0, from.z), v3(0, 0, Q_BOT + 0.1), v3(door.x, 0, door.z)];
    const l1 = pts[0].distanceTo(pts[1]);
    const l2 = pts[1].distanceTo(pts[2]);
    const run = ((l1 + l2) / 7) * 1000;
    const hop = 220;
    let phase = rec.phase;
    return this.anim.tween({
      dur: run + hop, ease: 'linear',
      update: (p) => {
        const t = p * (run + hop);
        if (t < run) {
          const sd = (t / run) * (l1 + l2);
          const a = sd < l1 ? pts[0] : pts[1];
          const b = sd < l1 ? pts[1] : pts[2];
          const u = sd < l1 ? sd / l1 : (sd - l1) / l2;
          phase += 0.9;
          this._pose(rec.slot, a.x + (b.x - a.x) * u, PAX_Y + Math.abs(Math.sin(phase)) * 0.08, a.z + (b.z - a.z) * u, heading(b.x - a.x, b.z - a.z), phase, 1.4, 1);
        } else {
          const u = (t - run) / hop;
          this._pose(rec.slot, door.x, PAX_Y + Math.sin(u * PI) * 0.55 + u * 0.3, door.z + (NOSE_Z + 0.25 - door.z) * u, heading(0, -1), 0, 0, 1 - u * 0.85);
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
      update: (t) => { const k = Math.sin(t * PI); const b = group.userData.ps || 1; group.scale.set(b * (1 + k * 0.04), b * (1 - k * 0.06), b * (1 + k * 0.04)); },
    }).then(() => { const b = group.userData.ps || 1; group.scale.set(b, b, b); });
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
      update: (t) => { o.paint.color.setHex(lerpHex(from, to, t)); const k = (g.userData.ps || 1) * (1 + Math.sin(t * PI) * 0.1); g.scale.set(k, k, k); },
    }).then(() => { g.scale.setScalar(g.userData.ps || 1); o.paint.color.setHex(to); return true; });
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
        update: (t) => { o.paint.color.setHex(lerpHex(from, to, t)); const k = (g.userData.ps || 1) * (1 + Math.sin(t * PI) * 0.12); g.scale.set(k, k, k); },
      }).then(() => { g.scale.setScalar(g.userData.ps || 1); o.paint.color.setHex(to); }));
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
    const k = Math.min(1, dt * 9);
    this.qrec.forEach((r) => {
      const moving = Math.abs(r.target - r.d) > 0.02;
      if (r.target !== r.d) r.d += (r.target - r.d) * k;
      if (r.s < 1) r.s = Math.min(1, (this.t - r.born) / 0.3);
      const p = this.slotXZ(r.lane, r.d);
      const front = r.idx === this.qNext;
      if (moving) r.phase += dt * 16;
      const bob = front ? Math.abs(Math.sin(this.t * 5)) * 0.09 : Math.abs(Math.sin(this.t * 2.4 + r.seed)) * 0.015;
      const yaw = front ? heading(0, 1) : p.yaw;
      this._pose(r.slot, p.x, PAX_Y + bob, p.z, yaw, r.phase, moving ? 1.2 : 0, Math.max(0.01, r.s));
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
