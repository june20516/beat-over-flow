import { useStore } from "../store/useStore";
import { TrackEditor } from "./TrackEditor";
import { MarkerEditor } from "./MarkerEditor";
import type { Track } from "../types";

interface TrackRowProps {
  track: Track;
  index: number;
  focused: boolean;
}

export function TrackRow({ track, index, focused }: TrackRowProps) {
  const setSelectedTrack = useStore((s) => s.setSelectedTrack);

  const rowClass = [
    "track-row",
    focused ? "track-row--focused" : "track-row--collapsed",
    index % 2 === 0 ? "track-row--even" : "track-row--odd",
  ].join(" ");

  return (
    <div className={rowClass} onClick={() => setSelectedTrack(track.id)}>
      <div className="track-row__editor">
        <TrackEditor track={track} focused={focused} />
      </div>
      <div className="track-row__lane">
        <MarkerEditor track={track} focused={focused} />
      </div>
    </div>
  );
}
