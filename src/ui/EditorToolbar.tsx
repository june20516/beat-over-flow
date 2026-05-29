import { GridFour, MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut, MusicNotes } from "@phosphor-icons/react";
import controls from "./controls.module.css";
import styles from "./EditorToolbar.module.css";
import { cx } from "./cx";
import { useEditorUi } from "../store/editorUi";
import { useViewport } from "../store/viewport";
import { useAssetLibrary } from "../store/assetLibrary";

export function EditorToolbar() {
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const toggleSequencer = useEditorUi((s) => s.toggleSequencer);
  const zoomByAtCenter = useViewport((s) => s.zoomByAtCenter);
  const fitAll = useViewport((s) => s.fitAll);
  const openManage = useAssetLibrary((s) => s.openManage);
  return (
    <div className={styles.editorToolbar}>
      <button type="button" className={cx(controls.btn, controls.btnGhost, sequencerOpen && styles.isActive)} aria-pressed={sequencerOpen} onClick={toggleSequencer} title="스텝 시퀀서 열기/닫기">
        <GridFour size={15} weight="bold" />시퀀서
      </button>
      <button
        type="button"
        className={cx(controls.btn, controls.btnGhost)}
        onClick={openManage}
        aria-haspopup="dialog"
        title="샘플 보기 / 관리"
      >
        <MusicNotes size={15} weight="bold" />샘플
      </button>
      <span className={styles.editorToolbarSep} />
      <button type="button" className={cx(controls.btn, controls.btnGhost, controls.btnIcon)} onClick={() => zoomByAtCenter(1.4)} title="확대">
        <MagnifyingGlassPlus size={15} weight="bold" />
      </button>
      <button type="button" className={cx(controls.btn, controls.btnGhost, controls.btnIcon)} onClick={() => zoomByAtCenter(1 / 1.4)} title="축소">
        <MagnifyingGlassMinus size={15} weight="bold" />
      </button>
      <button type="button" className={cx(controls.btn, controls.btnGhost)} onClick={fitAll} title="전체 보기(맞춤)">
        <CornersOut size={15} weight="bold" />맞춤
      </button>
    </div>
  );
}
