# 새 프로젝트 생성 시 베이스 플로우 선택 — Design

## 배경 / 문제

유튜브 베이스 플로우 기능(`2026-05-29-youtube-base-flow-design.md`, PR #7)은 구현됐지만 진입점이 어색하다. 현재 랜딩(`ProjectList.tsx`)에는 **"새 프로젝트 (오디오 업로드)"**와 **"예제 프로젝트"** 버튼만 있어, 유튜브로 시작하려면 (1) 오디오 프로젝트를 업로드로 만들고 (2) 에디터에서 "베이스 플로우" 버튼으로 소스를 교체해야 한다.

그러나 **기존 프로젝트의 베이스 플로우 변경은 희박한 usecase**다. 일반적인 흐름은 *새 프로젝트를 만들 때* 파일 또는 유튜브를 선택해 셋업하는 것이다. 진입점을 생성 시점으로 옮긴다.

## 목표

- 새 프로젝트 생성 시 오디오 파일 또는 유튜브 영상을 골라 셋업한다.
- 에디터 내 베이스 플로우 변경 진입점을 제거해 UI를 단순화한다.

## 비목표 (YAGNI)

- 기존 프로젝트의 베이스 플로우 사후 교체(드문 usecase라 제거).
- 유튜브 영상 제목 자동 가져오기(클라이언트 전용이라 YouTube Data API 키 없이 불가).

## 결정 사항 (사용자 확정)

- **진입점:** 단일 "새 프로젝트" 버튼 → 소스 선택 모달(탭: 오디오 업로드 / 유튜브).
- **에디터 변경 버튼:** 제거. 유튜브 전용 컨트롤(미니/앰비언트 토글·강도 슬라이더·nudge)은 유지.
- **유튜브 이름:** 모달에서 선택 입력. 비우면 `"유튜브 프로젝트"`로 자동.

## 아키텍처 / 컴포넌트

### 1. `src/domain/newProject.ts` (신규, 순수 빌더)

`buildProjectFromBlueprint`(예제 프로젝트) 컨벤션을 따른다 — 내부에서 `newId()`·`Date.now()` 생성, fetch/decode와 무관.

```ts
/** 업로드한 오디오 자산으로 빈 프로젝트를 만든다. */
export function buildAudioFileProject(name: string, assetId: string, durationMs: number): Project

/** 유튜브 영상으로 빈 프로젝트를 만든다. durationMs는 onReady 후 write-back되므로 0으로 시작.
 *  name이 공백이면 "유튜브 프로젝트"로 대체. */
export function buildYouTubeProject(videoId: string, name: string): Project
```

- 두 빌더 모두 `tracks: []`, `master: { volume: 1 }`, `transport: { playPauseKey: null }`, `libraryAssetIds: []`, `baseFlowView: DEFAULT_BASE_FLOW_VIEW`로 초기화.
- audioFile: `baseFlow = { kind: "audioFile", assetId, durationMs }`.
- youtube: `baseFlow = { kind: "youtube", videoId, durationMs: 0 }`.

### 2. `src/ui/NewProjectModal.tsx` (신규)

`Modal` primitive 기반. 탭 `[오디오 업로드 / 유튜브]`. `BaseFlowPicker`의 탭 UI/스타일을 계승하되 동작이 다르다(소스 mutate가 아니라 프로젝트 생성).

```ts
interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  onCreated(project: Project): void; // 생성·저장 후 에디터 진입용
}
```

- **오디오 탭:** 파일 선택(클릭/드롭) → `getEngine().decode(file)` → `normalizeAssetName(file.name)` → `putAsset` → `buildAudioFileProject` → `saveProject` → `onCreated`.
- **유튜브 탭:** URL 입력 + 이름 입력(선택, placeholder "유튜브 프로젝트") → `parseYouTubeId` → `buildYouTubeProject` → `saveProject` → `onCreated`.
- **에러 처리:** 유효하지 않은 URL / 디코드 실패는 모달 내 인라인 메시지(`alert` 대신). 디코드 등 비동기 동안 버튼 비활성 + 로딩 표시.

### 3. `src/ui/ProjectList.tsx` (수정)

- "새 프로젝트 (오디오 업로드)" 버튼 → **"새 프로젝트"** 단일 버튼. 클릭 시 `NewProjectModal` 오픈.
- 기존 `handleFile`·hidden `<input type=file>`는 모달로 이전 후 제거.
- `onCreated(project)` → `setProject(project)` + `onOpen(project)`.
- "예제 프로젝트" 버튼·프로젝트 그리드·복사/삭제/이름수정은 그대로.

### 4. `src/ui/Editor.tsx` (수정)

- 헤더의 "베이스 플로우" 버튼, 피커 `Modal`, `pickerOpen` 상태, `BaseFlowPicker` import 제거.
- 유튜브일 때의 미니/앰비언트 토글·강도 슬라이더는 유지.

### 5. `src/ui/BaseFlowPicker.tsx` + `BaseFlowPicker.module.css` (삭제)

에디터에서 더는 사용하지 않고 생성 모달로 대체.

## 데이터 흐름

```
NewProjectModal
  → (오디오) decode + putAsset + buildAudioFileProject
  → (유튜브) parseYouTubeId + buildYouTubeProject
  → saveProject(idb)
  → onCreated → setProject(store) + onOpen
  → Editor: baseFlow.kind 분기 로드(기존 구현)
     - youtube: onReady 후 setBaseFlowDurationMs로 길이 write-back
```

## 영향 / 잔존

- `useStore.setBaseFlow` 액션은 더는 UI에서 호출되지 않지만, 카논 mutate 경로이자 테스트가 있어 유지(데드코드 제거는 비목표). 나머지 baseFlow 액션(`setBaseFlowDurationMs`/`setBaseFlowView`/`setBaseFlowOffsetMs`/`setBaseFlowLoading`)은 계속 사용.

## 테스트 전략

- **단위:** `src/domain/newProject.test.ts` — 두 빌더의 `baseFlow.kind`·필드, 빈 트랙/마스터/transport/libraryAssetIds/baseFlowView 기본값, 유튜브 이름 공백 → "유튜브 프로젝트" 대체, durationMs 0.
- **수동(RTL 미설치):** 랜딩 "새 프로젝트" → 모달 탭 전환, 오디오 업로드 생성, 유튜브 URL 생성(이름 유무), 잘못된 URL 인라인 에러, 에디터 진입 후 정상 로드. 에디터 헤더에 베이스 플로우 버튼이 더는 없음 확인.

## 패키지매니저

yarn (classic 1.22.22). `yarn vitest run <path>`, `yarn test:run`, `yarn build`.
