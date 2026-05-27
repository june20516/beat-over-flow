import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchRoute, navigate, subscribe, getPathname } from "./router";

describe("matchRoute", () => {
  it("/ 는 home", () => {
    expect(matchRoute("/")).toEqual({ kind: "home" });
  });
  it("/edit 는 projectList", () => {
    expect(matchRoute("/edit")).toEqual({ kind: "projectList" });
  });
  it("/edit/:id 는 editor + projectId", () => {
    expect(matchRoute("/edit/abc-123")).toEqual({ kind: "editor", projectId: "abc-123" });
  });
  it("/play 는 play", () => {
    expect(matchRoute("/play")).toEqual({ kind: "play" });
  });
  it("알 수 없는 경로는 notFound", () => {
    expect(matchRoute("/unknown")).toEqual({ kind: "notFound" });
    expect(matchRoute("/edit/a/b")).toEqual({ kind: "notFound" });
    expect(matchRoute("/play/x")).toEqual({ kind: "notFound" });
  });
});

describe("navigate / subscribe", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("navigate 는 pathname 을 바꾼다", () => {
    navigate("/edit");
    expect(getPathname()).toBe("/edit");
  });

  it("navigate 는 구독자에게 알린다", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    navigate("/play");
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("같은 경로로의 navigate 는 알리지 않는다", () => {
    window.history.replaceState(null, "", "/play");
    const cb = vi.fn();
    const unsub = subscribe(cb);
    navigate("/play");
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it("popstate 는 구독자에게 알린다", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("unsubscribe 후에는 알리지 않는다", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    unsub();
    navigate("/edit");
    expect(cb).not.toHaveBeenCalled();
  });
});
