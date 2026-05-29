import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { cx } from "../cx";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 빨강 톤 확인 버튼 — 되돌릴 수 없는 액션에 사용. */
  destructive?: boolean;
  onConfirm(): void;
}

/**
 * 단일 응답형 확인 다이얼로그. 정보 입력 없이 "확인/취소" 둘 중 하나만 받을 때 사용한다.
 * Modal primitive(size=sm) 위에 표준 footer 패턴을 얹은 thin wrapper.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title={title}>
      {description != null && (
        <Modal.Body>
          <div className={styles.description}>{description}</div>
        </Modal.Body>
      )}
      <Modal.Footer>
        <button type="button" className={cx(styles.btn, styles.cancel)} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={cx(styles.btn, destructive ? styles.destructive : styles.primary)}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          autoFocus
        >
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
