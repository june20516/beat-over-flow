import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, Lock } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cx } from "../cx";
import { BUILTIN_SAMPLES } from "../../audio/builtinSamples";
import { listAssetsByIds } from "../../persistence/assets";
import type { SoundRef } from "../../types";
import styles from "./TrackSoundSelect.module.css";

interface Props {
  trackId: string;
  sound: SoundRef;
  recentSounds: SoundRef[];
  onChange(next: SoundRef): void;
  onOpenLibrary(): void;
}

function builtinLabel(id: string): string {
  return BUILTIN_SAMPLES.find((b) => b.id === id)?.label ?? id;
}

export function TrackSoundSelect({ sound, recentSounds, onChange, onOpenLibrary }: Props) {
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
      <DropdownMenu.Trigger className={styles.trigger} aria-label="사운드 선택" title={triggerLabel.text}>
        {triggerLabel.locked && <Lock size={11} weight="bold" />}
        <span className={styles.triggerLabel}>{triggerLabel.text}</span>
        <CaretDown size={11} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} sideOffset={4}>
          {recentSounds.map((s, i) => {
            const l = labelOf(s);
            const isCurrent = JSON.stringify(s) === JSON.stringify(sound);
            return (
              <DropdownMenu.Item
                key={i}
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
