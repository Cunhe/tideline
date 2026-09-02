import type { InstrumentId } from "./types";
import { midiToFreq } from "./theory";

function envGain(
  ctx: AudioContext,
  t: number,
  peak: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  dur: number,
): GainNode {
  const g = ctx.createGain();
  const p = Math.max(0.0001, peak);
  const s = Math.max(0.0001, sustain);
  const noteEnd = t + Math.max(dur, attack + decay);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(p, t + Math.max(0.004, attack));
  g.gain.exponentialRampToValueAtTime(s, t + attack + Math.max(0.02, decay));
  g.gain.setValueAtTime(s, noteEnd);
  g.gain.exponentialRampToValueAtTime(0.0001, noteEnd + Math.max(0.04, release));
  return g;
}

function osc(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  t: number,
  stop: number,
  detune = 0,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  o.start(t);
  o.stop(stop);
  return o;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 0.4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

let noiseCache: AudioBuffer | null = null;
function noise(ctx: AudioContext, t: number, stop: number): AudioBufferSourceNode {
  if (!noiseCache) noiseCache = noiseBuffer(ctx);
  const src = ctx.createBufferSource();
  src.buffer = noiseCache;
  src.loop = true;
  src.start(t);
  src.stop(stop);
  return src;
}

function connectOut(node: AudioNode, dest: AudioNode, extra?: AudioNode) {
  if (extra) {
    node.connect(extra);
    extra.connect(dest);
  } else {
    node.connect(dest);
  }
}

export function triggerSynth(
  ctx: AudioContext,
  dest: AudioNode,
  instrument: InstrumentId,
  midi: number,
  velocity: number,
  time: number,
  duration: number,
) {
  const vel = Math.max(0.05, Math.min(1, velocity));
  const dur = Math.max(0.05, duration);
  const t = Math.max(time, ctx.currentTime);
  const stop = t + dur + 1.8;
  const freq = midiToFreq(midi);

  if (instrument === "drums") {
    triggerDrum(ctx, dest, midi, vel, t);
    return;
  }

  switch (instrument) {
    case "piano":
      playPiano(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "epiano":
      playEPiano(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "organ":
      playOrgan(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "pad":
      playPad(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "strings":
      playStrings(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "choir":
      playChoir(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "bass":
      playBass(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "lead":
      playLead(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "pluck":
      playPluck(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "flute":
      playFlute(ctx, dest, freq, vel, t, dur, stop);
      break;
    case "bells":
      playBells(ctx, dest, freq, vel, t, dur, stop);
      break;
    default:
      playPiano(ctx, dest, freq, vel, t, dur, stop);
  }
}

function playPiano(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(700 + vel * 4800, t);
  filter.Q.value = 0.7;
  filter.frequency.exponentialRampToValueAtTime(420 + vel * 900, t + 0.35);

  const g = envGain(ctx, t, 0.22 * vel, 0.005, 0.16, 0.07 * vel, 0.45, dur);
  connectOut(g, dest, filter);

  const partials = [1, 2.003, 3.01, 4.04, 5.04];
  const gains = [1, 0.38, 0.14, 0.07, 0.03];
  partials.forEach((p, i) => {
    const o = osc(ctx, i === 0 ? "triangle" : "sine", freq * p, t, stop);
    const pg = ctx.createGain();
    pg.gain.value = gains[i] ?? 0.02;
    o.connect(pg);
    pg.connect(g);
  });

  const n = noise(ctx, t, t + 0.06);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.04 * vel, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  const nf = ctx.createBiquadFilter();
  nf.type = "highpass";
  nf.frequency.value = 1800;
  n.connect(nf);
  nf.connect(ng);
  ng.connect(dest);
}

function playEPiano(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const carrier = osc(ctx, "sine", freq, t, stop);
  const mod = osc(ctx, "sine", freq * 2, t, stop);
  const modG = ctx.createGain();
  modG.gain.setValueAtTime(freq * 1.6 * vel, t);
  modG.gain.exponentialRampToValueAtTime(freq * 0.2, t + 0.4);
  mod.connect(modG);
  modG.connect(carrier.frequency);

  const g = envGain(ctx, t, 0.2 * vel, 0.008, 0.22, 0.08 * vel, 0.5, dur);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200 + vel * 2400, t);
  carrier.connect(g);
  connectOut(g, dest, filter);
}

function playOrgan(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const g = envGain(ctx, t, 0.12 * vel, 0.02, 0.05, 0.1 * vel, 0.08, dur);
  g.connect(dest);
  ;[1, 2, 3, 4, 6].forEach((p, i) => {
    const o = osc(ctx, "sine", freq * p, t, stop);
    const pg = ctx.createGain();
    pg.gain.value = [0.9, 0.5, 0.28, 0.16, 0.08][i] ?? 0.05;
    o.connect(pg);
    pg.connect(g);
  });
}

function playPad(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.linearRampToValueAtTime(1400 + vel * 800, t + 0.8);
  filter.Q.value = 0.4;
  const g = envGain(ctx, t, 0.1 * vel, 0.35, 0.4, 0.08 * vel, 0.9, dur);
  connectOut(g, dest, filter);
  [-8, 0, 7].forEach((det) => {
    const o = osc(ctx, "sawtooth", freq, t, stop, det);
    o.connect(g);
  });
}

function playStrings(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900 + vel * 1600, t);
  const g = envGain(ctx, t, 0.12 * vel, 0.18, 0.3, 0.09 * vel, 0.5, dur);
  connectOut(g, dest, filter);
  const a = osc(ctx, "sawtooth", freq, t, stop, -6);
  const b = osc(ctx, "sawtooth", freq, t, stop, 7);
  a.connect(g);
  b.connect(g);
}

function playChoir(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const g = envGain(ctx, t, 0.09 * vel, 0.28, 0.25, 0.07 * vel, 0.6, dur);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.7;
  connectOut(g, dest, filter);
  ;[0.995, 1, 1.007, 1.5].forEach((m) => {
    const o = osc(ctx, "sine", freq * m, t, stop);
    o.connect(g);
  });
}

function playBass(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const g = envGain(ctx, t, 0.32 * vel, 0.006, 0.12, 0.14 * vel, 0.16, dur);
  g.connect(dest);
  osc(ctx, "sine", freq, t, stop).connect(g);
  const sq = osc(ctx, "sawtooth", freq, t, stop);
  const sg = ctx.createGain();
  sg.gain.value = 0.22;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(500 + vel * 700, t);
  sq.connect(sg);
  sg.connect(f);
  f.connect(g);
}

function playLead(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(400 + vel * 2800, t);
  filter.frequency.exponentialRampToValueAtTime(500, t + 0.25);
  const g = envGain(ctx, t, 0.14 * vel, 0.01, 0.12, 0.08 * vel, 0.2, dur);
  connectOut(g, dest, filter);
  osc(ctx, "sawtooth", freq, t, stop, -4).connect(g);
  osc(ctx, "sawtooth", freq, t, stop, 5).connect(g);
}

function playPluck(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const g = envGain(ctx, t, 0.2 * vel, 0.003, 0.18, 0.0001, 0.12, Math.min(dur, 0.5));
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1800 + vel * 2200, t);
  filter.frequency.exponentialRampToValueAtTime(280, t + 0.28);
  connectOut(g, dest, filter);
  osc(ctx, "triangle", freq, t, stop).connect(g);
  osc(ctx, "sawtooth", freq, t, stop).connect(g);
  void stop;
}

function playFlute(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const g = envGain(ctx, t, 0.14 * vel, 0.06, 0.1, 0.1 * vel, 0.12, dur);
  g.connect(dest);
  osc(ctx, "sine", freq, t, stop).connect(g);
  const n = noise(ctx, t, stop);
  const ng = ctx.createGain();
  ng.gain.value = 0.015 * vel;
  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = freq * 2;
  n.connect(nf);
  nf.connect(ng);
  ng.connect(g);
}

function playBells(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vel: number,
  t: number,
  dur: number,
  stop: number,
) {
  const g = envGain(ctx, t, 0.16 * vel, 0.002, 0.4, 0.0001, 0.8, Math.min(dur, 0.2));
  g.connect(dest);
  ;[1, 2.76, 5.4, 8.93].forEach((m, i) => {
    const o = osc(ctx, "sine", freq * m, t, stop);
    const pg = ctx.createGain();
    pg.gain.value = [1, 0.35, 0.18, 0.08][i] ?? 0.05;
    o.connect(pg);
    pg.connect(g);
  });
}

function triggerDrum(
  ctx: AudioContext,
  dest: AudioNode,
  midi: number,
  vel: number,
  t: number,
) {
  const n = midi;
  if (n === 35 || n === 36) {
    kick(ctx, dest, vel, t);
  } else if (n === 38 || n === 40) {
    snare(ctx, dest, vel, t);
  } else if (n === 42 || n === 44) {
    hat(ctx, dest, vel, t, false);
  } else if (n === 46) {
    hat(ctx, dest, vel, t, true);
  } else if (n === 49 || n === 57) {
    cymbal(ctx, dest, vel, t);
  } else if (n === 51 || n === 53) {
    ride(ctx, dest, vel, t);
  } else if (n === 37) {
    rim(ctx, dest, vel, t);
  } else if (n === 39) {
    clap(ctx, dest, vel, t);
  } else {
    tom(ctx, dest, vel, t, 90 + (n - 41) * 18);
  }
}

function kick(ctx: AudioContext, dest: AudioNode, vel: number, t: number) {
  const o = osc(ctx, "sine", 140, t, t + 0.45);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(g);
  g.connect(dest);
  const click = osc(ctx, "sine", 900, t, t + 0.03);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.15 * vel, t);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  click.connect(cg);
  cg.connect(dest);
}

function snare(ctx: AudioContext, dest: AudioNode, vel: number, t: number) {
  const o = osc(ctx, "triangle", 180, t, t + 0.2);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.22 * vel, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(og);
  og.connect(dest);
  const n = noise(ctx, t, t + 0.22);
  const nf = ctx.createBiquadFilter();
  nf.type = "highpass";
  nf.frequency.value = 1200;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.35 * vel, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  n.connect(nf);
  nf.connect(ng);
  ng.connect(dest);
}

function hat(ctx: AudioContext, dest: AudioNode, vel: number, t: number, open: boolean) {
  const n = noise(ctx, t, t + (open ? 0.35 : 0.07));
  const bp = ctx.createBiquadFilter();
  bp.type = "highpass";
  bp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.18 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.32 : 0.05));
  n.connect(bp);
  bp.connect(g);
  g.connect(dest);
}

function cymbal(ctx: AudioContext, dest: AudioNode, vel: number, t: number) {
  const n = noise(ctx, t, t + 1.4);
  const bp = ctx.createBiquadFilter();
  bp.type = "highpass";
  bp.frequency.value = 5000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  n.connect(bp);
  bp.connect(g);
  g.connect(dest);
}

function ride(ctx: AudioContext, dest: AudioNode, vel: number, t: number) {
  const o = osc(ctx, "sine", 520, t, t + 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g);
  g.connect(dest);
  hat(ctx, dest, vel * 0.5, t, true);
}

function rim(ctx: AudioContext, dest: AudioNode, vel: number, t: number) {
  const o = osc(ctx, "square", 400, t, t + 0.05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 800;
  o.connect(f);
  f.connect(g);
  g.connect(dest);
}

function clap(ctx: AudioContext, dest: AudioNode, vel: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const n = noise(ctx, t + i * 0.012, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2 * vel, t + i * 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    n.connect(f);
    f.connect(g);
    g.connect(dest);
  }
}

function tom(
  ctx: AudioContext,
  dest: AudioNode,
  vel: number,
  t: number,
  freq: number,
) {
  const o = osc(ctx, "sine", freq, t, t + 0.35);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4 * vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g);
  g.connect(dest);
}

export function metronomeClick(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  accent: boolean,
) {
  const t = Math.max(time, ctx.currentTime);
  const o = osc(ctx, "sine", accent ? 1400 : 980, t, t + 0.05);
  const g = ctx.createGain();
  g.gain.setValueAtTime(accent ? 0.18 : 0.1, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  o.connect(g);
  g.connect(dest);
}
