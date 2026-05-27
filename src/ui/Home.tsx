import { navigate } from "../router/router";

export function Home() {
  return (
    <div style={{ padding: 16 }}>
      <h1>BeatOverflow</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => navigate("/edit")}>편집</button>
        <button onClick={() => navigate("/play")}>플레이</button>
      </div>
    </div>
  );
}
