import { describe, it, expect } from "vitest";
import { judge, applyJudgment, accuracy, emptyScore, SCORE } from "./scoring";

describe("judge", () => {
  it("±40ms 이내 perfect", () => {
    expect(judge(0)).toBe("perfect");
    expect(judge(40)).toBe("perfect");
    expect(judge(-40)).toBe("perfect");
  });
  it("±100ms 이내 good", () => {
    expect(judge(41)).toBe("good");
    expect(judge(-100)).toBe("good");
  });
  it("그 밖 miss", () => {
    expect(judge(101)).toBe("miss");
  });
});

describe("applyJudgment", () => {
  it("perfect는 점수+콤보 증가", () => {
    const s = applyJudgment(emptyScore(), "perfect");
    expect(s.score).toBe(SCORE.perfect);
    expect(s.combo).toBe(1);
    expect(s.perfect).toBe(1);
    expect(s.totalJudged).toBe(1);
  });
  it("miss는 콤보 리셋, 점수 변화 없음", () => {
    let s = applyJudgment(emptyScore(), "perfect");
    s = applyJudgment(s, "miss");
    expect(s.combo).toBe(0);
    expect(s.score).toBe(SCORE.perfect);
    expect(s.miss).toBe(1);
  });
  it("maxCombo는 최대 콤보를 유지", () => {
    let s = emptyScore();
    s = applyJudgment(s, "good");
    s = applyJudgment(s, "good");
    s = applyJudgment(s, "miss");
    expect(s.maxCombo).toBe(2);
  });
});

describe("accuracy", () => {
  it("판정 합계 대비 획득 점수 비율(0..1)", () => {
    let s = emptyScore();
    s = applyJudgment(s, "perfect"); // 100/100
    s = applyJudgment(s, "miss"); // +0/100
    expect(accuracy(s)).toBeCloseTo(100 / 200);
  });
  it("판정 없으면 1", () => {
    expect(accuracy(emptyScore())).toBe(1);
  });
});
