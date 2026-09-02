import {
  Circle,
  Download,
  Eraser,
  FolderOpen,
  HelpCircle,
  Keyboard,
  Layers2,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  Repeat,
  Save,
  Square,
  Timer,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SNAP_OPTIONS } from "@/lib/midi/constants";
import { engine } from "@/lib/midi/engine";
import { projectFromMidi, projectToMidi } from "@/lib/midi/midi-io";
import { formatPosition } from "@/lib/midi/theory";
import type { SnapDiv, Tool } from "@/lib/midi/types";
import { downloadMidi } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";
import { useRef } from "react";

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export async function togglePlayback() {
  const s = useStudioStore.getState();
  engine.getProject = () => useStudioStore.getState().project;
  engine.onTick = (t) => useStudioStore.getState().setPlayhead(t);
  if (s.isPlaying) {
    engine.pause(s.project);
    s.setPlaying(false);
    s.setPlayhead(engine.startTicks);
  } else {
    await engine.play(s.playheadTicks);
    s.setPlaying(true);
  }
}

export function stopPlayback() {
  const s = useStudioStore.getState();
  engine.stop();
  s.setPlaying(false);
  s.setRecording(false);
  s.setPlayhead(0);
}

export function Transport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const name = useStudioStore((s) => s.project.name);
  const bpm = useStudioStore((s) => s.project.bpm);
  const project = useStudioStore((s) => s.project);
  const playheadTicks = useStudioStore((s) => s.playheadTicks);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const isRecording = useStudioStore((s) => s.isRecording);
  const metronome = useStudioStore((s) => s.metronome);
  const loopEnabled = useStudioStore((s) => s.project.loopEnabled);
  const tool = useStudioStore((s) => s.tool);
  const snap = useStudioStore((s) => s.snap);
  const ghostTracks = useStudioStore((s) => s.ghostTracks);
  const showKeyboard = useStudioStore((s) => s.showKeyboard);
  const dirty = useStudioStore((s) => s.dirty);

  const importMidi = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const p = await projectFromMidi(buf, file.name);
      useStudioStore.getState().loadProject(p);
      toast.success(`已导入 ${p.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "无法解析 MIDI 文件");
    }
  };

  const exportMidi = async () => {
    const s = useStudioStore.getState();
    const bytes = await projectToMidi(s.project);
    downloadMidi(`${s.project.name || "untitled"}.mid`, bytes);
    toast.success("已导出 MIDI");
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2 md:h-14 md:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-elevated text-accent shadow-[var(--shadow-border)]">
          <span className="font-display text-sm font-semibold tracking-tight">潮</span>
        </div>
        <div className="hidden min-w-0 sm:block">
          <div className="font-display text-sm font-semibold tracking-tight">潮谱</div>
          <div className="text-xs text-muted">Tideline</div>
        </div>
        <Input
          aria-label="工程名称"
          value={name}
          onChange={(e) => useStudioStore.getState().setProjectName(e.target.value)}
          className="h-8 w-28 bg-transparent px-2 text-sm shadow-none md:w-40"
        />
        {dirty ? <span className="hidden text-xs text-subtle md:inline">未保存</span> : null}
      </div>

      <div className="mx-1 hidden h-6 w-px bg-border md:block" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="hidden md:inline-flex">
            文件
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => useStudioStore.getState().newProject()}>
            <Plus className="size-4" />
            新建工程
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => useStudioStore.getState().toggleLibrary()}>
            <FolderOpen className="size-4" />
            打开…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              useStudioStore.getState().saveCurrent();
              toast.success("已保存到本机");
            }}
          >
            <Save className="size-4" />
            保存
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            导入 MIDI
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={exportMidi}>
            <Download className="size-4" />
            导出 MIDI
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => useStudioStore.getState().loadDemo()}>
            加载示例《港湾灯火》
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept=".mid,.midi,audio/midi"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importMidi(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-0.5">
        <Tip label="停止">
          <Button variant="ghost" size="icon-sm" onClick={stopPlayback} aria-label="停止">
            <Square className="size-3.5 fill-current" />
          </Button>
        </Tip>
        <Tip label={isPlaying ? "暂停 空格" : "播放 空格"}>
          <Button
            size="icon"
            className="size-10"
            onClick={togglePlayback}
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="ml-0.5 size-4 fill-current" />
            )}
          </Button>
        </Tip>
        <Tip label="录音">
          <Toggle
            size="icon-sm"
            pressed={isRecording}
            onPressedChange={(v) => useStudioStore.getState().setRecording(v)}
            aria-label="录音"
            className="data-[state=on]:text-danger"
          >
            <Circle className={isRecording ? "size-3 fill-current" : "size-3"} />
          </Toggle>
        </Tip>
        <Tip label="循环">
          <Toggle
            size="icon-sm"
            pressed={loopEnabled}
            onPressedChange={(v) => useStudioStore.getState().setLoop(v)}
            aria-label="循环"
          >
            <Repeat />
          </Toggle>
        </Tip>
        <Tip label="节拍器">
          <Toggle
            size="icon-sm"
            pressed={metronome}
            onPressedChange={() => useStudioStore.getState().toggleMetronome()}
            aria-label="节拍器"
          >
            <Timer />
          </Toggle>
        </Tip>
      </div>

      <div className="flex items-center gap-1 rounded-md bg-elevated px-2 py-1 shadow-[var(--shadow-border)]">
        <label className="text-xs text-muted" htmlFor="bpm">
          BPM
        </label>
        <input
          id="bpm"
          type="number"
          min={20}
          max={300}
          value={Math.round(bpm)}
          onChange={(e) => useStudioStore.getState().setBpm(Number(e.target.value) || 88)}
          className="h-7 w-12 bg-transparent text-center font-mono text-sm tabular-nums outline-none"
        />
      </div>

      <div className="hidden font-mono text-xs tabular-nums text-muted md:block">
        {formatPosition(playheadTicks, project)}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="hidden items-center rounded-md bg-elevated p-0.5 md:flex">
          {(
            [
              ["draw", "绘制", Pencil],
              ["select", "选择", MousePointer2],
              ["erase", "橡皮", Eraser],
            ] as const
          ).map(([id, label, Icon]) => (
            <Tip key={id} label={label}>
              <Toggle
                size="icon-sm"
                pressed={tool === id}
                onPressedChange={() => useStudioStore.getState().setTool(id as Tool)}
                aria-label={label}
              >
                <Icon />
              </Toggle>
            </Tip>
          ))}
        </div>

        <Select
          value={String(snap)}
          onValueChange={(v) => useStudioStore.getState().setSnap(Number(v) as SnapDiv)}
        >
          <SelectTrigger className="hidden w-20 md:flex" aria-label="吸附">
            <SelectValue placeholder="吸附" />
          </SelectTrigger>
          <SelectContent>
            {SNAP_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tip label="撤销">
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex"
            onClick={() => useStudioStore.getState().undo()}
            aria-label="撤销"
          >
            <Undo2 />
          </Button>
        </Tip>
        <Tip label="重做">
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex"
            onClick={() => useStudioStore.getState().redo()}
            aria-label="重做"
          >
            <Redo2 />
          </Button>
        </Tip>
        <Tip label="叠层显示">
          <Toggle
            size="icon-sm"
            className="hidden md:inline-flex"
            pressed={ghostTracks}
            onPressedChange={() => useStudioStore.getState().toggleGhost()}
            aria-label="叠层"
          >
            <Layers2 />
          </Toggle>
        </Tip>
        <Tip label="键盘">
          <Toggle
            size="icon-sm"
            pressed={showKeyboard}
            onPressedChange={() => useStudioStore.getState().toggleKeyboard()}
            aria-label="键盘"
          >
            <Keyboard />
          </Toggle>
        </Tip>
        <Tip label="快捷键">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => useStudioStore.getState().toggleHelp()}
            aria-label="帮助"
          >
            <HelpCircle />
          </Button>
        </Tip>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => fileRef.current?.click()}
          aria-label="导入"
        >
          <Upload />
        </Button>
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={exportMidi} aria-label="导出">
          <Download />
        </Button>
      </div>
    </header>
  );
}
