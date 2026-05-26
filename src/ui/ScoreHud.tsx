import { useStore } from "../store/useStore";
import { accuracy } from "../scoring/scoring";

export function ScoreHud() {
  const mode = useStore((s) => s.mode);
  const score = useStore((s) => s.score);
  if (mode !== "play") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        padding: "10px 14px",
        background: "rgba(16,19,26,0.9)",
        border: "1px solid #2a3140",
        borderRadius: 8,
        fontFamily: "monospace",
        textAlign: "right",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700 }}>{score.score}</div>
      <div>콤보 {score.combo} (최대 {score.maxCombo})</div>
      <div>정확도 {(accuracy(score) * 100).toFixed(1)}%</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>
        P {score.perfect} · G {score.good} · M {score.miss}
      </div>
    </div>
  );
}
