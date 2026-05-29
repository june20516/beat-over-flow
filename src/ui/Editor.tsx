import { useEffect, useRef, useState } from "react";
import controls from "./controls.module.css";
import styles from "./Editor.module.css";
import { cx } from "./cx";
import { useStore } from "../store/useStore";
import { getEngine, loadBaseFlow } from "../audio/runtime";
import { getAsset } from "../persistence/assets";
import { computePeaks } from "../render/waveform";
import { Timeline } from "./Timeline";
import { TransportBar } from "./TransportBar";
import { EditorToolbar } from "./EditorToolbar";
import { ModeSwitcher } from "./ModeSwitcher";
import { ScoreHud } from "./ScoreHud";
import { startKeyboard } from "../input/KeyboardController";
import { startPlaySession, endPlaySession } from "../scoring/playSession";
import { useEditorUi } from "../store/editorUi";
import { YouTubePlayer } from "./YouTubePlayer";
import { resolveBaseFlowView } from "../domain/baseFlowView";

interface Props {
  onExit: () => void;
}

export function Editor({ onExit }: Props) {
  const project = useStore((s) => s.project);
  const mode = useStore((s) => s.mode);
  const selectedTrackId = useStore((s) => s.selectedTrackId);
  const setSelectedTrack = useStore((s) => s.setSelectedTrack);
  const resetForTrack = useEditorUi((s) => s.resetForTrack);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const renameProject = useStore((s) => s.renameProject);
  const setBaseFlowLoading = useStore((s) => s.setBaseFlowLoading);
  const setBaseFlowView = useStore((s) => s.setBaseFlowView);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelNameRef = useRef(false);
  const playerHostRef = useRef<HTMLDivElement>(null);

  const view = resolveBaseFlowView(project?.baseFlowView);
  const isYouTube = project?.baseFlow.kind === "youtube";
  // 소스 "정체성"(어떤 영상/에셋인지)만 추출한다. 로드 effect는 이것에만 의존해야 한다 —
  // baseFlow 객체 전체에 의존하면 onReady 후 durationMs write-back이 baseFlow를 새 객체로
  // 바꿔 effect가 재실행되고, 플레이어가 무한 재생성되는 루프에 빠진다.
  const baseFlowKind = project?.baseFlow.kind;
  const baseFlowSourceId =
    project?.baseFlow.kind === "youtube" ? project.baseFlow.videoId : project?.baseFlow.assetId;

  // 트랙 에디터/마커 레인/파형 외의 빈 영역을 클릭하면 포커스 해제
  function handleMainClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-track-row], [data-base-flow-lane], [data-timeline-head]")) return;
    if (selectedTrackId) setSelectedTrack(null);
  }

  useEffect(() => {
    const stop = startKeyboard();
    return stop;
  }, []);

  useEffect(() => {
    if (mode === "play") startPlaySession();
    else endPlaySession();
  }, [mode]);

  useEffect(() => {
    resetForTrack();
  }, [selectedTrackId, resetForTrack]);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const ref = project.baseFlow;
    setBaseFlowLoading(true);
    (async () => {
      try {
        if (ref.kind === "audioFile") {
          await loadBaseFlow(ref);
          const asset = await getAsset(ref.assetId);
          if (!asset || cancelled) return;
          const buffer = await getEngine().decode(asset.blob);
          if (cancelled) return;
          setPeaks(computePeaks(buffer.getChannelData(0), 1000));
        } else {
          setPeaks(null);
          await loadBaseFlow(ref, playerHostRef.current ?? undefined);
        }
      } finally {
        if (!cancelled) setBaseFlowLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // 소스 정체성 + 레이아웃에만 의존. durationMs write-back/offsetMs/updatedAt 변경으로는
    // 재로드하지 않는다(무한 재생성 루프 방지). view.layout 변경 시엔 호스트 DOM이 바뀌어 재로드.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, baseFlowKind, baseFlowSourceId, view.layout, setBaseFlowLoading]);

  if (!project) return null;

  return (
    <div className={styles.appShell}>
      <ScoreHud />
      <header className={styles.topBar}>
        {editingName ? (
          <input
            className={styles.topBarNameInput}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (cancelNameRef.current) {
                cancelNameRef.current = false;
                return;
              }
              const name = draft.trim();
              if (name) renameProject(name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                cancelNameRef.current = true;
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        ) : (
          <button
            className={styles.topBarName}
            title="이름 수정"
            onClick={() => {
              setDraft(project.name);
              setEditingName(true);
            }}
          >
            {project.name}
          </button>
        )}
        <span className={styles.topBarSpacer} />
        <ModeSwitcher />
        <span className={styles.topBarSpacer} />
        {isYouTube && (
          <>
            <button
              className={cx(controls.btn, controls.btnGhost)}
              onClick={() => setBaseFlowView({ layout: view.layout === "mini" ? "ambient" : "mini" })}
              title="플레이어 배치 전환"
            >
              {view.layout === "mini" ? "미니" : "앰비언트"}
            </button>
            {view.layout === "ambient" && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={view.ambientIntensity}
                onChange={(e) => setBaseFlowView({ ambientIntensity: Number(e.target.value) })}
                title="앰비언트 강도"
              />
            )}
          </>
        )}
        <button className={cx(controls.btn, controls.btnGhost)} onClick={onExit}>
          ← 목록
        </button>
      </header>
      <TransportBar />
      <EditorToolbar />
      <div className={styles.editorMain} onClick={handleMainClick}>
        <div className={styles.editorMainTimeline} style={{ position: "relative" }}>
          {isYouTube && view.layout === "ambient" && <YouTubePlayer view={view} ref={playerHostRef} />}
          <Timeline peaks={peaks} durationMs={project.baseFlow.durationMs} baseFlowKind={project.baseFlow.kind} />
        </div>
      </div>
      {isYouTube && view.layout === "mini" && <YouTubePlayer view={view} ref={playerHostRef} />}
    </div>
  );
}
