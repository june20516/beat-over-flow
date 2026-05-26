import { useStore } from "../store/useStore";
import { TrackHeader } from "./TrackHeader";

export function TrackList() {
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const addTrack = useStore((s) => s.addTrack);

  return (
    <div style={{ width: 320 }}>
      <div style={{ height: 80, display: "flex", alignItems: "center", padding: "0 6px" }}>
        <strong>트랙</strong>
        <button onClick={addTrack} style={{ marginLeft: "auto" }}>
          ＋ 트랙
        </button>
      </div>
      {tracks.map((t) => (
        <TrackHeader key={t.id} track={t} />
      ))}
    </div>
  );
}
