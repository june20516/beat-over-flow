import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getEngine, loadBaseFlow } from "../audio/runtime";
import { getAsset } from "../persistence/assets";
import { computePeaks } from "../render/waveform";
import { Timeline } from "./Timeline";
import { TransportBar } from "./TransportBar";
import { EditorToolbar } from "./EditorToolbar";
import { ModeSwitcher } from "./ModeSwitcher";
import { ScoreHud } from "./ScoreHud";
import { startKeyboard } from "../input/KeyboardController";
import { startPlaySession, endPlaySession } from "../scoring/playSession";
import { useEditorUi } from "../store/editorUi";

interface Props {
  onExit: () => void;
}

export function Editor({ onExit }: Props) {
  const project = useStore((s) => s.project);
  const mode = useStore((s) => s.mode);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const resetForTrack = useEditorUi((s) => s.resetForTrack);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  useEffect(() => {
    const stop = startKeyboard();
    return stop;
  }, []);

  useEffect(() => {
    if (mode === "play") startPlaySession();
    else endPlaySession();
  }, [mode]);

  useEffect(() => {
    resetForTrack();
  }, [selectedTrackId, resetForTrack]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    (async () => {
      await loadBaseFlow(project.baseFlow.assetId);
      const asset = await getAsset(project.baseFlow.assetId);
      if (!asset || cancelled) return;
      const buffer = await getEngine().decode(asset.blob);
      if (cancelled) return;
      setPeaks(computePeaks(buffer.getChannelData(0), 1000));
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  if (!project) return null;

  return (
    <div className="app-shell">
      <ScoreHud />
      <header className="top-bar">
        <span className="top-bar__name">{project.name}</span>
        <span className="top-bar__spacer" />
        <ModeSwitcher />
        <span className="top-bar__spacer" />
        <button className="btn--ghost" onClick={onExit}>
          ← 목록
        </button>
      </header>
      <TransportBar />
      <EditorToolbar />
      <div className="editor-main">
        <div className="editor-main__timeline">
          <Timeline peaks={peaks} durationMs={project.baseFlow.durationMs} />
        </div>
      </div>
    </div>
  );
}
