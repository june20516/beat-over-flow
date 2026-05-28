import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import { cx } from "./cx";
import { useStore } from "../store/useStore";
import { useEditorUi } from "../store/editorUi";
import { usePulse } from "../store/pulse";
import { resolveTrackBehavior } from "../domain/mode";
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
  const removeTrack = useStore((s) => s.removeTrack);
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const pulseNonce = usePulse((s) => s.nonce[track.id] ?? 0);
  const mode = useStore((s) => s.mode);
  const showSequencer =
    focused && sequencerOpen && resolveTrackBehavior(mode, track.status) === "record";

  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (pulseNonce === 0) return;
    setPulsing(true);
    const id = setTimeout(() => setPulsing(false), 320);
    return () => clearTimeout(id);
  }, [pulseNonce]);

  const rowClass = [
    "track-row",
    focused ? "track-row--focused" : "track-row--collapsed",
    index % 2 === 0 ? "track-row--even" : "track-row--odd",
    pulsing ? "track-row--pulse" : "",
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
        {focused && (
          <div className="track-row__delete">
            <div className="track-row__delete-handle" aria-hidden="true" />
            <button
              type="button"
              className={cx(controls.btn, "track-row__delete-btn")}
              title="트랙 삭제"
              onClick={(e) => {
                e.stopPropagation();
                removeTrack(track.id);
              }}
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        )}
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
