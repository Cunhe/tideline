export type InstrumentId =
  | "piano"
  | "epiano"
  | "organ"
  | "pad"
  | "strings"
  | "choir"
  | "bass"
  | "lead"
  | "pluck"
  | "flute"
  | "bells"
  | "drums";

export type Tool = "draw" | "select" | "erase";

export type SnapDiv = 0 | 4 | 8 | 16 | 24 | 32;

export interface MidiNote {
  id: string;
  pitch: number;
  startTicks: number;
  durationTicks: number;
  velocity: number;
}

export interface MidiTrack {
  id: string;
  name: string;
  instrument: InstrumentId;
  mute: boolean;
  solo: boolean;
  volume: number;
  color: string;
  notes: MidiNote[];
}

export interface MidiProject {
  id: string;
  name: string;
  bpm: number;
  timeSigNum: number;
  timeSigDen: number;
  ppq: number;
  tracks: MidiTrack[];
  loopEnabled: boolean;
  loopStartTicks: number;
  loopEndTicks: number;
}

export interface SavedProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}
