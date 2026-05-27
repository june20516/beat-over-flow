# Editor 아키텍처 v2 설계 문서

> 작성일: 2026-05-27
> 상태: 설계 합의 완료 (구현 계획 작성 전)
> 선행 문서: `2026-05-26-beat-over-flow-design.md` (제품 전체 설계·곱셈 모델)

## 1. 개요

v1 Editor는 동작하지만, 12개의 신규 UX 요구사항(트랙 편집 고도화·인라인 시퀀서·가로 스크롤/줌·드래그 정렬 등)을 지금 구조로는 깔끔하게 수용할 수 없다. 이 문서는 **Editor를 "모놀리식 캔버스 + 분리된 헤더 컬럼"에서 "공유 뷰포트 + 행 기반 타임라인"으로 재편**하는 설계를 정의한다.

핵심 통찰: 요구사항 4·9·10·11은 모두 "트랙이 DOM 행이어야 하고, 모든 레인이 하나의 가로 좌표계를 공유해야 한다"는 동일한 구조 변경을 요구한다. 이 변경 하나가 다수 요구를 동시에 해소하므로 재편의 기대 가치가 충분하다.

## 2. 현재 구조와 한계

**현재:** `Editor` = `ScoreHud` + 상단바 + `TransportBar` + `editor-main`(`TrackList`[헤더 컬럼] + `TimelineCanvas`[모든 레인을 단일 캔버스에 렌더]) + `StepSequencerPanel`[하단].

- 마커는 캔버스 원으로 그려지고, 클릭 핸들링은 캔버스 내부에서 y좌표로 레인 인덱스를 계산.
- 가로 스크롤/줌 개념이 없음.

**한계 (요구사항과의 충돌):**
- **4** 시퀀서가 선택 트랙의 DOM 하위로 들어가야 함 → 트랙이 캔버스 레인이 아니라 DOM 행이어야 함.
- **9** 포커스 트랙 확장/축소 + 애니메이션 → 행별 높이 트랜지션 필요.
- **10** 가로 스크롤/줌이 베이스 파형·모든 마커·플레이헤드·구간에 동기 적용 → 공유 좌표계 필요.
- **11** track editor / marker editor 분리 → 각 트랙 행 = `[TrackEditor | MarkerEditor]`.

## 3. 용어 정의 (요구 11·5)

- **Timeline**: 스크롤/줌 컨테이너. 공유 뷰포트를 소유.
- **Track Editor**: 각 트랙 행의 **좌측 고정폭 설정 영역** (이름·상태·사운드·키·볼륨·마커비우기·삭제·드래그핸들).
- **Marker Editor**: 각 트랙 행의 **우측 마커 레인**. 마커를 시각화/편집하는 저작 표면.
- **Base Flow Lane**: 최상단 베이스 파형 레인 (캔버스).
- **Viewport (뷰포트)**: 시간↔픽셀 변환의 단일 소스 상태. 영속되지 않는 휘발성 뷰 상태.
- **포커스 트랙**: 현재 선택된 트랙(`selectedTrackId`). 풀 데이터/상호작용을 가진 단 하나의 트랙.

## 4. 컴포넌트 구조

```
Editor
├─ ScoreHud
├─ TopBar           (프로젝트명, ModeSwitcher, 목록)
├─ TransportBar     (재생/일시정지 + 재생키 KeyCap[12], 시간, seek, 마스터 볼륨)
├─ EditorToolbar    ← NEW 전역 툴바: 시퀀서 on/off 토글[4], 줌 리셋
└─ Timeline         ← NEW 공유 뷰포트 소유, wheel 팬/줌 핸들링[10]
    ├─ 좌측 고정 컬럼            |  우측 arrange 영역(뷰포트 적용)
    ├─ (헤더 슬롯)               |  TimeRuler + BaseFlowLane(캔버스) + PlayheadOverlay
    └─ TrackRow[]  (dnd-kit sortable, 좌측 컬럼이 드래그 단위)
         ├─ TrackEditor[11]
         │    드래그핸들, 이름, StatusGrid[2], 사운드 select,
         │    KeyCap[3], VolumeControl[1], ClearMarkers[7], 삭제
         ├─ MarkerEditor[11]
         │    포커스 → 가상화 SVG 마커 (좌클릭 추가 / 우클릭 삭제[5])
         │    언포커스 → 캔버스 오버뷰(가는 틱)
         └─ (포커스 && sequencerOpen) StepSequencer  ← 이 행 바로 아래 자식[4]
```

**좌/우 2컬럼 동기:** 좌측 Track Editor 컬럼은 가로 스크롤되지 않고 고정. 우측 arrange 영역만 뷰포트가 적용된다. 두 컬럼은 동일한 트랙 순서와 동일한 행 높이(포커스 상태)로 렌더되어 세로로 정렬된다.

## 5. 공유 뷰포트 (요구 10)

네이티브 가로 스크롤바를 쓰지 않고, 휘발성 상태가 시간↔픽셀 변환을 전담한다. 각 레인은 콘텐츠를 이 상태 기준으로 offset(transform)하여 그린다. → 여러 레인의 스크롤 동기화가 자동, 줌 앵커링이 단순.

**상태 (`useViewport`, 별도 zustand 스토어 — project와 분리, 영속 안 함):**
- `pxPerMs: number` — 줌(픽셀/밀리초).
- `scrollLeftPx: number` — 가로 스크롤 오프셋(px).
- `containerWidthPx: number` — 마커 에디터 가시 폭(레이아웃 측정값).
- `followPlayhead: boolean` — 재생 중 플레이헤드 auto-follow 여부(기본 `true`).

**파생/규칙:**
- `minPxPerMs = containerWidthPx / durationMs` (곡 전체가 가시폭에 딱 맞음 = 100%).
- `pxPerMs`는 `[minPxPerMs, MAX_PX_PER_MS]`로 클램프. `MAX_PX_PER_MS`는 합리적 상한(예: 0.5 = 1초당 500px).
- `scrollLeftPx`는 `[0, durationMs*pxPerMs - containerWidthPx]`로 클램프.
- `timeToX(ms) = ms * pxPerMs - scrollLeftPx`
- `xToTime(x) = (x + scrollLeftPx) / pxPerMs`

**인터랙션:**
- 휠(deltaY/deltaX) → `scrollLeftPx` 가로 팬. **수동 팬은 `followPlayhead`를 `false`로 끈다**(사용자와 다투지 않기 위해).
- Shift + 휠 → 줌. **커서 위치의 시간이 제자리에 유지되도록** 앵커링(`scrollLeftPx` 재계산). 줌은 follow를 유지한다(배율만 바뀌고, 다음 follow 갱신이 다시 중앙 정렬).
- 베이스 파형 더블클릭 → `pxPerMs = minPxPerMs`, `scrollLeftPx = 0` (최소줌 리셋).
- 프로젝트 변경/`durationMs` 변경/컨테이너 리사이즈 시 뷰포트 재계산(최소 클램프 유지).

**재생 중 auto-follow (요구: 뷰포트가 작을 때 재생하면 플레이헤드를 따라 이동):**
- 재생 중 `followPlayhead`가 켜져 있으면, 플레이헤드가 **가시영역의 가로 중앙에 오도록** 뷰포트가 따라 스크롤한다(`scrollLeftPx = playheadMs*pxPerMs - containerWidthPx/2`, 클램프). 결과적으로 진행 방향을 타고 자연스럽게 이동한다.
- **최소줌(곡 전체가 보임)에서는 `maxScrollLeftPx=0`이라 자동으로 no-op** — 별도 분기 없이 클램프만으로 "뷰포트가 작을 때만 따라감"이 성립한다.
- **수동 팬 시 follow 해제**, **재생 시작(`play()`) 시 follow 재활성**. (선택) `EditorToolbar`에 follow on/off 토글을 둘 수 있다.
- 구현 위치: 재생 RAF 루프(`audio/runtime.ts`)가 매 프레임 `playheadMs` 갱신 후 뷰포트의 follow 갱신을 호출한다(React 이펙트가 아니라 비-React 직접 호출로 매 프레임 비용 최소화). seek 시에도 1회 갱신.

## 6. 데이터 모델 변경 (`types.ts`)

```ts
export interface Project {
  // ...기존 동일...
  transport?: { playPauseKey: string | null }; // 신규(영속). 기존 저장 프로젝트엔 없으니 읽을 때 기본값 처리[12]
}
```

그 외 영속 모델 변경 없음:
- 트랙 순서(8) = `tracks` 배열 순서 → autosave가 자동 영속.
- 마커 비우기(7) = 마커 제거.
- 상태 그리드(2)/볼륨 팝오버(1) = UI 전용.
- 키 라벨(3) = 표시 전용. 저장은 기존대로 `e.code`(예: `"KeyA"`).

## 7. 스토어 변경 (`store/useStore.ts`)

신규 액션:
- `reorderTracks(fromIndex: number, toIndex: number)` — `@dnd-kit`의 `arrayMove` 사용 (8).
- `clearMarkers(trackId: string)` — 해당 트랙 마커 전부 제거 (7).
- `setPlayPauseKey(key: string | null)` — `project.transport.playPauseKey` 갱신 (12).

`selectedTrackId`를 "포커스 트랙"으로 그대로 활용(추가 상태 없음, 9).

**undo/redo 대비 규칙(지금 구현 X, 전제만 확정):**
- 모든 마커/트랙 편집은 store의 `project` 상태 전이로 **일원화**한다. store를 우회해 마커를 바꾸는 경로를 만들지 않는다.
- **"사용자 한 동작 = 원자적 1 전이 = undo 1스텝"**. `반복 채우기`·`마커 전체 비우기`는 내부적으로 마커 다수를 바꿔도 단일 `set` 전이여야 한다(이미 그러함). 이를 깨지 않는다.
- 이 전제 위에서 추후 zundo(MIT, zustand temporal 미들웨어, `partialize: s => s.project`) 또는 스냅샷 히스토리를 손쉽게 얹을 수 있다. 채택은 그 기능 착수 시점에 결정.

## 8. 요구사항별 설계

| # | 설계 |
|---|---|
| 1 | `VolumeControl`: 스피커 아이콘 버튼 → 클릭 시 **세로 range** 팝오버(absolute, 클릭아웃/Esc 닫힘). 기존 `range-fill`을 세로(writing-mode 또는 회전)로 적용. |
| 2 | `StatusGrid`: M/L/P/W 단일문자 2×2 버튼. 톤 배경색(M=회색·L=시안·P=초록·W=핑크), 선택된 것 배경 강조, `title`=풀라벨(뮤트/리스닝/플레이/라이트). 기존 `<select>` 대체. |
| 3 | `formatKeyCode(code: string \| null): string` (`domain/`, 순수함수): `null→"Key"`, `"KeyA"→"A"`, `"Digit1"→"1"`, `"Space"→"Space"`, `"ArrowLeft"→"←"` 등. `KeyCap` 표시에 사용. |
| 4 | 전역 `EditorToolbar`의 토글이 `sequencerOpen`(UI 상태) 제어. `sequencerOpen && 포커스 트랙 존재` 시 포커스 `TrackRow` **바로 아래** `StepSequencer`를 자식으로 렌더. 시퀀서 내부 로직(`domain/sequencer`)은 유지. 구간/칸수(`region`/`stepCount`)는 UI 상태로 보관하며 포커스 트랙 변경 시 초기화. |
| 5 | `MarkerEditor`: **좌클릭=마커 추가 / 우클릭(contextmenu, preventDefault)=가장 가까운 마커 삭제**(동위 조작). **`resolveTrackBehavior(mode, status) === "record"`(레코드 모드 + write 트랙)일 때만 활성.** 기존 키 기반 record 라이브 캡처는 유지. |
| 6 | `KeyboardController`: keydown 시 포커스가 input/select/textarea가 **아니고** 모드가 play/record면 **모든 키 `preventDefault`**(브라우저 기본동작 차단). |
| 7 | `TrackEditor`의 "마커 전체 비우기" 버튼 → `clearMarkers(trackId)`. |
| 8 | `@dnd-kit/core` + `@dnd-kit/sortable`로 좌측 Track Editor 행 정렬. 드롭 시 `reorderTracks` → autosave 영속. 우측 레인은 동일 `tracks` 순서를 따르므로 자동 정렬. |
| 9 | 포커스 트랙 = 높은 행 + 풀 컨트롤(Track Editor 전체) + SVG 마커 / 언포커스 = 낮은 행 + 간결 컨트롤 + 캔버스 오버뷰. 행 `height`에 CSS 트랜지션. 트랙 클릭 → 포커스(`setSelectedTrack`). |
| 10 | 5절 뷰포트 참조. wheel 팬 / Shift+wheel 줌(커서 앵커) / 더블클릭 최소줌 리셋 / 최소줌=폭100%. |
| 11 | 컴포넌트 경계로 `TrackEditor`(좌)/`MarkerEditor`(우) 명명 확정. |
| 12 | `TransportBar`에 재생키 `KeyCap` → `setPlayPauseKey`. `KeyboardController`가 **모든 모드**에서 해당 키로 재생/일시정지 토글. |

## 9. 마커 렌더링 — 하이브리드 (성능 ↔ 편집성)

밀도 추산: 120 BPM·4.5분(≈540비트)에서 16분음 하이햇 ≈ 한 레인 ~2,000 마커, 트랙 6~10개면 프로젝트 전체 수천~1만+ 마커. 최소줌(곡 전체 가시)에서 모든 마커가 동시에 보인다.

전략:
- **포커스(선택) 트랙 Marker Editor → SVG 마커** + **가시 영역 가상화**(`timeToX`가 `[0, width]` 범위인 마커만 렌더). 좌/우클릭·접근성·향후 드래그·undo 대상이 여기 하나로 집중(편집은 한 번에 한 트랙).
- **언포커스 트랙 → 캔버스 오버뷰**(가는 틱). 수천 개도 가볍고, 요구 9의 "간결하게"를 그대로 충족.
- **Base Flow → 캔버스 파형**(기존 유지).
- 마커는 매 프레임이 아니라 추가/삭제/줌/스크롤 시에만 갱신. 플레이헤드는 별도 오버레이라 마커 리렌더와 무관.

## 10. 제거/교체 매핑

- `render/TimelineCanvas.tsx` → `Timeline` + `BaseFlowLane`(캔버스 파형) + `MarkerEditor` + `PlayheadOverlay`로 분해.
- `ui/TrackList.tsx` / `ui/TrackHeader.tsx` → `TrackRow` / `TrackEditor`로 재편(상태·볼륨·키캡 로직 이동). `StatusGrid`·`VolumeControl`·`KeyCap`로 분리.
- `ui/StepSequencerPanel.tsx` → 위치만 이동(Editor 하단 → 포커스 트랙 자식). 내부 로직 유지.
- `domain/sequencer.ts`, `scoring/*`, `audio/*`, `persistence/*`는 변경 최소(스토어 액션 추가 외).

## 11. 테스트 전략

- **순수/스토어 (vitest):** `formatKeyCode`, `reorderTracks`, `clearMarkers`, 뷰포트 `timeToX`/`xToTime` + 최소줌 클램프 로직.
- **상호작용:** 마커 좌/우클릭 게이팅(record 동작에서만)은 store/도메인 레벨로 검증 가능한 형태로 분리.
- **브라우저:** 헤드리스 Chrome 드라이버로 단계별 시각 검증(목록·에디터·포커스 확장·시퀀서·스크롤/줌·드래그).

## 12. 확정된 기본값

- 마커 편집(좌/우클릭) = **레코드 모드 + write 트랙**일 때만 (`resolveTrackBehavior === "record"`).
- 가로 스크롤 = 네이티브 스크롤바가 아니라 **뷰포트 transform** 방식.
- 재생키 바인딩 위치 = **TransportBar**, 저장 = `Project.transport.playPauseKey`.
- DnD = **@dnd-kit** (MIT). 시퀀서 토글 = **전역 EditorToolbar**. 키 차단 = **입력 필드 제외**.

## 13. 구현 단계 (계획 골자 — 상세는 별도 plan)

1. **뷰포트 + 타임라인 골격**: `useViewport`, `Timeline`(wheel 팬/줌), `BaseFlowLane`(더블클릭 리셋), `PlayheadOverlay`. `TimelineCanvas` 대체. (10 코어)
2. **행 분해**: `TrackRow` = `TrackEditor` + `MarkerEditor`, 하이브리드 렌더, 좌/우클릭 편집(5), 포커스 확장/애니메이션(9), 용어 확정(11).
3. **트랙 에디터 컨트롤**: `StatusGrid`(2), `VolumeControl`(1), `KeyCap`+`formatKeyCode`(3), `ClearMarkers`(7).
4. **DnD 정렬**: @dnd-kit + `reorderTracks` + autosave(8).
5. **전역 툴바 + 시퀀서 재배치**(4).
6. **키보드 레이어**: `formatKeyCode` 공유, 모드 차단(6), 재생키 바인딩(12).
