import { useStore } from "../store/useStore";
import { useEditorUi } from "../store/editorUi";
import { TrackEditor } from "./TrackEditor";
import { MarkerEditor } from "./MarkerEditor";
import { StepSequencerPanel } from "./StepSequencerPanel";
import type { Track } from "../types";

interface TrackRowProps {
  track: Track;
  index: number;
  focused: boolean;
}

export function TrackRow({ track, index, focused }: TrackRowProps) {
  const setSelectedTrack = useStore((s) => s.setSelectedTrack);
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const showSequencer = focused && sequencerOpen;

  const rowClass = [
    "track-row",
    focused ? "track-row--focused" : "track-row--collapsed",
    index % 2 === 0 ? "track-row--even" : "track-row--odd",
  ].join(" ");

  return (
    <div className="track-row-wrap">
      <div className={rowClass} onClick={() => setSelectedTrack(track.id)}>
        <div className="track-row__editor">
          <TrackEditor track={track} focused={focused} />
        </div>
        <div className="track-row__lane">
          <MarkerEditor track={track} focused={focused} />
        </div>
      </div>
      {showSequencer && (
        <div className="track-row__sequencer">
          <div className="track-row__sequencer-gutter" aria-hidden="true" />
          <div className="track-row__sequencer-body">
            <StepSequencerPanel />
          </div>
        </div>
      )}
    </div>
  );
}
