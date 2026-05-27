import { navigate } from "../router/router";

export function PlayPlaceholder() {
  return (
    <div style={{ padding: 16 }}>
      <h1>플레이</h1>
      <p>준비 중입니다.</p>
      <button onClick={() => navigate("/")}>← 홈</button>
    </div>
  );
}
