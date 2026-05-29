import { useRef, useState, type DragEvent, type ChangeEvent, type ReactNode } from "react";
import { Plus } from "@phosphor-icons/react";
import { cx } from "../cx";
import styles from "./AssetUploadDropzone.module.css";

interface Props {
  onFiles(files: File[]): void;
  children: ReactNode;
}

export function AssetUploadDropzone({ onFiles, children }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  }

  return (
    <div className={styles.zone} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={onChange}
      />
      <button
        type="button"
        className={styles.uploadBtn}
        onClick={() => inputRef.current?.click()}
      >
        <Plus size={14} weight="bold" /> 업로드
      </button>
      {children}
      {dragging && (
        <div className={cx(styles.dropOverlay)}>여기에 드롭하여 업로드</div>
      )}
    </div>
  );
}
