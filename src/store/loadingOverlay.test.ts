import { describe, it, expect, beforeEach } from "vitest";
import { useLoadingOverlay } from "./loadingOverlay";

describe("loadingOverlay", () => {
  beforeEach(() => useLoadingOverlay.setState({ open: false, mode: "indeterminate", progress: undefined, label: undefined }));

  it("show은 open=true와 mode/label을 설정", () => {
    useLoadingOverlay.getState().show({ mode: "determinate", label: "복사 중..." });
    const s = useLoadingOverlay.getState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe("determinate");
    expect(s.label).toBe("복사 중...");
  });

  it("setProgress는 0..1 사이로 클램프", () => {
    useLoadingOverlay.getState().show({ mode: "determinate" });
    useLoadingOverlay.getState().setProgress(0.5);
    expect(useLoadingOverlay.getState().progress).toBe(0.5);
    useLoadingOverlay.getState().setProgress(2);
    expect(useLoadingOverlay.getState().progress).toBe(1);
    useLoadingOverlay.getState().setProgress(-1);
    expect(useLoadingOverlay.getState().progress).toBe(0);
  });

  it("hide는 open=false로 리셋", () => {
    useLoadingOverlay.getState().show({ mode: "indeterminate" });
    useLoadingOverlay.getState().hide();
    expect(useLoadingOverlay.getState().open).toBe(false);
  });
});
