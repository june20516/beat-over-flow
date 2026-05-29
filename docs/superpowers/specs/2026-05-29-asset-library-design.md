# 트랙 에셋 라이브러리 — 설계

작성일: 2026-05-29
브랜치: `feat/asset-library-modal`
관련: `docs/superpowers/specs/2026-05-26-beat-over-flow-design.md`(제품),
       `docs/superpowers/specs/2026-05-27-editor-architecture-v2-design.md`(v2 재편)

## 0. 한 줄

트랙 사운드를 **프로젝트 스코프의 에셋 라이브러리**(빌트인 6 + 업로드 N)로 묶고,
트랙 드롭다운은 **MRU 6슬롯**, 전체 보기는 **Radix Dialog 기반 그리드 카드 모달**로 분리한다.
모달 도입을 계기로 `<Modal>`·`<LoadingOverlay>` 두 UI primitive를 디자인 시스템에 추가한다.

## 1. 동기

- 트랙 에셋 선택이 현재 `<select>` 빌트인 6종만 노출하는 단일 UI → 유저 자유도(이 제품의 핵심 정체성)와 충돌.
- `SoundRef`는 이미 `builtin | upload` 두 타입을 지원하나 UI가 따라가지 못함.
- 향후 모달이 늘어남(키바인딩 안내·내보내기·설정 등) → 첫 모달 도입 시점에 **시스템 베이스**를 깐다.
- 기존 비동기 작업(프로젝트 복사·예제 프로젝트 빌드)에 블로킹/진행률 인디케이터가 없어 UX 흠.

## 2. 결정 요약

| 항목 | 결정 |
|---|---|
| 에셋 스코프 | **프로젝트 스코프**. 복제 시 함께 깊은 복사 |
| 빌트인 ↔ 업로드 | 같은 라이브러리, 빌트인은 잠금(🔒) — 삭제/이름변경 불가 |
| 에셋 정체성 | **원샷, ≤ 5초, ≤ 5MB** |
| 허용 포맷 | `audio/*` MIME — `decodeAudioData`가 받는 모든 포맷(`.wav .mp3 .ogg .flac .m4a .aac .webm`). MIME 검사 + decode 성공 여부가 게이트 |
| MRU 큐 | 트랙별 영속 `recentSounds: SoundRef[]` — **6슬롯**. `recentSounds[0] === sound` 불변량. 시드 = 빌트인 6종 |
| 모달 진입 | **관리 모드**(상단 툴바, 풀권한) / **선택 모드**(드롭다운 "전체 보기", 읽기 + 업로드만) |
| 삭제 가드 | 어떤 트랙이라도 현재 sound로 쓰면 삭제 불가. 사용처 트랙명 안내 |
| 이름 길이 | 입력 32자 컷 + 트랙 행 사운드 라벨에 hover 툴팁(전체 이름) |
| Modal primitive | **`@radix-ui/react-dialog`** 신규 도입 |
| Dropdown primitive | **`@radix-ui/react-dropdown-menu`** 신규 도입(`<TrackSoundSelect>`용) |
| 레이아웃 | 그리드 카드. "내 에셋" 펼침(상단, createdAt desc) + "빌트인" 접힘(하단) |
| 빌트인 접힘 상태 | localStorage 기억, 기본 접힘 |
| 벌크 업로드 | `multiple` + 드롭존. 파일별 독립 검증. 동명 충돌 시 `(2)` 접미 |
| 블로킹 로딩 | 새 primitive `<LoadingOverlay>` (determinate/indeterminate). 적용: 벌크 업로드 / 복사 / 예제 프로젝트 |
| 미리듣기 | 카드 ▶ 1회 재생, 동시 1개 제한, 모달 닫힐 때 stop |

## 3. 데이터 모델

### 3.1 `Track`

```ts
export interface Track {
  // ... 기존 필드
  recentSounds: SoundRef[]; // 최대 6. recentSounds[0] === sound 불변량
}
```

### 3.2 `Project`

```ts
export interface Project {
  // ... 기존 필드
  libraryAssetIds: string[]; // 이 프로젝트의 "내 에셋" 멤버십. 빌트인 미포함
}
```

업로드한 에셋은 트랙 부착 여부와 무관하게 라이브러리에 남는다 → 명시적 멤버십.

### 3.3 `StoredAsset`

```ts
export interface StoredAsset {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number; // epoch ms. "n분 전" 표시 + 정렬 키
}
```

### 3.4 마이그레이션

`persistence/projects.ts`의 로드 단계에서 normalize:

- `track.recentSounds` 없음 → `[track.sound, ...빌트인 5개(중복 제거)]` 시드
- `project.libraryAssetIds` 없음 → `[]`
- 기존 트랙 `track.sound`가 upload인데 `libraryAssetIds`에 없으면 자동 등록(데이터 일관성)

`persistence/assets.ts`의 로드 단계에서:

- `createdAt` 없음 → `0`으로 마이그레이션("오래 전"으로 표시)

## 4. 영속 API 확장 (`persistence/assets.ts`)

```ts
// 기존
putAsset(blob: Blob, name: string): Promise<string>           // createdAt 자동 부여 추가
getAsset(id): Promise<StoredAsset | null>
copyAsset(id): Promise<string>

// 신규
listAssetsByIds(ids: string[]): Promise<StoredAsset[]>        // 누락 id는 결과에서 빠짐
deleteAsset(id: string): Promise<void>
renameAsset(id: string, newName: string): Promise<void>
```

## 5. `duplicateProject` 확장

- assetId 맵핑 캐시(`idMap: Map<string,string>`)로 중복 `copyAsset` 방지.
- `clone.libraryAssetIds`도 같은 맵으로 깊은 복사.
- 각 트랙의 `track.sound`(upload) + `track.recentSounds`(각 upload) 모두 동일 맵으로 재매핑 → `recentSounds[0] === sound` 자동 보존.
- 복제 동안 `<LoadingOverlay determinate>` 표시. progress = `(처리된 asset 수) / (총 asset 수)`.

## 6. `buildProjectFromBlueprint` (예제 프로젝트) 확장

- 빌트인 시드 헬퍼 `BUILTIN_SEED: SoundRef[]` 추가.
- 각 트랙의 `recentSounds = [t.sound, ...BUILTIN_SEED(중복 제거)].slice(0, 6)`.
- `libraryAssetIds: []` (예제는 빌트인만 사용).

## 7. UI 구조

### 7.1 폴더 배치

```
src/ui/
├── primitives/                    ← 도메인 모르는 재사용 베이스
│   ├── Modal.tsx
│   ├── Modal.module.css
│   ├── LoadingOverlay.tsx
│   └── LoadingOverlay.module.css
├── asset-library/                 ← 이 기능 묶음
│   ├── AssetLibraryModal.tsx
│   ├── AssetLibraryModal.module.css
│   ├── AssetCard.tsx
│   ├── AssetCard.module.css
│   ├── AssetUploadDropzone.tsx
│   ├── TrackSoundSelect.tsx       ← 기존 <select> 자리 (Radix DropdownMenu)
│   ├── TrackSoundSelect.module.css
│   └── useAssetLibrary.ts         ← IDB ↔ store 연결 훅
├── EditorToolbar.tsx              ← 라이브러리 트리거 버튼 추가
└── TrackEditor.tsx                ← <select> 제거, <TrackSoundSelect/> 사용
```

### 7.2 `<Modal>` (primitive)

Radix Dialog 얇은 래퍼.

```tsx
<Modal open={open} onOpenChange={setOpen} title="샘플 라이브러리" size="lg">
  <Modal.Body>...</Modal.Body>
  <Modal.Footer>...</Modal.Footer>
</Modal>
```

- props: `open`, `onOpenChange`, `title`(필수, aria), `description`(선택), `size: "sm" | "md" | "lg"`.
- backdrop 클릭/ESC 모두 close (Radix 기본).
- focus trap·복원·body scroll lock = Radix 기본.

### 7.3 `<LoadingOverlay>` (primitive)

전역 단일 인스턴스 + zustand 슬라이스. App 루트에 한 번 마운트, 어디서든 호출.

```ts
interface LoadingOverlayState {
  open: boolean;
  mode: "indeterminate" | "determinate";
  progress?: number;   // 0..1
  label?: string;
  show(opts: { mode: "indeterminate" | "determinate"; label?: string }): void;
  setProgress(p: number): void;
  hide(): void;
}
```

- Radix Dialog(modal=true, ESC/외부 클릭 모두 무시).
- `determinate` = 가로 진행 바 + `Math.round(p*100)%`.
- `indeterminate` = 회전 스피너.

### 7.4 `<AssetLibraryModal>` (feature)

```tsx
type Mode = "manage" | "select";

interface Props {
  open: boolean;
  mode: Mode;
  targetTrackId?: string;   // mode === "select"일 때만
  onClose(): void;
}
```

내부:

```
┌─ Modal.Body ─────────────────────────────────────────────┐
│ AssetUploadDropzone  (모달 본문 전체가 dropzone — 오버레이) │
│                                                          │
│ ▾ 내 에셋 (N)                  [+ 업로드]                 │
│   <AssetCard kind="upload" ...> × N (createdAt desc)     │
│                                                          │
│ ▸ 빌트인 샘플 (6)                                          │
│   (펼치면 BUILTIN_SAMPLES 카드)                            │
└──────────────────────────────────────────────────────────┘
┌─ Modal.Footer ───────────────────────────────────────────┐
│                                                  [닫기]  │
└──────────────────────────────────────────────────────────┘
```

### 7.5 `<AssetCard>` (feature)

```tsx
interface Props {
  asset:
    | { kind: "builtin"; sampleId: string; label: string }
    | { kind: "upload"; id: string; name: string; durationMs: number; createdAt: number };
  mode: "manage" | "select";
  isCurrent?: boolean;            // 선택 모드에서 현재 트랙 sound면 강조
  onSelect?(): void;              // mode === "select"
  onRename?(newName: string): void; // mode === "manage" && kind === "upload"
  onDelete?(): void;              // mode === "manage" && kind === "upload"
  onPreview(): void;              // 공통
}
```

- 좌상 ▶ 미리듣기 버튼.
- 메타: 빌트인 → `🔒 라벨`, 업로드 → `이름 / 1.2s / 5분 전`.
- 액션:
  - `mode="manage"` + upload → ✏️(rename) · 🗑(delete).
  - `mode="select"` → 카드 전체 클릭 영역(= `onSelect`).
  - 현재 sound = 강조 테두리.

### 7.6 `<AssetUploadDropzone>` (feature)

- 모달 본문 위에 invisible overlay. 드래그 시작 시 dim + "여기에 드롭" 안내.
- 헤더 우상 [+ 업로드] = `<input type="file" multiple accept="audio/*">` 트리거.

### 7.7 `<TrackSoundSelect>` (feature) — `<select>` 교체

Radix DropdownMenu 사용.

```tsx
interface Props {
  trackId: string;
  sound: SoundRef;
  recentSounds: SoundRef[];   // 6개
  onChange(next: SoundRef): void;
  onOpenLibrary(): void;       // "전체 보기..." → openSelect(trackId)
}
```

메뉴 구조:

```
┌──────────────────────────┐
│ ● 🔒 킥           (현재) │   ← recentSounds[0]
│   🔒 스네어              │
│   Cowbell-808            │
│   🔒 하이햇              │
│   🔒 클랩                │
│   Vox-Hi-440             │
├──────────────────────────┤
│   전체 보기...           │   ← onOpenLibrary()
└──────────────────────────┘
```

이름이 32자에 가까우면 ellipsis + 항목에 `title` 속성.

### 7.8 Store 슬라이스 — `store/assetLibrary.ts`

```ts
interface AssetLibraryState {
  open: boolean;
  mode: "manage" | "select";
  targetTrackId: string | null;
  openManage(): void;
  openSelect(trackId: string): void;
  close(): void;
}
```

### 7.9 `useStore` 액션 추가

```ts
// 라이브러리 운영
addAssetToLibrary(assetId: string): void;
removeAssetFromLibrary(assetId: string): void;    // 가드 포함
renameLibraryAsset(assetId: string, newName: string): void;

// MRU 큐 운영 — 모든 sound 변경의 단일 진입점
selectTrackSound(trackId: string, sound: SoundRef): void;
```

기존 `setTrackSound` 호출처는 전부 `selectTrackSound`로 마이그레이션 → 큐 불변량 한 곳에서 유지.

### 7.10 IDB 소스 오브 트루스 — 캐시 layer 없음

모달의 카드 데이터는 모달 마운트 시 `listAssetsByIds(project.libraryAssetIds)`로 1회 페치 → 컴포넌트 로컬 state. 변경 후 refetch.

### 7.11 `<EditorToolbar>` 변경

시퀀서 토글 옆에 라이브러리 트리거 버튼 추가:

```
[ 시퀀서 ]  [ 🎵 라이브러리 ]  │  [🔍+] [🔍−] [맞춤]
```

아이콘: Phosphor `MusicNotes` 또는 `Folders` 중 톤 매칭.

## 8. 흐름

### 8.1 단일 파일 업로드 파이프라인

```
[파일] ─┬─ MIME/확장자 검사       audio/* 아니면 → "음원 파일이 아닙니다"
        ├─ 사이즈 검사 (>5MB)      → "용량 초과 (7.2MB > 5MB)"
        ├─ arrayBuffer + decode    decode 실패 → "지원하지 않는 포맷 또는 손상됨"
        ├─ duration 검사 (>5s)     → "길이 초과 (7.2s > 5s)"
        ├─ 이름 정규화
        │    · 확장자 제거: "kick.wav" → "kick"
        │    · 32자 컷
        │    · trim
        │    · 동일 이름 충돌 → "kick (2)", "kick (3)"
        ├─ putAsset(blob, name)    → IDB 저장 (createdAt = now)
        └─ addAssetToLibrary(id)
```

### 8.2 벌크 업로드 흐름

```
유저: N개 파일 드롭 (or [+ 업로드] 선택)
  ↓
LoadingOverlay determinate, label="업로드 중...", progress=0
  ↓
for i in 0..N:
  setProgress(i / N)
  try { 8.1 파이프라인 } catch (reason) { failed.push({ file, reason }) }
setProgress(1) → hide()
  ↓
실패 0건: 모달 그리드 즉시 갱신
실패 ≥1건: 모달 상단 인라인 에러 패널 (실패 목록 + [닫기])
```

### 8.3 삭제 가드

```ts
function canDelete(assetId: string, tracks: Track[]):
  | { ok: true }
  | { ok: false; usedBy: Track[] } {
  const usedBy = tracks.filter(
    t => t.sound.kind === "upload" && t.sound.assetId === assetId,
  );
  return usedBy.length === 0 ? { ok: true } : { ok: false, usedBy };
}
```

- 사용 중이면 🗑 클릭 → 인라인 경고 토스트
  > `"<이름>은 트랙 '킥', '하이햇'에서 사용 중입니다. 먼저 다른 사운드로 변경하세요."`
- `recentSounds`에 있어도 가드 발동 안 함 — 히스토리 슬롯은 자동 fallback으로 대체됨.
- 가드 통과 → IDB delete + 모든 트랙 `recentSounds`에서 제거 + `libraryAssetIds`에서 제거 + 빈 슬롯은 빌트인 fallback(정의 순으로 다음 빌트인 채워 항상 6개 유지).

### 8.4 이름변경

- 카드 ✏️ 클릭 → 인라인 input 모드 (Enter=확정, Esc=취소, blur=확정).
- maxLength 32, 공백 trim.
- 빈 문자열은 이전 이름으로 복원.
- 충돌 검사 없음(사용자 명시 입력). 트림 후 동일 문자열이면 no-op.

### 8.5 선택 흐름 (선택 모드)

```
유저: 트랙 드롭다운 → "전체 보기..." 클릭
  ↓
openSelect(trackId)
  ↓
모달 표시 (mode="select", 현재 sound 카드에 강조)
  ↓
카드 클릭 → selectTrackSound(targetTrackId, soundRef) → MRU 큐 갱신 → close()
```

### 8.6 미리듣기

- ▶ 클릭 → `SampleLibrary.load(ref)` (캐시됨) → `AudioBufferSourceNode` 1회 재생.
- 동시 1개 제한: 전역 `previewSourceRef` 한 자리. 새 클릭 시 기존 `stop()` 후 새 source.
- 모달 닫힐 때 자동 stop.
- 마스터 gain 경유(음소거/마스터 볼륨 영향 받음).

### 8.7 키바인딩 충돌

- 모달이 열린 동안 글로벌 키 입력 리스너(트랙 트리거)는 `e.target.closest('[role="dialog"]')` 검사로 무시.
- 기존 input 가드 패턴(`e.target instanceof HTMLInputElement`) 확장.

## 9. 검증/에러 처리

업로드 검증 파이프라인은 의존성 주입으로 테스트 가능하게 분리:

```ts
// src/asset-library/validateUpload.ts (순수)
export interface DecodeFn {
  (buf: ArrayBuffer): Promise<{ durationMs: number }>;
}
export type ValidateResult =
  | { ok: true; durationMs: number }
  | { ok: false; reason: "not-audio" | "too-large" | "decode-failed" | "too-long"; detail?: string };

export async function validateUpload(file: File, decode: DecodeFn): Promise<ValidateResult>;
```

프로덕션에선 `AudioContext.decodeAudioData` 어댑터 주입. 테스트에선 mock 주입.

상한:

```ts
export const MAX_BYTES = 5 * 1024 * 1024;  // 5MB
export const MAX_DURATION_MS = 5000;       // 5s
export const NAME_MAX_LENGTH = 32;
```

## 10. 테스트 전략

### 10.1 단위 테스트 (vitest)

| 대상 | 파일 | 검증 |
|---|---|---|
| MRU 큐 | `store/useStore.recentSounds.test.ts` | `selectTrackSound` 후 [0] 위치, 중복 제거, 최대 6, 불변량 |
| 이름 정규화 | `domain/assetName.test.ts` | 확장자 제거, 32자 컷, trim, 동명 시 `(2)` 접미 |
| 삭제 가드 | `store/useStore.deleteAsset.test.ts` | `canDelete` 식별, 가드 통과 시 `recentSounds`에서 제거 + 빌트인 fallback |
| 빌트인 fallback | `domain/recentSoundsFallback.test.ts` | 빈 슬롯에 정의 순으로 다음 빌트인, 항상 6개 |
| 프로젝트 마이그레이션 | `persistence/projects.migrate.test.ts` | 구 저장본 → `recentSounds`/`libraryAssetIds` 자동 시드 |
| `duplicateProject` 확장 | `persistence/projects.test.ts`(추가) | `idMap` 중복 방지, `libraryAssetIds`/`recentSounds` 깊은 복사 |
| `buildProjectFromBlueprint` 확장 | `example/exampleProject.test.ts`(추가) | `recentSounds` 시드, `libraryAssetIds: []` |
| `validateUpload` | `asset-library/validateUpload.test.ts` | MIME/사이즈/decode/duration 케이스 |

### 10.2 영속 테스트 (fake-indexeddb)

| 대상 | 파일 | 검증 |
|---|---|---|
| 새 assets API | `persistence/assets.test.ts`(추가) | `listAssetsByIds`/`deleteAsset`/`renameAsset`, `putAsset` `createdAt` 자동 부여 |
| `StoredAsset.createdAt` 마이그레이션 | 위와 동일 | `createdAt` 누락 시 `0` 정상 로드 |

### 10.3 시각 회귀 (Playwright snap)

`scripts/visual-snap.mjs` 패턴 그대로 추가:

- 라이브러리 모달 — `mode="manage"` 빈 상태 / N개 상태.
- 라이브러리 모달 — `mode="select"` 현재 sound 강조.
- 빌트인 섹션 펼침/접힘.
- `<LoadingOverlay>` determinate 60% / indeterminate.
- 트랙 드롭다운(`<TrackSoundSelect>`) 펼침.
- 업로드 에러 인라인 패널.

### 10.4 사람 수동 검증

- 실제 파일 업로드(`.wav .mp3 .ogg .flac .m4a`) 디코드/재생.
- 미리듣기 채널이 master gain 경유 — 음소거/마스터 볼륨 영향.
- 모바일 Safari IDB 한계(여러 5MB 파일 업로드 시) — 큰 위험 신호 시 별 이슈로 분리.
- 모달 열린 상태에서 트랙 키바인딩 차단 확인.

## 11. 의존성 추가

- `@radix-ui/react-dialog` (Modal/LoadingOverlay 양쪽 사용)
- `@radix-ui/react-dropdown-menu` (TrackSoundSelect)

둘 다 단일 패키지, ~5–7KB gz 각각.

## 12. 비목표 (YAGNI)

- 글로벌 토스트 시스템 — 이번 작업의 에러는 인라인 패널/모달 내 메시지로 충분. 토스트는 별도 디자인.
- 에셋 태그/카테고리/검색 — 에셋 수가 수십 개 이내로 가정. 그리드 + 섹션이면 충분.
- 정렬 토글 UI — 단일 정렬 규칙으로 시작.
- 전역 스코프 에셋 / 공유 — 프로젝트 스코프로 명확히 한정.
- 오디오 편집(트림/노멀라이즈) — 업로드 그대로 사용.

## 13. 마이그레이션 위험 / 롤백

- 새 필드 모두 normalize 단계에서 시드 → 구 저장본 호환.
- 신규 IDB 키 추가 없음(같은 `assets`/`projects` 스토어 유지) → DB 버전 업 불요.
- 롤백 시 새 필드는 무시되고 기존 동작 복귀.

## 14. 작업 진입점 요약

| 영역 | 변경 |
|---|---|
| `src/types.ts` | `Track.recentSounds`, `Project.libraryAssetIds` 추가 |
| `src/persistence/db.ts` | `StoredAsset.createdAt` 추가 |
| `src/persistence/assets.ts` | API 3개 추가, `putAsset` `createdAt` |
| `src/persistence/projects.ts` | normalize 마이그레이션, `duplicateProject` 확장 |
| `src/example/exampleProject.ts` | `recentSounds` 시드, `libraryAssetIds: []` |
| `src/store/useStore.ts` | `selectTrackSound`·라이브러리 운영 액션, 기존 `setTrackSound` 마이그레이션 |
| `src/store/assetLibrary.ts` (신규) | 모달 open/mode/targetTrack |
| `src/store/loadingOverlay.ts` (신규) | 글로벌 오버레이 상태 |
| `src/ui/primitives/Modal.*` (신규) | Radix Dialog 래퍼 |
| `src/ui/primitives/LoadingOverlay.*` (신규) | 글로벌 오버레이 컴포넌트 |
| `src/ui/asset-library/*` (신규) | 모달·카드·드롭존·드롭다운·훅·검증 |
| `src/ui/EditorToolbar.tsx` | 라이브러리 트리거 버튼 |
| `src/ui/TrackEditor.tsx` | `<select>` → `<TrackSoundSelect/>` |
| `src/ui/ProjectList.tsx` | 복사/예제 빌드 호출에 `<LoadingOverlay>` 적용 |
| `package.json` | Radix 두 패키지 추가 |
