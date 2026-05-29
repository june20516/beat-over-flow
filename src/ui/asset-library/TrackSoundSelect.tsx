import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, Lock } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cx } from "../cx";
import { BUILTIN_SAMPLES } from "../../audio/builtinSamples";
import { listAssetsByIds } from "../../persistence/assets";
import type { SoundRef } from "../../types";
import styles from "./TrackSoundSelect.module.css";

interface Props {
  /** 호출자 식별용(현재는 렌더에서 사용하지 않지만, onChange/onOpenLibrary 측에서 어떤 트랙에 대한 호출인지 명시 가능). */
  trackId: string;
  sound: SoundRef;
  recentSounds: SoundRef[];
  onChange(next: SoundRef): void;
  onOpenLibrary(): void;
}

/** SoundRef의 안정적 React key. recentSounds 재정렬 시에도 동일 항목이 동일 키를 갖는다. */
function refKey(s: SoundRef): string {
  return s.kind === "builtin" ? `b:${s.sampleId}` : `u:${s.assetId}`;
}

function builtinLabel(id: string): string {
  return BUILTIN_SAMPLES.find((b) => b.id === id)?.label ?? id;
}

export function TrackSoundSelect({ sound, recentSounds, onChange, onOpenLibrary }: Props) {
  // trackId는 호출자 컨벤션에 따라 onChange/onOpenLibrary 클로저에 이미 박혀 있으므로
  // 컴포넌트 본문에서 직접 사용하지 않는다. props에는 명시적 식별 위해 유지.
  const uploadIds = recentSounds
    .filter((s): s is Extract<SoundRef, { kind: "upload" }> => s.kind === "upload")
    .map((s) => s.assetId);
  const [names, setNames] = useState<Record<string, string>>({});

  // 동일 id 셋이면 reference만 새로 만들어도 effect 재실행을 피하도록 key 안정화.
  const idsKey = uploadIds.join("|");
  useEffect(() => {
    let cancelled = false;
    if (idsKey === "") { setNames({}); return; }
    listAssetsByIds(idsKey.split("|"))
      .then((xs) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const a of xs) map[a.id] = a.name;
        setNames(map);
      })
      .catch((e) => console.error("[TrackSoundSelect] listAssetsByIds failed", e));
    return () => { cancelled = true; };
  }, [idsKey]);

  function labelOf(s: SoundRef): { text: string; locked: boolean } {
    return s.kind === "builtin"
      ? { text: builtinLabel(s.sampleId), locked: true }
      : { text: names[s.assetId] ?? "...", locked: false };
  }

  const triggerLabel = labelOf(sound);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={styles.trigger}
        aria-label={`사운드 선택: ${triggerLabel.text}`}
        title={triggerLabel.text}
      >
        <span className={styles.triggerLabel}>{triggerLabel.text}</span>
        <CaretDown size={11} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} sideOffset={4}>
          {recentSounds.map((s) => {
            const l = labelOf(s);
            // SoundRef 리터럴은 코드베이스 전반에서 키 순서가 고정돼 있어 stringify 비교가 안전.
            // 향후 SoundRef에 선택적 필드가 추가되면 이 비교를 재검토해야 한다.
            const isCurrent = JSON.stringify(s) === JSON.stringify(sound);
            return (
              <DropdownMenu.Item
                key={refKey(s)}
                className={cx(styles.item, isCurrent && styles.itemCurrent)}
                onSelect={() => onChange(s)}
                title={l.text}
              >
                {l.locked && <Lock size={11} weight="bold" />}
                <span className={styles.itemLabel}>{l.text}</span>
                {isCurrent && <span className={styles.currentMark}>●</span>}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className={styles.sep} />
          <DropdownMenu.Item className={cx(styles.item, styles.itemAction)} onSelect={onOpenLibrary}>
            전체 보기...
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
