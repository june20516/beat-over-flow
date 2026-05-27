import { ArrowLeft } from "@phosphor-icons/react";
import { navigate } from "../router/router";

export function PlayPlaceholder() {
  return (
    <div className="screen">
      <div className="screen__badge">준비 중</div>
      <h1 className="screen__title screen__title--sm">플레이</h1>
      <p className="screen__lead">공유받은 작품을 연주하는 플레이 모드는 곧 추가됩니다.</p>
      <button className="btn--ghost" onClick={() => navigate("/")}>
        <ArrowLeft size={15} weight="bold" />
        홈으로
      </button>
    </div>
  );
}
