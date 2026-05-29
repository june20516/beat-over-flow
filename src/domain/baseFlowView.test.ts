import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_FLOW_VIEW, resolveBaseFlowView } from "./baseFlowView";

describe("resolveBaseFlowView", () => {
  it("없으면 기본값", () => {
    expect(resolveBaseFlowView(undefined)).toEqual(DEFAULT_BASE_FLOW_VIEW);
  });
  it("기본값은 mini / 0.5", () => {
    expect(DEFAULT_BASE_FLOW_VIEW).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });
  it("주어지면 그대로", () => {
    const v = { layout: "ambient" as const, ambientIntensity: 0.8 };
    expect(resolveBaseFlowView(v)).toEqual(v);
  });
});
