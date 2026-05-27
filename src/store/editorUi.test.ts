import { describe, it, expect, beforeEach } from "vitest";
import { useEditorUi } from "./editorUi";

describe("useEditorUi", () => {
  beforeEach(() => {
    useEditorUi.setState({
      sequencerOpen: false,
      region: { startMs: 0, endMs: 4000 },
      stepCount: 8,
    });
  });

  it("초기 상태: 닫힘, region {0,4000}, stepCount 8", () => {
    const s = useEditorUi.getState();
    expect(s.sequencerOpen).toBe(false);
    expect(s.region).toEqual({ startMs: 0, endMs: 4000 });
    expect(s.stepCount).toBe(8);
  });

  it("toggleSequencer는 열림 여부를 반전한다", () => {
    useEditorUi.getState().toggleSequencer();
    expect(useEditorUi.getState().sequencerOpen).toBe(true);
    useEditorUi.getState().toggleSequencer();
    expect(useEditorUi.getState().sequencerOpen).toBe(false);
  });

  it("setSequencerOpen은 값을 그대로 설정한다", () => {
    useEditorUi.getState().setSequencerOpen(true);
    expect(useEditorUi.getState().sequencerOpen).toBe(true);
    useEditorUi.getState().setSequencerOpen(false);
    expect(useEditorUi.getState().sequencerOpen).toBe(false);
  });

  it("setRegion은 구간을 교체한다", () => {
    useEditorUi.getState().setRegion({ startMs: 1000, endMs: 1800 });
    expect(useEditorUi.getState().region).toEqual({ startMs: 1000, endMs: 1800 });
  });

  it("setStepCount는 max(1, n)으로 클램프한다", () => {
    useEditorUi.getState().setStepCount(16);
    expect(useEditorUi.getState().stepCount).toBe(16);
    useEditorUi.getState().setStepCount(0);
    expect(useEditorUi.getState().stepCount).toBe(1);
    useEditorUi.getState().setStepCount(-5);
    expect(useEditorUi.getState().stepCount).toBe(1);
  });

  it("resetForTrack은 region={0,4000}, stepCount=8로 되돌린다(열림 여부는 보존)", () => {
    useEditorUi.setState({
      sequencerOpen: true,
      region: { startMs: 1000, endMs: 5000 },
      stepCount: 32,
    });
    useEditorUi.getState().resetForTrack();
    const s = useEditorUi.getState();
    expect(s.region).toEqual({ startMs: 0, endMs: 4000 });
    expect(s.stepCount).toBe(8);
    expect(s.sequencerOpen).toBe(true);
  });
});
