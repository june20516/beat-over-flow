import { PencilSimple, Play } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import screen from "./screen.module.css";
import { cx } from "./cx";
import { navigate } from "../router/router";

export function Home() {
  return (
    <div className={screen.screen}>
      <h1 className={screen.screenTitle}>BeatOverflow</h1>
      <p className={screen.screenLead}>오디오 위에 비트를 쌓아 만들고, 리듬게임처럼 연주하세요.</p>
      <div className={screen.screenActions}>
        <button className={cx(controls.btn, controls.btnPrimary, screen.screenCta)} onClick={() => navigate("/edit")}>
          <PencilSimple size={18} weight="bold" />
          편집
        </button>
        <button className={cx(controls.btn, controls.btnGhost, screen.screenCta)} onClick={() => navigate("/play")}>
          <Play size={18} weight="fill" />
          플레이
        </button>
      </div>
    </div>
  );
}
