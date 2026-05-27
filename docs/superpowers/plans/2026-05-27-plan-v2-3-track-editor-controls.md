# [Track Editor Controls] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v2 Editor의 `TrackEditor`(계획 2에서 생성된) 안의 컨트롤을 고도화한다 — 키코드 표시 변환 순수함수(`formatKeyCode`), 키 캡처 버튼(`KeyCap`), 상태 2×2 그리드(`StatusGrid`), 볼륨 팝오버(`VolumeControl`), 그리고 스토어 액션 `clearMarkers` + "마커 전체 비우기" 버튼. 요구 1·2·3·7을 충족한다.

**Architecture:** 공유 계약 문서 `docs/superpowers/plans/2026-05-27-v2-contracts.md`를 단일 기준으로 한다. 순수 로직(`formatKeyCode`)과 스토어 액션(`clearMarkers`)은 React에서 분리해 진짜 TDD(실패테스트→확인→구현→통과)로 구현한다. 시각 컴포넌트(`KeyCap`/`StatusGrid`/`VolumeControl`)는 계약 §8의 props 시그니처를 정확히 따르고, 팝오버/그리드의 시각은 헤드리스 Chrome 스크린샷으로 검증하거나(무인 시) `IMPLEMENTATION_NOTES.md`에 "사람 검증 필요"로 기록한다. 계획 2의 `TrackEditor`가 이미 존재한다고 가정하며, 그 안의 상태 `<select>`·볼륨 `range`·키 버튼을 새 컴포넌트로 교체하고 마커 비우기 버튼을 추가한다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest, @phosphor-icons/react

---

## 사전 컨텍스트 (구현 전 반드시 확인)

- **계약 §3** 스토어 액션:
  ```ts
  clearMarkers: (trackId: string) => void; // 해당 트랙 markers=[]
  ```
  - 기존 `mutate` 헬퍼로 `project` 단일 전이 + `updatedAt` 갱신(autosave가 영속). 단일 `set` 전이여야 함(undo 1스텝 규약).
- **계약 §7** `formatKeyCode(code: string | null): string` 규칙 전부:
  - `null` 또는 `""` → `"Key"`
  - `"KeyA"`..`"KeyZ"` → `"A"`..`"Z"` (마지막 글자)
  - `"Digit0".."Digit9"` → `"0".."9"`
  - `"Numpad0".."Numpad9"` → `"0".."9"`
  - `"Space"` → `"Space"`
  - `"ArrowLeft"/Right/Up/Down` → `"←"/"→"/"↑"/"↓"`
  - `"Escape"` → `"Esc"`, `"Enter"` → `"Enter"`
  - 그 외 → `code` 원문
- **계약 §8** props 시그니처(정확히 일치, any 지양):
  ```ts
  interface StatusGridProps { value: TrackStatus; onChange: (s: TrackStatus) => void; }
  interface VolumeControlProps { value: number; onChange: (v: number) => void; }
  interface KeyCapProps { code: string | null; onCapture: (code: string) => void; }
  ```
- **상태 라벨/색(계약 §8, 스펙 8절):** M=뮤트(`#6b7280`) / L=리스닝(`#22d3ee`) / P=플레이(`#4ade80`) / W=라이트(`#ec4899`). `TrackStatus = "mute" | "listening" | "play" | "write"`.
- **기존 패턴:**
  - `src/store/useStore.ts`: `mutate(s, fn)` + `mapTrack(tracks, id, fn)` 헬퍼 존재. 액션은 인터페이스 `StoreState`에 시그니처 추가 후 객체에 구현.
  - `src/ui/TransportBar.tsx`: range-fill 패턴 — `className="range-fill"` + `style={{ "--pct": "<n>%" }}`. `src/ui/styles.css`의 `input[type="range"].range-fill`는 가로 그라데이션. 세로는 CSS로 회전/`writing-mode` 적용.
  - `src/audio/builtinSamples.ts`: `BUILTIN_SAMPLES` 배열, 사운드 select에서 사용(이 계획에서는 변경 없음).
  - 키 저장값은 `e.code`(예: `"KeyA"`). `KeyCap.onCapture(code)`는 `e.code`를 그대로 전달.

---

## Task 1 — `formatKeyCode` 순수함수 (TDD, 요구 3)

**Files:**
- `src/domain/formatKeyCode.test.ts` (신규)
- `src/domain/formatKeyCode.ts` (신규)

- [ ] **실패 테스트 작성.** `src/domain/formatKeyCode.test.ts`를 작성한다. 계약 §7의 모든 케이스를 개별 테스트한다.
  ```ts
  import { describe, expect, it } from "vitest";
  import { formatKeyCode } from "./formatKeyCode";

  describe("formatKeyCode", () => {
    it("null이면 'Key'", () => {
      expect(formatKeyCode(null)).toBe("Key");
    });
    it("빈 문자열이면 'Key'", () => {
      expect(formatKeyCode("")).toBe("Key");
    });
    it("KeyA → 'A'", () => {
      expect(formatKeyCode("KeyA")).toBe("A");
    });
    it("KeyZ → 'Z'", () => {
      expect(formatKeyCode("KeyZ")).toBe("Z");
    });
    it("Digit0 → '0'", () => {
      expect(formatKeyCode("Digit0")).toBe("0");
    });
    it("Digit9 → '9'", () => {
      expect(formatKeyCode("Digit9")).toBe("9");
    });
    it("Numpad0 → '0'", () => {
      expect(formatKeyCode("Numpad0")).toBe("0");
    });
    it("Numpad9 → '9'", () => {
      expect(formatKeyCode("Numpad9")).toBe("9");
    });
    it("Space → 'Space'", () => {
      expect(formatKeyCode("Space")).toBe("Space");
    });
    it("ArrowLeft → '←'", () => {
      expect(formatKeyCode("ArrowLeft")).toBe("←");
    });
    it("ArrowRight → '→'", () => {
      expect(formatKeyCode("ArrowRight")).toBe("→");
    });
    it("ArrowUp → '↑'", () => {
      expect(formatKeyCode("ArrowUp")).toBe("↑");
    });
    it("ArrowDown → '↓'", () => {
      expect(formatKeyCode("ArrowDown")).toBe("↓");
    });
    it("Escape → 'Esc'", () => {
      expect(formatKeyCode("Escape")).toBe("Esc");
    });
    it("Enter → 'Enter'", () => {
      expect(formatKeyCode("Enter")).toBe("Enter");
    });
    it("그 외 코드는 원문 그대로", () => {
      expect(formatKeyCode("F5")).toBe("F5");
      expect(formatKeyCode("Tab")).toBe("Tab");
    });
  });
  ```
- [ ] **실패 확인.** `yarn vitest run src/domain/formatKeyCode.test.ts` 실행 → 모듈 미존재/함수 미존재로 실패하는 것을 확인한다(레드 단계 증거 확보).
- [ ] **구현.** `src/domain/formatKeyCode.ts`를 작성한다.
  ```ts
  const ARROWS: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
  };

  /**
   * 키보드 e.code를 사람이 읽을 표시 문자열로 변환한다 (순수함수).
   * 규칙은 v2-contracts.md §7 참조.
   */
  export function formatKeyCode(code: string | null): string {
    if (!code) return "Key";
    if (/^Key[A-Z]$/.test(code)) return code.slice(-1);
    if (/^Digit[0-9]$/.test(code)) return code.slice(-1);
    if (/^Numpad[0-9]$/.test(code)) return code.slice(-1);
    if (code === "Space") return "Space";
    if (code in ARROWS) return ARROWS[code];
    if (code === "Escape") return "Esc";
    if (code === "Enter") return "Enter";
    return code;
  }
  ```
- [ ] **통과 확인.** `yarn vitest run src/domain/formatKeyCode.test.ts` → 전체 그린.
- [ ] **Task 검증.** `yarn test:run && yarn tsc -b` 둘 다 통과 확인.
- [ ] **커밋.**
  ```
  feat(domain): formatKeyCode 키코드 표시 변환 (요구 3)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## Task 2 — `clearMarkers` 스토어 액션 (TDD, 요구 7)

**Files:**
- `src/store/useStore.test.ts` (신규 또는 기존에 추가)
- `src/store/useStore.ts` (수정)

- [ ] **실패 테스트 작성.** `src/store/useStore.test.ts`에 `clearMarkers` 테스트를 추가한다(파일이 없으면 신규 생성). 호출 후 ① 해당 트랙 `markers=[]`, ② 다른 트랙 markers 불변, ③ `project.updatedAt` 갱신, ④ 단일 전이(액션 1회 호출)임을 검증한다.
  ```ts
  import { beforeEach, describe, expect, it } from "vitest";
  import { useStore } from "./useStore";
  import type { Project } from "../types";

  function makeProject(): Project {
    return {
      id: "p1",
      name: "테스트",
      createdAt: 1000,
      updatedAt: 1000,
      baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 60000 },
      master: { volume: 1 },
      tracks: [
        {
          id: "t1",
          name: "트랙 1",
          status: "write",
          sound: { kind: "builtin", sampleId: "kick" },
          keyBinding: null,
          markers: [
            { id: "m1", timeMs: 100 },
            { id: "m2", timeMs: 200 },
          ],
          volume: 1,
          color: "#fff",
        },
        {
          id: "t2",
          name: "트랙 2",
          status: "play",
          sound: { kind: "builtin", sampleId: "snare" },
          keyBinding: null,
          markers: [{ id: "m3", timeMs: 300 }],
          volume: 1,
          color: "#000",
        },
      ],
    };
  }

  describe("clearMarkers", () => {
    beforeEach(() => {
      useStore.setState({ project: makeProject() });
    });

    it("해당 트랙의 markers를 빈 배열로 만든다", () => {
      useStore.getState().clearMarkers("t1");
      const t1 = useStore.getState().project!.tracks.find((t) => t.id === "t1")!;
      expect(t1.markers).toEqual([]);
    });

    it("다른 트랙의 markers는 그대로 둔다", () => {
      useStore.getState().clearMarkers("t1");
      const t2 = useStore.getState().project!.tracks.find((t) => t.id === "t2")!;
      expect(t2.markers).toHaveLength(1);
    });

    it("project.updatedAt을 갱신한다", () => {
      const before = useStore.getState().project!.updatedAt;
      useStore.getState().clearMarkers("t1");
      expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(before);
      expect(useStore.getState().project!.updatedAt).not.toBe(1000);
    });

    it("project가 null이면 아무 일도 하지 않는다", () => {
      useStore.setState({ project: null });
      expect(() => useStore.getState().clearMarkers("t1")).not.toThrow();
      expect(useStore.getState().project).toBeNull();
    });
  });
  ```
- [ ] **실패 확인.** `yarn vitest run src/store/useStore.test.ts` → `clearMarkers`가 `StoreState`에 없어 타입/런타임 실패 확인.
- [ ] **인터페이스에 시그니처 추가.** `src/store/useStore.ts`의 `StoreState` 인터페이스에서 `removeMarker` 줄 다음에 추가한다.
  ```ts
  clearMarkers: (trackId: string) => void;
  ```
- [ ] **구현 추가.** `useStore` 객체에서 `removeMarker` 구현 다음에 추가한다(기존 `mutate`+`mapTrack` 사용 → 단일 전이).
  ```ts
  clearMarkers: (trackId) =>
    set((s) => mutate(s, (tracks) => mapTrack(tracks, trackId, (t) => ({ ...t, markers: [] })))),
  ```
- [ ] **통과 확인.** `yarn vitest run src/store/useStore.test.ts` → 전체 그린.
- [ ] **Task 검증.** `yarn test:run && yarn tsc -b` 둘 다 통과 확인.
- [ ] **커밋.**
  ```
  feat(store): clearMarkers 액션 추가 (요구 7)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## Task 3 — `KeyCap` 컴포넌트 (요구 3)

**Files:**
- `src/ui/KeyCap.tsx` (신규)
- `src/ui/styles.css` (수정, 필요 시 — 기존 `.keycap` 재사용)

- [ ] **컴포넌트 작성.** `src/ui/KeyCap.tsx`. 계약 §8 `KeyCapProps`. 클릭하면 캡처모드로 진입하고, 다음 keydown의 `e.code`를 `onCapture`로 전달한 뒤 캡처모드를 종료한다. 표시는 `formatKeyCode(code)`. 미선택(`code` null)이면 `formatKeyCode`가 `"Key"`를 반환한다. 캡처 중에는 별도 표시(예: "…")를 보인다. 캡처 중 Escape도 e.code로 그대로 onCapture에 전달된다(키 변경 의도).
  ```tsx
  import { useState } from "react";
  import { formatKeyCode } from "../domain/formatKeyCode";

  interface KeyCapProps {
    code: string | null;
    onCapture: (code: string) => void;
  }

  export function KeyCap({ code, onCapture }: KeyCapProps) {
    const [capturing, setCapturing] = useState(false);

    function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
      e.preventDefault();
      e.stopPropagation();
      onCapture(e.code);
      setCapturing(false);
    }

    return (
      <button
        type="button"
        className={capturing ? "keycap keycap--capturing" : "keycap"}
        onKeyDown={capturing ? handleKeyDown : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setCapturing(true);
        }}
        onBlur={() => setCapturing(false)}
        title="클릭 후 키를 누르세요"
      >
        {capturing ? "…" : formatKeyCode(code)}
      </button>
    );
  }
  ```
- [ ] **스타일 확인.** `src/ui/styles.css`에 `.keycap` / `.keycap--capturing`이 이미 존재(기존 TrackHeader가 사용)하므로 추가 CSS 없이 재사용한다. 누락 시에만 기존 정의를 복원한다.
- [ ] **Task 검증.** `yarn test:run && yarn tsc -b` 둘 다 통과 확인.
- [ ] **커밋.**
  ```
  feat(ui): KeyCap 키 캡처 버튼 (요구 3)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## Task 4 — `StatusGrid` 컴포넌트 (요구 2)

**Files:**
- `src/ui/StatusGrid.tsx` (신규)
- `src/ui/styles.css` (수정 — 그리드/톤 스타일 추가)

- [ ] **컴포넌트 작성.** `src/ui/StatusGrid.tsx`. 계약 §8 `StatusGridProps`. M/L/P/W 단일문자 2×2 버튼. 각 톤 배경색(M=`#6b7280`, L=`#22d3ee`, P=`#4ade80`, W=`#ec4899`). 선택된 것은 배경 강조(실선 채움), 비선택은 흐림. `title`은 풀라벨(뮤트/리스닝/플레이/라이트). 클릭 시 `onChange(status)`.
  ```tsx
  import type { CSSProperties } from "react";
  import type { TrackStatus } from "../types";

  interface StatusGridProps {
    value: TrackStatus;
    onChange: (s: TrackStatus) => void;
  }

  interface StatusMeta {
    status: TrackStatus;
    letter: string;
    label: string;
    color: string;
  }

  const STATUS_META: StatusMeta[] = [
    { status: "mute", letter: "M", label: "뮤트", color: "#6b7280" },
    { status: "listening", letter: "L", label: "리스닝", color: "#22d3ee" },
    { status: "play", letter: "P", label: "플레이", color: "#4ade80" },
    { status: "write", letter: "W", label: "라이트", color: "#ec4899" },
  ];

  export function StatusGrid({ value, onChange }: StatusGridProps) {
    return (
      <div className="status-grid" role="group" aria-label="트랙 상태">
        {STATUS_META.map((m) => {
          const selected = m.status === value;
          return (
            <button
              key={m.status}
              type="button"
              className={selected ? "status-grid__cell status-grid__cell--on" : "status-grid__cell"}
              style={{ "--tone": m.color } as CSSProperties}
              title={m.label}
              aria-pressed={selected}
              onClick={(e) => {
                e.stopPropagation();
                onChange(m.status);
              }}
            >
              {m.letter}
            </button>
          );
        })}
      </div>
    );
  }
  ```
- [ ] **스타일 추가.** `src/ui/styles.css`에 `.track-row select` 인근(에디터 섹션)에 추가한다. 2×2 그리드 + 톤 배경.
  ```css
  /* 상태 2×2 그리드 (요구 2) */
  .status-grid {
    flex: none;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2px;
  }
  .status-grid__cell {
    width: 18px;
    height: 16px;
    padding: 0;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    border: 1px solid var(--tone);
    border-radius: 4px;
    color: var(--tone);
    background: transparent;
    cursor: pointer;
  }
  .status-grid__cell--on {
    color: #0a0a0a;
    background: var(--tone);
  }
  ```
- [ ] **Task 검증.** `yarn test:run && yarn tsc -b` 둘 다 통과 확인.
- [ ] **커밋.**
  ```
  feat(ui): StatusGrid 상태 2×2 그리드 (요구 2)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## Task 5 — `VolumeControl` 컴포넌트 (요구 1)

**Files:**
- `src/ui/VolumeControl.tsx` (신규)
- `src/ui/styles.css` (수정 — 팝오버/세로 range 스타일 추가)

- [ ] **컴포넌트 작성.** `src/ui/VolumeControl.tsx`. 계약 §8 `VolumeControlProps`. 스피커 아이콘(`@phosphor-icons/react`의 `SpeakerHigh`) 버튼 → 클릭 시 세로 range 팝오버(`position: absolute`)를 토글한다. 팝오버는 ① 바깥 클릭(`mousedown` 문서 리스너) ② Escape 키로 닫힌다. range는 `range-fill` 클래스 + `--pct`로 채움을 표시한다(세로는 CSS로 회전). 컨테이너는 `position: relative`, 팝오버는 `stopPropagation`으로 트랙 행 클릭 전파 차단.
  ```tsx
  import { useEffect, useRef, useState, type CSSProperties } from "react";
  import { SpeakerHigh } from "@phosphor-icons/react";

  interface VolumeControlProps {
    value: number;
    onChange: (v: number) => void;
  }

  export function VolumeControl({ value, onChange }: VolumeControlProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open) return;
      function onDocMouseDown(e: MouseEvent) {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      }
      document.addEventListener("mousedown", onDocMouseDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onDocMouseDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [open]);

    return (
      <div className="volume-control" ref={rootRef}>
        <button
          type="button"
          className="btn--icon volume-control__trigger"
          title={`볼륨 ${Math.round(value * 100)}%`}
          aria-label="볼륨"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <SpeakerHigh size={16} />
        </button>
        {open && (
          <div className="volume-control__popover" onClick={(e) => e.stopPropagation()}>
            <input
              className="range-fill volume-control__range"
              style={{ "--pct": `${value * 100}%` } as CSSProperties}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          </div>
        )}
      </div>
    );
  }
  ```
- [ ] **스타일 추가.** `src/ui/styles.css`에 추가한다. 세로 range는 회전으로 구현하고, `range-fill`의 `--pct`가 채움 방향과 일치하도록 설정한다.
  ```css
  /* 볼륨 팝오버 (요구 1) */
  .volume-control {
    position: relative;
    flex: none;
    display: inline-flex;
  }
  .volume-control__popover {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    padding: 14px 10px;
    background: var(--bg-elev-2);
    border: 1px solid var(--line-strong);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  /* 세로 range: 가로 슬라이더를 회전해 세로로 배치 */
  .volume-control__range {
    width: 96px;
    transform: rotate(-90deg);
    transform-origin: center;
  }
  ```
  > 주의: 회전 방식은 부모 폭/높이 계산이 까다로울 수 있다. `writing-mode: vertical-lr; direction: rtl;` 방식이 더 깔끔하면 대체하되, `range-fill`의 `--pct` 채움 방향(아래=0, 위=100%)이 시각적으로 맞는지 브라우저 검증 스텝에서 확인한다.
- [ ] **Task 검증.** `yarn test:run && yarn tsc -b` 둘 다 통과 확인.
- [ ] **커밋.**
  ```
  feat(ui): VolumeControl 세로 range 팝오버 (요구 1)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## Task 6 — `TrackEditor` 통합 + 마커 비우기 버튼 (요구 1·2·3·7)

**Files:**
- `src/ui/TrackEditor.tsx` (수정 — 계획 2 산출물)

- [ ] **현 상태 파악.** `src/ui/TrackEditor.tsx`를 읽어 ① 상태 `<select>` ② 볼륨 `<input type="range">` ③ 키 캡처 버튼이 어디에 있는지 확인한다. (계획 2가 `TrackHeader`의 컨트롤을 그대로 옮겼다면 동일 구조다.)
- [ ] **임포트 추가.** `TrackEditor.tsx` 상단에 추가한다(불필요해진 임포트는 제거).
  ```tsx
  import { Trash } from "@phosphor-icons/react";
  import { StatusGrid } from "./StatusGrid";
  import { VolumeControl } from "./VolumeControl";
  import { KeyCap } from "./KeyCap";
  ```
- [ ] **스토어 액션 바인딩.** 컴포넌트 내부에서 필요한 액션을 구독한다(이미 있으면 재사용).
  ```tsx
  const setTrackStatus = useStore((s) => s.setTrackStatus);
  const setTrackVolume = useStore((s) => s.setTrackVolume);
  const setTrackKeyBinding = useStore((s) => s.setTrackKeyBinding);
  const clearMarkers = useStore((s) => s.clearMarkers);
  const removeTrack = useStore((s) => s.removeTrack);
  ```
- [ ] **상태 select 교체.** 기존 상태 `<select>`(또는 `STATUSES.map(...)` 블록)를 다음으로 대체한다.
  ```tsx
  <StatusGrid value={track.status} onChange={(s) => setTrackStatus(track.id, s)} />
  ```
  관련 로컬 상수(`STATUSES`, `STATUS_LABEL`)가 더 이상 쓰이지 않으면 제거한다.
- [ ] **키 버튼 교체.** 기존 키 캡처 버튼(로컬 `capturing` state + `onKeyCapture` 포함)을 다음으로 대체한다. 키 저장값은 `e.code` 원문이므로 `onCapture`가 받은 `code`를 그대로 `setTrackKeyBinding`에 넘긴다.
  ```tsx
  <KeyCap code={track.keyBinding} onCapture={(code) => setTrackKeyBinding(track.id, code)} />
  ```
  쓰이지 않게 된 로컬 `capturing` state·`onKeyCapture` 핸들러는 제거한다.
- [ ] **볼륨 range 교체.** 기존 볼륨 `<input type="range" className="range-fill">`을 다음으로 대체한다.
  ```tsx
  <VolumeControl value={track.volume} onChange={(v) => setTrackVolume(track.id, v)} />
  ```
- [ ] **마커 비우기 버튼 추가.** 삭제 버튼 앞에 "마커 전체 비우기" 버튼을 추가한다. 트랙 행 클릭 전파를 막는다.
  ```tsx
  <button
    type="button"
    className="btn--icon track-editor__clear"
    title="마커 전체 비우기"
    onClick={(e) => {
      e.stopPropagation();
      clearMarkers(track.id);
    }}
  >
    <Trash size={14} />
  </button>
  ```
- [ ] **스타일(선택).** 필요 시 `src/ui/styles.css`에 `.track-editor__clear`를 추가(없어도 `btn--icon` 재사용으로 동작). 아이콘 버튼 톤만 맞추면 충분.
- [ ] **Task 검증.** `yarn test:run && yarn tsc -b` 둘 다 통과 확인.
- [ ] **커밋.**
  ```
  feat(ui): TrackEditor에 StatusGrid/KeyCap/VolumeControl/마커비우기 통합 (요구 1·2·3·7)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## Task 7 — 브라우저 시각 검증 (요구 1·2·3·7)

단위테스트로 못 잡는 시각 요소(2×2 그리드 톤/선택 강조, 볼륨 팝오버의 세로 range 채움·클릭아웃/Esc 닫힘, 키캡 표시)를 검증한다.

**Files:**
- `IMPLEMENTATION_NOTES.md` (무인 실행 시 신규/추가)

- [ ] **개발 서버 기동.** `yarn dev`로 Vite 서버를 띄운다(백그라운드).
- [ ] **헤드리스 Chrome 검증.** `/tmp/bof-driver` 헤드리스 Chrome 드라이버로 Editor를 연다. 트랙을 하나 추가하고 다음을 스크린샷으로 확인한다.
  - StatusGrid: M/L/P/W 4칸이 2×2로 보이고, 현재 상태 칸만 톤 배경으로 강조된다. 각 칸 hover/`title`이 풀라벨(뮤트/리스닝/플레이/라이트).
  - KeyCap: 미설정 시 "Key" 표시. 클릭→"…"→키 입력 후 `formatKeyCode` 결과(예: A, ←, Space) 표시.
  - VolumeControl: 스피커 클릭→세로 range 팝오버 표시, range-fill 채움이 값과 일치(아래=0). 바깥 클릭/Escape로 닫힘.
  - 마커 비우기: 마커 있는 트랙에서 버튼 클릭→마커가 모두 사라짐.
- [ ] **무인 실행 분기.** 헤드리스 드라이버를 쓸 수 없으면 `IMPLEMENTATION_NOTES.md`에 아래 항목을 "사람 검증 필요"로 기록한다. **성공을 꾸미지 않는다.**
  ```
  ## 사람 검증 필요 (계획 3 / Task 7)
  - StatusGrid 2×2 톤/선택 강조 시각 확인
  - VolumeControl 세로 range 채움 방향(아래=0, 위=100%) + 클릭아웃/Esc 닫힘
  - KeyCap 캡처 흐름(클릭→…→formatKeyCode 표시)
  - 마커 비우기 버튼 동작
  자동(헤드리스) 검증 미수행. 사유: <드라이버 부재/환경 제약 등 실제 사유 기재>
  ```
- [ ] **최종 검증.** `yarn test:run && yarn tsc -b` 둘 다 통과 확인.

---

## 완료 기준

- [ ] 요구 1(VolumeControl), 2(StatusGrid), 3(formatKeyCode+KeyCap), 7(clearMarkers+버튼) 전부 구현.
- [ ] `formatKeyCode`·`clearMarkers`는 진짜 TDD(레드→그린) 커밋 이력으로 증명.
- [ ] 모든 props 시그니처가 계약 §8과 정확히 일치(any 없음).
- [ ] 각 Task 종료 시 `yarn test:run && yarn tsc -b` 그린.
- [ ] 시각 요소는 헤드리스 검증 또는 `IMPLEMENTATION_NOTES.md` "사람 검증 필요" 기록.
