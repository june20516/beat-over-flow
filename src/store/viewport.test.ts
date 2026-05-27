import { describe, it, expect, beforeEach } from "vitest";
import { useViewport } from "./viewport";
import { MAX_PX_PER_MS } from "../timeline/viewportMath";

function reset() {
  useViewport.setState({ pxPerMs: 0, scrollLeftPx: 0, containerWidthPx: 1, durationMs: 0 });
}

describe("useViewport", () => {
  beforeEach(reset);

  it("초기값: containerWidthPx=1(0분모방지), durationMs=0", () => {
    const s = useViewport.getState();
    expect(s.containerWidthPx).toBe(1);
    expect(s.durationMs).toBe(0);
  });

  it("setDuration + setContainerWidth 후 fitAll로 minPxPerMs/scroll0", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    s.fitAll();
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.1);
    expect(v.scrollLeftPx).toBe(0);
  });

  it("setDuration은 재클램프하며 pxPerMs가 0이면 최소줌으로 채운다", () => {
    const s = useViewport.getState();
    s.setContainerWidth(1000);
    s.setDuration(10000);
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.1);
  });

  it("setContainerWidth는 pxPerMs/scroll을 재클램프한다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    s.fitAll();
    s.setContainerWidth(500);
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.1);
    expect(v.scrollLeftPx).toBe(0);
  });

  it("panByPx는 scrollLeftPx를 클램프 이동한다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    useViewport.setState({ pxPerMs: 0.2 });
    s.panByPx(500);
    expect(useViewport.getState().scrollLeftPx).toBe(500);
    s.panByPx(9999);
    expect(useViewport.getState().scrollLeftPx).toBe(1000);
    s.panByPx(-9999);
    expect(useViewport.getState().scrollLeftPx).toBe(0);
  });

  it("zoomAt은 앵커 시간을 유지하며 확대한다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    s.fitAll();
    s.zoomAt(2, 500);
    const v = useViewport.getState();
    expect(v.pxPerMs).toBeCloseTo(0.2);
    expect(5000 * v.pxPerMs - v.scrollLeftPx).toBeCloseTo(500);
  });

  it("zoomAt은 MAX_PX_PER_MS를 넘지 않는다", () => {
    const s = useViewport.getState();
    s.setDuration(10000);
    s.setContainerWidth(1000);
    useViewport.setState({ pxPerMs: 0.4 });
    s.zoomAt(100, 0);
    expect(useViewport.getState().pxPerMs).toBe(MAX_PX_PER_MS);
  });
});
