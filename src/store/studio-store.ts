import { create } from "zustand";
import { demoProject, emptyProject } from "@/lib/midi/demo";
import { STORAGE_CURRENT, STORAGE_PROJECTS, TRACK_COLORS } from "@/lib/midi/constants";
import type {
  InstrumentId,
  MidiNote,
  MidiProject,
  MidiTrack,
  SavedProjectMeta,
  SnapDiv,
  Tool,
} from "@/lib/midi/types";
import { clampPitch, quantizeNotes, snapTicks } from "@/lib/midi/theory";
import { uid } from "@/lib/utils";
import { engine } from "@/lib/midi/engine";

const HISTORY_LIMIT = 60;

let gestureBase: MidiProject | null = null;
let gestureDirty = false;

export interface StudioState {
  project: MidiProject;
  selectedTrackId: string;
  selectedNoteIds: string[];
  tool: Tool;
  snap: SnapDiv;
  drawDuration: number;
  pxPerBeat: number;
  keyHeight: number;
  scrollX: number;
  scrollY: number;
  playheadTicks: number;
  isPlaying: boolean;
  isRecording: boolean;
  metronome: boolean;
  keyboardOctave: number;
  showKeyboard: boolean;
  showHelp: boolean;
  showLibrary: boolean;
  ghostTracks: boolean;
  masterVolume: number;
  past: MidiProject[];
  future: MidiProject[];
  dirty: boolean;
  hydrated: boolean;

  hydrate: () => void;
  setPlayhead: (ticks: number) => void;
  setPlaying: (v: boolean) => void;
  setTool: (t: Tool) => void;
  setSnap: (s: SnapDiv) => void;
  setZoomX: (px: number) => void;
  setZoomY: (h: number) => void;
  setScroll: (x: number, y: number) => void;
  selectTrack: (id: string) => void;
  selectNotes: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setProjectName: (name: string) => void;
  setBpm: (bpm: number) => void;
  setTimeSig: (num: number, den: number) => void;
  setLoop: (enabled: boolean, start?: number, end?: number) => void;
  toggleMetronome: () => void;
  toggleKeyboard: () => void;
  toggleHelp: () => void;
  toggleLibrary: () => void;
  toggleGhost: () => void;
  setMasterVolume: (v: number) => void;
  setOctave: (n: number) => void;
  setRecording: (v: boolean) => void;
  setDrawDuration: (t: number) => void;

  undo: () => void;
  redo: () => void;
  commit: (next: MidiProject) => void;
  patchLive: (next: MidiProject) => void;
  beginGesture: () => void;
  endGesture: () => void;

  addTrack: (instrument?: InstrumentId) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<MidiTrack>) => void;
  addNote: (trackId: string, note: Omit<MidiNote, "id">) => string;
  addNotes: (trackId: string, notes: Omit<MidiNote, "id">[]) => void;
  updateNotes: (
    trackId: string,
    ids: string[],
    patch: Partial<Pick<MidiNote, "pitch" | "startTicks" | "durationTicks" | "velocity">>,
  ) => void;
  deleteNotes: (trackId: string, ids: string[]) => void;
  moveSelected: (dTicks: number, dPitch: number) => void;
  resizeSelected: (dDur: number) => void;
  setSelectedVelocity: (vel: number) => void;
  quantizeSelected: () => void;
  duplicateSelected: () => void;
  selectAllInTrack: () => void;
  pasteNotes: (notes: MidiNote[], atTicks: number) => void;

  newProject: () => void;
  loadDemo: () => void;
  loadProject: (p: MidiProject) => void;
  saveCurrent: () => void;
  listLibrary: () => SavedProjectMeta[];
  loadFromLibrary: (id: string) => void;
  deleteFromLibrary: (id: string) => void;
}

function cloneProject(p: MidiProject): MidiProject {
  return structuredClone(p);
}

let persistTimer: number | undefined;

function persist(p: MidiProject) {
  if (typeof window === "undefined") return;
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_CURRENT, JSON.stringify(p));
      const raw = localStorage.getItem(STORAGE_PROJECTS);
      const lib: Record<string, { meta: SavedProjectMeta; project: MidiProject }> = raw
        ? JSON.parse(raw)
        : {};
      lib[p.id] = {
        meta: { id: p.id, name: p.name, updatedAt: Date.now() },
        project: p,
      };
      localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(lib));
    } catch {
      /* quota */
    }
  }, 350);
}

function currentTrack(s: StudioState): MidiTrack | undefined {
  return s.project.tracks.find((t) => t.id === s.selectedTrackId) ?? s.project.tracks[0];
}

export const useStudioStore = create<StudioState>((set, get) => ({
  project: demoProject(),
  selectedTrackId: "tr-piano",
  selectedNoteIds: [],
  tool: "draw",
  snap: 16,
  drawDuration: 480,
  pxPerBeat: 64,
  keyHeight: 16,
  scrollX: 0,
  scrollY: 16 * 24,
  playheadTicks: 0,
  isPlaying: false,
  isRecording: false,
  metronome: false,
  keyboardOctave: 4,
  showKeyboard: true,
  showHelp: false,
  showLibrary: false,
  ghostTracks: true,
  masterVolume: 0.9,
  past: [],
  future: [],
  dirty: false,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(STORAGE_CURRENT);
      if (raw) {
        const p = JSON.parse(raw) as MidiProject;
        if (p?.tracks?.length) {
          set({
            project: p,
            selectedTrackId: p.tracks[0].id,
            hydrated: true,
            past: [],
            future: [],
          });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const p = get().project;
    set({ selectedTrackId: p.tracks[0]?.id ?? "", hydrated: true });
  },

  setPlayhead: (ticks) => set({ playheadTicks: Math.max(0, ticks) }),
  setPlaying: (v) => set({ isPlaying: v }),
  setTool: (t) => set({ tool: t }),
  setSnap: (s) => set({ snap: s }),
  setZoomX: (px) => set({ pxPerBeat: Math.max(24, Math.min(220, px)) }),
  setZoomY: (h) => set({ keyHeight: Math.max(10, Math.min(28, h)) }),
  setScroll: (x, y) => set({ scrollX: Math.max(0, x), scrollY: Math.max(0, y) }),
  selectTrack: (id) => set({ selectedTrackId: id, selectedNoteIds: [] }),
  selectNotes: (ids, additive) =>
    set((s) => ({
      selectedNoteIds: additive ? Array.from(new Set([...s.selectedNoteIds, ...ids])) : ids,
    })),
  clearSelection: () => set({ selectedNoteIds: [] }),
  setProjectName: (name) => {
    const s = get();
    s.commit({ ...s.project, name });
  },
  setBpm: (bpm) => {
    const s = get();
    s.commit({ ...s.project, bpm: Math.max(20, Math.min(300, bpm)) });
  },
  setTimeSig: (num, den) => {
    const s = get();
    s.commit({ ...s.project, timeSigNum: num, timeSigDen: den });
  },
  setLoop: (enabled, start, end) => {
    const s = get();
    s.commit({
      ...s.project,
      loopEnabled: enabled,
      loopStartTicks: start ?? s.project.loopStartTicks,
      loopEndTicks: end ?? s.project.loopEndTicks,
    });
  },
  toggleMetronome: () => {
    const next = !get().metronome;
    engine.metronome = next;
    set({ metronome: next });
  },
  toggleKeyboard: () => set((s) => ({ showKeyboard: !s.showKeyboard })),
  toggleHelp: () => set((s) => ({ showHelp: !s.showHelp })),
  toggleLibrary: () => set((s) => ({ showLibrary: !s.showLibrary })),
  toggleGhost: () => set((s) => ({ ghostTracks: !s.ghostTracks })),
  setMasterVolume: (v) => {
    engine.setVolume(v);
    set({ masterVolume: v });
  },
  setOctave: (n) => set({ keyboardOctave: Math.max(1, Math.min(7, n)) }),
  setRecording: (v) => {
    engine.recording = v;
    set({ isRecording: v });
  },
  setDrawDuration: (t) => set({ drawDuration: Math.max(30, t) }),

  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      past: s.past.slice(0, -1),
      future: [cloneProject(s.project), ...s.future].slice(0, HISTORY_LIMIT),
      project: prev,
      dirty: true,
    });
  },
  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    set({
      future: s.future.slice(1),
      past: [...s.past, cloneProject(s.project)].slice(-HISTORY_LIMIT),
      project: next,
      dirty: true,
    });
  },
  commit: (next) => {
    const s = get();
    persist(next);
    set({
      project: next,
      past: [...s.past, cloneProject(s.project)].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
      selectedTrackId: next.tracks.some((t) => t.id === s.selectedTrackId)
        ? s.selectedTrackId
        : (next.tracks[0]?.id ?? ""),
    });
  },
  patchLive: (next) => {
    gestureDirty = true;
    set({ project: next, dirty: true });
  },
  beginGesture: () => {
    if (!gestureBase) {
      gestureBase = cloneProject(get().project);
      gestureDirty = false;
    }
  },
  endGesture: () => {
    if (!gestureBase) return;
    if (gestureDirty) {
      persist(get().project);
      set((s) => ({
        past: [...s.past, gestureBase!].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
      }));
    }
    gestureBase = null;
    gestureDirty = false;
  },

  addTrack: (instrument = "piano") => {
    const s = get();
    const i = s.project.tracks.length;
    const names: Record<string, string> = {
      piano: "钢琴",
      epiano: "电钢琴",
      organ: "管风琴",
      pad: "暖垫",
      strings: "弦乐",
      choir: "人声",
      bass: "贝斯",
      lead: "主音",
      pluck: "拨弦",
      flute: "长笛",
      bells: "钟琴",
      drums: "鼓组",
    };
    const track: MidiTrack = {
      id: uid("tr"),
      name: names[instrument] ?? `轨道 ${i + 1}`,
      instrument,
      mute: false,
      solo: false,
      volume: 0.9,
      color: TRACK_COLORS[i % TRACK_COLORS.length],
      notes: [],
    };
    s.commit({ ...s.project, tracks: [...s.project.tracks, track] });
    set({ selectedTrackId: track.id });
  },
  removeTrack: (id) => {
    const s = get();
    if (s.project.tracks.length <= 1) return;
    s.commit({ ...s.project, tracks: s.project.tracks.filter((t) => t.id !== id) });
  },
  updateTrack: (id, patch) => {
    const s = get();
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  },
  addNote: (trackId, note) => {
    const id = uid("n");
    const s = get();
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId ? { ...t, notes: [...t.notes, { ...note, id }] } : t,
      ),
    });
    set({ selectedNoteIds: [id] });
    return id;
  },
  addNotes: (trackId, notes) => {
    const s = get();
    const made = notes.map((n) => ({ ...n, id: uid("n") }));
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId ? { ...t, notes: [...t.notes, ...made] } : t,
      ),
    });
    set({ selectedNoteIds: made.map((n) => n.id) });
  },
  updateNotes: (trackId, ids, patch) => {
    const s = get();
    const setIds = new Set(ids);
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              notes: t.notes.map((n) => {
                if (!setIds.has(n.id)) return n;
                const next = { ...n, ...patch };
                next.pitch = clampPitch(next.pitch);
                next.startTicks = Math.max(0, next.startTicks);
                next.durationTicks = Math.max(30, next.durationTicks);
                next.velocity = Math.max(1, Math.min(127, next.velocity));
                return next;
              }),
            }
          : t,
      ),
    });
  },
  deleteNotes: (trackId, ids) => {
    const s = get();
    const setIds = new Set(ids);
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === trackId ? { ...t, notes: t.notes.filter((n) => !setIds.has(n.id)) } : t,
      ),
    });
    set({ selectedNoteIds: [] });
  },
  moveSelected: (dTicks, dPitch) => {
    const s = get();
    const track = currentTrack(s);
    if (!track || s.selectedNoteIds.length === 0) return;
    const setIds = new Set(s.selectedNoteIds);
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === track.id
          ? {
              ...t,
              notes: t.notes.map((n) =>
                setIds.has(n.id)
                  ? {
                      ...n,
                      startTicks: Math.max(0, n.startTicks + dTicks),
                      pitch: clampPitch(n.pitch + dPitch),
                    }
                  : n,
              ),
            }
          : t,
      ),
    });
  },
  resizeSelected: (dDur) => {
    const s = get();
    const track = currentTrack(s);
    if (!track || s.selectedNoteIds.length === 0) return;
    const setIds = new Set(s.selectedNoteIds);
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === track.id
          ? {
              ...t,
              notes: t.notes.map((n) =>
                setIds.has(n.id)
                  ? { ...n, durationTicks: Math.max(30, n.durationTicks + dDur) }
                  : n,
              ),
            }
          : t,
      ),
    });
  },
  setSelectedVelocity: (vel) => {
    const s = get();
    const track = currentTrack(s);
    if (!track || s.selectedNoteIds.length === 0) return;
    s.updateNotes(track.id, s.selectedNoteIds, {
      velocity: Math.max(1, Math.min(127, vel)),
    });
  },
  quantizeSelected: () => {
    const s = get();
    const track = currentTrack(s);
    if (!track) return;
    const setIds = new Set(s.selectedNoteIds);
    const q = quantizeNotes(
      s.selectedNoteIds.length ? track.notes.filter((n) => setIds.has(n.id)) : track.notes,
      s.snap || 16,
      s.project.ppq,
    );
    const qMap = new Map(q.map((n) => [n.id, n]));
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === track.id
          ? { ...t, notes: t.notes.map((n) => qMap.get(n.id) ?? n) }
          : t,
      ),
    });
  },
  duplicateSelected: () => {
    const s = get();
    const track = currentTrack(s);
    if (!track || s.selectedNoteIds.length === 0) return;
    const setIds = new Set(s.selectedNoteIds);
    const selected = track.notes.filter((n) => setIds.has(n.id));
    const minStart = Math.min(...selected.map((n) => n.startTicks));
    const maxEnd = Math.max(...selected.map((n) => n.startTicks + n.durationTicks));
    const shift = maxEnd - minStart;
    const copies = selected.map((n) => ({
      ...n,
      id: uid("n"),
      startTicks: n.startTicks + shift,
    }));
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === track.id ? { ...t, notes: [...t.notes, ...copies] } : t,
      ),
    });
    set({ selectedNoteIds: copies.map((n) => n.id) });
  },
  selectAllInTrack: () => {
    const s = get();
    const track = currentTrack(s);
    if (!track) return;
    set({ selectedNoteIds: track.notes.map((n) => n.id) });
  },
  pasteNotes: (notes, atTicks) => {
    const s = get();
    const track = currentTrack(s);
    if (!track || notes.length === 0) return;
    const minStart = Math.min(...notes.map((n) => n.startTicks));
    const snapped = snapTicks(atTicks, s.snap, s.project.ppq);
    const copies = notes.map((n) => ({
      ...n,
      id: uid("n"),
      startTicks: n.startTicks - minStart + snapped,
    }));
    s.commit({
      ...s.project,
      tracks: s.project.tracks.map((t) =>
        t.id === track.id ? { ...t, notes: [...t.notes, ...copies] } : t,
      ),
    });
    set({ selectedNoteIds: copies.map((n) => n.id) });
  },

  newProject: () => {
    const p = emptyProject();
    engine.stop();
    set({
      project: p,
      selectedTrackId: p.tracks[0].id,
      selectedNoteIds: [],
      playheadTicks: 0,
      isPlaying: false,
      isRecording: false,
      drawDuration: p.ppq,
      past: [],
      future: [],
      dirty: false,
    });
    persist(p);
  },
  loadDemo: () => {
    const p = demoProject();
    engine.stop();
    set({
      project: p,
      selectedTrackId: p.tracks[0].id,
      selectedNoteIds: [],
      playheadTicks: 0,
      isPlaying: false,
      drawDuration: p.ppq,
      past: [],
      future: [],
      dirty: false,
    });
    persist(p);
  },
  loadProject: (p) => {
    engine.stop();
    set({
      project: p,
      selectedTrackId: p.tracks[0]?.id ?? "",
      selectedNoteIds: [],
      playheadTicks: 0,
      isPlaying: false,
      drawDuration: p.ppq,
      past: [],
      future: [],
      dirty: false,
    });
    persist(p);
  },
  saveCurrent: () => {
    persist(get().project);
    set({ dirty: false });
  },
  listLibrary: () => {
    try {
      const raw = localStorage.getItem(STORAGE_PROJECTS);
      if (!raw) return [];
      const lib = JSON.parse(raw) as Record<string, { meta: SavedProjectMeta }>;
      return Object.values(lib)
        .map((x) => x.meta)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },
  loadFromLibrary: (id) => {
    try {
      const raw = localStorage.getItem(STORAGE_PROJECTS);
      if (!raw) return;
      const lib = JSON.parse(raw) as Record<string, { project: MidiProject }>;
      if (lib[id]) get().loadProject(lib[id].project);
    } catch {
      /* ignore */
    }
  },
  deleteFromLibrary: (id) => {
    try {
      const raw = localStorage.getItem(STORAGE_PROJECTS);
      if (!raw) return;
      const lib = JSON.parse(raw) as Record<string, unknown>;
      delete lib[id];
      localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(lib));
    } catch {
      /* ignore */
    }
  },
}));
