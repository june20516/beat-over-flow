import { useStore } from "../store/useStore";
import { accuracy } from "../scoring/scoring";
import styles from "./ScoreHud.module.css";

export function ScoreHud() {
  const mode = useStore((s) => s.mode);
  const score = useStore((s) => s.score);
  if (mode !== "play") return null;

  return (
    <div className={styles.scoreHud}>
      <div className={styles.label}>SCORE</div>
      <div className={styles.value}>{score.score}</div>
      <div className={styles.combo}>
        콤보 <b>{score.combo}</b> · 최대 {score.maxCombo}
      </div>
      <div className={styles.acc}>정확도 {(accuracy(score) * 100).toFixed(1)}%</div>
      <div className={styles.judge}>
        <span className={styles.p}>P {score.perfect}</span>
        <span className={styles.g}>G {score.good}</span>
        <span className={styles.m}>M {score.miss}</span>
      </div>
    </div>
  );
}
