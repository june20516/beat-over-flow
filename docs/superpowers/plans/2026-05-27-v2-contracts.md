# Editor v2 공유 계약 (Contracts)

> v2 계획 1~6이 공유하는 파일 구조·타입·시그니처·규약. 모든 계획은 이 문서를 단일 기준으로 삼는다.
> 선행: `../specs/2026-05-27-editor-architecture-v2-design.md`

## 0. 규약

- **패키지매니저: yarn (classic 1.22.22).** `package.json`의 `packageManager` 필드로 핀됨. **npm/npx를 쓰지 말 것** — 의존성 추가는 `yarn add`, 스크립트는 `yarn <script>`, 락파일은 `yarn.lock`(package-lock.json 없음).
- **테스트:** vitest. 테스트는 대상 파일과 **같은 디렉터리**에 `*.test.ts` 공존. 단일 실행 `yarn vitest run <path>`, 전체 `yarn test:run`. 환경은 jsdom(`vitest.config.ts`), IndexedDB는 `fake-indexeddb`(`src/test-setup.ts`)로 이미 셋업됨.
- **타입체크:** `yarn tsc -b`. any 지양.
- **태스크 종료 시:** `yarn test:run && yarn tsc -b` 둘 다 통과해야 커밋.
- **커밋 메시지 끝에 반드시:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **브라우저 검증:** 캔버스/SVG 렌더·스크롤·드래그 등 단위테스트로 못 잡는 것은 헤드리스 Chrome 드라이버(`/tmp/bof-driver`) 또는 사람 확인. 무인 실행 시 "사람 검증 필요"로 `IMPLEMENTATION_NOTES.md`에 기록하고 **성공을 꾸미지 않는다.**
- **순수 로직은 React에서 분리**해 단위테스트한다(뷰포트 수학, formatKeyCode, 스토어 액션 등).

## 1. 파일 구조

**신규 생성**
- `src/timeline/viewportMath.ts` (+ `.test.ts`) — 순수 시간↔픽셀 변환 함수.
- `src/store/viewport.ts` (+ `.test.ts`) — `useViewport` zustand 스토어(휘발성).
- `src/store/editorUi.ts` (+ `.test.ts`) — `useEditorUi` zustand 스토어(시퀀서 토글/구간/칸수, 휘발성).
- `src/domain/formatKeyCode.ts` (+ `.test.ts`) — 키코드 표시 변환(순수).
- `src/ui/Timeline.tsx` — 스크롤/줌 컨테이너. 폭 측정(ResizeObserver) + wheel 핸들링. 좌(고정)·우(arrange) 레이아웃.
- `src/ui/BaseFlowLane.tsx` — 베이스 파형 캔버스(기존 TimelineCanvas의 파형부 이전). 클릭=seek, 더블클릭=`fitAll`.
- `src/ui/PlayheadOverlay.tsx` — 플레이헤드 세로선(뷰포트 구독).
- `src/ui/TrackRow.tsx` — 한 트랙 행 = `TrackEditor` + `MarkerEditor`. 포커스 && 시퀀서ON이면 하단에 `StepSequencerPanel` 자식 렌더. dnd-kit sortable 단위.
- `src/ui/TrackEditor.tsx` — 좌측 설정 영역(드래그핸들·이름·StatusGrid·사운드·KeyCap·VolumeControl·마커비우기·삭제).
- `src/ui/MarkerEditor.tsx` — 우측 마커 레인. 포커스→SVG(가상화, 좌/우클릭 편집), 언포커스→캔버스 오버뷰.
- `src/ui/StatusGrid.tsx` — M/L/P/W 2×2 상태 선택.
- `src/ui/VolumeControl.tsx` — 스피커 아이콘 + 세로 range 팝오버.
- `src/ui/KeyCap.tsx` — 키 바인딩 표시/캡처 버튼(formatKeyCode 사용).
- `src/ui/EditorToolbar.tsx` — 전역 툴바(시퀀서 on/off, 줌 리셋).

**수정**
- `src/types.ts` — `Project.transport` 추가.
- `src/store/useStore.ts` — `reorderTracks`/`clearMarkers`/`setPlayPauseKey` 추가, addTrack 시 transport 기본값.
- `src/ui/Editor.tsx` — 새 컴포넌트로 레이아웃 재구성.
- `src/ui/TransportBar.tsx` — 재생키 KeyCap 추가.
- `src/input/KeyboardController.ts` — 모드 기본동작 차단 + 재생키 토글.
- `src/ui/StepSequencerPanel.tsx` — region/stepCount를 `useEditorUi`에서 읽도록, 위치 이동(props 정리).

**삭제(대체됨)**
- `src/render/TimelineCanvas.tsx` → Timeline/BaseFlowLane/MarkerEditor/PlayheadOverlay.
- `src/ui/TrackList.tsx`, `src/ui/TrackHeader.tsx` → TrackRow/TrackEditor/StatusGrid/VolumeControl/KeyCap.

## 2. 타입 (`src/types.ts`)

```ts
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  baseFlow: BaseFlowRef;
  tracks: Track[];
  master: { volume: number };
  transport?: { playPauseKey: string | null }; // 신규. 기존 저장본엔 없을 수 있어 optional.
}
```

읽을 때 기본값: `project.transport?.playPauseKey ?? null`.

## 3. 스토어 액션 시그니처 (`src/store/useStore.ts`)

```ts
reorderTracks: (fromIndex: number, toIndex: number) => void; // 범위 밖이면 무시
clearMarkers: (trackId: string) => void;                     // 해당 트랙 markers=[]
setPlayPauseKey: (key: string | null) => void;               // project.transport.playPauseKey 갱신
```

- 모두 기존 `mutate` 헬퍼로 `project` 단일 전이 + `updatedAt` 갱신(autosave가 영속).
- `reorderTracks`는 인덱스 기반 이동(배열 splice/arrayMove). from===to거나 범위 밖이면 변경 없음.

## 4. 뷰포트 수학 (`src/timeline/viewportMath.ts`) — 순수

```ts
export interface Viewport {
  pxPerMs: number;
  scrollLeftPx: number;
  containerWidthPx: number;
}

export const MAX_PX_PER_MS = 0.5; // 1초당 최대 500px

export function minPxPerMs(containerWidthPx: number, durationMs: number): number; // durationMs<=0 → 0
export function clampPxPerMs(pxPerMs: number, containerWidthPx: number, durationMs: number): number; // [min, MAX]
export function maxScrollLeftPx(vp: Viewport, durationMs: number): number; // max(0, durationMs*pxPerMs - containerWidthPx)
export function clampScrollLeftPx(scrollLeftPx: number, vp: Viewport, durationMs: number): number; // [0, maxScrollLeftPx]
export function timeToX(ms: number, vp: Viewport): number;  // ms*pxPerMs - scrollLeftPx
export function xToTime(x: number, vp: Viewport): number;   // (x + scrollLeftPx)/pxPerMs
// 커서(anchorX)의 시간이 제자리 유지되도록 줌. factor>1 확대.
export function zoomedViewport(vp: Viewport, durationMs: number, factor: number, anchorX: number): Viewport;
```

`zoomedViewport`: `anchorTime = xToTime(anchorX, vp)` → `newPx = clampPxPerMs(vp.pxPerMs*factor, ...)` → `newScroll = clampScrollLeftPx(anchorTime*newPx - anchorX, {pxPerMs:newPx,...}, durationMs)`.

## 5. 뷰포트 스토어 (`src/store/viewport.ts`)

```ts
interface ViewportState {
  pxPerMs: number;
  scrollLeftPx: number;
  containerWidthPx: number;
  durationMs: number;
  setContainerWidth: (px: number) => void; // 변경 시 pxPerMs/scroll 재클램프
  setDuration: (ms: number) => void;        // 프로젝트 로드 시. 재클램프 + 필요시 fitAll
  fitAll: () => void;                        // pxPerMs=minPxPerMs, scrollLeftPx=0
  panByPx: (dx: number) => void;             // scrollLeftPx 클램프 이동
  zoomAt: (factor: number, anchorX: number) => void; // zoomedViewport 적용
}
export const useViewport = create<ViewportState>(...)
```

모든 클램프는 §4 함수 사용. `containerWidthPx` 초기값 1(0 분모 방지), `durationMs` 초기 0.

## 6. 에디터 UI 스토어 (`src/store/editorUi.ts`)

```ts
interface EditorUiState {
  sequencerOpen: boolean;
  region: { startMs: number; endMs: number };
  stepCount: number;
  toggleSequencer: () => void;
  setSequencerOpen: (b: boolean) => void;
  setRegion: (r: { startMs: number; endMs: number }) => void;
  setStepCount: (n: number) => void;       // max(1, n)
  resetForTrack: () => void;               // region={0,4000}, stepCount=8 (기본값)
}
export const useEditorUi = create<EditorUiState>(...)
```

포커스 트랙이 바뀌면(Editor에서 `selectedTrackId` 변화 감지) `resetForTrack()` 호출.

## 7. formatKeyCode (`src/domain/formatKeyCode.ts`) — 순수

```ts
export function formatKeyCode(code: string | null): string;
```

규칙:
- `null` 또는 `""` → `"Key"`
- `"KeyA"`..`"KeyZ"` → `"A"`..`"Z"` (마지막 글자)
- `"Digit0".."Digit9"` → `"0".."9"`
- `"Numpad0".."Numpad9"` → `"0".."9"`
- `"Space"` → `"Space"`
- `"ArrowLeft"/Right/Up/Down` → `"←"/"→"/"↑"/"↓"`
- `"Escape"` → `"Esc"`, `"Enter"` → `"Enter"`
- 그 외 → `code` 원문

## 8. 컴포넌트 props 계약

```ts
// BaseFlowLane: 클릭=seek(xToTime), 더블클릭=useViewport.fitAll()
interface BaseFlowLaneProps { peaks: Float32Array | null; durationMs: number; }

// PlayheadOverlay: 뷰포트 + playheadMs 구독, 세로선
// (props 없음)

// TrackRow: sortable 단위
interface TrackRowProps { track: Track; index: number; focused: boolean; }

interface TrackEditorProps { track: Track; focused: boolean; }

// MarkerEditor: focused→SVG(좌클릭 추가/우클릭 삭제), else 캔버스 오버뷰.
// 편집 활성 조건: resolveTrackBehavior(mode, track.status) === "record"
interface MarkerEditorProps { track: Track; focused: boolean; }

interface StatusGridProps { value: TrackStatus; onChange: (s: TrackStatus) => void; }

interface VolumeControlProps { value: number; onChange: (v: number) => void; }

// KeyCap: 클릭 후 키 캡처. 표시는 formatKeyCode(code).
interface KeyCapProps { code: string | null; onCapture: (code: string) => void; }
```

상태 라벨/색: M=뮤트(#6b7280) / L=리스닝(#22d3ee) / P=플레이(#4ade80) / W=라이트(#ec4899).

## 9. 키보드 (`src/input/KeyboardController.ts`)

keydown 처리 순서:
1. `e.repeat`면 무시.
2. target이 INPUT/SELECT/TEXTAREA면 return(타이핑 허용).
3. `state.mode`가 `"play"|"record"`면 `e.preventDefault()` (모든 키 기본동작 차단, 요구 6).
4. 재생키 일치(`project.transport?.playPauseKey === e.code`) → 재생/일시정지 토글(모든 모드, 요구 12). runtime의 `play()`/`pause()` 사용.
5. 트랙 키 일치 → 기존 record(addMarker+sound)/perform(sound+pressTrack) 동작.

## 10. dnd-kit (계획 4에서 설치)

```
yarn add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```
좌측 TrackEditor 컬럼을 `SortableContext`(verticalListSortingStrategy)로 감싸고, 드롭 시 인덱스로 `reorderTracks(from,to)` 호출. 드래그 핸들은 TrackEditor 내부.

## 11. 의존 순서

계획 1(뷰포트/타임라인 골격) → 2(행 분해/마커에디터/포커스) → 3(트랙에디터 컨트롤) → 4(DnD) → 5(툴바+시퀀서 재배치) → 6(키보드). 각 계획은 끝에서 테스트·tsc 그린 + 커밋.
