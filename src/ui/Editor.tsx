import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getEngine, loadBaseFlow, seek } from "../audio/runtime";
import { getAsset } from "../persistence/assets";
import { computePeaks } from "../render/waveform";
import { resolveTrackBehavior } from "../domain/mode";
import { TimelineCanvas } from "../render/TimelineCanvas";
import { TransportBar } from "./TransportBar";
import { TrackList } from "./TrackList";
import { ModeSwitcher } from "./ModeSwitcher";
import { StepSequencerPanel } from "./StepSequencerPanel";
import { ScoreHud } from "./ScoreHud";
import { startKeyboard } from "../input/KeyboardController";
import { startPlaySession, endPlaySession } from "../scoring/playSession";

interface Props {
  onExit: () => void;
}

export function Editor({ onExit }: Props) {
  const project = useStore((s) => s.project);
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const mode = useStore((s) => s.mode);
  const addMarker = useStore((s) => s.addMarker);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [region, setRegion] = useState({ startMs: 0, endMs: 4000 });
  const [stepCount, setStepCount] = useState(8);

  useEffect(() => {
    const stop = startKeyboard();
    return stop;
  }, []);

  useEffect(() => {
    if (mode === "play") startPlaySession();
    else endPlaySession();
  }, [mode]);

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

  function handleLaneClick(trackId: string, timeMs: number) {
    // 레코드 모드 + write 트랙에서만 클릭으로 마커 추가
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    if (resolveTrackBehavior(mode, track.status) === "record") {
      addMarker(trackId, timeMs);
    }
  }

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
      <div className="editor-main">
        <TrackList />
        <div className="editor-main__timeline">
          <TimelineCanvas
            peaks={peaks}
            durationMs={project.baseFlow.durationMs}
            tracks={tracks}
            region={region}
            stepCount={stepCount}
            onSeek={seek}
            onLaneClick={handleLaneClick}
          />
        </div>
      </div>
      <StepSequencerPanel
        region={region}
        setRegion={setRegion}
        stepCount={stepCount}
        setStepCount={setStepCount}
      />
    </div>
  );
}
