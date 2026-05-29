# 유튜브 임베드 베이스 플로우 설계

작성일: 2026-05-29

## 1. 배경과 목표

BeatOverflow는 베이스 플로우(배경 곡) 위에 트랙 마커를 찍고, 그 마커를
박자에 맞춰 연주(마커힛)하는 클라이언트 전용 연습 도구다. 현재 베이스 플로우는
업로드/빌트인 오디오 파일만 지원한다.

이 기능은 **유튜브 영상을 베이스 플로우 소스로 파일과 동등하게** 사용할 수 있게 한다.
사용자가 다운로드할 수 없는 유튜브 곡 위에서도 비트 연습을 할 수 있게 하는 것이 목적이다.

### 목표
- 유튜브 영상을 베이스 플로우로 재생하고, 트랜스포트(재생/일시정지/시크)로 제어.
- 마커·마커힛(메인 기능)의 가독성과 동작을 보존.
- file ↔ youtube 소스 전환 지원.
- 클라이언트 전용 유지(서버·등록 API 키 없음).

### 비목표 (YAGNI)
- 재생 속도 변경, 플레이리스트, 영상 트리밍(`startMs` 시작점만 허용).
- 자동 박자 감지.
- 샘플 단위 정밀 동기화 — 목표는 "합리적 정렬" 수준.

## 2. 핵심 제약 (유튜브 IFrame Player API)

설계 전제가 되는 외부 의존성. 본 구현 전 문서 확인 + 최소 스파이크로 재검증 권장.

- **백그라운드/숨김 재생 불가**: YouTube 약관상 플레이어는 화면에 보여야 하며
  완전히 숨기거나 가릴 수 없다(최소 크기·비가림). 브라우저도 화면 밖/숨겨진
  iframe을 throttle/일시정지한다. 따라서 "백그라운드 재생"은 **보이는 요소로서만**
  가능하다. dim/blur/작게는 허용, 완전 숨김은 불가.
- **타임라인 동기화**:
  - 내 컨트롤 → 유튜브: `playVideo/pauseVideo/seekTo`로 위임 가능(시크에 버퍼링 지연).
  - 유튜브 → 내 타임라인: `getCurrentTime()` 폴링만 제공(거칠고 jitter, 샘플 클럭 없음).
    → 보간 클럭 래퍼로 매끄럽게 변환 필요.
- **재생 정책**: 소리 있는 자동재생은 사용자 제스처 필요(재생 버튼이 충족).
- **임베드 불가 영상**: 일부 영상은 임베드가 비활성(onError 101/150).

## 3. 데이터 모델 (`src/types.ts`)

```ts
export type BaseFlowRef =
  | { kind: "audioFile"; assetId: string; durationMs: number }
  | { kind: "youtube"; videoId: string; durationMs: number;
      startMs?: number; offsetMs?: number };
```

- 기존 `audioFile`은 그대로 두고 `youtube` variant만 추가. `kind` 판별자로 분기.
- `videoId`만 저장(blob/asset 없음). 유튜브 베이스 플로우는 에셋 라이브러리
  (`libraryAssetIds`)와 완전히 무관 — 깔끔하게 분리된다.
- `durationMs`: 유튜브는 `onReady` 이후에만 확정 → 로드 시 ref에 write-back.
- `offsetMs`: 유튜브 오디오 출력과 우리 Web Audio 샘플 출력 사이 지연 보정값
  (수동 nudge). 유튜브 파이프라인 특성이라 youtube ref에 둔다. 기본 0.
- `startMs`: 영상 재생 시작 지점(선택).

Project에 뷰 설정(프로젝트당 영속) 추가:

```ts
baseFlowView?: { layout: "mini" | "ambient"; ambientIntensity: number };
// 기본: layout "mini", ambientIntensity 0.5
```

기존 저장본은 `audioFile`이며 `baseFlowView`가 없다 → 읽을 때 기본값을 적용한다.
별도 스키마 마이그레이션은 불필요(optional + 기본값 처리).

## 4. 소스 추상화 (`src/audio/YouTubeSource.ts`)

기존 `BaseFlowSource` 인터페이스를 구현한다(주석에 이미 "v2는 YouTubeSource가
구현"이라 예고되어 있음). IFrame Player API를 감싸고 **보간 클럭**을 제공한다.

- `onReady`에서 player 준비 완료, `getDuration()`으로 `durationMs` 확정 → ref write-back.
- 보간 클럭: 폴링/상태변경/시크 시 `(ytSec, performance.now())`를 기록한다.
  `currentTimeMs()`는 재생 중 `performance.now()`로 두 폴링 사이를 보간하고
  `offsetMs`를 적용한다. 주기적(≈250ms) 리싱크로 드리프트를 보정한다.
- `isPlaying()`은 YT state가 PLAYING일 때만 true → **버퍼링 중에는 false**가 되어
  마커가 침묵 속에 발화되지 않는다(플레이헤드는 재생 재개까지 정지).
- `play/pause/seek` → `playVideo/pauseVideo/seekTo`로 위임.
- `dispose`로 player와 폴링 타이머를 모두 해제.

### 스케줄러 무변경 근거
`Scheduler.ctxTimeForMarker(nowCtxSec, markerMs, nowMs) = nowCtxSec + (markerMs - nowMs)/1000`은
"현재 소스 위치 대비 마커가 얼마나 미래인지"만 사용한다. 보간 클럭이 매끄럽고
재생 배속이 1x(배속 변경 비노출)이면 이 식은 그대로 성립한다. 따라서
스케줄러/RAF/트랜스포트는 변경하지 않는다.

## 5. 런타임 통합 (`src/audio/runtime.ts`)

- `loadBaseFlow`만 `ref.kind`로 분기 → `AudioFileSource` 또는 `YouTubeSource` 생성.
- 스케줄러/RAF/트랜스포트: **무변경**(추상화 덕).
- 로딩/버퍼링 상태를 store에 노출(예: `baseFlowLoading`) → UI 스피너 표시,
  준비 전 재생 버튼 비활성.

## 6. UI

### 플레이어 배치 토글 (`mini` ↔ `ambient`, 프로젝트당 영속)
- `mini`: 드래그 가능한 구석 미니플레이어. 타임라인 간섭 최소(기본값).
- `ambient`: 영상이 타임라인 배경. **균형 프리셋**(블러 + 중간 dim)으로
  영상은 분위기 색감으로 남기고 마커 가독성을 보존. `ambientIntensity` 슬라이더로
  영상 노출 강도 조절(0=마커 우선, 1=영상 우선; 기본 0.5).
- 두 모드 모두 iframe을 살아있는 온스크린 DOM에 유지하므로 재생은 동일.

### 베이스 플로우 피커 (file ↔ youtube 전환 진입점)
- 탭 2개: "파일" / "유튜브".
- 유튜브 탭: URL 입력 → `videoId` 파싱(순수 함수; `watch?v=`, `youtu.be/`, `embed/` 지원).
- 프로젝트 생성과 에디터 양쪽에서 접근 가능.

### nudge 슬라이더
- 유튜브 소스일 때만 노출. `offsetMs`를 ±조정해 마커 어긋남을 사용자가 직접 보정.

### 파형 레인
- 유튜브는 파형이 없으므로 기존 80px 파형 레인을 단순 진행바 레인으로 대체.

### 소스 전환 시 마커 처리
- **절대시간 유지 + 클립**: 마커 ms는 그대로 보존한다. 새 베이스 플로우 길이를
  초과하는 마커는 표시만 숨기고 데이터는 보존한다(비파괴적).

## 7. 엣지 케이스 / 에러 처리

- 임베드 불가/비공개/삭제(onError 101·150·100·2): 에러 표시 후 다른 소스 선택 유도.
- 첫 재생: 사용자 제스처(재생 버튼)로 자동재생 정책 충족.
- 잘못된 URL: `videoId` 파싱 실패 메시지.
- 시크 직후 버퍼링: `isPlaying()` false 유지, 재개 시 정상 진행.

## 8. 테스트 전략

- `YouTubeSource`: 가짜 IFrame player + 가짜 clock(주입형)으로 보간/상태매핑/
  seek·buffer 전이/`offsetMs` 적용을 단위 테스트.
- `BaseFlowRef` 기본값 적용(구 저장본 읽기), `videoId` 파싱 순수 함수,
  마커 클립 로직.
- 실제 iframe 로딩·재생은 수동/통합 확인(단위 테스트 비대상).

## 9. 영향받는 파일(예상)

- `src/types.ts` — `BaseFlowRef` union 확장, `Project.baseFlowView` 추가.
- `src/audio/YouTubeSource.ts` — 신규.
- `src/audio/runtime.ts` — `loadBaseFlow` 분기, 로딩 상태 노출.
- `src/persistence/projects.ts` — 읽기 시 기본값 처리.
- `src/ui/` — 베이스 플로우 피커, 플레이어 배치(mini/ambient), nudge 슬라이더,
  진행바 레인(파형 레인 대체), 로딩/에러 상태.
- 동기화 유틸(videoId 파싱 등) 순수 함수 + 테스트.
