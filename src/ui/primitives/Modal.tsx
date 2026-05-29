import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { cx } from "../cx";
import styles from "./Modal.module.css";
import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg";

interface ModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  size?: Size;
  children: ReactNode;
}

export function Modal({ open, onOpenChange, title, description, size = "md", children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={cx(styles.content, styles[`size_${size}`])}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.closeBtn} aria-label="닫기">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </header>
          {description && <Dialog.Description className={styles.description}>{description}</Dialog.Description>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
function Footer({ children }: { children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}

Modal.Body = Body;
Modal.Footer = Footer;
