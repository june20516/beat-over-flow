import { describe, it, expect } from "vitest";
import { computePeaks } from "./waveform";

describe("computePeaks", () => {
  it("buckets 개수만큼의 양수 피크를 반환한다", () => {
    const data = new Float32Array(1000).map((_, i) => Math.sin(i));
    const peaks = computePeaks(data, 50);
    expect(peaks.length).toBe(50);
    for (const p of peaks) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("각 버킷은 해당 구간의 최대 절댓값이다", () => {
    const data = new Float32Array([0, 0.5, 0, 0, -1, 0]);
    const peaks = computePeaks(data, 2);
    expect(peaks[0]).toBeCloseTo(0.5); // 앞 3개 중 최대 절댓값
    expect(peaks[1]).toBeCloseTo(1.0); // 뒤 3개 중 최대 절댓값
  });

  it("buckets가 샘플 수보다 많아도 안전하다", () => {
    const data = new Float32Array([0.2, -0.4]);
    const peaks = computePeaks(data, 10);
    expect(peaks.length).toBe(10);
  });
});
