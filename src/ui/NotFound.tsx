import { ArrowLeft } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import screen from "./screen.module.css";
import { cx } from "./cx";
import { navigate } from "../router/router";

export function NotFound() {
  return (
    <div className={screen.screen}>
      <div className={screen.screenCode}>404</div>
      <p className={screen.screenLead}>존재하지 않는 페이지입니다.</p>
      <button className={cx(controls.btn, controls.btnGhost)} onClick={() => navigate("/")}>
        <ArrowLeft size={15} weight="bold" />
        홈으로
      </button>
    </div>
  );
}
