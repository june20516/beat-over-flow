# [Drag Reorder] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌측 Track Editor 컬럼을 드래그하여 트랙 순서를 바꾸고(요구 8), 그 순서가 autosave를 통해 IndexedDB에 영속되도록 한다. 순수 인덱스 이동 로직(`reorderTracks`)은 TDD로, 영속은 fake-indexeddb 통합 테스트로 검증한다. 실제 드래그 제스처 동작은 무인 환경에서 단위테스트로 보장 불가하므로 `IMPLEMENTATION_NOTES.md`에 "사람 검증 필요"로 기록한다.

**Architecture:** `@dnd-kit/core`의 `DndContext`로 좌측 트랙 컬럼을 감싸고, `@dnd-kit/sortable`의 `SortableContext`(`verticalListSortingStrategy`) + `useSortable`로 각 트랙 행 좌측(TrackEditor)을 정렬 단위로 만든다. `onDragEnd`에서 `active.id`/`over.id`를 트랙 인덱스로 변환해 `useStore.reorderTracks(from, to)`를 호출한다. `reorderTracks`는 기존 `mutate` 헬퍼로 `project.tracks`를 단일 전이(splice 기반 이동) + `updatedAt` 갱신하며, 이는 `startAutosave` 구독이 디바운스 저장한다. 우측 Marker Editor 레인은 동일한 `tracks` 순서를 그대로 따르므로 별도 처리 없이 자동 정렬된다.

**Tech Stack:** React 18, Vite, TypeScript, zustand, vitest, @dnd-kit

**계약/스펙 기준:**
- `docs/superpowers/plans/2026-05-27-v2-contracts.md` §3(reorderTracks 시그니처), §10(dnd-kit 설치/배치)
- `docs/superpowers/specs/2026-05-27-editor-architecture-v2-design.md` 요구 8(§8 표 8행, §7 신규 액션, §6 트랙 순서 영속)

**선행 의존:** 계획 2(TrackRow/TrackEditor 분해, 포커스), 계획 3(TrackEditor 컨트롤)이 완료되어 `src/ui/TrackRow.tsx`, `src/ui/TrackEditor.tsx`가 존재한다고 가정한다. 좌측 컬럼을 렌더하는 부모(계획 2의 `Timeline` 또는 `Editor`의 트랙 컬럼)에 dnd-kit 래핑을 추가한다.

---

### Task 1: dnd-kit 의존성 설치

**Files:**
- `package.json` (수정 — npm이 갱신)
- `package-lock.json` (수정 — npm이 갱신)

- [ ] 계약 §10에 따라 dnd-kit 3종 패키지를 설치한다:
  ```bash
  npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  ```
- [ ] `package.json`의 `dependencies`에 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` 3개가 추가되었는지 확인한다:
  ```bash
  node -e "const d=require('./package.json').dependencies; ['@dnd-kit/core','@dnd-kit/sortable','@dnd-kit/utilities'].forEach(k=>{ if(!d[k]) throw new Error('missing '+k); }); console.log('ok');"
  ```
- [ ] 타입 선언이 함께 제공되는지(별도 `@types` 불필요) 확인한다. dnd-kit는 자체 `.d.ts`를 번들하므로 추가 설치 없이 import 가능해야 한다:
  ```bash
  test -f node_modules/@dnd-kit/sortable/dist/sortable.d.ts && echo "types ok" || ls node_modules/@dnd-kit/sortable/dist/
  ```
- [ ] 검증: `npm run test:run && npx tsc -b` 둘 다 통과(설치만으로 기존 코드가 깨지지 않는지 확인).
- [ ] 커밋:
  ```
  chore: install @dnd-kit (core/sortable/utilities) for track reorder

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

### Task 2: reorderTracks 액션 — TDD (RED)

**Files:**
- `src/store/useStore.test.ts` (수정 — 테스트 추가)

`reorderTracks(fromIndex, toIndex)`의 동작 명세를 먼저 테스트로 고정한다. 계약 §3: 범위 밖/`from===to`면 변경 없음, 정상 이동 시 순서 변경 + `updatedAt` 갱신(단일 전이).

- [ ] `src/store/useStore.test.ts` 끝에 `reorderTracks` 전용 describe 블록을 추가한다. 기존 `sampleProject()`/`useStore.setState` 패턴을 그대로 따른다. 트랙 식별을 위해 이름을 직접 세팅한다:
  ```ts
  describe("useStore reorderTracks", () => {
    function projectWith3Tracks(): Project {
      const base = sampleProject();
      return {
        ...base,
        tracks: ["A", "B", "C"].map((name, i) => ({
          id: `t${i}`,
          name,
          status: "listening" as const,
          sound: { kind: "builtin" as const, sampleId: "kick" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
        })),
      };
    }

    beforeEach(() => {
      useStore.setState({
        project: projectWith3Tracks(),
        playing: false,
        playheadMs: 0,
        mode: "listening",
        selectedTrackId: null,
        score: emptyScore(),
      });
    });

    function names() {
      return useStore.getState().project!.tracks.map((t) => t.name);
    }

    it("앞 트랙을 뒤로 이동하면 순서가 바뀐다", () => {
      useStore.getState().reorderTracks(0, 2);
      expect(names()).toEqual(["B", "C", "A"]);
    });

    it("뒤 트랙을 앞으로 이동하면 순서가 바뀐다", () => {
      useStore.getState().reorderTracks(2, 0);
      expect(names()).toEqual(["C", "A", "B"]);
    });

    it("인접 트랙 스왑", () => {
      useStore.getState().reorderTracks(0, 1);
      expect(names()).toEqual(["B", "A", "C"]);
    });

    it("from===to면 순서/참조 모두 변경 없음(전이 없음)", () => {
      const before = useStore.getState().project!;
      useStore.getState().reorderTracks(1, 1);
      expect(useStore.getState().project).toBe(before); // 동일 참조 = set 미발생
      expect(names()).toEqual(["A", "B", "C"]);
    });

    it("fromIndex가 범위 밖이면 변경 없음", () => {
      const before = useStore.getState().project!;
      useStore.getState().reorderTracks(5, 0);
      expect(useStore.getState().project).toBe(before);
      expect(names()).toEqual(["A", "B", "C"]);
    });

    it("toIndex가 범위 밖이면 변경 없음", () => {
      const before = useStore.getState().project!;
      useStore.getState().reorderTracks(0, 9);
      expect(useStore.getState().project).toBe(before);
      expect(names()).toEqual(["A", "B", "C"]);
    });

    it("음수 인덱스면 변경 없음", () => {
      const before = useStore.getState().project!;
      useStore.getState().reorderTracks(-1, 1);
      expect(useStore.getState().project).toBe(before);
      expect(names()).toEqual(["A", "B", "C"]);
    });

    it("정상 이동 시 updatedAt이 갱신된다(단일 전이)", () => {
      const t0 = useStore.getState().project!.updatedAt;
      useStore.getState().reorderTracks(0, 2);
      expect(useStore.getState().project!.updatedAt).toBeGreaterThanOrEqual(t0);
    });

    it("project가 null이면 안전하게 무시한다", () => {
      useStore.setState({ project: null });
      expect(() => useStore.getState().reorderTracks(0, 1)).not.toThrow();
      expect(useStore.getState().project).toBeNull();
    });
  });
  ```
- [ ] 검증(RED): 아직 `reorderTracks`가 없으므로 타입체크/테스트가 실패해야 한다. 실패를 확인한다(이 단계에서는 그린이 아님이 정상):
  ```bash
  npx vitest run src/store/useStore.test.ts
  ```
  → `reorderTracks is not a function` 또는 tsc 에러로 RED 확인. (커밋하지 않는다.)

---

### Task 3: reorderTracks 액션 구현 (GREEN)

**Files:**
- `src/store/useStore.ts` (수정 — 액션 추가)

계약 §3 시그니처 `reorderTracks: (fromIndex: number, toIndex: number) => void`를 정확히 구현한다. 범위 밖/동일 인덱스면 `set`을 호출하지 않아 참조가 보존되도록 한다(단일 전이 보장 + 불필요한 autosave 방지).

- [ ] `src/store/useStore.ts`의 `StoreState` 인터페이스에 시그니처를 추가한다. `setSelectedTrack` 선언 위(트랙 액션 그룹) 근처에 둔다:
  ```ts
  reorderTracks: (fromIndex: number, toIndex: number) => void; // 범위 밖/동일이면 무시
  ```
- [ ] 파일 상단의 `mutate` 헬퍼 아래에 splice 기반 순수 이동 헬퍼를 추가한다(읽기 쉬운 불변 이동):
  ```ts
  /** 배열을 복사해 from→to로 한 요소를 이동한다(불변). 인덱스 가정은 호출부에서 보장. */
  function moveItem<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
    const next = arr.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }
  ```
- [ ] `create<StoreState>` 객체 안, `setSelectedTrack` 정의 근처에 액션 구현을 추가한다:
  ```ts
  reorderTracks: (fromIndex, toIndex) =>
    set((s) => {
      if (!s.project) return s;
      const len = s.project.tracks.length;
      const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < len;
      if (fromIndex === toIndex || !inRange(fromIndex) || !inRange(toIndex)) {
        return s; // 변경 없음 → 동일 참조 유지(전이 없음)
      }
      return mutate(s, (tracks) => moveItem(tracks, fromIndex, toIndex));
    }),
  ```
- [ ] 검증(GREEN): Task 2의 테스트가 전부 통과하는지 확인한다:
  ```bash
  npx vitest run src/store/useStore.test.ts
  ```
- [ ] 검증: `npm run test:run && npx tsc -b` 둘 다 통과.
- [ ] 커밋:
  ```
  feat(store): add reorderTracks action with range guards (req 8)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

### Task 4: 순서변경 → autosave 영속 통합 테스트

**Files:**
- `src/store/reorderTracks.persist.test.ts` (신규)

요구 8 핵심: 순서 변경이 자동 저장된다. `startAutosave` + fake-indexeddb로 "스토어 호출 → 디바운스 플러시 → `listProjects`/`loadProject`로 순서 확인"을 검증한다. 기존 `autosave.test.ts`의 fake-timer + `resetDbCache` 패턴을 그대로 따른다.

- [ ] `src/store/reorderTracks.persist.test.ts`를 생성한다:
  ```ts
  import { describe, it, expect, vi, beforeEach } from "vitest";
  import { useStore } from "./useStore";
  import { startAutosave } from "./autosave";
  import { listProjects, loadProject } from "../persistence/projects";
  import { resetDbCache } from "../persistence/db";
  import type { Project, Track } from "../types";

  function track(id: string, name: string): Track {
    return {
      id,
      name,
      status: "listening",
      sound: { kind: "builtin", sampleId: "kick" },
      keyBinding: null,
      markers: [],
      volume: 1,
      color: "#fff",
    };
  }

  function projectWith3Tracks(): Project {
    return {
      id: "p1",
      name: "곡",
      createdAt: 1,
      updatedAt: 1,
      baseFlow: { kind: "audioFile", assetId: "a1", durationMs: 5000 },
      tracks: [track("t0", "A"), track("t1", "B"), track("t2", "C")],
      master: { volume: 1 },
    };
  }

  describe("reorderTracks 영속(통합)", () => {
    beforeEach(() => {
      indexedDB = new IDBFactory();
      resetDbCache();
      useStore.setState({ project: null, playing: false, playheadMs: 0 });
    });

    it("순서변경 후 autosave가 새 순서를 IndexedDB에 저장한다", async () => {
      vi.useFakeTimers();
      const stop = startAutosave(0); // 디바운스 0ms
      useStore.getState().setProject(projectWith3Tracks());
      useStore.getState().reorderTracks(0, 2); // A,B,C → B,C,A
      await vi.runAllTimersAsync(); // 디바운스 + fake-indexeddb 작업 플러시
      vi.useRealTimers();

      const saved = await loadProject("p1");
      expect(saved?.tracks.map((t) => t.name)).toEqual(["B", "C", "A"]);

      const all = await listProjects();
      expect(all).toHaveLength(1);
      expect(all[0].tracks.map((t) => t.id)).toEqual(["t1", "t2", "t0"]);
      stop();
    });

    it("from===to(전이 없음)는 저장을 유발하지 않는다", async () => {
      vi.useFakeTimers();
      const stop = startAutosave(0);
      useStore.getState().setProject(projectWith3Tracks());
      await vi.runAllTimersAsync(); // setProject 저장 1회 플러시
      vi.useRealTimers();

      const before = await loadProject("p1");

      vi.useFakeTimers();
      useStore.getState().reorderTracks(1, 1); // 전이 없음
      await vi.runAllTimersAsync();
      vi.useRealTimers();

      const after = await loadProject("p1");
      expect(after?.tracks.map((t) => t.name)).toEqual(
        before?.tracks.map((t) => t.name),
      );
      expect(after?.tracks.map((t) => t.name)).toEqual(["A", "B", "C"]);
      stop();
    });
  });
  ```
- [ ] 검증: 통합 테스트가 통과하는지 단독 실행으로 확인한다:
  ```bash
  npx vitest run src/store/reorderTracks.persist.test.ts
  ```
- [ ] 검증: `npm run test:run && npx tsc -b` 둘 다 통과.
- [ ] 커밋:
  ```
  test(store): reorderTracks autosave persistence integration (req 8)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

### Task 5: TrackEditor 드래그 핸들 (useSortable)

**Files:**
- `src/ui/TrackEditor.tsx` (수정 — 드래그 핸들 + sortable transform 적용)

계약 §8 `TrackEditorProps { track: Track; focused: boolean; }`를 유지한 채, TrackEditor가 자신을 sortable 노드로 만들고 핸들에 dnd-kit listeners를 붙인다. `useSortable`의 `id`는 `track.id`를 사용한다(Task 6의 SortableContext items와 일치). 핸들 외 영역 클릭은 기존 포커스 동작을 방해하지 않도록, listeners는 **핸들 버튼에만** 부여한다.

- [ ] 상단 import에 dnd-kit과 Phosphor 핸들 아이콘을 추가한다:
  ```ts
  import { useSortable } from "@dnd-kit/sortable";
  import { CSS } from "@dnd-kit/utilities";
  import { DotsSixVertical } from "@phosphor-icons/react";
  ```
- [ ] 컴포넌트 본문 최상단에서 `useSortable`을 호출하고 루트 요소에 ref/transform을 적용한다. (아래는 TrackEditor의 골격 예시 — 계획 2/3에서 만든 기존 컨트롤 마크업은 `{/* ...기존 컨트롤... */}` 위치에 그대로 유지한다.)
  ```tsx
  export function TrackEditor({ track, focused }: TrackEditorProps) {
    const {
      attributes,
      listeners,
      setNodeRef,
      setActivatorNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: track.id });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="track-editor"
        data-focused={focused}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="track-editor__drag-handle"
          aria-label={`${track.name} 트랙 순서 이동`}
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical weight="bold" />
        </button>

        {/* ...기존 컨트롤(이름·StatusGrid·사운드·KeyCap·VolumeControl·마커비우기·삭제)... */}
      </div>
    );
  }
  ```
  - 주의: `setActivatorNodeRef` + 핸들 버튼에만 `listeners`를 부여하여, 드래그는 핸들에서만 시작되고 이름/볼륨/버튼 등 나머지 컨트롤은 정상 클릭/입력된다.
  - `React`가 import되어 있지 않다면 `import type React from "react";`로 `React.CSSProperties` 타입만 들여온다(any 미사용).
- [ ] `src/ui/styles.css`에 드래그 핸들 최소 스타일을 추가한다(가독성/그랩 커서):
  ```css
  .track-editor__drag-handle {
    cursor: grab;
    background: none;
    border: none;
    padding: 4px;
    color: #9ca3af;
    display: inline-flex;
    align-items: center;
    touch-action: none; /* dnd-kit 포인터 센서 권장 */
  }
  .track-editor__drag-handle:active {
    cursor: grabbing;
  }
  ```
- [ ] 검증: `npm run test:run && npx tsc -b` 둘 다 통과(타입/렌더 회귀 없음 확인).
- [ ] 커밋:
  ```
  feat(ui): add sortable drag handle to TrackEditor (req 8)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

### Task 6: 좌측 컬럼을 DndContext + SortableContext로 감싸기

**Files:**
- `src/ui/TrackRow.tsx` 또는 좌측 트랙 컬럼을 렌더하는 부모(계획 2 산출물; 보통 `src/ui/Timeline.tsx` 또는 `src/ui/Editor.tsx`) (수정)

좌측 TrackEditor 컬럼 전체를 `DndContext`(센서·충돌감지)와 `SortableContext`(`verticalListSortingStrategy`, items=트랙 id 배열)로 감싼다. `onDragEnd`에서 `active.id`/`over.id`를 트랙 인덱스로 변환해 `reorderTracks(from, to)`를 호출한다. 좌/우 컬럼은 동일 `tracks` 순서를 따르므로 우측은 자동 정렬된다(별도 처리 불필요).

- [ ] 좌측 트랙 컬럼을 렌더하는 정확한 위치를 확인한다(계획 2가 `TrackRow[]`를 어디서 map 하는지). 그 map을 감싸는 컨테이너에 dnd-kit 래핑을 추가한다:
  ```bash
  grep -rn "TrackRow" src/ui/
  ```
- [ ] 해당 부모 파일 상단에 dnd-kit import를 추가한다:
  ```ts
  import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
  } from "@dnd-kit/core";
  import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
  } from "@dnd-kit/sortable";
  ```
- [ ] 컴포넌트 본문에서 store의 `tracks`/`reorderTracks`를 구독하고 센서/핸들러를 구성한다:
  ```tsx
  const tracks = useStore((s) => s.project?.tracks ?? []);
  const reorderTracks = useStore((s) => s.reorderTracks);

  const sensors = useSensors(
    // 작은 이동(8px)부터 드래그로 인식 → 핸들 클릭과 드래그 구분, 오작동 방지
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = tracks.findIndex((t) => t.id === active.id);
    const to = tracks.findIndex((t) => t.id === over.id);
    if (from === -1 || to === -1) return;
    reorderTracks(from, to);
  }
  ```
- [ ] 좌측 트랙 행 목록 렌더를 `DndContext` + `SortableContext`로 감싼다. `items`는 트랙 id 배열이며 `useSortable({ id: track.id })`와 일치해야 한다:
  ```tsx
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={handleDragEnd}
  >
    <SortableContext
      items={tracks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      {tracks.map((track, index) => (
        <TrackRow
          key={track.id}
          track={track}
          index={index}
          focused={track.id === selectedTrackId}
        />
      ))}
    </SortableContext>
  </DndContext>
  ```
  - 주: `selectedTrackId`/`focused` 산출은 계획 2의 기존 방식을 그대로 따른다. dnd-kit 래핑만 추가하고 나머지 props 전달은 변경하지 않는다.
  - TrackRow가 좌측(TrackEditor)·우측(MarkerEditor)을 함께 렌더한다면, `useSortable`은 Task 5의 TrackEditor가 소유하므로 TrackRow는 그대로 두고 SortableContext만 행 목록을 감싸면 된다. 좌측만 별도 컬럼으로 분리된 레이아웃이라면 그 좌측 map을 감싼다(계획 2 레이아웃에 맞춰 1곳만).
- [ ] 검증: `npm run test:run && npx tsc -b` 둘 다 통과.
- [ ] 커밋:
  ```
  feat(ui): wrap track column in DndContext/SortableContext for reorder (req 8)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

### Task 7: 브라우저 검증 + 사람 검증 기록

**Files:**
- `IMPLEMENTATION_NOTES.md` (신규 또는 수정)

실제 드래그 제스처(포인터 누름→이동→놓음으로 순서 변경 + 우측 레인 동기 정렬)는 헤드리스 Chrome 스크린샷만으로는 신뢰성 있게 검증하기 어렵다(dnd-kit는 연속 포인터 이벤트 시퀀스 필요). 무인 실행에서는 성공을 꾸미지 않고 사람 검증 필요로 기록한다(계약 §0 규약).

- [ ] 헤드리스 Chrome 드라이버(`/tmp/bof-driver`)가 있으면 에디터를 띄워 좌측 트랙 컬럼에 드래그 핸들(DotsSixVertical)이 트랙마다 렌더되는지 **정적** 스크린샷으로 확인한다(핸들 존재/정렬 = 검증 가능 범위).
- [ ] `IMPLEMENTATION_NOTES.md`에 아래 항목을 추가한다(이미 있으면 섹션 append):
  ```markdown
  ## 계획 4 (드래그 순서변경, 요구 8) — 검증 상태

  - 자동 검증 완료:
    - `reorderTracks` 단위 동작(범위 가드/이동/단일 전이): `src/store/useStore.test.ts`
    - 순서변경 → autosave 영속(IndexedDB 라운드트립): `src/store/reorderTracks.persist.test.ts`
    - 타입체크/전체 테스트 그린: `npm run test:run && npx tsc -b`
  - **사람 검증 필요(무인 자동화로 미검증):**
    - 핸들을 실제 포인터로 드래그해 트랙 행 순서가 바뀌고, 놓는 순간 `reorderTracks`가 호출되어 우측 Marker Editor 레인도 같은 순서로 정렬되는지.
    - 드래그 중 시각 피드백(opacity/transform)과 핸들 외 컨트롤(이름 입력·볼륨·삭제 등)이 드래그로 오작동하지 않는지(PointerSensor distance 8px 가드).
    - 새로고침 후에도 변경된 순서가 유지되는지(autosave 영속 사용자 경로 확인).
  ```
- [ ] 검증: `npm run test:run && npx tsc -b` 최종 그린 확인.
- [ ] 커밋:
  ```
  docs: record reorder drag manual-verification needs (req 8)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## 완료 기준 (Definition of Done)

- [ ] `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities` 설치됨.
- [ ] `useStore.reorderTracks(fromIndex, toIndex)`가 계약 §3 시그니처로 존재하며: `from===to`/범위 밖/음수/non-integer/`project===null`이면 전이 없음, 정상 이동 시 순서 변경 + `updatedAt` 갱신(단일 `mutate` 전이).
- [ ] 순서변경이 autosave로 IndexedDB에 영속됨이 통합 테스트로 검증됨(`listProjects`/`loadProject`).
- [ ] 좌측 TrackEditor가 `useSortable` 핸들(DotsSixVertical)을 가지고, 부모가 `DndContext`+`SortableContext`(`verticalListSortingStrategy`)로 감싸 `onDragEnd`→`reorderTracks` 호출.
- [ ] 실제 드래그 제스처는 `IMPLEMENTATION_NOTES.md`에 사람 검증 필요로 기록(성공 미꾸밈).
- [ ] 모든 Task 종료 시 `npm run test:run && npx tsc -b` 그린.

## 다루는 요구사항

- **요구 8** (트랙 드래그 순서변경 + 영속): @dnd-kit sortable + `reorderTracks` + autosave 영속.
