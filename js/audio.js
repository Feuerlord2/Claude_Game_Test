// All audio is synthesized with WebAudio — zero asset downloads.
// Context is created lazily on the first user gesture (autoplay policy).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.soundOn = true;
    this.musicOn = true;
    this.disabled = false;   // test mode
    this.musicTimer = null;
    this.lastHeartbeat = 0;
  }

  init() {
    if (this.disabled || this.ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
      if (this.musicOn) this.startMusic();
    } catch (e) {
      this.disabled = true;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSound(on) { this.soundOn = on; }

  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  // ---- music: a slow ambient pad + occasional sparkle notes ----
  startMusic() {
    if (!this.ctx || this.padOsc) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(0, t);
    this.musicGain.gain.linearRampToValueAtTime(0.05, t + 2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.connect(this.musicGain);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.padOsc = [];
    for (const [freq, detune] of [[110, 0], [164.81, 4], [220, -3]]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = this.ctx.createGain();
      g.gain.value = 0.33;
      o.connect(g);
      g.connect(filter);
      o.start();
      this.padOsc.push(o);
    }
    this.padLfo = lfo;
    this.padFilter = filter;

    this.musicTimer = setInterval(() => this.sparkle(), 5200);
  }

  stopMusic() {
    if (!this.ctx || !this.padOsc) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.linearRampToValueAtTime(0, t + 0.6);
    const osc = this.padOsc;
    const lfo = this.padLfo;
    setTimeout(() => {
      for (const o of osc) { try { o.stop(); } catch {} }
      try { lfo.stop(); } catch {}
    }, 800);
    this.padOsc = null;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  sparkle() {
    if (!this.ctx || !this.musicOn || document.hidden) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880];
    const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
    this.tone({ freq: f, type: 'sine', gain: 0.03, attack: 0.4, decay: 2.2, dest: this.musicGain });
  }

  // ---- one-shot helpers ----
  tone({ freq, endFreq, type = 'sine', gain = 0.2, attack = 0.005, decay = 0.25, dest = null, detune = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + decay);
    o.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  noise({ gain = 0.15, decay = 0.15, freq = 1200 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * decay));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  // ---- game events ----
  drop() {
    if (!this.soundOn || !this.ctx) return;
    this.tone({ freq: 200, endFreq: 90, type: 'sine', gain: 0.12, decay: 0.12 });
    this.noise({ gain: 0.03, decay: 0.08, freq: 2200 });
  }

  merge(tier, chain) {
    if (!this.soundOn || !this.ctx) return;
    // Rising pentatonic: each tier is a step up; chains push the octave.
    const penta = [0, 2, 4, 7, 9];
    const idx = tier + Math.min(chain - 1, 4);
    const semis = penta[idx % 5] + 12 * Math.floor(idx / 5);
    const freq = 261.63 * Math.pow(2, semis / 12);
    this.tone({ freq, type: 'triangle', gain: 0.16, decay: 0.3 });
    this.tone({ freq: freq * 2, type: 'sine', gain: 0.06, decay: 0.22, detune: 6 });
    if (tier >= 6) this.tone({ freq: 70 + tier * 4, type: 'sine', gain: 0.18, decay: 0.5 });
    if (tier >= 9) this.noise({ gain: 0.08, decay: 0.5, freq: 500 });
  }

  bhBirth() {
    if (!this.soundOn || !this.ctx) return;
    this.tone({ freq: 32, endFreq: 68, type: 'sine', gain: 0.35, attack: 0.05, decay: 1.4 });
    this.noise({ gain: 0.1, decay: 1.2, freq: 300 });
  }

  bhEat() {
    if (!this.soundOn || !this.ctx) return;
    this.tone({ freq: 320, endFreq: 60, type: 'sine', gain: 0.08, decay: 0.18 });
  }

  bhFinale() {
    if (!this.soundOn || !this.ctx) return;
    this.tone({ freq: 55, endFreq: 28, type: 'sine', gain: 0.4, decay: 1.2 });
    this.noise({ gain: 0.15, decay: 0.9, freq: 800 });
    const penta = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    penta.forEach((f, i) => setTimeout(() => this.tone({ freq: f, type: 'sine', gain: 0.07, decay: 0.5 }), i * 70));
  }

  heartbeat(level) {
    if (!this.soundOn || !this.ctx) return;
    const now = performance.now();
    const interval = 900 - level * 500;
    if (now - this.lastHeartbeat < interval) return;
    this.lastHeartbeat = now;
    this.tone({ freq: 55, endFreq: 40, type: 'sine', gain: 0.14 + level * 0.1, decay: 0.16 });
  }

  gameover() {
    if (!this.soundOn || !this.ctx) return;
    [392, 311.13, 233.08].forEach((f, i) =>
      setTimeout(() => this.tone({ freq: f, endFreq: f * 0.94, type: 'triangle', gain: 0.16, decay: 0.5 }), i * 180));
  }

  revive() {
    if (!this.soundOn || !this.ctx) return;
    this.tone({ freq: 200, endFreq: 800, type: 'sawtooth', gain: 0.06, decay: 0.7 });
    this.tone({ freq: 100, endFreq: 400, type: 'sine', gain: 0.12, decay: 0.7 });
  }

  click() {
    if (!this.soundOn || !this.ctx) return;
    this.tone({ freq: 660, type: 'sine', gain: 0.05, decay: 0.06 });
  }
}
