import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStudioStore } from "@/store/studio-store";

const ROWS: [string, string][] = [
  ["空格", "播放 / 暂停"],
  ["Home", "回到开头并停止"],
  ["1 / 2 / 3", "绘制 / 选择 / 橡皮"],
  ["Delete", "删除选中音符"],
  ["Ctrl + Z / Y", "撤销 / 重做"],
  ["Ctrl + A / D", "全选 / 复制一份"],
  ["Ctrl + C / V", "复制 / 粘贴"],
  ["Ctrl + Q", "量化到当前网格"],
  ["Ctrl + S", "保存"],
  ["方向键", "移动选中音符"],
  ["L / M / R", "循环 / 节拍器 / 录音"],
  ["Z / X", "键盘八度"],
  ["A W S D …", "电脑键盘演奏"],
  ["滚轮", "平移；Ctrl 缩放"],
  ["Alt 拖拽", "抓手平移钢琴卷帘"],
];

export function HelpDialog() {
  const open = useStudioStore((s) => s.showHelp);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v !== open) useStudioStore.getState().toggleHelp();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
          <DialogDescription>潮谱是一台在浏览器里的 MIDI 钢琴卷帘。</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1.5">
          {ROWS.map(([k, v]) => (
            <li key={k} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="font-mono text-xs text-accent">{k}</span>
              <span className="text-muted">{v}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
