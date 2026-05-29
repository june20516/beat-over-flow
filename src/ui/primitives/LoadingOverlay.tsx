import * as Dialog from "@radix-ui/react-dialog";
import { useLoadingOverlay } from "../../store/loadingOverlay";
import styles from "./LoadingOverlay.module.css";

export function LoadingOverlay() {
  const { open, mode, progress, label } = useLoadingOverlay();
  const pct = mode === "determinate" ? Math.round((progress ?? 0) * 100) : null;
  return (
    <Dialog.Root open={open} onOpenChange={() => { /* blocking — 무시 */ }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Dialog.Title className={styles.srOnly}>로딩 중</Dialog.Title>
          <Dialog.Description className={styles.srOnly}>{label ?? "처리 중..."}</Dialog.Description>
          {mode === "determinate" ? (
            <div className={styles.bar} role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.barFill} style={{ width: `${pct}%` }} />
              <div className={styles.barText}>{pct}%</div>
            </div>
          ) : (
            <div className={styles.spinner} aria-hidden="true" />
          )}
          {label && <div className={styles.label}>{label}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
