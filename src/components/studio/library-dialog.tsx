import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudioStore } from "@/store/studio-store";

export function LibraryDialog() {
  const open = useStudioStore((s) => s.showLibrary);
  const [tick, setTick] = useState(0);
  const items = useMemo(() => {
    void tick;
    return useStudioStore.getState().listLibrary();
  }, [tick, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v !== open) useStudioStore.getState().toggleLibrary();
        if (v) setTick((n) => n + 1);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>工程库</DialogTitle>
          <DialogDescription>保存在这台设备上的 MIDI 工程</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">还没有保存过工程</p>
          ) : (
            items.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-elevated"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    useStudioStore.getState().loadFromLibrary(m.id);
                    useStudioStore.getState().toggleLibrary();
                    toast.success(`已打开 ${m.name}`);
                  }}
                >
                  <div className="truncate text-sm">{m.name}</div>
                  <div className="text-xs text-muted">
                    {new Date(m.updatedAt).toLocaleString()}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    useStudioStore.getState().deleteFromLibrary(m.id);
                    setTick((n) => n + 1);
                  }}
                >
                  删除
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
