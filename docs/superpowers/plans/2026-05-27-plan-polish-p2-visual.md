# [Polish P2 — Visual/Overlay: Portal·DragOverlay + Compact + Delete Affordance + Pulse] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폴리싱 #1(볼륨 팝오버 클리핑)·#2(언포커스 상태 한 글자)·#5(드래그 가시성)·#8(삭제 affordance)·#9(키 입력 트랙 펄스)를 구현한다.

**Architecture:** overflow:hidden 클리핑은 포털(volume 팝오버 `createPortal`, 트랙 드래그 dnd-kit `DragOverlay`)로 해소한다. 키 입력 시 트랙 시각 피드백은 휘발성 `usePulse`(트랙별 nonce) 스토어로 신호하고 `TrackRow`가 짧게 하이라이트한다. 언포커스 트랙은 StatusGrid compact(선택 글자 하나)로, 마커비우기/삭제는 포커스 행으로 옮기되 삭제는 행 우측 끝 핸들 hover 시 빨간 원형 버튼이 좌측 페이드인되는 오버레이로 demote한다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, @dnd-kit, vitest

**기준 문서:** `docs/superpowers/specs/2026-05-27-editor-v2-polish-design.md` (§3 D·F·G·H). 선행: P1(제스처) 완료 권장이나 독립 가능. 헤드리스 검증은 `public/samples/moodmode-demo.mp3`. any 금지.

---

## 파일 구조

```
src/
  store/
    pulse.ts (+test)        생성: usePulse (트랙별 nonce)
  ui/
    VolumeControl.tsx       수정: 팝오버 createPortal
    Timeline.tsx            수정: DndContext에 DragOverlay 추가
    StatusGrid.tsx          수정: compact prop
    TrackEditor.tsx         수정: compact 상태, 포커스 행에만 마커비우기, 인라인 삭제 제거
    TrackRow.tsx            수정: 삭제 affordance(핸들+hover 빨강원형) + 펄스 하이라이트
    styles.css              수정: 삭제 핸들/버튼, 펄스 애니메이션, compact 상태
  input/
    KeyboardController.ts   수정: triggerTrack에서 usePulse.pulse 호출
```

---

## Task 1: `usePulse` 스토어 (TDD) + KeyboardController 연동

**Files:** Create `src/store/pulse.ts`, `src/store/pulse.test.ts`; Modify `src/input/KeyboardController.ts`

- [ ] **RED** — `src/store/pulse.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { usePulse } from "./pulse";

describe("usePulse", () => {
  beforeEach(() => usePulse.setState({ nonce: {} }));

  it("pulse는 트랙 nonce를 증가시킨다", () => {
    usePulse.getState().pulse("t1");
    expect(usePulse.getState().nonce["t1"]).toBe(1);
    usePulse.getState().pulse("t1");
    expect(usePulse.getState().nonce["t1"]).toBe(2);
  });
  it("트랙별로 독립적이다", () => {
    usePulse.getState().pulse("t1");
    usePulse.getState().pulse("t2");
    expect(usePulse.getState().nonce["t1"]).toBe(1);
    expect(usePulse.getState().nonce["t2"]).toBe(1);
  });
  it("없던 트랙은 1부터 시작", () => {
    usePulse.getState().pulse("x");
    expect(usePulse.getState().nonce["x"]).toBe(1);
  });
});
```

- [ ] **확인(RED)** — `yarn vitest run src/store/pulse.test.ts` → 실패.

- [ ] **GREEN** — `src/store/pulse.ts`:
```ts
import { create } from "zustand";

interface PulseState {
  nonce: Record<string, number>;
  pulse: (trackId: string) => void;
}

/** 트랙 시각 피드백용 휘발성 신호. 키 트리거 시 nonce 증가 → 구독 컴포넌트가 짧게 하이라이트. */
export const usePulse = create<PulseState>((set) => ({
  nonce: {},
  pulse: (trackId) =>
    set((s) => ({ nonce: { ...s.nonce, [trackId]: (s.nonce[trackId] ?? 0) + 1 } })),
}));
```

- [ ] **확인(GREEN)** — `yarn vitest run src/store/pulse.test.ts` → PASS.

- [ ] **KeyboardController 연동** — `src/input/KeyboardController.ts`의 `triggerTrack` 함수 맨 위(또는 트리거 직후)에 펄스 신호 추가:
  - import: `import { usePulse } from "../store/pulse";`
  - `triggerTrack(track)` 본문 시작에 `usePulse.getState().pulse(track.id);` 추가(record/perform 공통, 키 입력 피드백).

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/store/pulse.ts src/store/pulse.test.ts src/input/KeyboardController.ts && git commit -m "$(cat <<'EOF'
feat(store): usePulse 트랙 프레스 신호 + KeyboardController 연동 (폴리싱 #9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: VolumeControl 팝오버 포털 (#1)

**Files:** Modify `src/ui/VolumeControl.tsx`

- [ ] **현 상태 파악** — `src/ui/VolumeControl.tsx`(현재 팝오버가 `.volume-control` 내부 absolute라 `.track-row*` overflow:hidden에 잘림).

- [ ] **수정** — 팝오버를 `createPortal(document.body)`로 띄우고 트리거 rect 기준 좌표(fixed)로 위치한다. 바깥클릭/Esc 닫힘 유지.
  - import 추가: `import { createPortal } from "react-dom";`
  - 트리거 버튼에 ref(`triggerRef`) 부착. 열릴 때 `triggerRef.current.getBoundingClientRect()`로 위치 계산해 state에 저장(스크롤/리사이즈 시 닫거나 재계산 — 간단히 `scroll`/`resize`에서 `setOpen(false)`).
  - 팝오버 마크업을 `createPortal(<div className="volume-control__popover" style={{position:"fixed", left: rect.left + rect.width/2, top: rect.top - 8, transform:"translate(-50%,-100%)", zIndex:50}} ...>...</div>, document.body)`로 감싼다.
  - 바깥클릭 판정: 문서 mousedown에서 트리거(rootRef)와 팝오버(popoverRef) 둘 다 contains 아니면 닫기(포털이므로 팝오버 ref 별도 필요).
  - range 입력/onChange/`--pct`/세로 회전 스타일은 유지.

  구현 골격:
  ```tsx
  import { useEffect, useRef, useState, type CSSProperties } from "react";
  import { createPortal } from "react-dom";
  import { SpeakerHigh } from "@phosphor-icons/react";

  export function VolumeControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);

    function openPopover() {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ left: r.left + r.width / 2, top: r.top - 8 });
      setOpen(true);
    }

    useEffect(() => {
      if (!open) return;
      function onDown(e: MouseEvent) {
        const t = e.target as Node;
        if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
        setOpen(false);
      }
      function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
      function onScrollResize() { setOpen(false); }
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      window.addEventListener("scroll", onScrollResize, true);
      window.addEventListener("resize", onScrollResize);
      return () => {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("scroll", onScrollResize, true);
        window.removeEventListener("resize", onScrollResize);
      };
    }, [open]);

    return (
      <div className="volume-control">
        <button ref={triggerRef} type="button" className="btn--icon volume-control__trigger"
          title={`볼륨 ${Math.round(value * 100)}%`} aria-label="볼륨"
          onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openPopover(); }}>
          <SpeakerHigh size={16} />
        </button>
        {open && pos && createPortal(
          <div ref={popoverRef} className="volume-control__popover"
            style={{ position: "fixed", left: pos.left, top: pos.top, transform: "translate(-50%, -100%)", zIndex: 50 } as CSSProperties}
            onClick={(e) => e.stopPropagation()}>
            <input className="range-fill volume-control__range"
              style={{ "--pct": `${value * 100}%` } as CSSProperties}
              type="range" min={0} max={1} step={0.01} value={value}
              onChange={(e) => onChange(Number(e.target.value))} />
          </div>,
          document.body,
        )}
      </div>
    );
  }
  ```
  - `.volume-control__popover`의 기존 `position:absolute; bottom/left/transform`은 인라인 fixed로 대체되므로, styles.css의 해당 위치 규칙은 충돌하지 않게 둔다(인라인이 우선). `.volume-control__range` 회전 스타일은 유지.

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/VolumeControl.tsx && git commit -m "$(cat <<'EOF'
fix(ui): VolumeControl 팝오버를 포털로 렌더해 클리핑 해소 (폴리싱 #1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 트랙 드래그 DragOverlay (#5)

**Files:** Modify `src/ui/Timeline.tsx`

- [ ] **현 상태 파악** — `src/ui/Timeline.tsx`의 `DndContext`/`SortableContext`. 현재 `useSortable`의 in-place transform이 `.track-row*` overflow:hidden에 잘림.

- [ ] **수정** — `DragOverlay`(포털)로 드래그 프리뷰를 띄운다.
  - import: `import { DragOverlay, type DragStartEvent } from "@dnd-kit/core";`
  - 활성 트랙 id state: `const [activeId, setActiveId] = useState<string | null>(null);`
  - `DndContext`에 `onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}`, `onDragEnd`에서 기존 reorder 후 `setActiveId(null)`, `onDragCancel={() => setActiveId(null)}`.
  - `</SortableContext>` 뒤(여전히 `DndContext` 안)에:
    ```tsx
    <DragOverlay>
      {activeId ? (() => {
        const t = tracks.find((x) => x.id === activeId);
        return t ? <div className="track-drag-overlay"><TrackEditor track={t} focused={false} /></div> : null;
      })() : null}
    </DragOverlay>
    ```
  - `TrackEditor`는 이미 import됨? 아니면 추가. (Timeline은 TrackRow만 import → `TrackEditor` import 추가.)
  - 주의: `TrackEditor` 내부의 `useSortable`는 동일 id로 오버레이에서도 호출되지만 dnd-kit는 오버레이 노드를 sortable로 등록하지 않게 처리됨. 만약 중복 id 경고가 나면, 오버레이용 경량 프리뷰(이름+색 막대만)로 대체:
    ```tsx
    <div className="track-drag-overlay" style={{ "--track-color": t.color } as CSSProperties}>{t.name}</div>
    ```
    (이 대안을 우선 채택해 useSortable 중복을 피한다 — 가벼운 고스트로 충분.)

  채택: **경량 고스트** 사용(useSortable 재호출 회피).
  ```tsx
  <DragOverlay>
    {activeId ? (() => {
      const t = tracks.find((x) => x.id === activeId);
      return t ? (
        <div className="track-drag-overlay" style={{ "--track-color": t.color } as CSSProperties}>
          {t.name}
        </div>
      ) : null;
    })() : null}
  </DragOverlay>
  ```

- [ ] **styles.css** — 파일 끝에:
```css
/* 트랙 드래그 고스트 (폴리싱 #5) */
.track-drag-overlay {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 14px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-elev-2);
  border-left: 4px solid var(--track-color, var(--purple));
  border-radius: var(--r-sm);
  box-shadow: var(--shadow);
  cursor: grabbing;
}
```

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/Timeline.tsx src/ui/styles.css && git commit -m "$(cat <<'EOF'
feat(ui): 트랙 드래그 DragOverlay 고스트로 클리핑 해소 (폴리싱 #5)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: StatusGrid compact + TrackEditor 포커스 분기 (#2, #8 일부)

**Files:** Modify `src/ui/StatusGrid.tsx`, `src/ui/TrackEditor.tsx`, `src/ui/styles.css`

- [ ] **StatusGrid compact** — `StatusGridProps`에 `compact?: boolean` 추가. compact면 선택된 상태 한 글자만 크게 표시(클릭 비활성, 표시 전용):
```tsx
interface StatusGridProps {
  value: TrackStatus;
  onChange: (s: TrackStatus) => void;
  compact?: boolean;
}
// 본문 시작:
if (compact) {
  const m = STATUS_META.find((x) => x.status === value)!;
  return (
    <div className="status-grid status-grid--compact" title={m.label} style={{ "--tone": m.color } as CSSProperties}>
      <span className="status-grid__letter">{m.letter}</span>
    </div>
  );
}
// 이하 기존 2×2 그리드 그대로
```

- [ ] **TrackEditor 포커스 분기** — `src/ui/TrackEditor.tsx`:
  - StatusGrid 호출에 `compact={!focused}` 전달: `<StatusGrid value={track.status} onChange={(s) => setTrackStatus(track.id, s)} compact={!focused} />`
  - 마커비우기(Trash) 버튼을 **focused일 때만** 렌더: `{focused && (<button ...clearMarkers.../>)}`
  - 인라인 삭제(X) 버튼 **제거**(삭제는 TrackRow의 affordance로 이동, Task 5). `removeTrack` 구독·`X` import 제거. `Trash` import는 유지.

- [ ] **styles.css** — 파일 끝에:
```css
/* 언포커스 상태 한 글자 (폴리싱 #2) */
.status-grid--compact {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--tone);
  border-radius: 6px;
  color: var(--tone);
}
.status-grid__letter {
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
}
```

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린(삭제 X 제거로 `removeTrack` 미사용 시 tsc가 잡으면 함께 제거).

- [ ] **커밋**
```bash
git add src/ui/StatusGrid.tsx src/ui/TrackEditor.tsx src/ui/styles.css && git commit -m "$(cat <<'EOF'
feat(ui): StatusGrid compact(언포커스 한 글자) + 마커비우기 포커스 한정, 인라인 삭제 제거 (폴리싱 #2·#8)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: TrackRow 삭제 affordance + 펄스 하이라이트 (#8, #9)

**Files:** Modify `src/ui/TrackRow.tsx`, `src/ui/styles.css`

- [ ] **TrackRow 수정** — 삭제 핸들(포커스 행 우측 끝, hover 시 빨간 원형 버튼 좌측 페이드인) + 펄스 하이라이트.
  - import: `useStore`(removeTrack), `usePulse`, `useEffect`/`useState`, `Trash` 아이콘(또는 `X`). 빨간 원형이므로 `Trash` 또는 `X`. `X` 사용.
  - 펄스 구독: `const pulseNonce = usePulse((s) => s.nonce[track.id] ?? 0);` + nonce 변경 시 잠시 `pulsing` 클래스:
    ```tsx
    const [pulsing, setPulsing] = useState(false);
    useEffect(() => {
      if (pulseNonce === 0) return;
      setPulsing(true);
      const id = setTimeout(() => setPulsing(false), 320);
      return () => clearTimeout(id);
    }, [pulseNonce]);
    ```
  - `removeTrack` 구독: `const removeTrack = useStore((s) => s.removeTrack);`
  - rowClass에 `pulsing ? "track-row--pulse" : ""` 추가.
  - 삭제 affordance를 `.track-row-wrap` 또는 `.track-row` 내부 우측에 focused일 때만 렌더(행은 position 필요 — `.track-row`에 `position:relative`가 없으면 추가):
    ```tsx
    {focused && (
      <div className="track-row__delete">
        <div className="track-row__delete-handle" aria-hidden="true" />
        <button
          type="button"
          className="track-row__delete-btn"
          title="트랙 삭제"
          onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    )}
    ```
    이 블록은 `.track-row`(또는 wrap) 안에서 absolute로 우측 끝에 배치. 현재 P2 이전 TrackRow는 `.track-row-wrap > .track-row(onClick) + (시퀀서)` 구조(P 계획 5). 삭제 affordance는 `.track-row` 내부 우측에 두어 행 높이를 따른다 → `.track-row`에 넣고 `.track-row{position:relative}` 보장.

- [ ] **styles.css** — 파일 끝에:
```css
/* 트랙 행 펄스(키 입력 피드백, 폴리싱 #9) */
.track-row--pulse {
  animation: track-pulse 0.32s ease;
}
@keyframes track-pulse {
  0% { background: rgba(168, 85, 247, 0.45); }
  100% { background: transparent; }
}

/* 삭제 affordance(포커스 행 우측 끝, 폴리싱 #8) */
.track-row { position: relative; }
.track-row__delete {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 56px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
  z-index: 6;
  pointer-events: none; /* 핸들/버튼만 받음 */
}
.track-row__delete-handle {
  position: absolute;
  top: 0; right: 0; bottom: 0;
  width: 10px;
  background: linear-gradient(90deg, transparent, rgba(248, 113, 113, 0.25));
  pointer-events: auto;
  cursor: pointer;
}
.track-row__delete-btn {
  width: 26px; height: 26px; padding: 0;
  border-radius: var(--r-pill);
  background: #ef4444;
  border: none;
  color: #fff;
  opacity: 0;
  transform: translateX(10px);
  transition: opacity 0.16s ease, transform 0.16s ease;
  pointer-events: none;
}
/* 핸들 또는 영역 hover 시 빨간 원형 버튼 좌측 페이드인 */
.track-row__delete:hover .track-row__delete-btn {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
```
  > `.track-row__delete-btn`이 `button{}` 전역 스타일을 받으므로 background/border 재정의 필요(위에 포함). `:hover`는 `.track-row__delete` 영역(핸들 포함) hover 시 작동.

- [ ] **검증** — `yarn test:run && yarn tsc -b` 그린.

- [ ] **커밋**
```bash
git add src/ui/TrackRow.tsx src/ui/styles.css && git commit -m "$(cat <<'EOF'
feat(ui): 삭제 affordance(우측 핸들 hover→빨강원형) + 트랙 펄스 하이라이트 (폴리싱 #8·#9)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 브라우저 검증 (P2)

- [ ] dev 후 데모 mp3 업로드, 트랙 2~3개 추가. 헤드리스 확인:
  - 볼륨 스피커 클릭 → 팝오버가 트랙 행 밖에서도 **안 잘리고** 보임(body 포털). 바깥클릭/Esc 닫힘.
  - 트랙 드래그 시 고스트가 행을 벗어나도 보임(DragOverlay). 드롭 시 순서 변경 유지.
  - 언포커스 트랙: 상태가 한 글자 크게(예: L). 포커스 트랙: 2×2 그리드.
  - 포커스 행: 마커비우기 버튼 보임, 인라인 X 없음. 행 우측 끝 hover → 빨간 원형 삭제 버튼 좌측 페이드인 → 클릭 시 삭제.
  - (P1 적용 시) 레코드/플레이에서 키 입력 → 해당 트랙 행 짧게 보라 하이라이트.
  - 콘솔 에러(favicon 제외) 없음.
- [ ] 무인이면 `IMPLEMENTATION_NOTES.md`에 P2 결과/미검증 기록(꾸미지 말 것).
- [ ] `yarn test:run && yarn tsc -b` 최종 그린.
- [ ] **커밋**(노트)
```bash
git add IMPLEMENTATION_NOTES.md && git commit -m "$(cat <<'EOF'
docs: P2(포털/오버레이/compact/삭제/펄스) 브라우저 검증 기록

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review (스펙 대조)
- §3 D(포털): Task 2(volume createPortal)·3(DragOverlay) → #1·#5. ✓
- §3 G(compact): Task 4 → #2. ✓
- §3 H(삭제): Task 4(마커비우기 포커스 한정+인라인 삭제 제거)·5(우측 핸들 hover 빨강원형) → #8. ✓
- §3 F(펄스): Task 1(usePulse+KeyboardController)·5(TrackRow 하이라이트) → #9. ✓
- 순수 로직(usePulse) TDD, UI는 헤드리스 검증. any 없음. 각 Task 그린+커밋.
