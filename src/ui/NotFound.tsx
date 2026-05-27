import { navigate } from "../router/router";

export function NotFound() {
  return (
    <div style={{ padding: 16 }}>
      <h1>404</h1>
      <p>존재하지 않는 페이지입니다.</p>
      <button onClick={() => navigate("/")}>← 홈</button>
    </div>
  );
}
