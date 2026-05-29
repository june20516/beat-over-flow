import type { Project } from "../types";

export type BaseFlowView = NonNullable<Project["baseFlowView"]>;

export const DEFAULT_BASE_FLOW_VIEW: BaseFlowView = {
  layout: "mini",
  ambientIntensity: 0.5,
};

export function resolveBaseFlowView(view: Project["baseFlowView"]): BaseFlowView {
  return view ?? DEFAULT_BASE_FLOW_VIEW;
}
