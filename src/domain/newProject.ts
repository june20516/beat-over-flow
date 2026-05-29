import type { Project } from "../types";
import { newId } from "./ids";
import { DEFAULT_BASE_FLOW_VIEW } from "./baseFlowView";

/** 새 빈 프로젝트의 공통 골격(트랙 없음, 기본 마스터/transport/뷰). */
function emptyProjectBase(name: string): Omit<Project, "baseFlow"> {
  const now = Date.now();
  return {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    tracks: [],
    master: { volume: 1 },
    transport: { playPauseKey: null },
    libraryAssetIds: [],
    baseFlowView: DEFAULT_BASE_FLOW_VIEW,
  };
}

/**
 * 업로드한 오디오 자산으로 빈 프로젝트를 만든다. fetch/decode와 무관한 순수 함수.
 * @param name 이미 정규화된 이름(호출부에서 normalizeAssetName 적용 후 전달).
 */
export function buildAudioFileProject(name: string, assetId: string, durationMs: number): Project {
  return {
    ...emptyProjectBase(name),
    baseFlow: { kind: "audioFile", assetId, durationMs },
  };
}

/**
 * 유튜브 영상으로 빈 프로젝트를 만든다. durationMs는 onReady 후 write-back되므로 0으로 시작.
 * name이 공백이면 "유튜브 프로젝트"로 대체한다.
 */
export function buildYouTubeProject(videoId: string, name: string): Project {
  const cleanName = name.trim() || "유튜브 프로젝트";
  return {
    ...emptyProjectBase(cleanName),
    baseFlow: { kind: "youtube", videoId, durationMs: 0 },
  };
}
