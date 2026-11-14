// Story sound engine: speech narration + data sonification + rain ambience.
// Everything is synthesised in the browser (Web Audio + Web Speech): no files,
// no external services. Starts only after the user turns sound on.

const PENTA = [0, 2, 4, 7, 9]; // major pentatonic steps

class StorySound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private timers: number[] = [];

  start() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.buildRain();
      this.buildDrone();
    }
    this.ctx.resume();
    this.enabled = true;
    this.droneGain?.gain.setTargetAtTime(0.035, this.ctx.currentTime, 1.5);
  }

  stop() {
    this.enabled = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    if (this.ctx) {
      this.rainGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
      this.droneGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
  }

  private buildRain() {
    const ctx = this.ctx!, len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.6;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6000;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    src.connect(bp).connect(lp).connect(this.rainGain).connect(this.master!);
    src.start();
  }

  private buildDrone() {
    const ctx = this.ctx!;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0;
    [55, 82.4, 110].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i === 2 ? "triangle" : "sine"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.5;
      o.connect(g).connect(this.droneGain!); o.start();
    });
    this.droneGain.connect(this.master!);
  }

  /** 0 = dry, 1 = downpour. */
  rain(level: number) {
    if (!this.enabled || !this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, this.ctx.currentTime, 0.8);
  }

  note(freq: number, at = 0, dur = 0.5, vol = 0.18, type: OscillatorType = "sine") {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  blip() { this.note(1320, 0, 0.12, 0.05, "triangle"); }

  /** Play a data series as rising/falling notes; returns its length in ms. */
  playSeries(values: number[], stepMs = 420, second?: number[]): number {
    if (!this.enabled || values.length === 0) return 0;
    const all = [...values, ...(second ?? [])];
    const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
    const freqOf = (v: number) => {
      const k = Math.round(((v - lo) / span) * 9); // 2 octaves of pentatonic
      const semis = PENTA[k % 5] + 12 * Math.floor(k / 5);
      return 220 * 2 ** (semis / 12);
    };
    values.forEach((v, i) => this.note(freqOf(v), (i * stepMs) / 1000, 0.55, 0.2, "sine"));
    second?.forEach((v, i) => this.note(freqOf(v) * 2, (i * stepMs + stepMs / 2) / 1000, 0.3, 0.07, "triangle"));
    return values.length * stepMs + 400;
  }

  speak(text: string, delayMs = 0) {
    if (!this.enabled || typeof window === "undefined" || !window.speechSynthesis) return;
    const go = () => {
      if (!this.enabled) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98; u.pitch = 1; u.lang = "en-GB";
      const v = window.speechSynthesis.getVoices().find((x) => /en[-_](GB|US)/i.test(x.lang) && /natural|google|microsoft/i.test(x.name))
        ?? window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("en"));
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    };
    if (delayMs) this.timers.push(window.setTimeout(go, delayMs)); else go();
  }
}

export const storySound = new StorySound();
