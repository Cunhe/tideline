import { Plus, Trash2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { INSTRUMENTS } from "@/lib/midi/constants";
import type { InstrumentId } from "@/lib/midi/types";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";

export function TrackList() {
  const tracks = useStudioStore((s) => s.project.tracks);
  const selectedTrackId = useStudioStore((s) => s.selectedTrackId);

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-panel sm:flex">
      <div className="flex h-9 items-center justify-between px-3">
        <span className="text-xs font-medium tracking-wide text-muted">轨道</span>
        <AddTrackButton />
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {tracks.map((track) => {
          const active = track.id === selectedTrackId;
          return (
            <div
              key={track.id}
              role="button"
              tabIndex={0}
              onClick={() => useStudioStore.getState().selectTrack(track.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  useStudioStore.getState().selectTrack(track.id);
                }
              }}
              className={cn(
                "mb-1.5 w-full rounded-lg p-2 text-left",
                active ? "bg-elevated" : "bg-surface hover:bg-elevated/60",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: track.color }}
                />
                <Input
                  value={track.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    useStudioStore.getState().updateTrack(track.id, { name: e.target.value })
                  }
                  className="h-7 bg-transparent px-1 text-sm shadow-none"
                />
              </div>
              <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={track.instrument}
                  onValueChange={(v) =>
                    useStudioStore.getState().updateTrack(track.id, {
                      instrument: v as InstrumentId,
                    })
                  }
                >
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTRUMENTS.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div
                className="mt-1.5 flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Toggle
                  size="sm"
                  pressed={track.mute}
                  onPressedChange={(v) =>
                    useStudioStore.getState().updateTrack(track.id, { mute: v })
                  }
                  className="h-7 px-2 text-xs"
                  aria-label="静音"
                >
                  M
                </Toggle>
                <Toggle
                  size="sm"
                  pressed={track.solo}
                  onPressedChange={(v) =>
                    useStudioStore.getState().updateTrack(track.id, { solo: v })
                  }
                  className="h-7 px-2 text-xs"
                  aria-label="独奏"
                >
                  S
                </Toggle>
                <Volume2 className="size-3.5 text-muted" />
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[track.volume]}
                  onValueChange={([v]) =>
                    useStudioStore.getState().updateTrack(track.id, { volume: v ?? 0.9 })
                  }
                  className="flex-1"
                  aria-label="音量"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7"
                  disabled={tracks.length <= 1}
                  onClick={() => useStudioStore.getState().removeTrack(track.id)}
                  aria-label="删除轨道"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function MobileTracks() {
  const tracks = useStudioStore((s) => s.project.tracks);
  const selectedTrackId = useStudioStore((s) => s.selectedTrackId);
  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-panel px-2 py-1.5 sm:hidden">
      {tracks.map((track) => (
        <button
          key={track.id}
          type="button"
          onClick={() => useStudioStore.getState().selectTrack(track.id)}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs",
            track.id === selectedTrackId ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
          )}
        >
          <span
            className="size-2 rounded-full"
            style={{ background: track.id === selectedTrackId ? "currentColor" : track.color }}
          />
          {track.name}
        </button>
      ))}
      <AddTrackButton />
    </div>
  );
}

function AddTrackButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="添加轨道">
          <Plus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {INSTRUMENTS.map((i) => (
          <DropdownMenuItem
            key={i.id}
            onSelect={() => useStudioStore.getState().addTrack(i.id)}
          >
            {i.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
