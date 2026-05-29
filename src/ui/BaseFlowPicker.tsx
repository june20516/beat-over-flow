import { useState } from "react";
import { useStore } from "../store/useStore";
import { parseYouTubeId } from "../domain/youtube";
import styles from "./BaseFlowPicker.module.css";

interface Props {
  onClose: () => void;
}

export function BaseFlowPicker({ onClose }: Props) {
  const setBaseFlow = useStore((s) => s.setBaseFlow);
  const [tab, setTab] = useState<"file" | "youtube">("youtube");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function applyYouTube() {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("유효한 유튜브 URL 또는 영상 ID가 아닙니다.");
      return;
    }
    // durationMs는 onReady 후 write-back되므로 0으로 시작.
    setBaseFlow({ kind: "youtube", videoId: id, durationMs: 0 });
    onClose();
  }

  return (
    <div className={styles.picker}>
      <div className={styles.tabs}>
        <button className={tab === "file" ? styles.tabActive : styles.tab} onClick={() => setTab("file")}>파일</button>
        <button className={tab === "youtube" ? styles.tabActive : styles.tab} onClick={() => setTab("youtube")}>유튜브</button>
      </div>
      {tab === "youtube" ? (
        <div className={styles.body}>
          <input
            className={styles.input}
            placeholder="https://youtu.be/... 또는 영상 ID"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") applyYouTube(); }}
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.apply} onClick={applyYouTube}>적용</button>
        </div>
      ) : (
        <div className={styles.body}>
          {/* 파일 베이스 플로우는 기존 업로드/에셋 흐름을 사용한다. */}
          <p className={styles.hint}>파일 베이스 플로우는 프로젝트 생성/에셋 업로드 흐름을 사용하세요.</p>
        </div>
      )}
    </div>
  );
}
