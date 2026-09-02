import { useCallback, useEffect, useRef } from "react";
import {
  KEYS_WIDTH,
  MAX_PITCH,
  MIN_PITCH,
  RULER_HEIGHT,
  VELOCITY_HEIGHT,
} from "@/lib/midi/constants";
import type { MidiNote, MidiProject } from "@/lib/midi/types";
import {
  displayPitch,
  isBlackKey,
  projectLengthTicks,
  snapTicks,
  ticksPerBar,
  ticksPerBeat,
} from "@/lib/midi/theory";
import { engine } from "@/lib/midi/engine";
import { useStudioStore } from "@/store/studio-store";
import { uid } from "@/lib/utils";

type Drag =
  | { kind: "draw"; id: string; start: number; pitch: number }
  | {
      kind: "move";
      ids: string[];
      origin: { id: string; start: number; pitch: number }[];
      lastPitch: number;
      lastStart: number;
    }
  | { kind: "resize"; ids: string[]; origin: { id: string; dur: number }[]; last: number }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number }
  | { kind: "pan"; x: number; y: number; sx: number; sy: number }
  | { kind: "playhead" }
  | { kind: "loop"; edge: "start" | "end" }
  | { kind: "velocity"; ids: string[] }
  | { kind: "erase" };

function css(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  );
}

function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function patchTrackNotes(
  project: MidiProject,
  trackId: string,
  notes: MidiNote[],
): MidiProject {
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, notes } : t)),
  };
}

export function PianoRoll() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const spaceRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0 });
  const playheadRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    sizeRef.current = { w, h };
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = useStudioStore.getState();
    const {
      project,
      selectedTrackId,
      selectedNoteIds,
      pxPerBeat,
      keyHeight,
      scrollX,
      scrollY,
      ghostTracks,
      snap,
      tool,
    } = s;
    const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0];
    const ppq = project.ppq;
    const pxPerTick = pxPerBeat / ppq;
    const barTicks = ticksPerBar(project);
    const beatTicks = ticksPerBeat(ppq, project.timeSigDen);
    const subTicks = snap > 0 ? (ppq * 4) / snap : beatTicks / 2;
    projectLengthTicks(project, 12);
    const velH = h < 420 ? 0 : VELOCITY_HEIGHT;
    const rollH = h - RULER_HEIGHT - velH;
    const playhead = playheadRef.current;

    const bg = css("--color-bg", "#09090b");
    const surface = css("--color-surface", "#12141a");
    const elevated = css("--color-elevated", "#1a1d26");
    const fg = css("--color-fg", "#e8eae9");
    const muted = css("--color-muted", "#8b908c");
    const subtle = css("--color-subtle", "#5c605e");
    const gridBar = css("--color-grid-bar", "#2c313c");
    const gridBeat = css("--color-grid-beat", "#1f232c");
    const gridSub = css("--color-grid-sub", "#181b22");
    const playCol = css("--color-playhead", "#d7e6e3");
    const accent = css("--color-accent", "#8eb8b4");
    const keyW = css("--color-key-white", "#d8dbd6");
    const keyB = css("--color-key-black", "#1c1e24");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const pitchAtY = (y: number) => {
      const rel = y - RULER_HEIGHT + scrollY;
      return MAX_PITCH - Math.floor(rel / keyHeight);
    };
    const yOfPitch = (p: number) => RULER_HEIGHT + (MAX_PITCH - p) * keyHeight - scrollY;
    const xOfTicks = (t: number) => KEYS_WIDTH + t * pxPerTick - scrollX;
    const ticksAtX = (x: number) => (x - KEYS_WIDTH + scrollX) / pxPerTick;

    const p0 = pitchAtY(RULER_HEIGHT);
    const p1 = pitchAtY(RULER_HEIGHT + rollH);

    for (let p = p0; p >= p1; p--) {
      if (p < MIN_PITCH || p > MAX_PITCH) continue;
      const y = yOfPitch(p);
      const black = isBlackKey(p);
      ctx.fillStyle = black ? hexAlpha(elevated, 0.9) : surface;
      ctx.fillRect(KEYS_WIDTH, y, w - KEYS_WIDTH, keyHeight);
      if (p % 12 === 0) {
        ctx.fillStyle = hexAlpha(fg, 0.04);
        ctx.fillRect(KEYS_WIDTH, y, w - KEYS_WIDTH, keyHeight);
      }
    }

    const t0 = Math.max(0, ticksAtX(KEYS_WIDTH));
    const t1 = ticksAtX(w);
    for (let t = Math.floor(t0 / subTicks) * subTicks; t < t1; t += subTicks) {
      const x = xOfTicks(t);
      if (x < KEYS_WIDTH) continue;
      const onBar = Math.abs(t % barTicks) < 0.5;
      const onBeat = Math.abs(t % beatTicks) < 0.5;
      ctx.strokeStyle = onBar ? gridBar : onBeat ? gridBeat : gridSub;
      ctx.lineWidth = onBar ? 1.25 : 1;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT);
      ctx.lineTo(x, RULER_HEIGHT + rollH);
      ctx.stroke();
    }

    const selected = new Set(selectedNoteIds);
    const drawNote = (note: MidiNote, color: string, ghost: boolean) => {
      const x = xOfTicks(note.startTicks);
      const y = yOfPitch(note.pitch);
      const nw = Math.max(4, note.durationTicks * pxPerTick);
      const nh = Math.max(keyHeight - 2, 8);
      if (x + nw < KEYS_WIDTH || x > w || y + nh < RULER_HEIGHT || y > RULER_HEIGHT + rollH) return;
      const velA = 0.42 + (note.velocity / 127) * 0.58;
      ctx.beginPath();
      ctx.roundRect(
        Math.max(x, KEYS_WIDTH),
        y + 1,
        nw - (x < KEYS_WIDTH ? KEYS_WIDTH - x : 0),
        nh,
        3,
      );
      ctx.fillStyle = ghost ? hexAlpha(color, 0.18) : hexAlpha(color, velA);
      ctx.fill();
      if (!ghost) {
        ctx.fillStyle = hexAlpha("#ffffff", 0.22);
        ctx.fillRect(Math.max(x, KEYS_WIDTH), y + 1, 3, nh);
      }
      if (selected.has(note.id) && !ghost) {
        ctx.strokeStyle = playCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    if (ghostTracks) {
      for (const tr of project.tracks) {
        if (tr.id === track?.id) continue;
        for (const note of tr.notes) drawNote(note, tr.color, true);
      }
    }
    if (track) {
      for (const note of track.notes) drawNote(note, track.color, false);
    }

    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, w, RULER_HEIGHT);
    ctx.fillStyle = hexAlpha(fg, 0.06);
    ctx.fillRect(0, RULER_HEIGHT - 1, w, 1);
    ctx.font = `500 10px ${css("--font-mono", "IBM Plex Mono")}, monospace`;
    ctx.textBaseline = "middle";
    for (let t = Math.floor(t0 / barTicks) * barTicks; t < t1; t += beatTicks) {
      const x = xOfTicks(t);
      if (x < KEYS_WIDTH) continue;
      const onBar = Math.abs(t % barTicks) < 0.5;
      ctx.fillStyle = onBar ? muted : subtle;
      if (onBar) {
        ctx.fillText(String(Math.floor(t / barTicks) + 1), x + 4, RULER_HEIGHT / 2);
      }
      ctx.fillStyle = onBar ? gridBar : gridBeat;
      ctx.fillRect(x, RULER_HEIGHT - (onBar ? 10 : 6), 1, onBar ? 10 : 6);
    }

    if (project.loopEnabled) {
      const lx0 = xOfTicks(project.loopStartTicks);
      const lx1 = xOfTicks(project.loopEndTicks);
      ctx.fillStyle = hexAlpha(accent, 0.12);
      ctx.fillRect(
        Math.max(KEYS_WIDTH, lx0),
        0,
        Math.max(0, lx1 - Math.max(KEYS_WIDTH, lx0)),
        RULER_HEIGHT,
      );
      ctx.fillStyle = accent;
      ctx.fillRect(lx0, 0, 2, RULER_HEIGHT);
      ctx.fillRect(lx1, 0, 2, RULER_HEIGHT);
    }

    const px = xOfTicks(playhead);
    if (px >= KEYS_WIDTH && px <= w) {
      ctx.strokeStyle = playCol;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.fillStyle = playCol;
      ctx.beginPath();
      ctx.moveTo(px - 5, 0);
      ctx.lineTo(px + 5, 0);
      ctx.lineTo(px, 8);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = elevated;
    ctx.fillRect(0, RULER_HEIGHT, KEYS_WIDTH, rollH);
    ctx.font = `500 10px ${css("--font-sans", "IBM Plex Sans")}, sans-serif`;
    for (let p = p0; p >= p1; p--) {
      if (p < MIN_PITCH || p > MAX_PITCH) continue;
      const y = yOfPitch(p);
      const black = isBlackKey(p);
      ctx.fillStyle = black ? keyB : keyW;
      const inset = black ? 10 : 0;
      ctx.fillRect(0, y + 0.5, KEYS_WIDTH - 4 - inset, keyHeight - 1);
      if (!black) {
        ctx.fillStyle = hexAlpha("#09090b", 0.55);
        if (p % 12 === 0)
          ctx.fillText(displayPitch(p, track?.instrument === "drums"), 6, y + keyHeight / 2);
      }
    }

    if (velH > 0) {
      const vy = h - velH;
      ctx.fillStyle = bg;
      ctx.fillRect(KEYS_WIDTH, vy, w - KEYS_WIDTH, velH);
      ctx.fillStyle = hexAlpha(fg, 0.06);
      ctx.fillRect(KEYS_WIDTH, vy, w - KEYS_WIDTH, 1);
      ctx.fillStyle = muted;
      ctx.font = `500 10px ${css("--font-sans", "IBM Plex Sans")}`;
      ctx.fillText("力度", 8, vy + 14);
      if (track) {
        for (const note of track.notes) {
          const x = xOfTicks(note.startTicks);
          const nw = Math.max(3, note.durationTicks * pxPerTick);
          if (x + nw < KEYS_WIDTH || x > w) continue;
          const vh = (note.velocity / 127) * (velH - 10);
          ctx.fillStyle = selected.has(note.id)
            ? hexAlpha(playCol, 0.9)
            : hexAlpha(track.color, 0.75);
          ctx.fillRect(Math.max(KEYS_WIDTH, x), vy + velH - 4 - vh, Math.max(2, nw * 0.7), vh);
        }
      }
    }

    const drag = dragRef.current;
    if (drag?.kind === "marquee") {
      const x = Math.min(drag.x0, drag.x1);
      const y = Math.min(drag.y0, drag.y1);
      const mw = Math.abs(drag.x1 - drag.x0);
      const mh = Math.abs(drag.y1 - drag.y0);
      ctx.fillStyle = hexAlpha(accent, 0.12);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, mw, mh);
      ctx.strokeRect(x, y, mw, mh);
    }

    if (track && track.notes.length === 0) {
      ctx.fillStyle = muted;
      ctx.font = `500 13px ${css("--font-sans", "IBM Plex Sans")}`;
      ctx.textAlign = "center";
      ctx.fillText(
        tool === "draw" ? "拖拽绘制音符 · 空格播放" : "当前轨道还没有音符",
        KEYS_WIDTH + (w - KEYS_WIDTH) / 2,
        RULER_HEIGHT + rollH / 2,
      );
      ctx.textAlign = "start";
    }
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    const unsub = useStudioStore.subscribe(() => draw());
    draw();
    let raf = 0;
    const loop = () => {
      const s = useStudioStore.getState();
      const ticks = s.isPlaying ? engine.currentTicks(s.project) : s.playheadTicks;
      if (Math.abs(ticks - playheadRef.current) > 0.5) {
        playheadRef.current = ticks;
        if (s.isPlaying) s.setPlayhead(ticks);
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [draw]);

  const localToNote = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const s = useStudioStore.getState();
    const pxPerTick = s.pxPerBeat / s.project.ppq;
    const ticks = (x - KEYS_WIDTH + s.scrollX) / pxPerTick;
    const pitch = MAX_PITCH - Math.floor((y - RULER_HEIGHT + s.scrollY) / s.keyHeight);
    return { x, y, ticks, pitch };
  };

  const hitNote = (ticks: number, pitch: number, notes: MidiNote[]) => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.pitch === pitch && ticks >= n.startTicks && ticks <= n.startTicks + n.durationTicks) {
        return n;
      }
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    const { x, y, ticks, pitch } = localToNote(e.clientX, e.clientY);
    const s = useStudioStore.getState();
    const track = s.project.tracks.find((t) => t.id === s.selectedTrackId) ?? s.project.tracks[0];
    if (!track) return;
    const h = sizeRef.current.h;
    const velH = h < 420 ? 0 : VELOCITY_HEIGHT;
    const velTop = h - velH;

    if (e.button === 1 || e.altKey) {
      dragRef.current = { kind: "pan", x: e.clientX, y: e.clientY, sx: s.scrollX, sy: s.scrollY };
      return;
    }

    if (y < RULER_HEIGHT) {
      if (s.project.loopEnabled) {
        const pxPerTick = s.pxPerBeat / s.project.ppq;
        const ls = KEYS_WIDTH + s.project.loopStartTicks * pxPerTick - s.scrollX;
        const le = KEYS_WIDTH + s.project.loopEndTicks * pxPerTick - s.scrollX;
        if (Math.abs(x - ls) < 6) {
          s.beginGesture();
          dragRef.current = { kind: "loop", edge: "start" };
          return;
        }
        if (Math.abs(x - le) < 6) {
          s.beginGesture();
          dragRef.current = { kind: "loop", edge: "end" };
          return;
        }
      }
      const snapped = snapTicks(Math.max(0, ticks), s.snap, s.project.ppq);
      engine.seek(snapped);
      s.setPlayhead(snapped);
      dragRef.current = { kind: "playhead" };
      return;
    }

    if (velH > 0 && y > velTop) {
      s.beginGesture();
      dragRef.current = {
        kind: "velocity",
        ids: s.selectedNoteIds.length ? s.selectedNoteIds : track.notes.map((n) => n.id),
      };
      const vel = Math.max(
        1,
        Math.min(127, Math.round(((velTop + velH - 4 - y) / (velH - 10)) * 127)),
      );
      const ids = new Set(
        s.selectedNoteIds.length ? s.selectedNoteIds : track.notes.map((n) => n.id),
      );
      s.patchLive(
        patchTrackNotes(
          s.project,
          track.id,
          track.notes.map((n) => (ids.has(n.id) ? { ...n, velocity: vel } : n)),
        ),
      );
      return;
    }

    if (x < KEYS_WIDTH) {
      if (pitch >= MIN_PITCH && pitch <= MAX_PITCH) {
        engine.preview(track.instrument, pitch, 0.85, 0.4);
      }
      return;
    }

    if (s.tool === "erase") {
      const hit = hitNote(ticks, pitch, track.notes);
      if (hit) s.deleteNotes(track.id, [hit.id]);
      dragRef.current = { kind: "erase" };
      return;
    }

    const hit = hitNote(ticks, pitch, track.notes);
    if (s.tool === "select" || (s.tool === "draw" && hit)) {
      if (hit) {
        s.beginGesture();
        const ids = e.shiftKey
          ? Array.from(new Set([...s.selectedNoteIds, hit.id]))
          : s.selectedNoteIds.includes(hit.id)
            ? s.selectedNoteIds
            : [hit.id];
        s.selectNotes(ids);
        engine.preview(track.instrument, hit.pitch, hit.velocity / 127, 0.25);
        const pxPerTick = s.pxPerBeat / s.project.ppq;
        const right = KEYS_WIDTH + (hit.startTicks + hit.durationTicks) * pxPerTick - s.scrollX;
        s.beginGesture();
        if (Math.abs(x - right) < 8) {
          dragRef.current = {
            kind: "resize",
            ids,
            origin: ids.map((id) => {
              const n = track.notes.find((nn) => nn.id === id)!;
              return { id, dur: n.durationTicks };
            }),
            last: ticks,
          };
        } else {
          dragRef.current = {
            kind: "move",
            ids,
            origin: ids.map((id) => {
              const n = track.notes.find((nn) => nn.id === id)!;
              return { id, start: n.startTicks, pitch: n.pitch };
            }),
            lastPitch: pitch,
            lastStart: snapTicks(ticks, s.snap, s.project.ppq),
          };
        }
      } else {
        if (!e.shiftKey) s.clearSelection();
        dragRef.current = { kind: "marquee", x0: x, y0: y, x1: x, y1: y };
      }
      return;
    }

    if (s.tool === "draw") {
      const start = snapTicks(Math.max(0, ticks), s.snap, s.project.ppq);
      const dur = s.drawDuration;
      const id = uid("n");
      const note: MidiNote = {
        id,
        pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch)),
        startTicks: start,
        durationTicks: dur,
        velocity: 100,
      };
      s.beginGesture();
      s.patchLive(patchTrackNotes(s.project, track.id, [...track.notes, note]));
      s.selectNotes([id]);
      dragRef.current = { kind: "draw", id, start, pitch };
      engine.preview(track.instrument, pitch, 0.8, 0.2);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { x, y, ticks, pitch } = localToNote(e.clientX, e.clientY);
      const s = useStudioStore.getState();
      const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
      if (track) {
        const hit = hitNote(ticks, pitch, track.notes);
        const pxPerTick = s.pxPerBeat / s.project.ppq;
        if (hit) {
          const right = KEYS_WIDTH + (hit.startTicks + hit.durationTicks) * pxPerTick - s.scrollX;
          canvas.style.cursor = Math.abs(x - right) < 8 ? "ew-resize" : "grab";
        } else if (y < RULER_HEIGHT) canvas.style.cursor = "ew-resize";
        else if (x < KEYS_WIDTH) canvas.style.cursor = "pointer";
        else
          canvas.style.cursor =
            s.tool === "draw" ? "crosshair" : s.tool === "erase" ? "cell" : "default";
      }
      return;
    }
    const s = useStudioStore.getState();
    const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
    const { x, y, ticks, pitch } = localToNote(e.clientX, e.clientY);

    if (drag.kind === "pan") {
      s.setScroll(drag.sx - (e.clientX - drag.x), drag.sy - (e.clientY - drag.y));
      return;
    }
    if (drag.kind === "playhead") {
      const snapped = snapTicks(Math.max(0, ticks), s.snap, s.project.ppq);
      engine.seek(snapped);
      s.setPlayhead(snapped);
      return;
    }
    if (drag.kind === "loop") {
      const snapped = snapTicks(Math.max(0, ticks), s.snap, s.project.ppq);
      if (drag.edge === "start") {
        s.patchLive({
          ...s.project,
          loopStartTicks: Math.min(snapped, s.project.loopEndTicks - s.project.ppq),
        });
      } else {
        s.patchLive({
          ...s.project,
          loopEndTicks: Math.max(snapped, s.project.loopStartTicks + s.project.ppq),
        });
      }
      return;
    }
    if (drag.kind === "erase" && track) {
      const hit = hitNote(ticks, pitch, track.notes);
      if (hit) s.deleteNotes(track.id, [hit.id]);
      return;
    }
    if (drag.kind === "marquee") {
      drag.x1 = x;
      drag.y1 = y;
      draw();
      return;
    }
    if (drag.kind === "draw" && track) {
      const end = snapTicks(Math.max(ticks, drag.start + 30), s.snap, s.project.ppq);
      const dur = Math.max(30, end - drag.start);
      s.patchLive(
        patchTrackNotes(
          s.project,
          track.id,
          track.notes.map((n) => (n.id === drag.id ? { ...n, durationTicks: dur } : n)),
        ),
      );
      s.setDrawDuration(dur);
      return;
    }
    if (drag.kind === "move" && track) {
      const dPitch = pitch - drag.lastPitch;
      const start = snapTicks(ticks, s.snap, s.project.ppq);
      const dTicks = start - drag.lastStart;
      if (dPitch === 0 && dTicks === 0) return;
      const setIds = new Set(drag.ids);
      s.patchLive(
        patchTrackNotes(
          s.project,
          track.id,
          track.notes.map((n) =>
            setIds.has(n.id)
              ? {
                  ...n,
                  pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, n.pitch + dPitch)),
                  startTicks: Math.max(0, n.startTicks + dTicks),
                }
              : n,
          ),
        ),
      );
      drag.lastPitch = pitch;
      drag.lastStart = start;
      return;
    }
    if (drag.kind === "resize" && track) {
      const snapped = snapTicks(ticks, s.snap, s.project.ppq);
      const setIds = new Set(drag.ids);
      s.patchLive(
        patchTrackNotes(
          s.project,
          track.id,
          track.notes.map((n) =>
            setIds.has(n.id) ? { ...n, durationTicks: Math.max(30, snapped - n.startTicks) } : n,
          ),
        ),
      );
      return;
    }
    if (drag.kind === "velocity" && track) {
      const h = sizeRef.current.h;
      const velH = h < 420 ? 0 : VELOCITY_HEIGHT;
      const velTop = h - velH;
      const vel = Math.max(
        1,
        Math.min(127, Math.round(((velTop + velH - 4 - y) / (velH - 10)) * 127)),
      );
      const ids = new Set(drag.ids);
      s.patchLive(
        patchTrackNotes(
          s.project,
          track.id,
          track.notes.map((n) => (ids.has(n.id) ? { ...n, velocity: vel } : n)),
        ),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const s = useStudioStore.getState();
    const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
    if (drag?.kind === "marquee" && track) {
      const x0 = Math.min(drag.x0, drag.x1);
      const x1 = Math.max(drag.x0, drag.x1);
      const y0 = Math.min(drag.y0, drag.y1);
      const y1 = Math.max(drag.y0, drag.y1);
      const pxPerTick = s.pxPerBeat / s.project.ppq;
      const ids = track.notes
        .filter((n) => {
          const nx = KEYS_WIDTH + n.startTicks * pxPerTick - s.scrollX;
          const ny = RULER_HEIGHT + (MAX_PITCH - n.pitch) * s.keyHeight - s.scrollY;
          const nw = n.durationTicks * pxPerTick;
          return nx < x1 && nx + nw > x0 && ny < y1 && ny + s.keyHeight > y0;
        })
        .map((n) => n.id);
      s.selectNotes(e.shiftKey ? [...s.selectedNoteIds, ...ids] : ids);
    }
    if (
      drag?.kind === "move" ||
      drag?.kind === "resize" ||
      drag?.kind === "draw" ||
      drag?.kind === "loop" ||
      drag?.kind === "velocity"
    ) {
      s.endGesture();
    }
    dragRef.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const { ticks, pitch, x, y } = localToNote(e.clientX, e.clientY);
    if (x < KEYS_WIDTH || y < RULER_HEIGHT) return;
    const s = useStudioStore.getState();
    const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
    if (!track) return;
    const hit = hitNote(ticks, pitch, track.notes);
    if (hit) s.deleteNotes(track.id, [hit.id]);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useStudioStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY > 0 ? 0.92 : 1.08;
        s.setZoomX(s.pxPerBeat * factor);
        return;
      }
      if (e.shiftKey) {
        s.setScroll(s.scrollX + e.deltaY, s.scrollY);
        return;
      }
      s.setScroll(s.scrollX + e.deltaX, s.scrollY + e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={wrapRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-bg">
      <canvas
        ref={canvasRef}
        className="block size-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}
