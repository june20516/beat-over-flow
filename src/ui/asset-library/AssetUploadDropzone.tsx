import { useRef, useState, type DragEvent, type ChangeEvent, type ReactNode } from "react";
import { Plus } from "@phosphor-icons/react";
import styles from "./AssetUploadDropzone.module.css";

interface ZoneProps {
  onFiles(files: File[]): void;
  children: ReactNode;
}

/**
 * 영역 위에 파일을 드롭하면 onFiles를 호출한다. 자체 버튼은 노출하지 않는다 —
 * "업로드" 버튼은 호출자가 원하는 위치(예: 섹션 헤더 우측)에 <AssetUploadButton>로 배치한다.
 */
export function AssetUploadDropzone({ onFiles, children }: ZoneProps) {
  const [dragging, setDragging] = useState(false);

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    // 자식 요소로 진입할 때 dragLeave가 발화하므로, 진짜 zone 밖으로 나갈 때만 끈다.
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragging(false);
    }
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div className={styles.zone} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {children}
      {dragging && <div className={styles.dropOverlay}>여기에 드롭하여 업로드</div>}
    </div>
  );
}

interface ButtonProps {
  onFiles(files: File[]): void;
}

/** 파일 선택 다이얼로그 트리거 버튼. <AssetUploadDropzone>과 동일 onFiles 핸들러를 공유한다. */
export function AssetUploadButton({ onFiles }: ButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="audio/*" multiple hidden onChange={onChange} />
      <button
        type="button"
        className={styles.uploadBtn}
        onClick={() => inputRef.current?.click()}
      >
        <Plus size={12} weight="bold" /> 업로드
      </button>
    </>
  );
}
