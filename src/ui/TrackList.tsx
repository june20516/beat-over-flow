import { Plus } from "@phosphor-icons/react";
import { useStore } from "../store/useStore";
import { TrackHeader } from "./TrackHeader";

export function TrackList() {
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const addTrack = useStore((s) => s.addTrack);

  return (
    <div className="tracklist panel">
      <div className="tracklist__head">
        <h2 className="section-title">트랙</h2>
        <button className="btn--primary" onClick={addTrack}>
          <Plus size={15} weight="bold" />
          트랙
        </button>
      </div>
      {tracks.map((t) => (
        <TrackHeader key={t.id} track={t} />
      ))}
    </div>
  );
}
