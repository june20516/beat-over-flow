import { describe, expect, it } from "vitest";
import { parseYouTubeId } from "./youtube";

describe("parseYouTubeId", () => {
  it("watch?v= URL에서 id 추출", () => {
    expect(parseYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("부가 쿼리가 있어도 id 추출", () => {
    expect(parseYouTubeId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
  });
  it("youtu.be 단축 URL", () => {
    expect(parseYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
  });
  it("embed URL", () => {
    expect(parseYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("순수 11자 id 입력은 그대로", () => {
    expect(parseYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("유효하지 않으면 null", () => {
    expect(parseYouTubeId("https://example.com/foo")).toBeNull();
    expect(parseYouTubeId("")).toBeNull();
    expect(parseYouTubeId("not a url")).toBeNull();
  });
});
