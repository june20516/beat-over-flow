import { forwardRef } from "react";
import styles from "./YouTubePlayer.module.css";
import type { BaseFlowView } from "../domain/baseFlowView";

interface Props {
  view: BaseFlowView;
}

/**
 * 유튜브 플레이어 호스트. ref로 컨테이너 div를 노출해 Editor가
 * loadBaseFlow(ref, container)에 전달한다. layout에 따라 미니/앰비언트 배치.
 * 앰비언트는 intensity로 영상 노출 강도(opacity/blur)를 조절(균형 기본).
 */
export const YouTubePlayer = forwardRef<HTMLDivElement, Props>(function YouTubePlayer({ view }, ref) {
  if (view.layout === "ambient") {
    // intensity 0 → 마커 우선(거의 안 보임), 1 → 영상 우선
    const opacity = 0.12 + view.ambientIntensity * 0.7; // 0.12~0.82
    const blurPx = 6 - view.ambientIntensity * 5; // 6px~1px
    return (
      <div className={styles.ambient} aria-hidden>
        <div className={styles.host} style={{ opacity, filter: `blur(${blurPx}px)` }} ref={ref} />
        <div style={{ position: "absolute", inset: 0, background: `rgba(8,6,20,${0.7 - view.ambientIntensity * 0.4})` }} />
      </div>
    );
  }
  return (
    <div className={styles.mini}>
      <div className={styles.host} ref={ref} />
    </div>
  );
});
