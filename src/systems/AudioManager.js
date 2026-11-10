const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  { root: 48, notes: [60, 64, 67, 72] },
  { root: 45, notes: [57, 60, 64, 69] },
  { root: 41, notes: [53, 57, 60, 65] },
  { root: 43, notes: [55, 59, 62, 67] },
];
const ARP =;
const MELODY = [
  [76, null, 79, null, 76, null, 74, null],
  [72, null, 76, null, 77, null, 76, null],
  [77, null, 76, null, 72, null, 69, null],
  [74, null, 79, 77, 76, null, null, null],
];

export class AudioManager {
  constructor(save) {
    this.save = save;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;

    // Auto-unlock audio on the user's very first tap or click anywhere on screen
    this._gestureHandler = () => {
      this.unlock();
    };
    window.addEventListener('pointerdown', this._gestureHandler, { passive: true });
    window.addEventListener('touchstart', this._gestureHandler, { passive: true });
    window.addEventListener('keydown', this._gestureHandler, { passive: true });

    this._onVis = () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', this._onVis);
  }

  get soundOn() { return this.save.settings.sound; }
  get musicOn() { return this.save.settings.music; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 1.0;
      this.master.connect(this.ctx.destination);
      
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.85;
      this.sfxGain.connect(this.master);
      
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.30;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.applyMusic();
  }

  setSound(on) { this.save.setSetting('sound', on); this.unlock(); }
  setMusic(on) { this.save.setSetting('music', on); this.unlock(); this.applyMusic(); }

  applyMusic() {
    if (!this.ctx) return;
    if (this.musicOn && !this.timer) {
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this._schedule(), 90);
    } else if (!this.musicOn && this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') {
      if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1;
      return;
    }
    const eighth = 60 / 112 / 2;
    while (this.nextTime < this.ctx.currentTime + 0.35) {
      const bar = Math.floor(this.step / 8) % CHORDS.length;
      const i = this.step % 8;
      const chord = CHORDS[bar];
      const t = this.nextTime;
      this._note(midi(chord.notes[ARP[i]] - 12), t, eighth * 0.9, 'triangle', 0.5, this.musicGain);
      if (i === 0 || i === 4) this._note(midi(chord.root - 12), t, eighth * 3.6, 'sine', 0.9, this.musicGain);
      const m = MELODY[bar][i];
      if (m) this._note(midi(m - 12), t, eighth * 1.8, 'sine', 0.55, this.musicGain);
      this.nextTime += eighth;
      this.step++;
    }
  }

  _note(freq, time, dur, type, vol, dest, slideTo) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, time + dur);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(dest);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  _sfxTone(freq, delay, dur, type = 'sine', vol = 0.5, slideTo) {
    if (!this.ctx) return;
    this._note(freq, this.ctx.currentTime + delay, dur, type, vol, this.sfxGain, slideTo);
  }

  sfx(name, n = 0) {
    if (!this.soundOn) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    switch (name) {
      case 'click': this._sfxTone(660, 0, 0.07, 'triangle', 0.45); break;
      case 'park': this._sfxTone(220, 0, 0.18, 'sawtooth', 0.22, 140); this._sfxTone(330, 0.04, 0.12, 'triangle', 0.35); break;
      case 'board': this._sfxTone(midi(72 + Math.min(n, 7) * 2), 0, 0.12, 'sine', 0.5); break;
      case 'depart': this._sfxTone(300, 0, 0.35, 'square', 0.15, 600); this._sfxTone(900, 0.05, 0.2, 'triangle', 0.3); break;
      case 'coin': this._sfxTone(1318, 0, 0.08, 'square', 0.18); this._sfxTone(1760, 0.07, 0.16, 'square', 0.18); break;
      case 'unlock': this._sfxTone(500, 0, 0.1, 'triangle', 0.45); this._sfxTone(750, 0.09, 0.18, 'triangle', 0.45); break;
      case 'error': this._sfxTone(160, 0, 0.18, 'sawtooth', 0.25, 110); break;
      case 'star': this._sfxTone(midi(76 + n * 4), 0, 0.3, 'triangle', 0.5); break;
      case 'win': [72, 76, 79, 84].forEach((m, i) => this._sfxTone(midi(m), i * 0.12, 0.32, 'triangle', 0.45)); break;
      case 'fail': [67, 64, 60].forEach((m, i) => this._sfxTone(midi(m - 12), i * 0.18, 0.3, 'sawtooth', 0.25)); break;
      default: break;
    }
  }

  destroy() {
    if (this.timer) window.clearInterval(this.timer);
    window.removeEventListener('pointerdown', this._gestureHandler);
    window.removeEventListener('touchstart', this._gestureHandler);
    window.removeEventListener('keydown', this._gestureHandler);
    document.removeEventListener('visibilitychange', this._onVis);
  }
}

export default AudioManager;
