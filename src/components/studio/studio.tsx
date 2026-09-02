import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { engine } from "@/lib/midi/engine";
import { useStudioStore } from "@/store/studio-store";
import { HelpDialog } from "./help-dialog";
import { Inspector } from "./inspector";
import { LibraryDialog } from "./library-dialog";
import { MobileTools } from "./mobile-tools";
import { PianoKeyboard } from "./piano-keyboard";
import { PianoRoll } from "./piano-roll";
import { MobileTracks, TrackList } from "./track-list";
import { Transport } from "./transport";
import { useStudioHotkeys } from "./use-hotkeys";

export function Studio() {
  useStudioHotkeys();

  useEffect(() => {
    useStudioStore.getState().hydrate();
    engine.getProject = () => useStudioStore.getState().project;
    engine.onTick = (t) => useStudioStore.getState().setPlayhead(t);
    engine.metronome = useStudioStore.getState().metronome;
    engine.setVolume(useStudioStore.getState().masterVolume);
  }, []);

  return (
    <TooltipProvider delayDuration={280}>
      <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
        <Transport />
        <MobileTracks />
        <div className="flex min-h-0 flex-1">
          <TrackList />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <PianoRoll />
            <Inspector />
          </div>
        </div>
        <MobileTools />
        <PianoKeyboard />
        <LibraryDialog />
        <HelpDialog />
      </div>
    </TooltipProvider>
  );
}
