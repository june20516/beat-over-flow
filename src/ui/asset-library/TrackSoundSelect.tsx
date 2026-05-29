import { Lock } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { DropdownSelect } from "../primitives/DropdownSelect";
import { BUILTIN_SAMPLES } from "../../audio/builtinSamples";
import { listAssetsByIds } from "../../persistence/assets";
import type { SoundRef } from "../../types";
import styles from "./TrackSoundSelect.module.css";

interface Props {
  /** 호출자 식별용(현재는 렌더에 사용하지 않지만 onChange/onOpenLibrary 클로저에 어떤 트랙인지 명시 가능). */
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
  const uploadIds = recentSounds
    .filter((s): s is Extract<SoundRef, { kind: "upload" }> => s.kind === "upload")
    .map((s) => s.assetId);
  const [names, setNames] = useState<Record<string, string>>({});

  // 동일 id 셋이면 reference만 새로 만들어도 effect 재실행을 피하도록 key 안정화.
  const idsKey = uploadIds.join("|");
  useEffect(() => {
    let cancelled = false;
    if (idsKey === "") {
      setNames({});
      return;
    }
    listAssetsByIds(idsKey.split("|"))
      .then((xs) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const a of xs) map[a.id] = a.name;
        setNames(map);
      })
      .catch((e) => console.error("[TrackSoundSelect] listAssetsByIds failed", e));
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  function labelOf(s: SoundRef): { text: string; locked: boolean } {
    return s.kind === "builtin"
      ? { text: builtinLabel(s.sampleId), locked: true }
      : { text: names[s.assetId] ?? "...", locked: false };
  }

  const triggerLabel = labelOf(sound);

  return (
    <DropdownSelect
      triggerLabel={triggerLabel.text}
      triggerTitle={triggerLabel.text}
      ariaLabel={`사운드 선택: ${triggerLabel.text}`}
      triggerClassName={styles.trigger}
    >
      {recentSounds.map((s) => {
        const l = labelOf(s);
        // SoundRef 리터럴은 코드베이스 전반에서 키 순서가 고정돼 있어 stringify 비교가 안전.
        // 향후 SoundRef에 선택적 필드가 추가되면 이 비교를 재검토해야 한다.
        const isCurrent = JSON.stringify(s) === JSON.stringify(sound);
        return (
          <DropdownSelect.Item
            key={refKey(s)}
            selected={isCurrent}
            icon={l.locked ? <Lock size={11} weight="bold" /> : null}
            label={l.text}
            title={l.text}
            onSelect={() => onChange(s)}
          />
        );
      })}
      <DropdownSelect.Separator />
      <DropdownSelect.Action onSelect={onOpenLibrary}>전체 보기...</DropdownSelect.Action>
    </DropdownSelect>
  );
}
