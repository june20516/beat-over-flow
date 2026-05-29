# 새 프로젝트 생성 시 베이스 플로우 선택 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새 프로젝트 생성 시 오디오 파일 또는 유튜브 영상을 골라 셋업하고, 에디터 내 베이스 플로우 변경 진입점은 제거한다.

**Architecture:** 순수 빌더(`buildAudioFileProject`/`buildYouTubeProject`)로 프로젝트 객체를 만들고, `NewProjectModal`이 파일 디코드/유튜브 파싱 후 빌더를 호출해 `saveProject`→`onCreated`로 에디터에 진입시킨다. 랜딩의 단일 "새 프로젝트" 버튼이 모달을 연다. 기존 `BaseFlowPicker`와 에디터 변경 버튼은 삭제한다.

**Tech Stack:** TypeScript, React 18, zustand 4, vitest 2(+jsdom), idb. (RTL 미설치 → 컴포넌트는 수동 검증, 빌더 등 순수 로직은 단위 테스트.)

**참고 스펙:** `docs/superpowers/specs/2026-05-29-new-project-base-flow-selection-design.md`

**테스트 실행:** 단일 파일은 `yarn vitest run <path>`, 전체는 `yarn test:run`.

---

## File Structure

신규:
- `src/domain/newProject.ts` — `buildAudioFileProject`, `buildYouTubeProject` 순수 빌더.
- `src/domain/newProject.test.ts`
- `src/ui/NewProjectModal.tsx` — 파일/유튜브 탭 생성 모달.
- `src/ui/NewProjectModal.module.css`

수정:
- `src/ui/ProjectList.tsx` — 단일 "새 프로젝트" 버튼 + 모달 연결, 기존 `handleFile`/hidden input 제거.
- `src/ui/Editor.tsx` — 헤더 "베이스 플로우" 버튼·피커 Modal·`pickerOpen` 제거(유튜브 토글/강도 유지).

삭제:
- `src/ui/BaseFlowPicker.tsx`, `src/ui/BaseFlowPicker.module.css`

---

## Task 1: 순수 빌더 `buildAudioFileProject` / `buildYouTubeProject`

**Files:**
- Create: `src/domain/newProject.ts`, `src/domain/newProject.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/domain/newProject.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAudioFileProject, buildYouTubeProject } from "./newProject";

describe("buildAudioFileProject", () => {
  it("audioFile baseFlow와 빈 트랙·기본값을 만든다", () => {
    const p = buildAudioFileProject("내 곡", "asset-1", 5000);
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("내 곡");
    expect(p.baseFlow).toEqual({ kind: "audioFile", assetId: "asset-1", durationMs: 5000 });
    expect(p.tracks).toEqual([]);
    expect(p.master).toEqual({ volume: 1 });
    expect(p.transport).toEqual({ playPauseKey: null });
    expect(p.libraryAssetIds).toEqual([]);
    expect(p.baseFlowView).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });

  it("두 번 호출하면 서로 다른 id", () => {
    const a = buildAudioFileProject("x", "a", 1);
    const b = buildAudioFileProject("x", "a", 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe("buildYouTubeProject", () => {
  it("youtube baseFlow(durationMs 0)와 기본값을 만든다", () => {
    const p = buildYouTubeProject("dQw4w9WgXcQ", "리믹스");
    expect(p.id).toBeTruthy();
    expect(p.name).toBe("리믹스");
    expect(p.baseFlow).toEqual({ kind: "youtube", videoId: "dQw4w9WgXcQ", durationMs: 0 });
    expect(p.tracks).toEqual([]);
    expect(p.master).toEqual({ volume: 1 });
    expect(p.transport).toEqual({ playPauseKey: null });
    expect(p.libraryAssetIds).toEqual([]);
    expect(p.baseFlowView).toEqual({ layout: "mini", ambientIntensity: 0.5 });
  });

  it("이름이 공백이면 '유튜브 프로젝트'로 대체", () => {
    expect(buildYouTubeProject("dQw4w9WgXcQ", "   ").name).toBe("유튜브 프로젝트");
    expect(buildYouTubeProject("dQw4w9WgXcQ", "").name).toBe("유튜브 프로젝트");
  });

  it("이름 앞뒤 공백은 trim", () => {
    expect(buildYouTubeProject("dQw4w9WgXcQ", "  곡  ").name).toBe("곡");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `yarn vitest run src/domain/newProject.test.ts`
Expected: FAIL — 모듈 미정의.

- [ ] **Step 3: 구현**

`src/domain/newProject.ts`:

```ts
import type { Project } from "../types";
import { newId } from "./ids";
import { DEFAULT_BASE_FLOW_VIEW } from "./baseFlowView";

/** 새 빈 프로젝트의 공통 골격(트랙 없음, 기본 마스터/transport/뷰). */
function emptyProjectBase(name: string): Omit<Project, "baseFlow"> {
  const now = Date.now();
  return {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    tracks: [],
    master: { volume: 1 },
    transport: { playPauseKey: null },
    libraryAssetIds: [],
    baseFlowView: DEFAULT_BASE_FLOW_VIEW,
  };
}

/** 업로드한 오디오 자산으로 빈 프로젝트를 만든다. fetch/decode와 무관한 순수 함수. */
export function buildAudioFileProject(name: string, assetId: string, durationMs: number): Project {
  return {
    ...emptyProjectBase(name),
    baseFlow: { kind: "audioFile", assetId, durationMs },
  };
}

/**
 * 유튜브 영상으로 빈 프로젝트를 만든다. durationMs는 onReady 후 write-back되므로 0으로 시작.
 * name이 공백이면 "유튜브 프로젝트"로 대체한다.
 */
export function buildYouTubeProject(videoId: string, name: string): Project {
  const cleanName = name.trim() || "유튜브 프로젝트";
  return {
    ...emptyProjectBase(cleanName),
    baseFlow: { kind: "youtube", videoId, durationMs: 0 },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `yarn vitest run src/domain/newProject.test.ts`
Expected: PASS (5 케이스).

- [ ] **Step 5: Commit**

```bash
git add src/domain/newProject.ts src/domain/newProject.test.ts
git commit -m "feat(domain): pure builders for new audio/youtube projects"
```

---

## Task 2: `NewProjectModal` 컴포넌트

**Files:**
- Create: `src/ui/NewProjectModal.tsx`, `src/ui/NewProjectModal.module.css`

> RTL 미설치 → 수동 검증. 파일 탭은 기존 `AssetUploadDropzone`/`AssetUploadButton`(`src/ui/asset-library/AssetUploadDropzone.tsx`)을 재사용한다. 유튜브 탭은 URL + 이름(선택) 입력.

- [ ] **Step 1: CSS 작성**

`src/ui/NewProjectModal.module.css`:

```css
.picker { display: flex; flex-direction: column; gap: 12px; padding: 4px; min-width: 320px; }
.tabs { display: flex; gap: 8px; }
.tab, .tabActive { padding: 6px 14px; border-radius: 6px; border: 1px solid #2a2a44; background: transparent; color: #9ca3c4; cursor: pointer; }
.tabActive { background: #2a1b45; color: #fff; border-color: #7c2d92; }
.body { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.input { padding: 8px 10px; border-radius: 6px; border: 1px solid #2a2a44; background: #0d0a1f; color: #fff; }
.apply { align-self: flex-end; padding: 6px 16px; border-radius: 6px; border: none; background: #7c2d92; color: #fff; cursor: pointer; }
.apply:disabled { opacity: 0.5; cursor: default; }
.error { color: #f87171; font-size: 12px; margin: 0; }
.hint { color: #9ca3c4; font-size: 12px; margin: 0; }
```

- [ ] **Step 2: 컴포넌트 작성**

`src/ui/NewProjectModal.tsx`:

```tsx
import { useState } from "react";
import type { Project } from "../types";
import { Modal } from "./primitives/Modal";
import { parseYouTubeId } from "../domain/youtube";
import { buildAudioFileProject, buildYouTubeProject } from "../domain/newProject";
import { normalizeAssetName } from "../domain/assetName";
import { putAsset } from "../persistence/assets";
import { saveProject } from "../persistence/projects";
import { getEngine } from "../audio/runtime";
import { AssetUploadDropzone, AssetUploadButton } from "./asset-library/AssetUploadDropzone";
import styles from "./NewProjectModal.module.css";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 생성·저장 완료된 프로젝트. 호출부가 setProject + 에디터 진입을 처리한다. */
  onCreated(project: Project): void;
}

export function NewProjectModal({ open, onOpenChange, onCreated }: Props) {
  const [tab, setTab] = useState<"file" | "youtube">("file");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const buffer = await getEngine().decode(file);
      const cleanName = normalizeAssetName(file.name);
      const assetId = await putAsset(file, cleanName);
      const project = buildAudioFileProject(cleanName, assetId, buffer.duration * 1000);
      await saveProject(project);
      onCreated(project);
    } catch (e) {
      console.error("[NewProjectModal] file create failed", e);
      setError(`오디오를 불러오지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function applyYouTube() {
    const id = parseYouTubeId(url);
    if (!id) {
      setError("유효한 유튜브 URL 또는 영상 ID가 아닙니다.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const project = buildYouTubeProject(id, name);
      await saveProject(project);
      onCreated(project);
    } catch (e) {
      console.error("[NewProjectModal] youtube create failed", e);
      setError(`프로젝트 생성에 실패했습니다: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="새 프로젝트" size="sm">
      <div className={styles.picker}>
        <div className={styles.tabs}>
          <button
            className={tab === "file" ? styles.tabActive : styles.tab}
            onClick={() => { setTab("file"); setError(null); }}
          >
            오디오 업로드
          </button>
          <button
            className={tab === "youtube" ? styles.tabActive : styles.tab}
            onClick={() => { setTab("youtube"); setError(null); }}
          >
            유튜브
          </button>
        </div>

        {tab === "file" ? (
          <AssetUploadDropzone onFiles={handleFiles}>
            <div className={styles.body}>
              <p className={styles.hint}>오디오 파일을 드롭하거나 선택하세요.</p>
              <AssetUploadButton onFiles={handleFiles} />
            </div>
          </AssetUploadDropzone>
        ) : (
          <div className={styles.body}>
            <input
              className={styles.input}
              placeholder="https://youtu.be/... 또는 영상 ID"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void applyYouTube(); }}
              autoFocus
            />
            <input
              className={styles.input}
              placeholder="프로젝트 이름 (선택, 비우면 '유튜브 프로젝트')"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void applyYouTube(); }}
            />
            <button className={styles.apply} disabled={busy} onClick={() => void applyYouTube()}>
              만들기
            </button>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {busy && <p className={styles.hint}>준비 중...</p>}
      </div>
    </Modal>
  );
}
```

> `AssetUploadButton`은 `accept="audio/*" multiple`이며 `onFiles(File[])`를 호출한다. 여기서는 첫 파일만 사용한다(`files[0]`).

- [ ] **Step 3: 타입체크**

Run: `yarn tsc -b`
Expected: 이 파일 통과. (ProjectList 미연결 상태라 NewProjectModal 미사용 경고는 없음 — export된 컴포넌트라 unused 아님. Editor의 기존 BaseFlowPicker 사용부는 Task 4에서 정리.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/NewProjectModal.tsx src/ui/NewProjectModal.module.css
git commit -m "feat(ui): NewProjectModal with file/youtube source tabs"
```

---

## Task 3: `ProjectList` — 단일 "새 프로젝트" 버튼 + 모달 연결

**Files:**
- Modify: `src/ui/ProjectList.tsx`

> 기존 `handleFile`(36-57줄)·hidden `<input type="file">`(135-141줄)·관련 import를 제거하고 `NewProjectModal`로 대체한다. `setProject`+`onOpen`은 `onCreated` 콜백에서 호출한다.

- [ ] **Step 1: import 교체**

`src/ui/ProjectList.tsx` 상단 import에서 `putAsset`, `getEngine`, `newId`, `normalizeAssetName` 사용처가 사라지므로 제거하고 `NewProjectModal`을 추가한다. 최종 import 블록(1-15줄)을 다음으로 교체:

```tsx
import { useEffect, useRef, useState } from "react";
import { Plus, Sparkle, Copy, PencilSimple } from "@phosphor-icons/react";
import styles from "./ProjectList.module.css";
import controls from "./controls.module.css";
import primitives from "./primitives.module.css";
import { cx } from "./cx";
import { listProjects, saveProject, deleteProject, duplicateProject } from "../persistence/projects";
import { getEngine } from "../audio/runtime";
import { useStore } from "../store/useStore";
import { useLoadingOverlay } from "../store/loadingOverlay";
import { buildProjectFromBlueprint, EXAMPLE_BLUEPRINT } from "../example/exampleProject";
import { NewProjectModal } from "./NewProjectModal";
import { putAsset } from "../persistence/assets";
import type { Project } from "../types";
```

> 참고: `getEngine`·`putAsset`은 `createExample`이 계속 사용하므로 남긴다. `newId`·`normalizeAssetName`은 `handleFile` 제거로 더는 안 쓰이므로 import에서 뺐다.

- [ ] **Step 2: 모달 상태 추가 + handleFile/fileRef 제거**

`fileRef` 선언(26줄 `const fileRef = useRef<HTMLInputElement>(null);`)을 제거하고, 그 자리(상태 선언부)에 모달 open 상태를 추가:

```tsx
  const [newOpen, setNewOpen] = useState(false);
```

`handleFile` 함수(36-57줄) 전체를 삭제하고, 다음 `handleCreated`를 추가한다(예: `createExample` 위):

```tsx
  function handleCreated(project: Project) {
    setNewOpen(false);
    setProject(project);
    onOpen(project);
  }
```

- [ ] **Step 3: 버튼 + 모달 렌더 교체**

CTA 버튼 영역(126-141줄: 업로드 버튼 + hidden input)을 다음으로 교체:

```tsx
          <button className={cx(controls.btn, controls.btnPrimary, styles.cta)} onClick={() => setNewOpen(true)}>
            <Plus size={18} weight="bold" />
            새 프로젝트
          </button>
          <button className={cx(controls.btn, controls.btnGhost, styles.ctaSecondary)} onClick={createExample}>
            <Sparkle size={18} weight="bold" />
            예제 프로젝트
          </button>
```

> 이 교체로 `</div>`(ctaRow 닫기) 다음에 있던 hidden `<input ref={fileRef} ... onChange={handleFile} />`도 함께 삭제된다. ctaRow `<div>`는 두 버튼만 감싸도록 유지한다.

컴포넌트 최상위 반환 `<div className={styles.landing}>`의 닫는 태그 바로 앞(파일 끝 `</div>` 직전)에 모달을 추가:

```tsx
      <NewProjectModal open={newOpen} onOpenChange={setNewOpen} onCreated={handleCreated} />
```

- [ ] **Step 4: 타입체크 + 전체 테스트**

Run: `yarn tsc -b && yarn test:run`
Expected: 컴파일 통과(ProjectList에 미사용 import 없음), 기존 테스트 그린.

> Editor는 아직 `BaseFlowPicker`를 사용 중이라 이 시점엔 정상 컴파일된다. (BaseFlowPicker 삭제는 Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/ProjectList.tsx
git commit -m "feat(ui): single new-project button opens source modal"
```

---

## Task 4: `Editor` 변경 버튼 제거 + `BaseFlowPicker` 삭제

**Files:**
- Modify: `src/ui/Editor.tsx`
- Delete: `src/ui/BaseFlowPicker.tsx`, `src/ui/BaseFlowPicker.module.css`

> 현재 `Editor.tsx`는 헤더에 "베이스 플로우" 버튼을, 하단에 `<Modal>`+`<BaseFlowPicker>`를 렌더한다. 유튜브 전용 컨트롤(미니/앰비언트 토글·강도 슬라이더)은 유지한다.

- [ ] **Step 1: import 제거**

`src/ui/Editor.tsx`에서 다음 두 import를 제거한다:

```tsx
import { BaseFlowPicker } from "./BaseFlowPicker";
import { Modal } from "./primitives/Modal";
```

> `YouTubePlayer`, `resolveBaseFlowView` import는 유지한다(플레이어/뷰에 계속 사용).

- [ ] **Step 2: pickerOpen 상태 제거**

`const [pickerOpen, setPickerOpen] = useState(false);` 선언을 제거한다.

- [ ] **Step 3: 헤더의 "베이스 플로우" 버튼 제거(토글/강도는 유지)**

헤더에서 다음 버튼 블록만 제거한다:

```tsx
        <button
          className={cx(controls.btn, controls.btnGhost)}
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          title="베이스 플로우 변경"
        >
          베이스 플로우
        </button>
```

> 바로 뒤의 `{isYouTube && ( ... 미니/앰비언트 토글 + 강도 슬라이더 ... )}` 블록은 그대로 둔다.

- [ ] **Step 4: 하단 피커 Modal 제거**

다음 블록을 제거한다:

```tsx
      <Modal open={pickerOpen} onOpenChange={setPickerOpen} title="베이스 플로우 변경" size="sm">
        <BaseFlowPicker onClose={() => setPickerOpen(false)} />
      </Modal>
```

- [ ] **Step 5: BaseFlowPicker 파일 삭제**

```bash
git rm src/ui/BaseFlowPicker.tsx src/ui/BaseFlowPicker.module.css
```

- [ ] **Step 6: 타입체크 + 전체 테스트**

Run: `yarn tsc -b && yarn test:run`
Expected: 컴파일 통과(BaseFlowPicker 참조 0, 미사용 import 0), 기존 + 신규 테스트 그린.

- [ ] **Step 7: Commit**

```bash
git add src/ui/Editor.tsx
git commit -m "feat(ui): remove in-editor base flow change entry point"
```

---

## Task 5: 최종 검증

- [ ] **Step 1: 전체 테스트**

Run: `yarn test:run`
Expected: 전부 PASS(기존 289 + 신규 빌더 5 = 294).

- [ ] **Step 2: 타입체크/빌드**

Run: `yarn build`
Expected: tsc + vite 빌드 성공.

- [ ] **Step 3: 수동 종합 시나리오(`yarn dev`)**

- 랜딩 "새 프로젝트" → 모달 오픈, 탭 전환(오디오 업로드 / 유튜브).
- 오디오 탭: 파일 드롭/선택 → 디코드 후 에디터 진입, 파형 표시.
- 유튜브 탭: 유효한 URL + 이름 입력 → 에디터 진입, onReady 후 트랜스포트에 길이 표시.
- 유튜브 탭: 이름 비우고 생성 → 프로젝트명 "유튜브 프로젝트".
- 유튜브 탭: 잘못된 URL → 모달 인라인 에러, 비크래시.
- 에디터 헤더에 "베이스 플로우" 버튼이 더는 없음. 유튜브 프로젝트에서 미니/앰비언트 토글·강도 슬라이더·nudge는 정상.
- 예제 프로젝트 버튼·프로젝트 복사/삭제/이름수정 회귀 없음.

- [ ] **Step 4: 최종 커밋(필요 시)**

```bash
git add -A && git commit -m "chore: new-project base flow selection final polish"
```

---

## Self-Review 메모

- 스펙 §아키텍처 1(빌더) → Task 1. §2(모달) → Task 2. §3(ProjectList) → Task 3. §4(Editor)+§5(BaseFlowPicker 삭제) → Task 4. §테스트 → Task 1 단위 + Task 5 수동.
- 타입 시그니처 일관성: `buildAudioFileProject(name, assetId, durationMs)`, `buildYouTubeProject(videoId, name)`, `NewProjectModal({ open, onOpenChange, onCreated })`, `onCreated(project)` → `setProject`+`onOpen`.
- 재사용: 파일 업로드는 기존 `AssetUploadDropzone`/`AssetUploadButton`(`accept=audio/*`, `onFiles(File[])`) 활용 — DRY. `normalizeAssetName`로 파일명 정규화(기존 경로와 동일).
- 잔존: `useStore.setBaseFlow`는 UI 미사용이 되지만 카논 mutate 경로+테스트 유지(데드코드 제거는 비목표).
- 확인 완료: `Modal` primitive는 `open`/`onOpenChange`/`title`/`size` props(`src/ui/primitives/Modal.tsx`). `putAsset(blob, name)`, `getEngine().decode(file)`는 기존 시그니처 그대로.
