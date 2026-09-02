import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { displayPitch } from "@/lib/midi/theory";
import { useStudioStore } from "@/store/studio-store";

export function Inspector() {
  const project = useStudioStore((s) => s.project);
  const selectedTrackId = useStudioStore((s) => s.selectedTrackId);
  const ids = useStudioStore((s) => s.selectedNoteIds);
  const ghostTracks = useStudioStore((s) => s.ghostTracks);
  const track = project.tracks.find((t) => t.id === selectedTrackId);
  const notes = track ? track.notes.filter((n) => ids.includes(n.id)) : [];
  if (!track) return null;

  const first = notes[0];
  const avgVel =
    notes.length === 0
      ? 100
      : Math.round(notes.reduce((a, n) => a + n.velocity, 0) / notes.length);

  return (
    <div className="hidden items-center gap-3 border-t border-border bg-panel px-3 py-2 lg:flex">
      <span className="text-xs text-muted">
        {notes.length === 0
          ? `${track.name} · ${track.notes.length} 个音符`
          : notes.length === 1 && first
            ? `${displayPitch(first.pitch, track.instrument === "drums")} · 力度 ${first.velocity}`
            : `已选 ${notes.length} 个音符`}
      </span>
      <div className="flex w-48 items-center gap-2">
        <span className="text-xs text-subtle">力度</span>
        <Slider
          min={1}
          max={127}
          value={[avgVel]}
          onValueChange={([v]) =>
            useStudioStore.getState().setSelectedVelocity(v ?? avgVel)
          }
          disabled={notes.length === 0}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => useStudioStore.getState().quantizeSelected()}
      >
        量化
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => useStudioStore.getState().duplicateSelected()}
        disabled={notes.length === 0}
      >
        复制
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted"
        onClick={() => useStudioStore.getState().toggleGhost()}
      >
        {ghostTracks ? "隐藏其他轨道" : "显示其他轨道"}
      </Button>
    </div>
  );
}
