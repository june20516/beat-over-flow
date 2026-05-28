import { useState, type CSSProperties } from "react";
import { Repeat } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import { cx } from "./cx";
import { useStore } from "../store/useStore";
import { useEditorUi } from "../store/editorUi";
import {
  stepTimes,
  activeStepsToMarkerTimes,
  markersAlignedToSteps,
  tilePattern,
  type RepeatTarget,
} from "../domain/sequencer";

export function StepSequencerPanel() {
  const region = useEditorUi((s) => s.region);
  const setRegion = useEditorUi((s) => s.setRegion);
  const stepCount = useEditorUi((s) => s.stepCount);
  const setStepCount = useEditorUi((s) => s.setStepCount);
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
    return <div className="empty-hint panel">트랙을 선택하면 스텝 시퀀서가 표시됩니다.</div>;
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
    <div className="seq-panel panel">
      <div className="seq-panel__head">
        <h2 className="section-title">스텝 시퀀서 — {track.name}</h2>
        <label className="field">
          구간 시작(ms)
          <input
            className={controls.input}
            type="number"
            value={Math.round(region.startMs)}
            onChange={(e) => setRegion({ ...region, startMs: Number(e.target.value) })}
            style={{ width: 90 }}
          />
        </label>
        <label className="field">
          끝(ms)
          <input
            className={controls.input}
            type="number"
            value={Math.round(region.endMs)}
            onChange={(e) => setRegion({ ...region, endMs: Number(e.target.value) })}
            style={{ width: 90 }}
          />
        </label>
        <label className="field">
          칸수
          <input
            className={controls.input}
            type="number"
            min={1}
            max={64}
            value={stepCount}
            onChange={(e) => setStepCount(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
      </div>

      <div className="step-grid">
        {steps.map((t, i) => (
          <button
            key={i}
            className={
              "step-cell" +
              (active[i] ? " step-cell--active" : "") +
              (i % 4 === 0 ? " step-cell--beat" : "")
            }
            style={{ "--cell-color": track.color } as CSSProperties}
            onClick={() => toggleMarkerAt(track.id, t, tolerance)}
          />
        ))}
      </div>

      <div className="seq-controls">
        <span>반복</span>
        <select className={controls.select} value={repeatKind} onChange={(e) => setRepeatKind(e.target.value as typeof repeatKind)}>
          <option value="toEnd">곡 끝까지</option>
          <option value="count">N회</option>
          <option value="until">지정 지점까지</option>
        </select>
        {repeatKind === "count" && (
          <input className={controls.input} type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 70 }} />
        )}
        {repeatKind === "until" && (
          <input className={controls.input} type="number" min={0} value={untilMs} onChange={(e) => setUntilMs(Number(e.target.value))} style={{ width: 100 }} />
        )}
        <button className={cx(controls.btn, controls.btnPrimary)} onClick={fill}>
          <Repeat size={15} weight="bold" />
          반복 채우기
        </button>
        <button className={cx(controls.btn, controls.btnGhost)} onClick={clearAndRefill}>범위 지우고 다시 채우기</button>
      </div>
    </div>
  );
}
