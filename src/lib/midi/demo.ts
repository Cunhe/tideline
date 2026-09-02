import { PPQ, TRACK_COLORS } from "./constants";
import type { MidiNote, MidiProject } from "./types";
import { uid } from "@/lib/utils";

const Q = PPQ;
const E = PPQ / 2;
const S = PPQ / 4;
const H = PPQ * 2;
const W = PPQ * 4;
const BAR = W;

export function emptyProject(name = "未命名"): MidiProject {
  return {
    id: uid("pj"),
    name,
    bpm: 88,
    timeSigNum: 4,
    timeSigDen: 4,
    ppq: PPQ,
    tracks: [
      {
        id: uid("tr"),
        name: "钢琴",
        instrument: "piano",
        mute: false,
        solo: false,
        volume: 0.92,
        color: TRACK_COLORS[0],
        notes: [],
      },
    ],
    loopEnabled: true,
    loopStartTicks: 0,
    loopEndTicks: BAR * 8,
  };
}

export function demoProject(): MidiProject {
  let i = 0;
  const n = (pitch: number, start: number, dur: number, vel = 96): MidiNote => ({
    id: `dn-${i++}`,
    pitch,
    startTicks: start,
    durationTicks: dur,
    velocity: vel,
  });

  const piano: MidiNote[] = [];
  const pad: MidiNote[] = [];
  const bass: MidiNote[] = [];
  const drums: MidiNote[] = [];

  const chords = [
    [50, 53, 57, 62],
    [46, 50, 53, 58],
    [53, 57, 60, 65],
    [48, 52, 55, 60],
  ];

  for (let bar = 0; bar < 8; bar++) {
    const t0 = bar * BAR;
    const ch = chords[bar % 4];
    pad.push(n(ch[0] + 12, t0, W, 58));
    pad.push(n(ch[2] + 12, t0, W, 52));
    pad.push(n(ch[3], t0, W, 50));

    bass.push(n(ch[0] - 12, t0, H, 100));
    bass.push(n(ch[0] - 12, t0 + H, E, 88));
    bass.push(n(ch[2] - 12, t0 + H + E, E, 84));

    const arp = [
      ch[0] + 12,
      ch[1] + 12,
      ch[2] + 12,
      ch[3] + 12,
      ch[2] + 12,
      ch[1] + 12,
      ch[2] + 12,
      ch[0] + 12,
    ];
    arp.forEach((p, idx) => {
      piano.push(n(p, t0 + idx * E, E - 20, 78 + (idx % 2) * 8));
    });

    if (bar >= 2) {
      const motif = bar % 4 === 3 ? [69, 67, 65, 64] : [69, 70, 72, 69];
      motif.forEach((p, idx) => {
        piano.push(n(p, t0 + idx * Q, Q - 30, 92));
      });
    }

    drums.push(n(36, t0, S, 110));
    drums.push(n(36, t0 + H, S, 96));
    drums.push(n(38, t0 + Q, S, 92));
    drums.push(n(38, t0 + Q * 3, S, 88));
    for (let hi = 0; hi < 8; hi++) {
      drums.push(n(42, t0 + hi * E, S, hi % 2 === 0 ? 70 : 48));
    }
    if (bar % 4 === 3) drums.push(n(49, t0 + Q * 3.5, E, 70));
  }

  piano.push(n(62, 8 * BAR, W, 70));
  piano.push(n(65, 8 * BAR, W, 64));
  piano.push(n(69, 8 * BAR, W, 68));
  pad.push(n(50, 8 * BAR, W, 48));
  bass.push(n(38, 8 * BAR, W, 80));
  drums.push(n(36, 8 * BAR, S, 90));
  drums.push(n(49, 8 * BAR, H, 64));

  return {
    id: "pj-demo",
    name: "港湾灯火",
    bpm: 88,
    timeSigNum: 4,
    timeSigDen: 4,
    ppq: PPQ,
    tracks: [
      {
        id: "tr-piano",
        name: "钢琴",
        instrument: "piano",
        mute: false,
        solo: false,
        volume: 0.9,
        color: TRACK_COLORS[0],
        notes: piano,
      },
      {
        id: "tr-pad",
        name: "暖垫",
        instrument: "pad",
        mute: false,
        solo: false,
        volume: 0.72,
        color: TRACK_COLORS[4],
        notes: pad,
      },
      {
        id: "tr-bass",
        name: "贝斯",
        instrument: "bass",
        mute: false,
        solo: false,
        volume: 0.88,
        color: TRACK_COLORS[2],
        notes: bass,
      },
      {
        id: "tr-drums",
        name: "鼓组",
        instrument: "drums",
        mute: false,
        solo: false,
        volume: 0.78,
        color: TRACK_COLORS[3],
        notes: drums,
      },
    ],
    loopEnabled: true,
    loopStartTicks: 0,
    loopEndTicks: BAR * 8,
  };
}
