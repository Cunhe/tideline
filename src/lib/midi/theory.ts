import {
  BLACK_PC,
  DRUM_LABELS,
  MIN_PITCH,
  PITCH_NAMES,
  PPQ,
} from "./constants";
import type { MidiNote, MidiProject, MidiTrack, SnapDiv } from "./types";

export function isBlackKey(midi: number): boolean {
  return BLACK_PC.has(((midi % 12) + 12) % 12);
}

export function pitchName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES[pc]}${oct}`;
}

export function displayPitch(midi: number, drums: boolean): string {
  if (drums && DRUM_LABELS[midi]) return DRUM_LABELS[midi];
  return pitchName(midi);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function ticksPerBeat(ppq = PPQ, den = 4): number {
  return ppq * (4 / den);
}

export function ticksPerBar(project: Pick<MidiProject, "ppq" | "timeSigNum" | "timeSigDen">): number {
  return project.timeSigNum * ticksPerBeat(project.ppq, project.timeSigDen);
}

export function snapGridTicks(snap: SnapDiv, ppq = PPQ): number {
  if (snap <= 0) return 1;
  return (ppq * 4) / snap;
}

export function snapTicks(ticks: number, snap: SnapDiv, ppq = PPQ): number {
  const grid = snapGridTicks(snap, ppq);
  return Math.max(0, Math.round(ticks / grid) * grid);
}

export function formatPosition(ticks: number, project: MidiProject): string {
  const barLen = ticksPerBar(project);
  const beatLen = ticksPerBeat(project.ppq, project.timeSigDen);
  const bar = Math.floor(ticks / barLen) + 1;
  const rem = ticks - (bar - 1) * barLen;
  const beat = Math.floor(rem / beatLen) + 1;
  const tick = Math.floor(rem % beatLen);
  return `${bar}.${beat}.${String(tick).padStart(3, "0")}`;
}

export function projectLengthTicks(project: MidiProject, minBars = 8): number {
  let max = 0;
  for (const t of project.tracks) {
    for (const n of t.notes) {
      max = Math.max(max, n.startTicks + n.durationTicks);
    }
  }
  const bar = ticksPerBar(project);
  const bars = Math.max(minBars, Math.ceil(max / bar) + 2);
  return bars * bar;
}

export function cloneNotes(notes: MidiNote[]): MidiNote[] {
  return notes.map((n) => ({ ...n }));
}

export function sortNotes(notes: MidiNote[]): MidiNote[] {
  return [...notes].sort(
    (a, b) => a.startTicks - b.startTicks || a.pitch - b.pitch,
  );
}

export function notesInRange(
  notes: MidiNote[],
  start: number,
  end: number,
): MidiNote[] {
  return notes.filter(
    (n) => n.startTicks < end && n.startTicks + n.durationTicks > start,
  );
}

export function activeTracks(project: MidiProject): MidiTrack[] {
  const anySolo = project.tracks.some((t) => t.solo);
  return project.tracks.filter((t) => {
    if (t.mute) return false;
    if (anySolo && !t.solo) return false;
    return true;
  });
}

export function quantizeNotes(
  notes: MidiNote[],
  snap: SnapDiv,
  ppq: number,
): MidiNote[] {
  if (snap <= 0) return notes;
  return notes.map((n) => ({
    ...n,
    startTicks: snapTicks(n.startTicks, snap, ppq),
    durationTicks: Math.max(
      snapGridTicks(snap, ppq),
      snapTicks(n.durationTicks, snap, ppq),
    ),
  }));
}

export function clampPitch(pitch: number): number {
  return Math.max(MIN_PITCH, Math.min(108, pitch));
}
