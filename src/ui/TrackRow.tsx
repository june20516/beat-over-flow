import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import styles from "./TrackRow.module.css";
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

  const rowClass = cx(
    styles.trackRow,
    focused && styles.focused,
    index % 2 === 0 ? styles.even : styles.odd,
    pulsing && styles.pulse,
  );

  return (
    <div data-track-row>
      <div className={rowClass} onClick={() => setSelectedTrack(track.id)}>
        <div className={styles.editor} data-track-row-editor>
          <TrackEditor track={track} focused={focused} />
        </div>
        <div className={styles.lane}>
          <MarkerEditor track={track} focused={focused} />
        </div>
        {focused && (
          <div className={styles.delete}>
            <div className={styles.deleteHandle} aria-hidden="true" />
            <button
              type="button"
              className={cx(controls.btn, styles.deleteBtn)}
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
        <div className={styles.sequencer}>
          <div className={styles.sequencerGutter} aria-hidden="true" />
          <div className={styles.sequencerBody}>
            <StepSequencerPanel />
          </div>
        </div>
      )}
    </div>
  );
}
