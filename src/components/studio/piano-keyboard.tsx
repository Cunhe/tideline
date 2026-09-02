import { useEffect, useState } from "react";
import { COMPUTER_KEYS } from "@/lib/midi/constants";
import { engine } from "@/lib/midi/engine";
import { isBlackKey, pitchName, snapTicks } from "@/lib/midi/theory";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];

export function PianoKeyboard() {
  const show = useStudioStore((s) => s.showKeyboard);
  const octave = useStudioStore((s) => s.keyboardOctave);
  const selectedTrackId = useStudioStore((s) => s.selectedTrackId);
  const instrument = useStudioStore(
    (s) => s.project.tracks.find((t) => t.id === s.selectedTrackId)?.instrument ?? "piano",
  );
  const [held, setHeld] = useState<Set<number>>(new Set());

  useEffect(() => {
    const down = new Map<string, { pitch: number; start: number }>();

    const isTyping = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    };

    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e) || e.repeat) return;
      const off = COMPUTER_KEYS[e.key.toLowerCase()];
      if (off == null) return;
      e.preventDefault();
      const s = useStudioStore.getState();
      const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
      if (!track) return;
      const pitch = (s.keyboardOctave + 1) * 12 + off;
      const start = s.isPlaying ? engine.currentTicks(s.project) : s.playheadTicks;
      down.set(e.key, { pitch, start });
      engine.noteOn(`k:${e.key}`, track.instrument, pitch, 0.88);
      setHeld((prev) => new Set(prev).add(pitch));
    };

    const onUp = (e: KeyboardEvent) => {
      const rec = down.get(e.key);
      if (!rec) return;
      down.delete(e.key);
      engine.noteOff(`k:${e.key}`);
      setHeld((prev) => {
        const n = new Set(prev);
        n.delete(rec.pitch);
        return n;
      });
      const s = useStudioStore.getState();
      if (!s.isRecording) return;
      const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
      if (!track) return;
      const end = s.isPlaying ? engine.currentTicks(s.project) : rec.start + s.drawDuration;
      const start = snapTicks(rec.start, s.snap, s.project.ppq);
      const dur = Math.max(30, end - rec.start);
      s.addNote(track.id, {
        pitch: rec.pitch,
        startTicks: start,
        durationTicks: dur,
        velocity: 104,
      });
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [selectedTrackId, octave]);

  if (!show) return null;

  const start = (octave + 1) * 12;
  const whites: number[] = [];
  for (let o = 0; o < 2; o++) {
    for (const w of WHITE_OFFSETS) whites.push(start + o * 12 + w);
  }
  whites.push(start + 24);

  const playPitch = (pitch: number) => {
    engine.preview(instrument, pitch, 0.88, 0.4);
    const s = useStudioStore.getState();
    if (!s.isRecording) return;
    const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
    if (!track) return;
    const t0 = snapTicks(s.playheadTicks, s.snap, s.project.ppq);
    s.addNote(track.id, {
      pitch,
      startTicks: t0,
      durationTicks: s.drawDuration,
      velocity: 104,
    });
    if (!s.isPlaying) s.setPlayhead(t0 + s.drawDuration);
  };

  return (
    <div className="shrink-0 border-t border-border bg-surface">
      <div className="flex items-center justify-between px-3 pt-1.5">
        <span className="text-xs text-muted">
          电脑键盘 A–L 演奏 · Z/X 换八度 · 当前 C{octave}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="h-7 rounded-md px-2 text-xs text-fg hover:bg-elevated"
            onClick={() => useStudioStore.getState().setOctave(octave - 1)}
          >
            − 八度
          </button>
          <button
            type="button"
            className="h-7 rounded-md px-2 text-xs text-fg hover:bg-elevated"
            onClick={() => useStudioStore.getState().setOctave(octave + 1)}
          >
            + 八度
          </button>
        </div>
      </div>
      <div className="relative mx-2 mb-2 h-16 overflow-hidden rounded-md md:h-20">
        <div className="flex h-full">
          {whites.map((p) => (
            <button
              key={p}
              type="button"
              onPointerDown={() => playPitch(p)}
              className={cn(
                "relative min-w-0 flex-1 border-r border-black/15 text-[10px] text-bg/70",
                held.has(p) ? "bg-accent" : "bg-key-white",
              )}
              aria-label={pitchName(p)}
            >
              {p % 12 === 0 ? (
                <span className="absolute bottom-1 left-1 font-medium">{pitchName(p)}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 flex">
          {whites.map((p, i) => {
            const black = p + 1;
            const canBlack = isBlackKey(black) && black < start + 25;
            const width = 100 / whites.length;
            if (!canBlack) return <div key={p} style={{ width: `${width}%` }} />;
            return (
              <div key={p} className="relative" style={{ width: `${width}%` }}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    playPitch(black);
                  }}
                  className={cn(
                    "pointer-events-auto absolute top-0 left-[62%] z-10 h-[58%] w-[70%] rounded-b-sm",
                    held.has(black) ? "bg-accent" : "bg-key-black",
                  )}
                  aria-label={pitchName(black)}
                  style={{ marginLeft: i === whites.length - 1 ? 0 : undefined }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
