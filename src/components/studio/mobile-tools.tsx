import { Eraser, MousePointer2, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { SNAP_OPTIONS } from "@/lib/midi/constants";
import type { SnapDiv, Tool } from "@/lib/midi/types";
import { useStudioStore } from "@/store/studio-store";

export function MobileTools() {
  const tool = useStudioStore((s) => s.tool);
  const snap = useStudioStore((s) => s.snap);

  return (
    <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-surface px-2 py-1.5 md:hidden">
      {(
        [
          ["draw", "绘制", Pencil],
          ["select", "选择", MousePointer2],
          ["erase", "橡皮", Eraser],
        ] as const
      ).map(([id, label, Icon]) => (
        <Toggle
          key={id}
          pressed={tool === id}
          onPressedChange={() => useStudioStore.getState().setTool(id as Tool)}
          className="h-11 flex-1"
          aria-label={label}
        >
          <Icon />
          <span>{label}</span>
        </Toggle>
      ))}
      <Select
        value={String(snap)}
        onValueChange={(v) => useStudioStore.getState().setSnap(Number(v) as SnapDiv)}
      >
        <SelectTrigger className="h-11 w-20" aria-label="吸附">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SNAP_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
