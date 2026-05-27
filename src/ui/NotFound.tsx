import { ArrowLeft } from "@phosphor-icons/react";
import { navigate } from "../router/router";

export function NotFound() {
  return (
    <div className="screen">
      <div className="screen__code">404</div>
      <p className="screen__lead">존재하지 않는 페이지입니다.</p>
      <button className="btn--ghost" onClick={() => navigate("/")}>
        <ArrowLeft size={15} weight="bold" />
        홈으로
      </button>
    </div>
  );
}
