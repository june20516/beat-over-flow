import { useState } from "react";
import { useStore } from "../store/useStore";
import {
  stepTimes,
  activeStepsToMarkerTimes,
  markersAlignedToSteps,
  tilePattern,
  type RepeatTarget,
} from "../domain/sequencer";

interface Region {
  startMs: number;
  endMs: number;
}

interface Props {
  region: Region;
  setRegion: (r: Region) => void;
  stepCount: number;
  setStepCount: (n: number) => void;
}

export function StepSequencerPanel({ region, setRegion, stepCount, setStepCount }: Props) {
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const durationMs = useStore((s) => s.project?.baseFlow.durationMs ?? 0);
  const toggleMarkerAt = useStore((s) => s.toggleMarkerAt);
  const addMarkersBulk = useStore((s) => s.addMarkersBulk);
  const removeMarkersInRange = useStore((s) => s.removeMarkersInRange);

  const [repeatKind, setRepeatKind] = useState<"count" | "until" | "toEnd">("toEnd");
  const [count, setCount] = useState(4);
  const [untilMs, setUntilMs] = useState(90000);

  const track = tracks.find((t) => t.id === selectedTrackId) ?? null;
  if (!track) {
    return <div style={{ padding: 8 }}>트랙을 선택하면 스텝 시퀀서가 표시됩니다.</div>;
  }

  const steps = stepTimes(region.startMs, region.endMs, stepCount);
  const stepSpacing = (region.endMs - region.startMs) / stepCount;
  const tolerance = Math.min(20, stepSpacing / 2);
  const active = markersAlignedToSteps(
    track.markers.map((m) => m.timeMs),
    steps,
    tolerance,
  );

  function fill() {
    const activeIdx = active.flatMap((on, i) => (on ? [i] : []));
    const pattern = activeStepsToMarkerTimes(region.startMs, region.endMs, stepCount, activeIdx);
    if (pattern.length === 0) return;
    const regionLen = region.endMs - region.startMs;
    let target: RepeatTarget;
    if (repeatKind === "count") target = { kind: "count", count };
    else if (repeatKind === "until") target = { kind: "until", untilMs };
    else target = { kind: "toEnd", endMs: durationMs };
    const tiled = tilePattern(pattern, region.startMs, regionLen, target);
    // 첫 구간(원본 패턴)은 이미 존재하므로 그 이후만 추가
    const toAdd = tiled.filter((t) => t >= region.endMs);
    addMarkersBulk(track!.id, toAdd);
  }

  function clearAndRefill() {
    const regionLen = region.endMs - region.startMs;
    let endLimit: number;
    if (repeatKind === "count") endLimit = region.startMs + regionLen * count;
    else if (repeatKind === "until") endLimit = untilMs;
    else endLimit = durationMs;
    removeMarkersInRange(track!.id, region.endMs, endLimit);
    fill();
  }

  return (
    <div style={{ padding: 8, borderTop: "1px solid #222833" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <strong>스텝 시퀀서 — {track.name}</strong>
        <label>
          구간 시작(ms)
          <input
            type="number"
            value={Math.round(region.startMs)}
            onChange={(e) => setRegion({ ...region, startMs: Number(e.target.value) })}
            style={{ width: 80 }}
          />
        </label>
        <label>
          끝(ms)
          <input
            type="number"
            value={Math.round(region.endMs)}
            onChange={(e) => setRegion({ ...region, endMs: Number(e.target.value) })}
            style={{ width: 80 }}
          />
        </label>
        <label>
          칸수
          <input
            type="number"
            min={1}
            max={64}
            value={stepCount}
            onChange={(e) => setStepCount(Math.max(1, Number(e.target.value)))}
            style={{ width: 50 }}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
        {steps.map((t, i) => (
          <button
            key={i}
            onClick={() => toggleMarkerAt(track.id, t, tolerance)}
            style={{
              flex: 1,
              height: 32,
              background: active[i] ? track.color : "#1a1f29",
              border: "1px solid #2a3140",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span>반복:</span>
        <select value={repeatKind} onChange={(e) => setRepeatKind(e.target.value as typeof repeatKind)}>
          <option value="toEnd">곡 끝까지</option>
          <option value="count">N회</option>
          <option value="until">지정 지점까지</option>
        </select>
        {repeatKind === "count" && (
          <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 60 }} />
        )}
        {repeatKind === "until" && (
          <input type="number" min={0} value={untilMs} onChange={(e) => setUntilMs(Number(e.target.value))} style={{ width: 90 }} />
        )}
        <button onClick={fill}>⟳ 반복 채우기</button>
        <button onClick={clearAndRefill}>범위 지우고 다시 채우기</button>
      </div>
    </div>
  );
}
