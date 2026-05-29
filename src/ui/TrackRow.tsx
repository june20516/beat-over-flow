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
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const pulseEvent = usePulse((s) => s.events[track.id]);
  const mode = useStore((s) => s.mode);
  const showSequencer =
    focused && sequencerOpen && resolveTrackBehavior(mode, track.status) === "record";

  // 오버레이는 nonce를 key로 매번 remount되므로, 연타 시 호출 횟수만큼
  // 별도 애니메이션이 시작된다. source에 따라 색을 다르게 입힌다.
  const rowClass = cx(
    styles.trackRow,
    focused && styles.focused,
    index % 2 === 0 ? styles.even : styles.odd,
  );

  return (
    <div data-track-row>
      <div className={rowClass} onClick={() => setSelectedTrack(track.id)}>
        {pulseEvent && (
          <span
            key={pulseEvent.nonce}
            className={cx(
              styles.pulseOverlay,
              pulseEvent.source === "auto" ? styles.pulseAuto : styles.pulseKey,
            )}
            aria-hidden="true"
          />
        )}
        <div className={styles.editor} data-track-row-editor>
          <TrackEditor track={track} focused={focused} />
        </div>
        <div className={styles.lane}>
          <MarkerEditor track={track} focused={focused} />
        </div>
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
