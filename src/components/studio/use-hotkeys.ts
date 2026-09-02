import { useEffect } from "react";
import type { MidiNote } from "@/lib/midi/types";
import { snapTicks } from "@/lib/midi/theory";
import { useStudioStore } from "@/store/studio-store";
import { stopPlayback, togglePlayback } from "./transport";

let clipboard: MidiNote[] = [];

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function useStudioHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e);
      const meta = e.metaKey || e.ctrlKey;
      const s = useStudioStore.getState();

      if (e.code === "Space" && !typing) {
        e.preventDefault();
        togglePlayback();
        return;
      }
      if (e.code === "Home" && !typing) {
        e.preventDefault();
        stopPlayback();
        return;
      }
      if (e.key === "?" && !typing) {
        s.toggleHelp();
        return;
      }
      if (typing) {
        if (meta && e.key.toLowerCase() === "s") {
          e.preventDefault();
          s.saveCurrent();
        }
        return;
      }

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        s.saveCurrent();
        return;
      }
      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        s.selectAllInTrack();
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicateSelected();
        return;
      }
      if (meta && e.key.toLowerCase() === "c") {
        const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
        if (!track) return;
        clipboard = track.notes.filter((n) => s.selectedNoteIds.includes(n.id)).map((n) => ({ ...n }));
        return;
      }
      if (meta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        s.pasteNotes(clipboard, s.playheadTicks);
        return;
      }
      if (meta && e.key.toLowerCase() === "q") {
        e.preventDefault();
        s.quantizeSelected();
        return;
      }

      if (e.key === "1") s.setTool("draw");
      if (e.key === "2") s.setTool("select");
      if (e.key === "3") s.setTool("erase");
      if (e.key.toLowerCase() === "m" && !meta) s.toggleMetronome();
      if (e.key.toLowerCase() === "r" && !meta) s.setRecording(!s.isRecording);
      if (e.key.toLowerCase() === "z" && !meta) s.setOctave(s.keyboardOctave - 1);
      if (e.key.toLowerCase() === "x" && !meta) s.setOctave(s.keyboardOctave + 1);

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const track = s.project.tracks.find((t) => t.id === s.selectedTrackId);
        if (track && s.selectedNoteIds.length) s.deleteNotes(track.id, s.selectedNoteIds);
        return;
      }

      const grid = s.snap > 0 ? snapTicks(s.project.ppq, s.snap, s.project.ppq) || s.project.ppq : s.project.ppq;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        s.moveSelected(-grid, 0);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        s.moveSelected(grid, 0);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        s.moveSelected(0, 1);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        s.moveSelected(0, -1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
