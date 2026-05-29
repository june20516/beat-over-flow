import { describe, it, expect, beforeEach } from "vitest";
import { useAssetLibrary } from "./assetLibrary";

describe("assetLibrary slice", () => {
  beforeEach(() => useAssetLibrary.setState({ open: false, mode: "manage", targetTrackId: null }));

  it("openManage", () => {
    useAssetLibrary.getState().openManage();
    const s = useAssetLibrary.getState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe("manage");
    expect(s.targetTrackId).toBeNull();
  });

  it("openSelect는 targetTrackId를 저장한다", () => {
    useAssetLibrary.getState().openSelect("t1");
    const s = useAssetLibrary.getState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe("select");
    expect(s.targetTrackId).toBe("t1");
  });

  it("close는 리셋", () => {
    useAssetLibrary.getState().openSelect("t1");
    useAssetLibrary.getState().close();
    const s = useAssetLibrary.getState();
    expect(s.open).toBe(false);
    expect(s.targetTrackId).toBeNull();
  });
});
