import { GridFour, MagnifyingGlassMinus } from "@phosphor-icons/react";
import { useEditorUi } from "../store/editorUi";
import { useViewport } from "../store/viewport";

export function EditorToolbar() {
  const sequencerOpen = useEditorUi((s) => s.sequencerOpen);
  const toggleSequencer = useEditorUi((s) => s.toggleSequencer);
  const fitAll = useViewport((s) => s.fitAll);

  return (
    <div className="editor-toolbar">
      <button
        type="button"
        className={"btn--ghost" + (sequencerOpen ? " is-active" : "")}
        aria-pressed={sequencerOpen}
        onClick={toggleSequencer}
        title="스텝 시퀀서 열기/닫기"
      >
        <GridFour size={15} weight="bold" />
        시퀀서
      </button>
      <button type="button" className="btn--ghost" onClick={fitAll} title="줌 리셋(전체 보기)">
        <MagnifyingGlassMinus size={15} weight="bold" />
        줌 리셋
      </button>
    </div>
  );
}
