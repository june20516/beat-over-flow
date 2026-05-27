import { useStore } from "../store/useStore";
import { accuracy } from "../scoring/scoring";

export function ScoreHud() {
  const mode = useStore((s) => s.mode);
  const score = useStore((s) => s.score);
  if (mode !== "play") return null;

  return (
    <div className="score-hud">
      <div className="score-hud__label">SCORE</div>
      <div className="score-hud__value">{score.score}</div>
      <div className="score-hud__combo">
        콤보 <b>{score.combo}</b> · 최대 {score.maxCombo}
      </div>
      <div className="score-hud__acc">정확도 {(accuracy(score) * 100).toFixed(1)}%</div>
      <div className="score-hud__judge">
        <span className="p">P {score.perfect}</span>
        <span className="g">G {score.good}</span>
        <span className="m">M {score.miss}</span>
      </div>
    </div>
  );
}
