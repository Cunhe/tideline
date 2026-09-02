import { INSTRUMENT_MAP, INSTRUMENTS, PPQ, TRACK_COLORS } from "./constants";
import type { InstrumentId, MidiProject, MidiTrack } from "./types";
import { uid } from "@/lib/utils";

type MidiCtor = (typeof import("@tonejs/midi"))["Midi"];

async function loadMidi(): Promise<MidiCtor> {
  const mod = (await import("@tonejs/midi")) as unknown as {
    Midi?: MidiCtor;
    default?: { Midi?: MidiCtor } | MidiCtor;
  };
  if (typeof mod.Midi === "function") return mod.Midi;
  const def = mod.default;
  if (def && typeof def === "object" && typeof def.Midi === "function") return def.Midi;
  if (typeof def === "function") return def as MidiCtor;
  throw new Error("无法加载 MIDI 引擎");
}

function gmToInstrument(gm: number, percussion: boolean): InstrumentId {
  if (percussion) return "drums";
  const exact = INSTRUMENTS.find((i) => i.gm === gm && !i.drum);
  if (exact) return exact.id;
  if (gm <= 7) return "piano";
  if (gm <= 15) return "epiano";
  if (gm <= 23) return "organ";
  if (gm <= 31) return "epiano";
  if (gm <= 39) return "bass";
  if (gm <= 47) return "pluck";
  if (gm <= 55) return "strings";
  if (gm <= 63) return "choir";
  if (gm <= 79) return "flute";
  if (gm <= 87) return "lead";
  if (gm <= 95) return "pad";
  if (gm <= 103) return "bells";
  return "piano";
}

export async function projectFromMidi(buffer: ArrayBuffer, filename: string): Promise<MidiProject> {
  const Midi = await loadMidi();
  const midi = new Midi(buffer);
  const ppq = midi.header.ppq || PPQ;
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const tracks: MidiTrack[] = [];

  midi.tracks.forEach((t, i) => {
    const percussion = t.channel === 9 || t.instrument.percussion;
    const notes = t.notes.map((n) => ({
      id: uid("n"),
      pitch: n.midi,
      startTicks: Math.round(n.ticks),
      durationTicks: Math.max(30, Math.round(n.durationTicks)),
      velocity: Math.round(Math.max(1, Math.min(127, n.velocity * 127))),
    }));
    if (notes.length === 0 && t.name === "") return;
    tracks.push({
      id: uid("tr"),
      name: t.name || (percussion ? "鼓组" : `轨道 ${i + 1}`),
      instrument: gmToInstrument(t.instrument.number, percussion),
      mute: false,
      solo: false,
      volume: 0.9,
      color: TRACK_COLORS[i % TRACK_COLORS.length],
      notes,
    });
  });

  if (tracks.length === 0) {
    tracks.push({
      id: uid("tr"),
      name: "钢琴",
      instrument: "piano",
      mute: false,
      solo: false,
      volume: 0.9,
      color: TRACK_COLORS[0],
      notes: [],
    });
  }

  const name = filename.replace(/\.(mid|midi)$/i, "") || midi.header.name || "未命名";
  const last = tracks.reduce((m, t) => {
    return Math.max(
      m,
      t.notes.reduce((mm, n) => Math.max(mm, n.startTicks + n.durationTicks), 0),
    );
  }, 0);

  return {
    id: uid("pj"),
    name,
    bpm: Math.round(bpm * 10) / 10,
    timeSigNum: ts[0] ?? 4,
    timeSigDen: ts[1] ?? 4,
    ppq,
    tracks,
    loopEnabled: true,
    loopStartTicks: 0,
    loopEndTicks: Math.max(ppq * 4 * 4, last),
  };
}

export async function projectToMidi(project: MidiProject): Promise<Uint8Array> {
  const Midi = await loadMidi();
  const midi = new Midi();
  midi.header.fromJSON({
    name: project.name,
    ppq: project.ppq || PPQ,
    meta: [],
    tempos: [{ ticks: 0, bpm: project.bpm }],
    timeSignatures: [
      {
        ticks: 0,
        timeSignature: [project.timeSigNum, project.timeSigDen],
        measures: 0,
      },
    ],
    keySignatures: [],
  });

  let channel = 0;
  for (const track of project.tracks) {
    const t = midi.addTrack();
    t.name = track.name;
    const def = INSTRUMENT_MAP[track.instrument];
    if (def.drum) {
      t.channel = 9;
    } else {
      t.channel = channel % 16 === 9 ? 10 : channel % 16;
      channel += 1;
      t.instrument.number = def.gm;
    }
    for (const n of track.notes) {
      t.addNote({
        midi: n.pitch,
        ticks: Math.round(n.startTicks),
        durationTicks: Math.max(1, Math.round(n.durationTicks)),
        velocity: Math.max(0.01, Math.min(1, n.velocity / 127)),
      });
    }
  }
  return midi.toArray();
}
