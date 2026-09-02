import type { InstrumentId, SnapDiv } from "./types";

export const PPQ = 480;
export const MIN_PITCH = 21;
export const MAX_PITCH = 108;
export const PITCH_COUNT = MAX_PITCH - MIN_PITCH + 1;
export const DEFAULT_BPM = 88;
export const KEYS_WIDTH = 52;
export const RULER_HEIGHT = 28;
export const VELOCITY_HEIGHT = 56;
export const MIN_NOTE_TICKS = 30;

export const PITCH_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const BLACK_PC = new Set([1, 3, 6, 8, 10]);

export const TRACK_COLORS = [
  "#6a9aa3",
  "#7d9174",
  "#9a7d6e",
  "#6d7d96",
  "#8a8a7a",
  "#6e8a88",
] as const;

export interface InstrumentDef {
  id: InstrumentId;
  name: string;
  gm: number;
  drum?: boolean;
}

export const INSTRUMENTS: InstrumentDef[] = [
  { id: "piano", name: "三角钢琴", gm: 0 },
  { id: "epiano", name: "电钢琴", gm: 4 },
  { id: "organ", name: "管风琴", gm: 19 },
  { id: "pad", name: "暖垫", gm: 89 },
  { id: "strings", name: "弦乐", gm: 48 },
  { id: "choir", name: "人声合唱", gm: 52 },
  { id: "bass", name: "指拨贝斯", gm: 33 },
  { id: "lead", name: "合成主音", gm: 81 },
  { id: "pluck", name: "拨弦", gm: 45 },
  { id: "flute", name: "长笛", gm: 73 },
  { id: "bells", name: "钟琴", gm: 9 },
  { id: "drums", name: "鼓组", gm: 0, drum: true },
];

export const INSTRUMENT_MAP: Record<InstrumentId, InstrumentDef> = Object.fromEntries(
  INSTRUMENTS.map((i) => [i.id, i]),
) as Record<InstrumentId, InstrumentDef>;

export const SNAP_OPTIONS: { value: SnapDiv; label: string }[] = [
  { value: 4, label: "1/4" },
  { value: 8, label: "1/8" },
  { value: 16, label: "1/16" },
  { value: 24, label: "三连音" },
  { value: 32, label: "1/32" },
  { value: 0, label: "关闭" },
];

export const COMPUTER_KEYS: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ";": 16,
  "'": 17,
};

export const DRUM_LABELS: Record<number, string> = {
  35: "底鼓",
  36: "底鼓",
  38: "军鼓",
  40: "军鼓",
  42: "闭镜",
  44: "踏镜",
  46: "开镜",
  41: "低通",
  43: "低通",
  45: "通鼓",
  47: "中通",
  48: "高通",
  49: "吊镜",
  51: "叮叮镜",
  53: "叮叮边",
  37: "边击",
  39: "拍手",
};

export const STORAGE_PROJECTS = "tideline:projects:v1";
export const STORAGE_CURRENT = "tideline:current:v1";
