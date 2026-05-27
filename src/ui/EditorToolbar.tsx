import { GridFour, MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut } from "@phosphor-icons/react";
import { useEditorUi } from "../store/editorUi";
import { useViewport } from "../store/viewport";

export function EditorToolbar() {
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const toggleSequencer = useEditorUi((s) => s.toggleSequencer);
  const zoomByAtCenter = useViewport((s) => s.zoomByAtCenter);
  const fitAll = useViewport((s) => s.fitAll);
  return (
    <div className="editor-toolbar">
      <button type="button" className={"btn--ghost" + (sequencerOpen ? " is-active" : "")} aria-pressed={sequencerOpen} onClick={toggleSequencer} title="스텝 시퀀서 열기/닫기">
        <GridFour size={15} weight="bold" />시퀀서
      </button>
      <span className="editor-toolbar__sep" />
      <button type="button" className="btn--ghost btn--icon" onClick={() => zoomByAtCenter(1.4)} title="확대">
        <MagnifyingGlassPlus size={15} weight="bold" />
      </button>
      <button type="button" className="btn--ghost btn--icon" onClick={() => zoomByAtCenter(1 / 1.4)} title="축소">
        <MagnifyingGlassMinus size={15} weight="bold" />
      </button>
      <button type="button" className="btn--ghost" onClick={fitAll} title="전체 보기(맞춤)">
        <CornersOut size={15} weight="bold" />맞춤
      </button>
    </div>
  );
}
