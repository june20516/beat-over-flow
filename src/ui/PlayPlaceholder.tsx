import { ArrowLeft } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import screen from "./screen.module.css";
import { cx } from "./cx";
import { navigate } from "../router/router";

export function PlayPlaceholder() {
  return (
    <div className={screen.screen}>
      <div className={screen.screenBadge}>준비 중</div>
      <h1 className={cx(screen.screenTitle, screen.screenTitleSm)}>플레이</h1>
      <p className={screen.screenLead}>공유받은 작품을 연주하는 플레이 모드는 곧 추가됩니다.</p>
      <button className={cx(controls.btn, controls.btnGhost)} onClick={() => navigate("/")}>
        <ArrowLeft size={15} weight="bold" />
        홈으로
      </button>
    </div>
  );
}
