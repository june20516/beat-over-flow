# Editor v2 폴리싱 설계 문서

> 작성일: 2026-05-27
> 상태: 설계 합의 완료
> 선행: `2026-05-27-editor-architecture-v2-design.md`, v2 계획 1~6 구현 완료(브랜치 `feat/editor-v2`).

## 1. 개요

v2 에디터 사용 중 발견된 10개 폴리싱 항목을, 재사용 가능한 **구조 빌딩블록**으로 묶어 구현한다.
단일 항목 패치가 아니라 인터랙션/플로팅/플레이헤드/피드백의 공통 추상화를 도입해 일관성과 확장성을 높인다.

### 데모 베이스플로우
검증용으로 `public/samples/moodmode-demo.mp3`(no-copyright)를 프로젝트에 포함했다. 충분히 긴 트랙이라
가로 스크롤/줌/플레이헤드/시퀀서 동작을 의미 있게 확인할 수 있다. 헤드리스 검증 시 이 파일을 업로드해 사용한다.

## 2. 폴리싱 항목 → 빌딩블록 매핑

| # | 항목 | 빌딩블록 |
|---|---|---|
| 1 | 볼륨 팝오버가 트랙 엘리먼트(overflow:hidden) 밖에서 잘림 | D 플로팅 포털 |
| 2 | 언포커스 트랙은 선택된 MLPW 한 글자만 크게 | G StatusGrid compact |
| 3 | 줌 동작 안 함(파형 영역 포함) + 더블클릭이 클릭에 선점 | A 뷰포트 줌 API + 휠 버그 수정 |
| 4 | 플레이 모드에서 play 상태 트랙 레인에도 플레이헤드 | E 공유 레인 플레이헤드 |
| 5 | 드래그 중 엘리먼트가 트랙 밖에서 안 보임 | D dnd-kit DragOverlay |
| 6 | 레코드 마커 편집을 클릭(up)에서만, 드래그는 비움 | B 레인 제스처 훅 |
| 7 | 시퀀서 구간을 레인/파형에서 드래그로 지정 | B 제스처 훅 + C 구간선택 |
| 8 | 마커비우기/삭제 버튼 모호함, 삭제 위상 | H 삭제 affordance |
| 9 | 플레이 모드 키 입력 시 해당 트랙 짧게 하이라이트 | F 트랙 프레스 펄스 |
| 10 | 플레이 모드: 키로 항상 소리(미리듣기), 채점은 재생 중만 | I perform 소리/채점 분리 |

## 3. 빌딩블록 설계

### A. 뷰포트 줌 API + 휠 버그 수정 [#3]

**버그 원인:** macOS에서 Shift+휠은 세로 스크롤을 가로로 변환해 `deltaX`에 값을 싣고 `deltaY=0`이 된다.
현재 줌 핸들러는 `Math.pow(ZOOM_IN_FACTOR, -e.deltaY)`로 `deltaY`만 읽어 factor=1 → 줌이 전혀 안 된다.

**수정:**
- `useViewport`에 액션 추가:
  ```ts
  zoomByAtCenter: (factor: number) => void; // 가시영역 중앙 앵커로 zoomedViewport 적용(follow 유지)
  ```
  내부적으로 `zoomedViewport(vp, durationMs, factor, containerWidthPx/2)` 사용. `+`=확대(factor>1), `−`=축소(factor<1). 클램프는 §4 함수 그대로.
- `Timeline`의 wheel 핸들러:
  - 줌 조건을 `e.shiftKey || e.ctrlKey || e.metaKey`로 넓히고, **0이 아닌 dominant delta**를 사용:
    `const d = e.deltaY !== 0 ? e.deltaY : e.deltaX; factor = Math.pow(ZOOM_IN_FACTOR, -d);` (트랙패드 핀치는 ctrl+deltaY).
  - 평휠(modifier 없음)은 기존대로 가로 팬(`deltaX || deltaY`).
  - **휠 핸들러 부착 범위 확장:** 현재 헤더 `.timeline__arrange`에만 붙어 있어 트랙 레인 위에선 줌/팬이 안 된다.
    `.timeline` 루트에 wheel 리스너를 붙이고, 이벤트 target이 좌측 컬럼(`.timeline__fixed-col` 또는 `.track-row__editor` 내부)이면 무시한다. 앵커 x는 우측 arrange 좌측 기준으로 계산(arrange rect 사용).
- `EditorToolbar`에 `+`/`−`/`맞춤(fitAll)` 버튼 추가(발견성·신뢰성).
- `BaseFlowLane`의 **더블클릭=fitAll 제거**(단일클릭 seek가 더블클릭을 선점하는 문제 해소). 줌 리셋은 툴바 `맞춤` 버튼이 담당.

순수 검증: `zoomByAtCenter`의 중앙 앵커·클램프(단위테스트). 휠 delta 분기는 순수 헬퍼 `resolveWheelIntent(e-like) → {kind:'zoom'|'pan', amount}`로 추출해 TDD.

### B. 레인 포인터 제스처 훅 `useLaneGesture` [#6, #7]

레인 위 pointer 시퀀스를 의미 이벤트로 변환하는 훅. React DOM 핸들러를 받아 반환한다.

```ts
interface LaneGestureHandlers {
  onClick?: (localX: number) => void;       // 드래그 아니고 좌클릭 up
  onContextClick?: (localX: number) => void; // 우클릭(contextmenu)
  onDragRange?: (startX: number, endX: number) => void; // 드래그 종료(임계 초과)
  onDragMove?: (startX: number, endX: number) => void;  // 드래그 중(오버레이 갱신)
}
const DRAG_THRESHOLD_PX = 5;
function useLaneGesture(handlers: LaneGestureHandlers): {
  onPointerDown, onContextMenu // 요소에 스프레드
};
```

- pointerdown에서 시작 x 기록 + pointer capture. pointermove가 임계(5px) 초과 시 드래그 진입 → `onDragMove`.
  pointerup 시: 드래그였으면 `onDragRange`, 아니면 `onClick`. 우클릭은 `onContextClick`(preventDefault).
- 좌표는 요소 `getBoundingClientRect().left` 기준 local x. ms 변환은 호출부에서 `xToTime`.
- **마커는 클릭(up)에서만** 추가되므로 #6 해소(mousedown 즉시 X). 드래그는 마커를 만들지 않고 구간으로 간다.

순수 검증: 제스처 판정 로직을 순수 함수 `classifyPointerSequence(downX, upX, moved) → 'click'|'drag'`로 분리해 TDD(임계 경계 포함).

적용:
- `BaseFlowLane`: `onClick`→`seek(xToTime)`, `onDragRange`/`onDragMove`→구간(C).
- `MarkerEditor`(포커스, 편집 가능): `onClick`→`addMarker`, `onContextClick`→`findNearestMarker`+`removeMarker`, `onDragRange`/`onDragMove`→구간(C). 편집 불가(레코드 동작 아님)면 클릭/우클릭 무시하되 드래그=구간은 허용(구간 지정은 모드 무관).

### C. 구간 선택 상태 + 드래그 오버레이 [#7]

- 드래그 중: 반투명 범위 오버레이(`region-drag-overlay`)를 해당 레인 위에 px로 그린다(start~end x).
- 드래그 종료: `min/max`로 정렬한 `{startMs,endMs}`(`xToTime`)를 `useEditorUi.setRegion`에 반영하고,
  `sequencerOpen===false`면 `setSequencerOpen(true)`로 자동 표시(포커스 트랙 없으면 베이스 파형 드래그는 region만 갱신).
- 시퀀서 패널의 region 입력과 양방향 동기(이미 `useEditorUi` 단일 소스).

순수 검증: `dragToRegion(startX, endX, vp) → {startMs,endMs}`(정렬·클램프 0..duration) TDD.

### D. 플로팅 레이어(포털) [#1, #5]

- **VolumeControl 팝오버:** `createPortal(document.body)`로 렌더. 트리거 버튼의 `getBoundingClientRect`로 위치(트리거 위 중앙). 바깥클릭/Esc 닫힘 로직 유지. 스크롤/리사이즈 시 위치 재계산(열린 동안 rAF 또는 트리거 클릭 시점 1회 + scroll 리스너). overflow:hidden 조상 클리핑 해소.
- **트랙 드래그:** `DndContext`에 `<DragOverlay>` 추가. `onDragStart`에서 활성 트랙 id 기록, `DragOverlay` 안에 그 트랙의 `TrackEditor` 프리뷰(또는 경량 고스트)를 렌더. `useSortable`의 in-place transform 대신 오버레이가 포털로 body에 떠서 행을 벗어나도 안 잘린다. 원본은 `isDragging`이면 opacity 낮춤.

검증: 포털/오버레이는 헤드리스 스크린샷 + 사람 검증.

### E. 공유 레인 플레이헤드 `LanePlayhead` [#4]

- 베이스/트랙 레인에서 재사용할 세로 플레이헤드 선 컴포넌트(뷰포트+playheadMs 구독, `timeToX`로 위치, 가시범위 밖 숨김). 기존 `PlayheadOverlay`의 선 로직을 공유 컴포넌트로 추출.
- `MarkerEditor`(또는 `TrackRow__lane`)에서 **`mode==='play' && resolveTrackBehavior('play', track.status)==='perform'`** 일 때 `LanePlayhead` 렌더.
- 베이스 파형 위 플레이헤드는 현행 유지(`PlayheadOverlay`가 `LanePlayhead`를 사용하도록 리팩터).

검증: timeToX는 기존 단위테스트로 커버. 표시 조건(play×perform)은 헤드리스 확인.

### F. 트랙 프레스 펄스 [#9]

- 휘발성 신호 스토어(또는 `useEditorUi` 확장): `pulses: Record<trackId, number>`(nonce). `pulse(trackId)` 액션이 nonce 증가.
  - 신규 경량 스토어 `usePulse` 권장(useStore/editorUi 오염 방지).
  ```ts
  interface PulseState { nonce: Record<string, number>; pulse: (trackId: string) => void; }
  ```
- `KeyboardController.triggerTrack`에서 트랙 트리거 시 `usePulse.getState().pulse(track.id)` 호출(플레이 모드 perform·레코드 공통 — 시각 피드백은 모드 무관 유용하나, 요구는 플레이 모드. 일단 트리거 시 항상 펄스, 비용 미미).
- `TrackRow`(또는 TrackEditor)가 자신의 nonce를 구독, 변경 시 `track-row--pulse` 클래스를 잠시 부여(키 변경 기반 CSS 애니메이션 1회 재생). 구현: nonce를 `key` 또는 effect로 감지해 짧은 timeout 후 클래스 제거, 혹은 CSS `animation` + nonce를 animation 재시작 트리거로.

순수 검증: pulse 액션 nonce 증가 TDD. 시각은 헤드리스/사람.

### G. StatusGrid compact [#2]

- `StatusGrid`에 `compact?: boolean` prop 추가(또는 TrackEditor가 focused에 따라 분기).
  - `compact`(언포커스): 선택된 상태의 글자 하나만 크게(톤 색), 클릭 시 순환 또는 비활성(언포커스 행은 클릭=포커스이므로 상태 변경 불가, 표시 전용). 표시 전용으로 한다.
  - `!compact`(포커스): 기존 2×2 선택 그리드.
- `TrackEditor`가 `focused`로 분기: `<StatusGrid value=... onChange=... compact={!focused} />`.

검증: compact 표시는 헤드리스(언포커스 트랙에 한 글자 크게).

### H. 삭제 affordance [#8]

- **평소(언포커스) 행:** 드래그핸들 · 이름 · StatusGrid(compact) · 사운드 · KeyCap · VolumeControl 만. 마커비우기/삭제 없음.
- **포커스 행:** 위 + 마커비우기(인라인 아이콘) + **우측 끝 삭제 affordance**.
- **삭제 affordance:** 행 우측 끝에 얇은 세로 핸들(`track-row__delete-handle`). 핸들 hover 시, 빨간 **원형 아이콘 삭제 버튼**이 좌측에서 페이드/슬라이드 인(오버레이, 텍스트 없음). 클릭 시 삭제(undo 없으니 클릭 = 즉시 삭제하되, 작은 원형이라 우발 클릭 위험 낮음 — 필요 시 1차 hover-노출/2차-클릭 2단계로 자연 가드). 텍스트 라벨 없음.
  - 구현: `.track-row__delete-handle`(focus 행에만, position absolute right, width ~10px) + `.track-row__delete-btn`(원형 빨강, 기본 `opacity:0; transform:translateX(8px); pointer-events:none`, 핸들/영역 hover 시 `opacity:1; translateX(0)` 전이).

검증: 헤드리스(포커스 행 hover→삭제 버튼 등장, 클릭→삭제) + 사람.

### I. perform 소리/채점 분리 [#10]

- 현재 `playSession`은 모드가 play로 바뀔 때 `startPlaySession`으로 엔진 생성, `pressTrack`은 호출 시 항상 채점.
- 변경: `KeyboardController.triggerTrack`의 perform 분기에서 **소리는 항상 재생**, **`pressTrack`는 `useStore.getState().playing`일 때만 호출**.
  - 재생 전 미리듣기: 소리만, 채점 없음. 재생 중: 소리 + 채점.
- 대안(더 견고): `pressTrack` 내부에서 `if (!useStore.getState().playing) return null;` 가드. 단, "엔진 없으면 null" 외에 playing 가드를 추가. KeyboardController 쪽 가드와 이중이 되지 않게 한 곳(playSession.pressTrack)에 두는 것을 채택.

순수 검증: `pressTrack`이 `playing=false`면 채점/스코어 갱신 안 함(스토어 playing 토글하며 단위테스트).

## 4. 영향 파일 (요약)

- `src/store/viewport.ts` (+test): `zoomByAtCenter`.
- `src/timeline/` 신규 순수 모듈(+test): `resolveWheelIntent`, `classifyPointerSequence`/`dragToRegion`(파일명 구현 시 확정, 예 `laneGesture.ts`).
- `src/input/useLaneGesture.ts` (신규): 제스처 훅.
- `src/store/pulse.ts` (+test) 또는 editorUi 확장: 프레스 펄스.
- `src/ui/EditorToolbar.tsx`: 줌 버튼.
- `src/ui/Timeline.tsx`: 휠 범위 확장 + 줌 버그 수정 + DragOverlay.
- `src/ui/BaseFlowLane.tsx`: 제스처 적용, 더블클릭 제거.
- `src/ui/MarkerEditor.tsx`: 제스처 적용(클릭/우클릭/드래그), LanePlayhead(play×perform), 구간 오버레이.
- `src/ui/PlayheadOverlay.tsx` → `LanePlayhead` 공유 추출.
- `src/ui/VolumeControl.tsx`: 포털.
- `src/ui/StatusGrid.tsx`: compact.
- `src/ui/TrackEditor.tsx` / `TrackRow.tsx` / `styles.css`: 삭제 affordance, compact 분기, 펄스 클래스, 마커비우기/삭제 포커스 행 한정.
- `src/scoring/playSession.ts`: 채점 playing 게이트.

## 5. 테스트 전략

- **순수 TDD:** `zoomByAtCenter`(중앙앵커/클램프), `resolveWheelIntent`(modifier/dominant delta), `classifyPointerSequence`(임계), `dragToRegion`(정렬/클램프), `usePulse`(nonce), `pressTrack` playing 게이트.
- **헤드리스 + 사람 검증:** 포털 팝오버 비클리핑, DragOverlay 가시성, compact 한 글자, 삭제 핸들 hover 페이드인, 레인 플레이헤드(play×perform), 프레스 펄스, 휠 줌 실제 동작(데모 mp3로 줌 범위 확인).

## 6. 구현 계획 분할

- **계획 P1 (인터랙션):** A(줌/휠) + B(제스처 훅) + C(구간 드래그) — #3·#6·#7. 순수 로직 다수 TDD.
- **계획 P2 (시각/오버레이):** D(포털·DragOverlay) + G(compact) + H(삭제 affordance) + F(펄스) — #1·#2·#5·#8·#9.
- **계획 P3 (재생/플레이헤드):** E(레인 플레이헤드) + I(채점 게이트) — #4·#10.

각 계획은 끝에서 `yarn test:run && yarn tsc -b` 그린 + 헤드리스 검증(데모 mp3) + 커밋.

## 7. any 미사용 / 계약 정합

- 모든 신규 타입 명시(`any` 금지, CSS custom property는 `as CSSProperties` 허용).
- 기존 계약(§4 viewportMath, §5 useViewport, §6 editorUi, §8 props)과 충돌 시 계약 우선. 신규 액션은 계약 확장으로 본 문서에 명시.
