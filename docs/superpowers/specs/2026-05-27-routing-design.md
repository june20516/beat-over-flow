# 라우팅 설계 문서

> 작성일: 2026-05-27
> 상태: 설계 합의 완료 (구현 계획 작성 전)
> 관련: [BeatOverflow 설계 문서](./2026-05-26-beat-over-flow-design.md) §13(공유, 추후)

## 1. 배경 / 목적

향후 **play 전용 URL**(공유 링크로 받은 작품을 편집 없이 연주만 하는 경험)을 도입할 예정이다.
그 분기를 미리 마련하기 위해, 앱 최상위를 `edit` / `play`로 나누는 클라이언트 라우팅을 도입한다.

현재 작성된 모든 로직은 **edit**(작곡/편집) 경험이다. **play는 자리만 마련하고 막아둔다.**

설계 철학상 서버를 두지 않으므로(클라이언트 전용 · IndexedDB), 라우팅도 클라이언트에서 완결한다.
정적 호스팅(Cloudflare assets-only Worker)에서 딥링크가 동작하도록 `wrangler.jsonc`에
`not_found_handling: "single-page-application"`이 이미 설정되어 있어, 임의 경로 직접 접근 시에도
`index.html`이 로드되어 클라이언트 라우터가 분기를 처리한다.

## 2. 라우팅 구조

| 경로 | 화면 | 상태 |
|------|------|------|
| `/` | **Home** — 프로젝트 타이틀 + 버튼 2개(편집 / 플레이) | 신규 |
| `/edit` | **ProjectList** (프로젝트 목록) | 기존 로직 |
| `/edit/:projectId` | **Editor** (해당 프로젝트 편집) | id 기반 로드 |
| `/play` | **"준비 중"** 안내 화면 | 신규(자리만, 막힘) |
| 그 외 | **404** (심플 안내 + 홈 링크) | 신규 |

- `Project.id`는 `crypto.randomUUID()`로 생성되는 안정적 UUID이며, `/edit/:projectId`의 라우트 키로 사용한다.
- **부수 효과(개선)**: `/edit/:id`에서 새로고침해도 해당 프로젝트가 그대로 유지된다. 기존에는
  새로고침 시 목록 뷰로 돌아가 편집 맥락을 잃었으나, id가 URL에 있으므로 재로드된다.
- 알 수 없는 경로는 `/edit`로의 리다이렉트가 아니라 **별도 404 화면**으로 처리한다(존재하지 않는
  경로임을 명시).

## 3. 미니 라우터 메커니즘

직접 만든 의존성 0짜리 라우터를 둔다. 라이브러리(wouter, react-router)는 도입하지 않는다.
근거: 경로 4종, 미니멀 의존성 철학, 전환 비용이 작음(§6 참조).

### 3.1 `src/router/router.ts`

- `usePathname(): string`
  - React 18의 `useSyncExternalStore`로 `window.location.pathname`을 구독한다.
  - `subscribe`는 `popstate` 이벤트(브라우저 뒤로/앞으로)와 프로그래매틱 네비게이션 알림을 함께 구독한다.
  - 동시성 안전하고 외부 스토어 구독의 정석 방식이다.
- `navigate(to: string): void`
  - 현재 경로와 같으면 무시한다.
  - `window.history.pushState(null, "", to)` 후 구독자에게 알린다(내부 listener Set 통지).

```ts
// 개념 스케치 (구현 계획에서 확정)
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function navigate(to: string): void {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  notify();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}
```

### 3.2 경로 매칭 (App에서 수행)

정규식/와일드카드 매처를 두지 않는다. 경로를 세그먼트로 분해해 **명시적으로 분기**한다.

```ts
const segments = pathname.split("/").filter(Boolean);
// []                  -> Home
// ["edit"]            -> ProjectList
// ["edit", id]        -> Editor(id)
// ["play"]            -> PlayPlaceholder
// 그 외                -> NotFound
```

경로 4종에는 이 방식이 가장 읽기 쉽다. 일반화된 패턴 매처가 필요해지는 순간이 §6의 첫 전환 신호다.

## 4. 컴포넌트 / 파일 변경

### 신규
- `src/router/router.ts` — `usePathname`, `navigate`
- `src/ui/Home.tsx` — 타이틀 + 버튼 2개(편집 → `/edit`, 플레이 → `/play`)
- `src/ui/PlayPlaceholder.tsx` — "준비 중" 안내
- `src/ui/NotFound.tsx` — 심플 404 + 홈 링크

### 변경
- `src/App.tsx` — `usePathname()` + 세그먼트 기반 라우트 스위치로 재작성.
  기존의 `useState<"list" | "editor">` 토글을 제거한다.

### 연결
- `ProjectList.onOpen(project)` → `setProject(project)` 후 `navigate('/edit/' + project.id)`
- `Editor.onExit` → `navigate('/edit')`
- `/edit/:projectId` 진입 처리:
  - 스토어 `project?.id`가 라우트의 id와 같으면 그대로 렌더
  - 다르면 `loadProject(id)` 시도 → 성공 시 `setProject`, 실패(`null`) 시 **404** 렌더
- autosave(`startAutosave`)는 기존처럼 동작한다. project가 `null`이면 no-op이므로 위치 변경은 최소화한다(구현 계획에서 확정).

## 5. 테스트 (jsdom — history/location 사용 가능)

- **라우터**: `navigate`가 `location.pathname`을 갱신하고 구독자에게 알리는지, `popstate`에 반응하는지.
- **라우트 스위치**: `/`, `/edit`, `/edit/:id`, `/play`, 미지정 경로 각각에 올바른 컴포넌트가 렌더되는지.
- **연결**: Home 버튼이 해당 경로로 이동하는지, ProjectList에서 프로젝트 열기 시 `/edit/:id`로 이동하는지,
  존재하지 않는 projectId 진입 시 404가 뜨는지.

> Web Audio/Canvas는 jsdom 미지원이므로 라우팅 테스트는 화면 전환과 네비게이션 동작에 한정한다.

## 6. 라이브러리 전환 임계점 (향후 고려사항)

직접 만든 라우터는 의도적으로 최소다. 아래 신호 중 하나라도 명확해지면 wouter(초경량) 또는
react-router(표준)로의 전환을 검토한다. 전환 비용은 작다 — `usePathname`/`navigate` 사용처가
소수이고, 매칭 로직이 App 한 곳에 모여 있기 때문이다.

### 전환 트리거
- **정규식/와일드카드 매칭**이 필요해질 때 (세그먼트 명시 분기로는 가독성이 무너지는 시점)
- **중첩 레이아웃**(공유 셸 + 하위 라우트)이 필요할 때
- **라우트 가드 / 데이터 로더**(진입 전 인증·프리페치)가 필요할 때
- **라우트 수가 5개를 초과**해 명시 분기가 길어질 때
- **쿼리파람 기반 상태**를 다수 다뤄야 할 때

### 공유 기능(§13)과의 연결
가장 유력한 전환 지점이다. 공유는 *작품(마커 + 트랙 설정 + 베이스 참조)을 압축 문자열/쿼리파람/링크로
내보내기·불러오기*로 설계되어 있다. 이때 다음이 생긴다:
- `/play/:shareId` 형태의 **경로 파라미터** 또는 `?d=<encoded>` **쿼리파람** 디코딩
- 진입 시 인코딩된 작품을 로드하는 **로더 성격의 로직**

이 단계에서 파라미터·로더 수요가 동시에 발생하므로, 그때 라이브러리 도입을 함께 결정하는 것이 자연스럽다.

### 현재 한계 (명시)
- 경로 파라미터는 1뎁스(`/edit/:id`)를 세그먼트 인덱스로 수동 처리한다.
- 중첩 라우트, 라우트 가드, 데이터 로더, 코드 스플리팅 연동 없음.
- 링크는 `<a href>` 가로채기 없이 버튼 + `navigate()` 호출로만 처리한다(외부 링크/우클릭 새 탭 등
  표준 `<a>` 동작이 필요하면 `<Link>` 컴포넌트 도입을 검토).
