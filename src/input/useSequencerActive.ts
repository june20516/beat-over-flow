import { useStore } from "../store/useStore";
import { useEditorUi } from "../store/editorUi";
import { isMarkerEditingEnabled } from "../timeline/markerMath";

/** 시퀀서가 현재 포커스 트랙에서 활성인지: 토글 ON + 포커스 트랙이 레코드 동작(W 상태 + 레코드 모드). */
export function useSequencerActive(): boolean {
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const mode = useStore((s) => s.mode);
  const status = useStore((s) => {
    const id = s.selectedTrackId;
    if (!id) return null;
    return s.project?.tracks.find((t) => t.id === id)?.status ?? null;
  });
  return sequencerOpen && status !== null && isMarkerEditingEnabled(mode, status);
}
