import React from "react";
import ReactDOM from "react-dom/client";

import "./ui/base.css";
// IMPORTANT — 삭제 금지: 공유 모듈이 컴포넌트 모듈보다 CSS 번들에서 먼저 emit되어야
// 컴포넌트별 오버라이드(VolumeControl .range, ProjectList .cta 등)가 우선된다.
// 이 순서가 깨지면 홈/프로젝트 목록의 CTA 버튼 크기와 VolumeControl 슬라이더 방향이 회귀한다.
import "./ui/controls.module.css";
import "./ui/primitives.module.css";
import "./ui/screen.module.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
