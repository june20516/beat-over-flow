import type { CSSProperties } from "react";
import { Play, Pause, SpeakerHigh } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import primitives from "./primitives.module.css";
import styles from "./TransportBar.module.css";
import { cx } from "./cx";
import { useStore } from "../store/useStore";
import { play, pause, seek, setBaseFlowOffsetMs as runtimeSetBaseFlowOffsetMs } from "../audio/runtime";
import { KeyCap } from "./KeyCap";

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function TransportBar() {
  const playing = useStore((s) => s.playing);
  const playheadMs = useStore((s) => s.playheadMs);
  const project = useStore((s) => s.project);
  const setMasterVolume = useStore((s) => s.setMasterVolume);
  const setPlayPauseKey = useStore((s) => s.setPlayPauseKey);
  const setBaseFlowOffsetMs = useStore((s) => s.setBaseFlowOffsetMs);
  const baseFlowLoading = useStore((s) => s.baseFlowLoading);
  const playPauseKey = project?.transport?.playPauseKey ?? null;
  const durationMs = project?.baseFlow.durationMs ?? 0;
  const playedPct = durationMs > 0 ? (playheadMs / durationMs) * 100 : 0;
  const isYouTube = project?.baseFlow.kind === "youtube";
  const offsetMs = project?.baseFlow.kind === "youtube" ? (project.baseFlow.offsetMs ?? 0) : 0;

  return (
    <div className={cx(styles.transport, primitives.panel)}>
      <button
        className={cx(controls.btn, controls.btnIcon, controls.btnPrimary)}
        disabled={baseFlowLoading}
        onClick={() => (playing ? pause() : void play())}
      >
        {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
      </button>
      <KeyCap code={playPauseKey} onCapture={(code) => setPlayPauseKey(code)} />
      <span className={styles.time}>
        {fmt(playheadMs)} / {fmt(durationMs)}
      </span>
      <input
        className={cx(controls.range, controls.rangeFill, styles.seek)}
        style={{ "--pct": `${playedPct}%` } as CSSProperties}
        type="range"
        min={0}
        max={durationMs}
        value={playheadMs}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <label className={styles.vol}>
        <SpeakerHigh size={18} />
        <input
          className={cx(controls.range, controls.rangeFill, styles.volRange)}
          style={{ "--pct": `${(project?.master.volume ?? 1) * 100}%` } as CSSProperties}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={project?.master.volume ?? 1}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
        />
      </label>
      {isYouTube && (
        <label className={styles.vol} title="마커 타이밍 보정(nudge)">
          <span style={{ fontSize: 12, color: "#9ca3c4" }}>nudge</span>
          <input
            type="range"
            min={-500}
            max={500}
            step={10}
            value={offsetMs}
            onChange={(e) => {
              const ms = Number(e.target.value);
              setBaseFlowOffsetMs(ms); // store(영속)
              runtimeSetBaseFlowOffsetMs(ms); // 현재 소스 즉시 반영
            }}
          />
          <span style={{ fontSize: 11, color: "#9ca3c4", width: 44 }}>{offsetMs}ms</span>
        </label>
      )}
    </div>
  );
}
