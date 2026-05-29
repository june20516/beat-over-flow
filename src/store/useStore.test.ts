import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { GlobalMode, Project } from "../types";
import { emptyScore, applyJudgment } from "../scoring/scoring";

function sampleProject(): Project {
  return {
    id: "p1",
    name: "테스트곡",
    createdAt: 1,
    updatedAt: 1,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 5000 },
    tracks: [],
    master: { volume: 1 },
    libraryAssetIds: [],
  };
}

describe("useStore", () => {
  beforeEach(() => {
    useStore.setState({ project: null, playing: false, playheadMs: 0, mode: "listening", selectedTrackId: null, score: emptyScore() });
  });

  it("setProject로 현재 프로젝트를 교체한다", () => {
    useStore.getState().setProject(sampleProject());
    expect(useStore.getState().project?.name).toBe("테스트곡");
  });

  it("renameProject는 이름과 updatedAt을 갱신한다", () => {
    useStore.getState().setProject(sampleProject());
    useStore.getState().renameProject("새 이름");
    expect(useStore.getState().project?.name).toBe("새 이름");
    expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(
      useStore.getState().project!.createdAt,
    );
  });

  it("setMasterVolume은 0..1로 클램프한다", () => {
    useStore.getState().setProject(sampleProject());
    useStore.getState().setMasterVolume(2);
    expect(useStore.getState().project!.master.volume).toBe(1);
  });
});

describe("useStore 트랙/마커", () => {
  beforeEach(() => {
    useStore.setState({ project: sampleProject(), playing: false, playheadMs: 0, mode: "listening", selectedTrackId: null, score: emptyScore() });
  });

  it("addTrack은 기본 트랙을 추가한다", () => {
    useStore.getState().addTrack();
    const tracks = useStore.getState().project!.tracks;
    expect(tracks.length).toBe(1);
    expect(tracks[0].status).toBe("listening");
    expect(tracks[0].markers).toEqual([]);
  });

  it("setTrackStatus는 해당 트랙 상태를 바꾼다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().setTrackStatus(id, "play");
    expect(useStore.getState().project!.tracks[0].status).toBe("play");
  });

  it("addMarker는 시각순으로 마커를 넣는다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().addMarker(id, 500);
    useStore.getState().addMarker(id, 100);
    const times = useStore.getState().project!.tracks[0].markers.map((m) => m.timeMs);
    expect(times).toEqual([100, 500]);
  });

  it("removeMarker는 해당 마커를 제거한다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().addMarker(id, 100);
    const mid = useStore.getState().project!.tracks[0].markers[0].id;
    useStore.getState().removeMarker(id, mid);
    expect(useStore.getState().project!.tracks[0].markers).toEqual([]);
  });

  it("removeTrack은 트랙을 제거한다", () => {
    useStore.getState().addTrack();
    const id = useStore.getState().project!.tracks[0].id;
    useStore.getState().removeTrack(id);
    expect(useStore.getState().project!.tracks).toEqual([]);
  });

  it("setMode는 전역 모드를 바꾼다", () => {
    useStore.getState().setMode("record" as GlobalMode);
    expect(useStore.getState().mode).toBe("record");
  });
});

describe("useStore 시퀀서 보조 액션", () => {
  beforeEach(() => {
    useStore.setState({
      project: sampleProject(),
      playing: false,
      playheadMs: 0,
      mode: "listening",
      selectedTrackId: null,
      score: emptyScore(),
    });
    useStore.getState().addTrack();
  });

  function trackId() {
    return useStore.getState().project!.tracks[0].id;
  }

  it("setSelectedTrack은 선택 트랙을 기록", () => {
    useStore.getState().setSelectedTrack(trackId());
    expect(useStore.getState().selectedTrackId).toBe(trackId());
  });

  it("toggleMarkerAt: 없으면 추가, 허용오차 내 있으면 제거", () => {
    const id = trackId();
    useStore.getState().toggleMarkerAt(id, 200, 10);
    expect(useStore.getState().project!.tracks[0].markers.length).toBe(1);
    useStore.getState().toggleMarkerAt(id, 205, 10); // 오차 내 → 제거
    expect(useStore.getState().project!.tracks[0].markers.length).toBe(0);
  });

  it("removeMarkersInRange: [from,to] 내 마커 제거", () => {
    const id = trackId();
    [100, 300, 500].forEach((t) => useStore.getState().addMarker(id, t));
    useStore.getState().removeMarkersInRange(id, 200, 400);
    expect(useStore.getState().project!.tracks[0].markers.map((m) => m.timeMs)).toEqual([100, 500]);
  });

  it("addMarkersBulk: 여러 마커를 시각순으로 추가", () => {
    const id = trackId();
    useStore.getState().addMarkersBulk(id, [400, 100, 250]);
    expect(useStore.getState().project!.tracks[0].markers.map((m) => m.timeMs)).toEqual([
      100, 250, 400,
    ]);
  });
});

describe("useStore 점수", () => {
  beforeEach(() => {
    useStore.setState({
      project: sampleProject(), playing: false, playheadMs: 0,
      mode: "play", selectedTrackId: null, score: emptyScore(),
    });
  });
  it("setScore로 점수 상태 교체", () => {
    const s = applyJudgment(emptyScore(), "perfect");
    useStore.getState().setScore(s);
    expect(useStore.getState().score.score).toBe(100);
  });
  it("resetScore로 초기화", () => {
    useStore.getState().setScore(applyJudgment(emptyScore(), "perfect"));
    useStore.getState().resetScore();
    expect(useStore.getState().score.totalJudged).toBe(0);
  });
});

function makeProject(): Project {
  return {
    id: "p1",
    name: "테스트",
    createdAt: 1000,
    updatedAt: 1000,
    baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 60000 },
    master: { volume: 1 },
    libraryAssetIds: [],
    tracks: [
      {
        id: "t1",
        name: "트랙 1",
        status: "record",
        sound: { kind: "builtin", sampleId: "kick" },
        keyBinding: null,
        markers: [
          { id: "m1", timeMs: 100 },
          { id: "m2", timeMs: 200 },
        ],
        volume: 1,
        color: "#fff",
        recentSounds: [{ kind: "builtin", sampleId: "kick" }],
      },
      {
        id: "t2",
        name: "트랙 2",
        status: "play",
        sound: { kind: "builtin", sampleId: "snare" },
        keyBinding: null,
        markers: [{ id: "m3", timeMs: 300 }],
        volume: 1,
        color: "#000",
        recentSounds: [{ kind: "builtin", sampleId: "snare" }],
      },
    ],
  };
}

describe("clearMarkers", () => {
  beforeEach(() => {
    useStore.setState({ project: makeProject() });
  });

  it("해당 트랙의 markers를 빈 배열로 만든다", () => {
    useStore.getState().clearMarkers("t1");
    const t1 = useStore.getState().project!.tracks.find((t) => t.id === "t1")!;
    expect(t1.markers).toEqual([]);
  });

  it("다른 트랙의 markers는 그대로 둔다", () => {
    useStore.getState().clearMarkers("t1");
    const t2 = useStore.getState().project!.tracks.find((t) => t.id === "t2")!;
    expect(t2.markers).toHaveLength(1);
  });

  it("project.updatedAt을 갱신한다", () => {
    const before = useStore.getState().project!.updatedAt;
    useStore.getState().clearMarkers("t1");
    expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(useStore.getState().project!.updatedAt).not.toBe(1000);
  });

  it("project가 null이면 아무 일도 하지 않는다", () => {
    useStore.setState({ project: null });
    expect(() => useStore.getState().clearMarkers("t1")).not.toThrow();
    expect(useStore.getState().project).toBeNull();
  });
});

describe("useStore reorderTracks", () => {
  function projectWith3Tracks(): Project {
    const base = sampleProject();
    return {
      ...base,
      tracks: ["A", "B", "C"].map((name, i) => ({
        id: `t${i}`,
        name,
        status: "listening" as const,
        sound: { kind: "builtin" as const, sampleId: "kick" },
        keyBinding: null,
        markers: [],
        volume: 1,
        color: "#fff",
        recentSounds: [{ kind: "builtin" as const, sampleId: "kick" }],
      })),
    };
  }

  beforeEach(() => {
    useStore.setState({
      project: projectWith3Tracks(),
      playing: false,
      playheadMs: 0,
      mode: "listening",
      selectedTrackId: null,
      score: emptyScore(),
    });
  });

  function names() {
    return useStore.getState().project!.tracks.map((t) => t.name);
  }

  it("앞 트랙을 뒤로 이동하면 순서가 바뀐다", () => {
    useStore.getState().reorderTracks(0, 2);
    expect(names()).toEqual(["B", "C", "A"]);
  });

  it("뒤 트랙을 앞으로 이동하면 순서가 바뀐다", () => {
    useStore.getState().reorderTracks(2, 0);
    expect(names()).toEqual(["C", "A", "B"]);
  });

  it("인접 트랙 스왑", () => {
    useStore.getState().reorderTracks(0, 1);
    expect(names()).toEqual(["B", "A", "C"]);
  });

  it("from===to면 순서/참조 모두 변경 없음(전이 없음)", () => {
    const before = useStore.getState().project!;
    useStore.getState().reorderTracks(1, 1);
    expect(useStore.getState().project).toBe(before);
    expect(names()).toEqual(["A", "B", "C"]);
  });

  it("fromIndex가 범위 밖이면 변경 없음", () => {
    const before = useStore.getState().project!;
    useStore.getState().reorderTracks(5, 0);
    expect(useStore.getState().project).toBe(before);
    expect(names()).toEqual(["A", "B", "C"]);
  });

  it("toIndex가 범위 밖이면 변경 없음", () => {
    const before = useStore.getState().project!;
    useStore.getState().reorderTracks(0, 9);
    expect(useStore.getState().project).toBe(before);
    expect(names()).toEqual(["A", "B", "C"]);
  });

  it("음수 인덱스면 변경 없음", () => {
    const before = useStore.getState().project!;
    useStore.getState().reorderTracks(-1, 1);
    expect(useStore.getState().project).toBe(before);
    expect(names()).toEqual(["A", "B", "C"]);
  });

  it("정상 이동 시 updatedAt이 갱신된다(단일 전이)", () => {
    const t0 = useStore.getState().project!.updatedAt;
    useStore.getState().reorderTracks(0, 2);
    expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(t0);
  });

  it("project가 null이면 안전하게 무시한다", () => {
    useStore.setState({ project: null });
    expect(() => useStore.getState().reorderTracks(0, 1)).not.toThrow();
    expect(useStore.getState().project).toBeNull();
  });
});

describe("setPlayPauseKey", () => {
  function makeTransportProject(overrides: Partial<Project> = {}): Project {
    return {
      id: "p1",
      name: "test",
      createdAt: 0,
      updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 1000 },
      tracks: [],
      master: { volume: 1 },
      libraryAssetIds: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    useStore.setState({ project: makeTransportProject() });
  });

  it("transport가 없던 프로젝트에 playPauseKey를 설정한다", () => {
    useStore.getState().setPlayPauseKey("KeyP");
    expect(useStore.getState().project?.transport?.playPauseKey).toBe("KeyP");
  });

  it("기존 playPauseKey를 다른 키로 교체한다", () => {
    useStore.setState({ project: makeTransportProject({ transport: { playPauseKey: "KeyP" } }) });
    useStore.getState().setPlayPauseKey("Space");
    expect(useStore.getState().project?.transport?.playPauseKey).toBe("Space");
  });

  it("null로 바인딩을 해제한다", () => {
    useStore.setState({ project: makeTransportProject({ transport: { playPauseKey: "KeyP" } }) });
    useStore.getState().setPlayPauseKey(null);
    expect(useStore.getState().project?.transport?.playPauseKey).toBeNull();
  });

  it("updatedAt을 갱신한다 (단일 전이)", () => {
    const before = useStore.getState().project!.updatedAt;
    useStore.getState().setPlayPauseKey("KeyP");
    expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("project가 null이면 아무 일도 하지 않는다", () => {
    useStore.setState({ project: null });
    useStore.getState().setPlayPauseKey("KeyP");
    expect(useStore.getState().project).toBeNull();
  });
});
