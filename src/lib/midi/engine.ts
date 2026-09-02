import type { InstrumentId, MidiProject } from "./types";
import { activeTracks, ticksPerBar, ticksPerBeat } from "./theory";
import { metronomeClick, triggerSynth } from "./synth";

type ProjectGetter = () => MidiProject;

const LOOKAHEAD = 0.12;
const INTERVAL_MS = 25;

class PlaybackEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  playing = false;
  recording = false;
  metronome = false;
  startCtxTime = 0;
  startTicks = 0;
  lastEmitTicks = 0;
  scheduled = new Set<string>();
  scheduledClicks = new Set<number>();
  timer: number | null = null;
  getProject: ProjectGetter | null = null;
  onTick: ((ticks: number) => void) | null = null;
  liveNotes = new Map<string, { pitch: number; instrument: InstrumentId }>();
  volume = 0.9;

  unlock() {
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.buildGraph();
    }
    return this.ctx;
  }

  private buildGraph() {
    if (!this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * this.volume;
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.18;
    this.master.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);
  }

  private silenceAndRebuild() {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    try {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      this.master.disconnect();
    } catch {
      /* already disconnected */
    }
    this.buildGraph();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.volume * this.volume, ctx.currentTime, 0.03);
  }

  currentTicks(project: MidiProject): number {
    if (!this.playing || !this.ctx) return this.startTicks;
    const elapsed = this.ctx.currentTime - this.startCtxTime;
    const beats = elapsed * (project.bpm / 60);
    let ticks = this.startTicks + beats * project.ppq;
    if (project.loopEnabled && project.loopEndTicks > project.loopStartTicks) {
      const span = project.loopEndTicks - project.loopStartTicks;
      if (ticks >= project.loopEndTicks) {
        ticks = project.loopStartTicks + ((ticks - project.loopStartTicks) % span);
      }
    }
    return ticks;
  }

  async play(fromTicks: number) {
    const ctx = this.unlock();
    if (ctx.state === "suspended") await ctx.resume();
    this.playing = true;
    this.startTicks = Math.max(0, fromTicks);
    this.startCtxTime = ctx.currentTime;
    this.lastEmitTicks = this.startTicks;
    this.scheduled.clear();
    this.scheduledClicks.clear();
    if (this.timer != null) window.clearInterval(this.timer);
    this.scheduler();
    this.timer = window.setInterval(() => this.scheduler(), INTERVAL_MS);
  }

  stop() {
    this.playing = false;
    this.recording = false;
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.startTicks = 0;
    this.lastEmitTicks = 0;
    this.scheduled.clear();
    this.scheduledClicks.clear();
    this.silenceAndRebuild();
    this.onTick?.(0);
  }

  pause(project: MidiProject) {
    if (this.playing) {
      this.startTicks = this.currentTicks(project);
      this.playing = false;
      if (this.timer != null) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  seek(ticks: number) {
    this.startTicks = Math.max(0, ticks);
    this.lastEmitTicks = this.startTicks;
    if (this.playing && this.ctx) {
      this.startCtxTime = this.ctx.currentTime;
      this.scheduled.clear();
      this.scheduledClicks.clear();
    }
    this.onTick?.(this.startTicks);
  }

  preview(instrument: InstrumentId, pitch: number, velocity = 0.8, duration = 0.35) {
    const ctx = this.unlock();
    if (!this.master) return;
    triggerSynth(ctx, this.master, instrument, pitch, velocity, ctx.currentTime, duration);
  }

  noteOn(id: string, instrument: InstrumentId, pitch: number, velocity = 0.85) {
    const ctx = this.unlock();
    if (!this.master) return;
    this.liveNotes.set(id, { pitch, instrument });
    triggerSynth(ctx, this.master, instrument, pitch, velocity, ctx.currentTime, 1.8);
  }

  noteOff(id: string) {
    this.liveNotes.delete(id);
  }

  private scheduler() {
    if (!this.playing || !this.ctx || !this.getProject || !this.master) return;
    const project = this.getProject();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const ahead = now + LOOKAHEAD;
    const ticksNow = this.currentTicks(project);
    if (project.loopEnabled && this.lastEmitTicks - ticksNow > project.ppq) {
      this.scheduled.clear();
      this.scheduledClicks.clear();
    }
    this.lastEmitTicks = ticksNow;
    this.onTick?.(ticksNow);

    const beatTicks = ticksPerBeat(project.ppq, project.timeSigDen);
    const barTicks = ticksPerBar(project);
    const ticksPerSec = (project.bpm / 60) * project.ppq;

    const windowStart = ticksNow;
    const windowEnd = ticksNow + LOOKAHEAD * ticksPerSec + 2;

    for (const track of activeTracks(project)) {
      for (const note of track.notes) {
        const start = note.startTicks;
        let fire = start;
        if (project.loopEnabled && project.loopEndTicks > project.loopStartTicks) {
          if (start < project.loopStartTicks || start >= project.loopEndTicks) {
            if (!(start >= windowStart - 1 && start <= windowEnd)) continue;
          } else if (start < windowStart - 1) {
            continue;
          }
        }
        const key = `${track.id}:${note.id}:${Math.floor(fire)}:${Math.floor(windowStart / barTicks)}`;
        if (this.scheduled.has(key)) continue;
        const inWindow = fire >= windowStart - 1 && fire <= windowEnd;
        if (!inWindow) continue;
        const dticks = fire - ticksNow;
        const when = now + dticks / ticksPerSec;
        if (when < now - 0.02) continue;
        if (when > ahead + 0.02) continue;
        this.scheduled.add(key);
        const durSec = note.durationTicks / ticksPerSec;
        const vol = (note.velocity / 127) * track.volume;
        triggerSynth(ctx, this.master, track.instrument, note.pitch, vol, when, durSec);
      }
    }

    if (this.metronome) {
      const firstBeat = Math.floor(windowStart / beatTicks);
      const lastBeat = Math.ceil(windowEnd / beatTicks);
      for (let b = firstBeat; b <= lastBeat; b++) {
        if (this.scheduledClicks.has(b)) continue;
        const tick = b * beatTicks;
        const dticks = tick - ticksNow;
        const when = now + dticks / ticksPerSec;
        if (when < now - 0.01 || when > ahead) continue;
        this.scheduledClicks.add(b);
        const accent = tick % barTicks === 0;
        metronomeClick(ctx, this.master, when, accent);
      }
    }

    if (this.scheduled.size > 4000) this.scheduled.clear();
    if (this.scheduledClicks.size > 2000) this.scheduledClicks.clear();
  }
}

export const engine = new PlaybackEngine();

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && engine.ctx?.state === "suspended") {
      void engine.ctx.resume();
    }
  });
}
