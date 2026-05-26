import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getEngine, loadBaseFlow, seek } from "../audio/runtime";
import { getAsset } from "../persistence/assets";
import { computePeaks } from "../render/waveform";
import { TimelineCanvas } from "../render/TimelineCanvas";
import { TransportBar } from "./TransportBar";

interface Props {
  onExit: () => void;
}

export function Editor({ onExit }: Props) {
  const project = useStore((s) => s.project);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: 8 }}>
        <strong>{project.name}</strong>
        <button onClick={onExit}>← 목록</button>
      </div>
      <TransportBar />
      <TimelineCanvas
        peaks={peaks}
        durationMs={project.baseFlow.durationMs}
        onSeek={seek}
      />
    </div>
  );
}
