// Story sound: a generative documentary score, narration, data sonification and rain.
// Everything is synthesised in the browser (Web Audio + Web Speech): no audio files, no licences,
// no external services. Nothing plays until the reader turns sound on.
//
// The score: slow evolving string-like pads through a long reverb, a sub-bass, sparse piano notes,
// and per-chapter colour (rain, sonar pings, a heartbeat for tension). Music dips under the narrator.
import type { Mood } from "@/lib/storyScript";

const PENTA = [0, 2, 4, 7, 9]; // major pentatonic steps, for the data melody
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Chords as MIDI notes, lowest first: [root, ...upper voices]. Modal, D minor / F major colours. */
const C = {
  Dm9: [38, 57, 62, 64, 65], Bbmaj7: [34, 53, 57, 62, 65], Fmaj7: [41, 57, 60, 64, 65], Csus: [36, 55, 60, 62, 67],
  Gm9: [43, 58, 62, 65, 69], Asus: [45, 57, 62, 64, 69], Am9: [45, 59, 60, 64, 67], Dm7: [38, 57, 60, 62, 65],
  Esus: [40, 59, 62, 64, 69], CE: [40, 55, 60, 64, 67], Dm: [38, 57, 62, 65, 69], Bb: [34, 53, 58, 62, 65],
  Gm: [43, 55, 58, 62, 67], A: [45, 57, 61, 64, 69], F: [41, 57, 60, 65, 69], C: [36, 55, 60, 64, 67], Bbmaj9: [34, 53, 57, 60, 62],
};

interface MoodSpec {
  chords: number[][];
  bar: number;          // seconds per chord
  bright: number;       // pad filter cutoff (Hz)
  pad: number;          // pad level
  piano: number;        // chance of a piano note per beat (0-1)
  rain?: number;        // rain level 0-1 (overridden by real rainfall in "sky")
  ping?: boolean;       // sonar pings
  pulse?: boolean;      // heartbeat
}

const MOODS: Record<Mood, MoodSpec> = {
  prologue: { chords: [C.Dm9, C.Bbmaj7, C.Fmaj7, C.Csus], bar: 9, bright: 700, pad: 0.9, piano: 0.18 },
  sky:      { chords: [C.Dm9, C.Gm9, C.Bbmaj7, C.Asus], bar: 9, bright: 950, pad: 0.8, piano: 0.12, rain: 0.5 },
  radar:    { chords: [C.Am9, C.Fmaj7, C.Dm7, C.Esus], bar: 8, bright: 800, pad: 0.75, piano: 0.1, ping: true },
  water:    { chords: [C.Fmaj7, C.CE, C.Dm7, C.Bbmaj7], bar: 8, bright: 1100, pad: 0.85, piano: 0.3 },
  change:   { chords: [C.Dm, C.Bb, C.Gm, C.A], bar: 6, bright: 1300, pad: 1, piano: 0.08, pulse: true },
  sure:     { chords: [C.Bbmaj7, C.F, C.Csus, C.Dm9], bar: 9, bright: 900, pad: 0.8, piano: 0.2 },
  epilogue: { chords: [C.F, C.C, C.Dm7, C.Bbmaj9], bar: 8, bright: 1500, pad: 0.95, piano: 0.28 },
};

const MUSIC_LEVEL = 0.55;
const DUCKED = 0.28;

class StorySound {
  enabled = false;
  narration = true;
  music = true;
  speaking = false;
  /** Text being spoken now (for on-screen subtitles), and who to tell when it changes. */
  caption = "";
  onCaption: ((t: string) => void) | null = null;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private dry: GainNode | null = null;
  private wet: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private voices: { oscs: OscillatorNode[]; gain: GainNode }[] = [];
  private mood: Mood | null = null;
  private chordIdx = 0;
  private loop: number | null = null;
  private beat: number | null = null;
  private timers: number[] = [];
  private speechToken = 0;

  start() {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.build();
    this.ctx!.resume();
    this.enabled = true;
    this.setMusicLevel();
    if (!this.mood) this.setMood("prologue");
  }

  stop() {
    this.enabled = false;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.loop) { clearInterval(this.loop); this.loop = null; }
    if (this.beat) { clearInterval(this.beat); this.beat = null; }
    this.cancelSpeech();
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.musicBus?.gain.setTargetAtTime(0, t, 0.6);
      this.rainGain?.gain.setTargetAtTime(0, t, 0.4);
      this.releaseVoices(2);
    }
    this.mood = null;
  }

  setMusic(on: boolean) { this.music = on; this.setMusicLevel(); }
  setNarration(on: boolean) { this.narration = on; if (!on) this.cancelSpeech(); }

  // ---------- graph ----------

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(comp).connect(ctx.destination);

    // reverb: a generated 5 s hall
    const rev = ctx.createConvolver();
    const len = ctx.sampleRate * 5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    rev.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.55;
    this.dry = ctx.createGain(); this.dry.gain.value = 0.6;
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0;
    this.dry.connect(this.musicBus);
    this.wet.connect(rev).connect(this.musicBus);
    this.musicBus.connect(this.master);

    // pad filter, slowly breathing
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass"; this.padFilter.frequency.value = 800; this.padFilter.Q.value = 0.7;
    const lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
    lfo.frequency.value = 0.05; lfoAmt.gain.value = 220;
    lfo.connect(lfoAmt).connect(this.padFilter.frequency); lfo.start();
    this.padFilter.connect(this.dry); this.padFilter.connect(this.wet);

    // rain: filtered noise straight to the master (not ducked)
    const nlen = ctx.sampleRate * 2, nb = ctx.createBuffer(1, nlen, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5500;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    src.connect(bp).connect(lp).connect(this.rainGain).connect(this.master);
    src.start();
  }

  private setMusicLevel() {
    if (!this.ctx || !this.musicBus) return;
    const target = !this.enabled || !this.music ? 0 : this.speaking ? DUCKED : MUSIC_LEVEL;
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, this.speaking ? 0.25 : 0.9);
  }

  // ---------- score ----------

  /** Change the music to a chapter's mood (crossfades over a few seconds). */
  setMood(mood: Mood, rainLevel?: number) {
    if (!this.enabled || !this.ctx) return;
    const spec = MOODS[mood];
    const t = this.ctx.currentTime;
    this.padFilter!.frequency.setTargetAtTime(spec.bright, t, 2);
    this.rainGain!.gain.setTargetAtTime(Math.max(0, Math.min(1, rainLevel ?? spec.rain ?? 0)) * 0.16, t, 1.5);
    if (this.mood === mood) return;
    this.mood = mood;
    this.chordIdx = 0;
    this.playChord(spec.chords[0], spec.pad);
    if (this.loop) clearInterval(this.loop);
    this.loop = window.setInterval(() => {
      this.chordIdx = (this.chordIdx + 1) % spec.chords.length;
      this.playChord(spec.chords[this.chordIdx], spec.pad);
    }, spec.bar * 1000);
    if (this.beat) clearInterval(this.beat);
    let k = 0;
    this.beat = window.setInterval(() => {
      if (!this.enabled) return;
      const chord = spec.chords[this.chordIdx];
      if (Math.random() < spec.piano) this.piano(chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 12);
      if (spec.ping && k % 6 === 0) this.ping();
      if (spec.pulse && k % 2 === 0) this.heartbeat();
      k++;
    }, 1000);
    if (mood !== "prologue") this.swell();
  }

  private playChord(notes: number[], level: number) {
    const ctx = this.ctx!, t = ctx.currentTime;
    this.releaseVoices(4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05 * level, t + 3.5);
    gain.connect(this.padFilter!);
    const oscs: OscillatorNode[] = [];
    notes.forEach((n, i) => {
      if (i === 0) { // sub-bass: a pure sine an octave down, straight to the dry path
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = hz(n - 12); g.gain.value = 0.9;
        o.connect(g).connect(gain); o.start(); oscs.push(o);
        return;
      }
      for (const det of [-7, 6]) { // two detuned saws per note: a soft string section
        const o = ctx.createOscillator();
        o.type = "sawtooth"; o.frequency.value = hz(n); o.detune.value = det + (Math.random() * 4 - 2);
        const g = ctx.createGain(); g.gain.value = 0.22;
        o.connect(g).connect(gain); o.start(); oscs.push(o);
      }
    });
    this.voices.push({ oscs, gain });
  }

  private releaseVoices(seconds: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of this.voices) {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(v.gain.gain.value, t);
      v.gain.gain.linearRampToValueAtTime(0, t + seconds);
      v.oscs.forEach((o) => o.stop(t + seconds + 0.1));
    }
    this.voices = [];
  }

  /** A soft felt-piano note: sine + a little second harmonic, long decay, mostly reverb. */
  private piano(midi: number, at = 0, vol = 0.07) {
    if (!this.ctx || !this.music) return;
    const ctx = this.ctx, t = ctx.currentTime + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
    for (const [mult, amp] of [[1, 1], [2, 0.25], [3, 0.08]] as const) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sine"; o.frequency.value = hz(midi) * mult; og.gain.value = amp;
      o.connect(og).connect(g); o.start(t); o.stop(t + 3.3);
    }
    g.connect(lp); lp.connect(this.dry!); lp.connect(this.wet!);
  }

  /** A sonar ping with echoes (the radar chapter). */
  ping() {
    if (!this.enabled || !this.ctx || !this.music) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(1480, t); o.frequency.exponentialRampToValueAtTime(1380, t + 0.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    const delay = ctx.createDelay(2), fb = ctx.createGain();
    delay.delayTime.value = 0.42; fb.gain.value = 0.38;
    o.connect(g); g.connect(this.wet!); g.connect(delay); delay.connect(fb).connect(delay); delay.connect(this.wet!);
    o.start(t); o.stop(t + 1);
    this.timers.push(window.setTimeout(() => { try { fb.disconnect(); delay.disconnect(); } catch { /* gone */ } }, 6000));
  }

  /** A low double heartbeat (the turning point). */
  private heartbeat() {
    if (!this.ctx || !this.music) return;
    const ctx = this.ctx;
    for (const [at, vol] of [[0, 0.28], [0.22, 0.18]] as const) {
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.dry!); o.start(t); o.stop(t + 0.4);
    }
  }

  /** A breath of filtered noise that marks a new chapter. */
  private swell() {
    if (!this.ctx || !this.music) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const len = ctx.sampleRate * 3, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + 2.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2); g.gain.linearRampToValueAtTime(0, t + 3);
    s.connect(f).connect(g).connect(this.wet!); s.start(t);
  }

  /** 0 = dry, 1 = downpour. */
  rain(level: number) {
    if (!this.enabled || !this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.16, this.ctx.currentTime, 1);
  }

  /** A short tick (flipbook frames). */
  blip() {
    if (!this.enabled || !this.ctx || !this.music) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = "triangle"; o.frequency.value = 1320;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.master!); o.start(t); o.stop(t + 0.15);
  }

  /** Play a data series as piano notes, higher = larger; returns its length in ms. */
  playSeries(values: number[], stepMs = 520, second?: number[]): number {
    if (!this.enabled || !this.ctx || values.length === 0) return 0;
    const all = [...values, ...(second ?? [])];
    const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
    const midiOf = (v: number) => { const k = Math.round(((v - lo) / span) * 9); return 62 + PENTA[k % 5] + 12 * Math.floor(k / 5); };
    values.forEach((v, i) => this.piano(midiOf(v), (i * stepMs) / 1000, 0.16));
    second?.forEach((v, i) => this.piano(midiOf(v) + 12, (i * stepMs + stepMs / 2) / 1000, 0.05));
    return values.length * stepMs + 1200;
  }

  // ---------- narration ----------

  private voice(): SpeechSynthesisVoice | null {
    const vs = window.speechSynthesis.getVoices();
    const prefs = [
      /Microsoft (Ryan|Guy|Thomas|Brian|Andrew|Christopher).*Natural/i, /Microsoft .*Natural.*English/i,
      /Google UK English Male/i, /Daniel/i, /Google UK English/i, /Google US English/i,
    ];
    for (const p of prefs) { const v = vs.find((x) => p.test(x.name) && x.lang.startsWith("en")); if (v) return v; }
    return vs.find((x) => /en[-_]GB/i.test(x.lang)) ?? vs.find((x) => x.lang.startsWith("en")) ?? null;
  }

  cancelSpeech() {
    this.speechToken++;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    this.speaking = false;
    this.setCaption("");
    this.setMusicLevel();
  }

  private setCaption(t: string) { this.caption = t; this.onCaption?.(t); }

  /** Speak lines one after another (showing each as a subtitle); resolves when done or cancelled. */
  async speakLines(lines: string[]): Promise<boolean> {
    const token = ++this.speechToken;
    for (const line of lines) {
      if (token !== this.speechToken || !this.enabled) return false;
      await this.say(line, token);
      if (token !== this.speechToken || !this.enabled) return false;
      await new Promise((r) => setTimeout(r, 350));
    }
    if (token === this.speechToken) { this.setCaption(""); this.speaking = false; this.setMusicLevel(); }
    return token === this.speechToken;
  }

  private say(text: string, token: number): Promise<void> {
    return new Promise((resolve) => {
      this.setCaption(text);
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      // no voice (or narration off): keep the subtitle up for a reading-speed pause instead
      const readMs = 1200 + text.split(/\s+/).length * 330;
      if (!synth || !this.narration) { setTimeout(resolve, readMs); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB"; u.rate = 0.93; u.pitch = 0.95;
      const v = this.voice(); if (v) u.voice = v;
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(guard); resolve(); };
      // some browsers never fire "end": give up after a generous estimate
      const guard = setTimeout(finish, readMs * 2.2 + 3000);
      u.onstart = () => { if (token === this.speechToken) { this.speaking = true; this.setMusicLevel(); } };
      u.onend = finish; u.onerror = finish;
      synth.speak(u);
    });
  }
}

export const storySound = new StorySound();
