import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cx } from "../cx";
import styles from "./DropdownSelect.module.css";

interface RootProps {
  /** trigger에 표시할 라벨. 보통 현재 선택의 텍스트. */
  triggerLabel: ReactNode;
  /** 접근성용 aria-label. 보통 "<용도> 선택: <현재값>" 형태. */
  ariaLabel?: string;
  /** 호버 tooltip. 보통 currentLabel 그대로. */
  triggerTitle?: string;
  /** trigger 외부에서 폭/위치 제어용. 모듈 CSS의 클래스를 그대로 넘긴다. */
  triggerClassName?: string;
  /** Content(메뉴) 추가 클래스. min-width 등 도메인별 조정용. */
  contentClassName?: string;
  /** 메뉴 내용 — DropdownSelect.Item / Separator / Action 조합. */
  children: ReactNode;
}

/**
 * Radix DropdownMenu 기반 셀렉트 primitive.
 * - trigger: 현재 라벨 + 우측 caret.
 * - content: 사용자가 정의한 Item/Separator/Action 조합.
 * - 도메인 무지. 표시 라벨·아이콘은 호출자가 매핑한다.
 */
function Root({
  triggerLabel,
  ariaLabel,
  triggerTitle,
  triggerClassName,
  contentClassName,
  children,
}: RootProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cx(styles.trigger, triggerClassName)}
        aria-label={ariaLabel}
        title={triggerTitle}
      >
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <CaretDown size={11} weight="bold" className={styles.triggerCaret} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={cx(styles.menu, contentClassName)} sideOffset={4}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface ItemProps {
  onSelect(): void;
  /** 현재 선택 표식 — 굵기 + 우측 dot. */
  selected?: boolean;
  /** 좌측 아이콘(선택). */
  icon?: ReactNode;
  /** 우측 표식 커스텀. 미지정이면 selected일 때 기본 dot. */
  trailing?: ReactNode;
  label: ReactNode;
  /** 라벨 텍스트가 길어 잘릴 때 hover 툴팁용. */
  title?: string;
}

function Item({ onSelect, selected, icon, trailing, label, title }: ItemProps) {
  const computedTrailing = trailing ?? (selected ? <span className={styles.currentMark}>●</span> : null);
  return (
    <DropdownMenu.Item
      className={cx(styles.item, selected && styles.itemSelected)}
      onSelect={onSelect}
      title={title}
    >
      {icon != null && <span className={styles.itemIcon}>{icon}</span>}
      <span className={styles.itemLabel}>{label}</span>
      {computedTrailing}
    </DropdownMenu.Item>
  );
}

function Separator() {
  return <DropdownMenu.Separator className={styles.sep} />;
}

interface ActionProps {
  onSelect(): void;
  children: ReactNode;
}

/** Item과 다른 톤(보조 액션)으로 표시되는 항목. 예: "전체 보기...", "에셋 추가". */
function Action({ onSelect, children }: ActionProps) {
  return (
    <DropdownMenu.Item className={cx(styles.item, styles.itemAction)} onSelect={onSelect}>
      {children}
    </DropdownMenu.Item>
  );
}

export const DropdownSelect = Object.assign(Root, { Item, Separator, Action });
