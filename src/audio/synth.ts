import type { BuiltinSound } from "../gamefile/schema";

// Built-in show sounds, generated with Web Audio so the game works without any files.

type Stop = () => void;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

function tone(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  start: number,
  dur: number,
  { type = "sine" as OscillatorType, gain = 0.3, attack = 0.005, release = dur } = {},
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + release);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + release + 0.05);
  return osc;
}

/** A bell: fundamental plus inharmonic partials. */
function bell(ctx: AudioContext, out: AudioNode, freq: number, start: number, gain = 0.25) {
  tone(ctx, out, freq, start, 1.2, { gain });
  tone(ctx, out, freq * 2.76, start, 0.5, { gain: gain * 0.35 });
  tone(ctx, out, freq * 5.4, start, 0.25, { gain: gain * 0.15 });
}

/** Brassy note: filtered saw stack. */
function brass(ctx: AudioContext, out: AudioNode, freq: number, start: number, dur: number, gain = 0.18) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, start);
  filter.frequency.linearRampToValueAtTime(3000, start + 0.08);
  filter.frequency.linearRampToValueAtTime(1600, start + dur);
  filter.connect(out);
  for (const detune of [-6, 0, 6]) {
    const o = tone(ctx, filter, freq, start, dur, { type: "sawtooth", gain: gain / 2, attack: 0.03, release: dur });
    o.detune.value = detune;
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function hit(ctx: AudioContext, out: AudioNode, start: number, gain: number, freq = 1800) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 0.12);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
  src.connect(filter).connect(g).connect(out);
  src.start(start);
}

const sounds: Record<BuiltinSound, (ctx: AudioContext, out: GainNode, t: number) => Stop | void> = {
  reveal(ctx, out, t) {
    [72, 76, 79, 84, 88].forEach((n, i) => bell(ctx, out, midi(n), t + i * 0.05, 0.12));
  },
  correct(ctx, out, t) {
    bell(ctx, out, midi(84), t, 0.3);
    bell(ctx, out, midi(91), t + 0.12, 0.3);
  },
  wrong(ctx, out, t) {
    for (const f of [98, 104]) tone(ctx, out, f, t, 0.7, { type: "square", gain: 0.12, release: 0.7 });
  },
  bonus(ctx, out, t) {
    const notes = [60, 64, 67, 72];
    notes.forEach((n, i) => brass(ctx, out, midi(n), t + i * 0.13, 0.3));
    for (const n of [60, 64, 67, 72]) brass(ctx, out, midi(n), t + 0.55, 1.4, 0.12);
    for (let i = 0; i < 12; i++) hit(ctx, out, t + 0.55 + i * 0.03, 0.15, 6000);
  },
  tick(ctx, out, t) {
    tone(ctx, out, 1400, t, 0.06, { type: "square", gain: 0.08 });
  },
  timeUp(ctx, out, t) {
    [0, 0.22, 0.44].forEach((d) => tone(ctx, out, 523, t + d, 0.18, { type: "square", gain: 0.12 }));
  },
  think(ctx, out, t) {
    // A gentle looping arpeggio until stopped.
    const pattern = [69, 72, 76, 72, 67, 71, 74, 71, 65, 69, 72, 69, 64, 68, 71, 68];
    let next = t;
    let i = 0;
    const schedule = () => {
      while (next < ctx.currentTime + 0.5) {
        tone(ctx, out, midi(pattern[i % pattern.length]), next, 0.4, { type: "triangle", gain: 0.12 });
        if (i % 4 === 0) tone(ctx, out, midi(pattern[i % pattern.length] - 24), next, 1.2, { gain: 0.15 });
        next += 0.25;
        i++;
      }
    };
    schedule();
    const timer = setInterval(schedule, 150);
    return () => clearInterval(timer);
  },
  drumroll(ctx, out, t) {
    for (let i = 0; i < 60; i++) hit(ctx, out, t + i * 0.035, 0.1 + (i / 60) * 0.25, 400);
    hit(ctx, out, t + 2.15, 0.6, 250);
    tone(ctx, out, midi(36), t + 2.15, 1, { gain: 0.3 });
  },
  coins(ctx, out, t) {
    for (let i = 0; i < 14; i++) {
      const at = t + i * 0.045 + Math.random() * 0.03;
      tone(ctx, out, 2400 + Math.random() * 1800, at, 0.18, { gain: 0.08 });
      tone(ctx, out, 3900 + Math.random() * 1500, at + 0.01, 0.12, { gain: 0.04 });
    }
  },
  win(ctx, out, t) {
    [60, 64, 67, 72, 67, 72].forEach((n, i) => brass(ctx, out, midi(n), t + i * 0.14, 0.25));
    for (const n of [48, 60, 64, 67, 72, 76]) brass(ctx, out, midi(n), t + 0.9, 2.2, 0.1);
    for (let i = 0; i < 6; i++) bell(ctx, out, midi(84 + (i % 3) * 4), t + 0.9 + i * 0.1, 0.08);
  },
};

export class Synth {
  private ctx = new AudioContext();
  private master = this.ctx.createGain();

  constructor() {
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
  }

  get unlocked() {
    return this.ctx.state === "running";
  }

  unlock() {
    return this.ctx.resume();
  }

  /** Called whenever the browser suspends or resumes this window's sound (Safari does both on its own). */
  onStateChange(listener: () => void) {
    this.ctx.addEventListener("statechange", listener);
  }

  play(name: BuiltinSound): Stop {
    const out = this.ctx.createGain();
    out.connect(this.master);
    const stopLoop = sounds[name](this.ctx, out, this.ctx.currentTime + 0.01);
    return () => {
      stopLoop?.();
      out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      setTimeout(() => out.disconnect(), 1000);
    };
  }
}
