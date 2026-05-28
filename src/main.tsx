import React from "react";
import ReactDOM from "react-dom/client";

import "./ui/base.css";
// Cascade order: 공유 베이스 레이어(컨트롤/프리미티브/스크린)를 컴포넌트 모듈보다 먼저 emit해
// 컴포넌트별 오버라이드가 자연스럽게 이긴다.
import "./ui/controls.module.css";
import "./ui/primitives.module.css";
import "./ui/screen.module.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
