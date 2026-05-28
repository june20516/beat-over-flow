import { PencilSimple, Play } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import { cx } from "./cx";
import { navigate } from "../router/router";

export function Home() {
  return (
    <div className="screen">
      <h1 className="screen__title">BeatOverflow</h1>
      <p className="screen__lead">오디오 위에 비트를 쌓아 만들고, 리듬게임처럼 연주하세요.</p>
      <div className="screen__actions">
        <button className={cx(controls.btn, controls.btnPrimary, "screen__cta")} onClick={() => navigate("/edit")}>
          <PencilSimple size={18} weight="bold" />
          편집
        </button>
        <button className={cx(controls.btn, controls.btnGhost, "screen__cta")} onClick={() => navigate("/play")}>
          <Play size={18} weight="fill" />
          플레이
        </button>
      </div>
    </div>
  );
}
