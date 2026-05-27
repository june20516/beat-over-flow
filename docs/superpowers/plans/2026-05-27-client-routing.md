# 클라이언트 라우팅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 루트에서 edit/play로 분기하는 클라이언트 라우팅을 도입한다 — `/`(홈), `/edit`(목록), `/edit/:projectId`(편집기), `/play`(준비 중), 그 외 404.

**Architecture:** 의존성 0의 직접 만든 미니 라우터. `useSyncExternalStore`로 `location.pathname`을 구독하고(`usePathname`), `navigate()`가 `history.pushState` 후 구독자에게 알린다. 경로 매칭은 순수 함수 `matchRoute(pathname)`로 분리해 단위 테스트하고, `App`은 그 결과로 컴포넌트를 스위치한다.

**Tech Stack:** React 18, TypeScript, Vitest(jsdom), zustand. 라우팅 라이브러리·테스트 라이브러리 신규 도입 없음.

**관련 스펙:** [docs/superpowers/specs/2026-05-27-routing-design.md](../specs/2026-05-27-routing-design.md)

---

## 파일 구조

### 신규
- `src/router/router.ts` — `usePathname`, `navigate`, `subscribe`, `getPathname`, `matchRoute`, `Route` 타입
- `src/router/router.test.ts` — `matchRoute`, `navigate`, `subscribe` 테스트
- `src/ui/Home.tsx` — 타이틀 + 버튼 2개(편집/플레이)
- `src/ui/PlayPlaceholder.tsx` — "준비 중" 안내
- `src/ui/NotFound.tsx` — 404 + 홈 링크

### 변경
- `src/App.tsx` — 세그먼트 기반 라우트 스위치로 재작성. 기존 `useState<"list" | "editor">` 제거. 얇은 래퍼 `EditorRoute`(id로 프로젝트 로드)와 `ProjectList` 연결 포함.

### 미변경 (인용용 시그니처)
- `src/ui/ProjectList.tsx` — `Props { onOpen: (project: Project) => void }`. 이미 내부에서 `setProject(p)` 호출 후 `onOpen(p)` 한다.
- `src/ui/Editor.tsx` — `Props { onExit: () => void }`. `useStore(s => s.project)`로 프로젝트를 읽는다.
- `src/persistence/projects.ts` — `loadProject(id: string): Promise<Project | null>`.
- `src/store/useStore.ts` — `project: Project | null`, `setProject(project: Project | null)`.

---

## Task 1: 미니 라우터 코어 + 경로 매칭

**Files:**
- Create: `src/router/router.ts`
- Test: `src/router/router.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성 — `matchRoute`**

`src/router/router.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchRoute, navigate, subscribe, getPathname } from "./router";

describe("matchRoute", () => {
  it("/ 는 home", () => {
    expect(matchRoute("/")).toEqual({ kind: "home" });
  });
  it("/edit 는 projectList", () => {
    expect(matchRoute("/edit")).toEqual({ kind: "projectList" });
  });
  it("/edit/:id 는 editor + projectId", () => {
    expect(matchRoute("/edit/abc-123")).toEqual({ kind: "editor", projectId: "abc-123" });
  });
  it("/play 는 play", () => {
    expect(matchRoute("/play")).toEqual({ kind: "play" });
  });
  it("알 수 없는 경로는 notFound", () => {
    expect(matchRoute("/unknown")).toEqual({ kind: "notFound" });
    expect(matchRoute("/edit/a/b")).toEqual({ kind: "notFound" });
    expect(matchRoute("/play/x")).toEqual({ kind: "notFound" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test:run src/router/router.test.ts`
Expected: FAIL — `router.ts`가 없어 import 해석 실패.

- [ ] **Step 3: `matchRoute` + 타입 구현**

`src/router/router.ts`:

```ts
export type Route =
  | { kind: "home" }
  | { kind: "projectList" }
  | { kind: "editor"; projectId: string }
  | { kind: "play" }
  | { kind: "notFound" };

export function matchRoute(pathname: string): Route {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { kind: "home" };
  if (segments[0] === "edit") {
    if (segments.length === 1) return { kind: "projectList" };
    if (segments.length === 2) return { kind: "editor", projectId: segments[1] };
    return { kind: "notFound" };
  }
  if (segments[0] === "play" && segments.length === 1) return { kind: "play" };
  return { kind: "notFound" };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test:run src/router/router.test.ts`
Expected: PASS (matchRoute describe 블록).

- [ ] **Step 5: 실패하는 테스트 작성 — `navigate` / `subscribe`**

`src/router/router.test.ts`에 describe 블록 추가:

```ts
describe("navigate / subscribe", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("navigate 는 pathname 을 바꾼다", () => {
    navigate("/edit");
    expect(getPathname()).toBe("/edit");
  });

  it("navigate 는 구독자에게 알린다", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    navigate("/play");
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("같은 경로로의 navigate 는 알리지 않는다", () => {
    window.history.replaceState(null, "", "/play");
    const cb = vi.fn();
    const unsub = subscribe(cb);
    navigate("/play");
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it("popstate 는 구독자에게 알린다", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("unsubscribe 후에는 알리지 않는다", () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    unsub();
    navigate("/edit");
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `yarn test:run src/router/router.test.ts`
Expected: FAIL — `navigate`/`subscribe`/`getPathname` 미정의.

- [ ] **Step 7: `navigate` / `subscribe` / `getPathname` / `usePathname` 구현**

`src/router/router.ts` 상단에 추가:

```ts
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function getPathname(): string {
  return window.location.pathname;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  notify();
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getPathname);
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `yarn test:run src/router/router.test.ts`
Expected: PASS (전체 블록).

- [ ] **Step 9: 타입 체크**

Run: `npx tsc -b`
Expected: 에러 없이 통과.

- [ ] **Step 10: 커밋**

```bash
git add src/router/router.ts src/router/router.test.ts
git commit -m "feat: 미니 라우터 코어(usePathname/navigate)와 matchRoute 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 화면 컴포넌트 (Home / PlayPlaceholder / NotFound)

`@testing-library/react` 미설치로 렌더 단위 테스트는 하지 않는다. 순수 표현 컴포넌트이므로 `tsc`로 타입을 검증하고, 동작은 Task 3 통합 후 브라우저로 수동 확인한다.

**Files:**
- Create: `src/ui/Home.tsx`
- Create: `src/ui/PlayPlaceholder.tsx`
- Create: `src/ui/NotFound.tsx`

- [ ] **Step 1: `Home.tsx` 작성**

`src/ui/Home.tsx`:

```tsx
import { navigate } from "../router/router";

export function Home() {
  return (
    <div style={{ padding: 16 }}>
      <h1>BeatOverflow</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => navigate("/edit")}>편집</button>
        <button onClick={() => navigate("/play")}>플레이</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `PlayPlaceholder.tsx` 작성**

`src/ui/PlayPlaceholder.tsx`:

```tsx
import { navigate } from "../router/router";

export function PlayPlaceholder() {
  return (
    <div style={{ padding: 16 }}>
      <h1>플레이</h1>
      <p>준비 중입니다.</p>
      <button onClick={() => navigate("/")}>← 홈</button>
    </div>
  );
}
```

- [ ] **Step 3: `NotFound.tsx` 작성**

`src/ui/NotFound.tsx`:

```tsx
import { navigate } from "../router/router";

export function NotFound() {
  return (
    <div style={{ padding: 16 }}>
      <h1>404</h1>
      <p>존재하지 않는 페이지입니다.</p>
      <button onClick={() => navigate("/")}>← 홈</button>
    </div>
  );
}
```

- [ ] **Step 4: 타입 체크**

Run: `npx tsc -b`
Expected: 에러 없이 통과.

- [ ] **Step 5: 커밋**

```bash
git add src/ui/Home.tsx src/ui/PlayPlaceholder.tsx src/ui/NotFound.tsx
git commit -m "feat: Home/PlayPlaceholder/NotFound 화면 컴포넌트 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: App 라우트 스위치 재작성 + 연결

기존 `useState<"list" | "editor">` 토글을 제거하고 `matchRoute(usePathname())` 결과로 스위치한다. `EditorRoute`는 라우트의 `projectId`로 스토어를 동기화한다(이미 로드돼 있으면 즉시 렌더, 아니면 `loadProject`, 없으면 404). `ProjectList`는 `onOpen`에서 `/edit/:id`로 이동한다. autosave는 App 루트에 그대로 유지한다(라우트 전환과 무관하게 동작, project가 null이면 no-op).

**Files:**
- Modify: `src/App.tsx` (전체 재작성)

- [ ] **Step 1: `App.tsx` 전체 재작성**

`src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { ProjectList } from "./ui/ProjectList";
import { Editor } from "./ui/Editor";
import { Home } from "./ui/Home";
import { PlayPlaceholder } from "./ui/PlayPlaceholder";
import { NotFound } from "./ui/NotFound";
import { usePathname, matchRoute, navigate } from "./router/router";
import { useStore } from "./store/useStore";
import { loadProject } from "./persistence/projects";
import { startAutosave } from "./store/autosave";

function EditorRoute({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.project);
  const setProject = useStore((s) => s.setProject);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    project?.id === projectId ? "ready" : "loading",
  );

  useEffect(() => {
    if (project?.id === projectId) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const loaded = await loadProject(projectId);
      if (cancelled) return;
      if (loaded) {
        setProject(loaded);
        setStatus("ready");
      } else {
        setStatus("notfound");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, project?.id, setProject]);

  if (status === "loading") return null;
  if (status === "notfound") return <NotFound />;
  return <Editor onExit={() => navigate("/edit")} />;
}

export function App() {
  const pathname = usePathname();
  const route = matchRoute(pathname);

  useEffect(() => {
    const stop = startAutosave();
    return stop;
  }, []);

  switch (route.kind) {
    case "home":
      return <Home />;
    case "projectList":
      return <ProjectList onOpen={(project) => navigate(`/edit/${project.id}`)} />;
    case "editor":
      return <EditorRoute projectId={route.projectId} />;
    case "play":
      return <PlayPlaceholder />;
    case "notFound":
      return <NotFound />;
  }
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc -b`
Expected: 에러 없이 통과. (`route.kind` 스위치가 `Route` 유니온을 모두 처리하는지 포함.)

- [ ] **Step 3: 전체 테스트 실행 (회귀 확인)**

Run: `yarn test:run`
Expected: 기존 61개 + 라우터 테스트 전부 PASS.

- [ ] **Step 4: 프로덕션 빌드 확인**

Run: `yarn build`
Expected: `tsc -b && vite build` 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/App.tsx
git commit -m "feat: App 라우트 스위치 재작성 및 ProjectList/Editor 연결

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 사람 검증 필요 (브라우저, jsdom으로 확인 불가)

`yarn dev` 후 다음을 확인한다:

- [ ] `/` — 타이틀 + "편집"/"플레이" 버튼 표시. "편집" → `/edit`, "플레이" → `/play` 이동.
- [ ] `/edit` — 프로젝트 목록 표시. 프로젝트 열기 → URL이 `/edit/<uuid>`로 바뀌고 편집기 표시.
- [ ] 편집기에서 "← 목록" → `/edit`로 복귀.
- [ ] `/edit/<uuid>`에서 **새로고침** → 해당 프로젝트가 유지된 채 편집기 재진입.
- [ ] 존재하지 않는 `/edit/<없는-id>` 직접 접근 → 404 화면.
- [ ] `/play` — "준비 중" 화면, "← 홈" → `/`.
- [ ] `/아무거나` — 404 화면, "← 홈" → `/`.
- [ ] 브라우저 **뒤로/앞으로** 버튼이 위 전환과 일치하게 동작.

---

## Self-Review 결과

- **스펙 커버리지:** §2 라우팅 구조(5경로) → Task 1 `matchRoute` + Task 2/3 화면·스위치. §3 미니 라우터 → Task 1. §4 파일 변경 → Task 1~3. §5 테스트 → Task 1(라우터/매칭) + 수동 검증 섹션(화면 전환). §6 임계점 문서는 스펙 문서에 이미 존재(구현 산출물 아님). 누락 없음.
- **Placeholder 스캔:** "구현 계획에서 확정" 류 미사용. 모든 코드 단계에 실제 코드 포함.
- **타입 일관성:** `Route` 유니온의 `kind` 값(`home`/`projectList`/`editor`/`play`/`notFound`)이 `matchRoute`와 `App` 스위치에서 동일. `navigate`/`usePathname`/`matchRoute` 시그니처가 사용처와 일치. `loadProject`/`setProject` 시그니처는 기존 코드와 일치.
