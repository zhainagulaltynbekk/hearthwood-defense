import { SaveData } from './SaveData';

export type SoundName =
  | 'shoot_archer'
  | 'shoot_cannon'
  | 'shoot_frost'
  | 'shoot_mage'
  | 'hit'
  | 'explode'
  | 'death'
  | 'boss_death'
  | 'place'
  | 'upgrade'
  | 'sell'
  | 'wave_start'
  | 'boss_wave'
  | 'life_lost'
  | 'click'
  | 'error'
  | 'gold'
  | 'victory'
  | 'defeat';

/** Minimum seconds between two plays of the same sound (keeps big fights from turning into noise). */
const THROTTLE: Partial<Record<SoundName, number>> = {
  shoot_archer: 0.05,
  shoot_cannon: 0.08,
  shoot_frost: 0.07,
  shoot_mage: 0.08,
  hit: 0.045,
  explode: 0.07,
  death: 0.04,
  gold: 0.06,
};

/**
 * Procedural sound effects with the Web Audio API - no audio files.
 * The AudioContext is created lazily on the first user gesture so browsers
 * never log autoplay warnings.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private _muted: boolean;
  private readonly lastPlayed = new Map<SoundName, number>();

  constructor() {
    this._muted = SaveData.getMuted();
  }

  get muted(): boolean {
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    SaveData.setMuted(muted);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  toggleMute(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  /** Call from a user gesture (pointer / key). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.6);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this._muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const throttle = THROTTLE[name];
    if (throttle !== undefined) {
      const last = this.lastPlayed.get(name) ?? -1;
      if (now - last < throttle) return;
    }
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'shoot_archer':
        this.tone('triangle', 720, 240, 0.09, 0.16, now);
        this.noiseHit(3200, 'highpass', 0.04, 0.08, now);
        break;
      case 'shoot_cannon':
        this.tone('sine', 140, 38, 0.38, 0.55, now);
        this.noiseHit(700, 'lowpass', 0.28, 0.45, now);
        break;
      case 'shoot_frost':
        this.tone('sine', 1500, 2300, 0.14, 0.12, now);
        this.tone('triangle', 2200, 1700, 0.12, 0.06, now + 0.02);
        break;
      case 'shoot_mage':
        this.tone('sawtooth', 980, 260, 0.16, 0.1, now, 2400);
        this.noiseHit(4200, 'bandpass', 0.16, 0.14, now);
        break;
      case 'hit':
        this.noiseHit(2400, 'bandpass', 0.035, 0.12, now);
        break;
      case 'explode':
        this.noiseHit(500, 'lowpass', 0.45, 0.5, now);
        this.tone('sine', 90, 30, 0.4, 0.45, now);
        break;
      case 'death':
        this.tone('square', 520, 140, 0.1, 0.06, now, 1800);
        this.tone('sine', 300, 600, 0.08, 0.08, now + 0.04);
        break;
      case 'boss_death':
        this.tone('sawtooth', 220, 40, 0.9, 0.25, now, 900);
        this.noiseHit(400, 'lowpass', 0.8, 0.5, now);
        this.arp([523, 659, 784, 1046], 0.09, 'triangle', 0.14, now + 0.3);
        break;
      case 'place':
        this.tone('triangle', 240, 110, 0.14, 0.3, now);
        this.noiseHit(900, 'lowpass', 0.08, 0.2, now);
        break;
      case 'upgrade':
        this.arp([523, 659, 784, 1046], 0.065, 'square', 0.07, now, 2600);
        break;
      case 'sell':
        this.arp([1046, 784], 0.07, 'triangle', 0.14, now);
        break;
      case 'gold':
        this.tone('triangle', 1568, 1568, 0.07, 0.05, now);
        break;
      case 'wave_start':
        this.horn([294, 440], now);
        break;
      case 'boss_wave':
        this.horn([196, 294, 233], now);
        this.tone('sine', 60, 50, 1.0, 0.4, now);
        break;
      case 'life_lost':
        this.tone('sawtooth', 330, 110, 0.32, 0.18, now, 1200);
        this.tone('sine', 165, 70, 0.32, 0.25, now);
        break;
      case 'click':
        this.tone('triangle', 900, 700, 0.04, 0.12, now);
        break;
      case 'error':
        this.tone('square', 180, 150, 0.12, 0.07, now, 900);
        this.tone('square', 150, 120, 0.12, 0.07, now + 0.1, 900);
        break;
      case 'victory':
        this.arp([523, 659, 784, 1046, 784, 1046, 1318], 0.12, 'triangle', 0.16, now);
        break;
      case 'defeat':
        this.arp([440, 392, 349, 262], 0.22, 'sawtooth', 0.08, now, 1100);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at: number, lowpass = 0): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.012, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node: AudioNode = osc;
    if (lowpass > 0) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = osc.connect(f);
    }
    node.connect(gain).connect(this.master!);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private noiseHit(freq: number, type: BiquadFilterType, dur: number, vol: number, at: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(at, Math.random() * 0.3);
    src.stop(at + dur + 0.02);
  }

  private arp(freqs: number[], step: number, type: OscillatorType, vol: number, at: number, lowpass = 0): void {
    freqs.forEach((f, i) => this.tone(type, f, f * 1.01, step * 1.6, vol, at + i * step, lowpass));
  }

  private horn(freqs: number[], at: number): void {
    freqs.forEach((f, i) => {
      this.tone('sawtooth', f, f, 0.34, 0.12, at + i * 0.18, 1300);
      this.tone('sawtooth', f * 1.005, f * 1.005, 0.34, 0.08, at + i * 0.18, 900);
    });
  }
}
