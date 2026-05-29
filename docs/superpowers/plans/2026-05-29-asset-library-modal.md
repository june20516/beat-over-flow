# 트랙 에셋 라이브러리 모달 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트랙 사운드를 프로젝트 스코프의 에셋 라이브러리(빌트인 6 + 업로드 N)로 묶고, 드롭다운은 MRU 6슬롯·전체 보기는 Radix Dialog 모달로 분리한다. `<Modal>`·`<LoadingOverlay>` 두 UI primitive를 디자인 시스템에 추가한다.

**Architecture:** 도메인 → 영속 → store → UI primitive → feature 컴포넌트 → 통합의 순으로 쌓아 올린다. 순수 도메인/영속은 TDD, UI는 코드 작성 후 `tsc -b`·시각 회귀로 검증. 모든 sound 변경은 `selectTrackSound` 단일 진입점을 통해 MRU 큐 불변량(`recentSounds[0] === sound`)을 유지.

**Tech Stack:** React 18, Zustand, IndexedDB(idb), Vitest + jsdom + fake-indexeddb, Playwright(시각 회귀), 신규: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`.

**Spec:** `docs/superpowers/specs/2026-05-29-asset-library-design.md`

**작업 도중 공통 명령**

- 패키지매니저는 **yarn**. npm/npx 금지.
- 단위 테스트 단일: `yarn vitest run <path> -t "<name>"`
- 단위 테스트 전체: `yarn test:run`
- 타입 체크: `yarn tsc -b`
- 빌드: `yarn build`

---

## 0. 사전 체크

- [ ] **Step 0.1: 브랜치 확인**

`git branch --show-current` → `feat/asset-library-modal` 이어야 함.

- [ ] **Step 0.2: 베이스라인 그린 확인**

```
yarn install
yarn tsc -b
yarn test:run
```

기존 198 통과(또는 그 이상) 그린 상태가 베이스라인. 이걸 회귀로 절대 깨지 않게 한다.

---

## Phase A — 데이터 모델 & 영속

### Task 1: 의존성 추가 (Radix 두 패키지)

**Files:**
- Modify: `package.json`
- Modify: `yarn.lock` (자동)

- [ ] **Step 1.1: 추가 설치**

```bash
yarn add @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

- [ ] **Step 1.2: 베이스라인 확인**

```bash
yarn tsc -b
yarn test:run
```

모두 그린.

- [ ] **Step 1.3: 커밋**

```bash
git add package.json yarn.lock
git commit -m "build: add @radix-ui/react-dialog, react-dropdown-menu"
```

---

### Task 2: `Track.recentSounds`·`Project.libraryAssetIds` 타입 추가

**Files:**
- Modify: `src/types.ts`

> 이 task는 타입만 추가하므로 단위 테스트가 없다. 후속 task의 마이그레이션·액션 테스트가 이를 사용한다.

- [ ] **Step 2.1: 타입 확장**

`src/types.ts` 전체 교체:

```ts
export type TrackStatus = "mute" | "listening" | "play" | "write";
export type GlobalMode = "listening" | "play" | "record";

export type BaseFlowRef = { kind: "audioFile"; assetId: string; durationMs: number };

export type SoundRef =
  | { kind: "builtin"; sampleId: string }
  | { kind: "upload"; assetId: string };

export interface Marker {
  id: string;
  timeMs: number;
}

export interface Track {
  id: string;
  name: string;
  status: TrackStatus;
  sound: SoundRef;
  keyBinding: string | null;
  markers: Marker[];
  volume: number; // 0..1
  color: string; // CSS color
  /** 트랙 스코프 MRU 큐. recentSounds[0] === sound 불변량. 최대 6. */
  recentSounds: SoundRef[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  baseFlow: BaseFlowRef;
  tracks: Track[];
  master: { volume: number }; // 0..1
  transport?: { playPauseKey: string | null };
  /** 이 프로젝트의 "내 에셋" 멤버십(업로드만). 빌트인은 미포함. */
  libraryAssetIds: string[];
}
```

- [ ] **Step 2.2: 타입 컴파일 깨지는 곳 확인**

```bash
yarn tsc -b
```

기존 코드 다수가 깨질 것(아직 마이그레이션 안 한 상태). **이 단계에선 깨진 채로 OK** — 후속 task에서 채워간다. 일단 어떤 파일이 깨지는지 기록.

- [ ] **Step 2.3: 커밋 보류**

타입만 추가하고 후속과 함께 커밋. 다음 task로 직진.

---

### Task 3: `StoredAsset.createdAt` 추가 + `putAsset` 자동 부여 + 마이그레이션

**Files:**
- Modify: `src/persistence/db.ts`
- Modify: `src/persistence/assets.ts`
- Test: `src/persistence/assets.test.ts`

- [ ] **Step 3.1: 실패 테스트 작성**

`src/persistence/assets.test.ts`에 다음 케이스 추가(파일 하단):

```ts
import { listAssetsByIds, deleteAsset, renameAsset } from "./assets"; // 아직 없음 — 후속에서 export

describe("StoredAsset.createdAt", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("putAsset은 createdAt을 epoch ms로 자동 부여한다", async () => {
    const before = Date.now();
    const id = await putAsset(new Blob(["x"]), "a.wav");
    const after = Date.now();
    const got = await getAsset(id);
    expect(got!.createdAt).toBeGreaterThanOrEqual(before);
    expect(got!.createdAt).toBeLessThanOrEqual(after);
  });

  it("createdAt 누락 저장본을 로드하면 0으로 정규화된다", async () => {
    // 직접 IDB에 createdAt 없이 저장
    const { getDb } = await import("./db");
    const db = await getDb();
    await db.put("assets", { id: "legacy-1", name: "old", blob: new Blob(["y"]) } as never);
    const got = await getAsset("legacy-1");
    expect(got!.createdAt).toBe(0);
  });
});
```

- [ ] **Step 3.2: 테스트 실패 확인**

```bash
yarn vitest run src/persistence/assets.test.ts
```

Expected: `listAssetsByIds`/`deleteAsset`/`renameAsset` import 실패 + `createdAt` 단정 실패.

- [ ] **Step 3.3: 타입 수정**

`src/persistence/db.ts`에서 `StoredAsset` 갱신:

```ts
export interface StoredAsset {
  id: string;
  name: string;
  blob: Blob;
  createdAt: number; // epoch ms. 누락 저장본은 로드 시 0으로 정규화
}
```

- [ ] **Step 3.4: `putAsset` + `getAsset` 마이그레이션 구현**

`src/persistence/assets.ts` 갱신:

```ts
import { getDb, type StoredAsset } from "./db";
import { newId } from "../domain/ids";

export async function putAsset(blob: Blob, name: string): Promise<string> {
  const db = await getDb();
  const asset: StoredAsset = { id: newId(), name, blob, createdAt: Date.now() };
  await db.put("assets", asset);
  return asset.id;
}

export async function getAsset(id: string): Promise<StoredAsset | null> {
  const db = await getDb();
  const raw = await db.get("assets", id);
  if (!raw) return null;
  return { ...raw, createdAt: raw.createdAt ?? 0 };
}

export async function copyAsset(id: string): Promise<string> {
  const asset = await getAsset(id);
  if (!asset) throw new Error("asset not found: " + id);
  return putAsset(asset.blob, asset.name);
}

// 신규 API들은 후속 Task에서 추가.
```

- [ ] **Step 3.5: createdAt 테스트만 실행해 그린 확인**

```bash
yarn vitest run src/persistence/assets.test.ts -t "createdAt"
```

`listAssetsByIds`/`deleteAsset`/`renameAsset` 테스트는 여전히 실패하지만 createdAt 두 케이스는 그린.

- [ ] **Step 3.6: 커밋 (Task 2의 타입 변경 포함)**

```bash
git add src/types.ts src/persistence/db.ts src/persistence/assets.ts src/persistence/assets.test.ts
git commit -m "feat(persistence): StoredAsset.createdAt + Track.recentSounds/Project.libraryAssetIds 타입"
```

---

### Task 4: `listAssetsByIds` 구현

**Files:**
- Modify: `src/persistence/assets.ts`
- Test: `src/persistence/assets.test.ts`

- [ ] **Step 4.1: 실패 테스트 추가**

```ts
describe("listAssetsByIds", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("주어진 id들만 반환, 누락된 id는 결과에서 빠진다", async () => {
    const a = await putAsset(new Blob(["a"]), "A");
    const b = await putAsset(new Blob(["b"]), "B");
    const got = await listAssetsByIds([a, "nope", b]);
    expect(got.map((x) => x.name).sort()).toEqual(["A", "B"]);
  });

  it("빈 배열이면 빈 배열 반환", async () => {
    expect(await listAssetsByIds([])).toEqual([]);
  });
});
```

- [ ] **Step 4.2: 실패 확인**

```bash
yarn vitest run src/persistence/assets.test.ts -t "listAssetsByIds"
```

- [ ] **Step 4.3: 구현 추가**

`src/persistence/assets.ts` 하단에:

```ts
export async function listAssetsByIds(ids: string[]): Promise<StoredAsset[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const results = await Promise.all(ids.map((id) => db.get("assets", id)));
  return results
    .filter((a): a is StoredAsset => a !== undefined)
    .map((a) => ({ ...a, createdAt: a.createdAt ?? 0 }));
}
```

- [ ] **Step 4.4: 그린 확인**

```bash
yarn vitest run src/persistence/assets.test.ts -t "listAssetsByIds"
```

- [ ] **Step 4.5: 커밋**

```bash
git add src/persistence/assets.ts src/persistence/assets.test.ts
git commit -m "feat(persistence): listAssetsByIds"
```

---

### Task 5: `deleteAsset` 구현

**Files:**
- Modify: `src/persistence/assets.ts`
- Test: `src/persistence/assets.test.ts`

- [ ] **Step 5.1: 실패 테스트**

```ts
describe("deleteAsset", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("저장된 id를 삭제한다", async () => {
    const id = await putAsset(new Blob(["x"]), "X");
    await deleteAsset(id);
    expect(await getAsset(id)).toBeNull();
  });

  it("없는 id를 삭제해도 throw 하지 않는다", async () => {
    await expect(deleteAsset("nope")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 5.2: 실패 확인**

`yarn vitest run src/persistence/assets.test.ts -t "deleteAsset"`

- [ ] **Step 5.3: 구현**

```ts
export async function deleteAsset(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("assets", id);
}
```

- [ ] **Step 5.4: 그린 확인 + 커밋**

```bash
yarn vitest run src/persistence/assets.test.ts -t "deleteAsset"
git add src/persistence/assets.ts src/persistence/assets.test.ts
git commit -m "feat(persistence): deleteAsset"
```

---

### Task 6: `renameAsset` 구현

**Files:**
- Modify: `src/persistence/assets.ts`
- Test: `src/persistence/assets.test.ts`

- [ ] **Step 6.1: 실패 테스트**

```ts
describe("renameAsset", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("이름만 갱신하고 나머지 필드는 유지한다", async () => {
    const id = await putAsset(new Blob(["x"]), "old");
    await renameAsset(id, "new");
    const got = await getAsset(id);
    expect(got!.name).toBe("new");
    expect(await got!.blob.text()).toBe("x");
  });

  it("없는 id를 rename하면 throw", async () => {
    await expect(renameAsset("nope", "x")).rejects.toThrow();
  });
});
```

- [ ] **Step 6.2: 실패 확인**

`yarn vitest run src/persistence/assets.test.ts -t "renameAsset"`

- [ ] **Step 6.3: 구현**

```ts
export async function renameAsset(id: string, newName: string): Promise<void> {
  const db = await getDb();
  const asset = await db.get("assets", id);
  if (!asset) throw new Error("asset not found: " + id);
  await db.put("assets", { ...asset, name: newName });
}
```

- [ ] **Step 6.4: 그린 + 커밋**

```bash
yarn vitest run src/persistence/assets.test.ts -t "renameAsset"
git add src/persistence/assets.ts src/persistence/assets.test.ts
git commit -m "feat(persistence): renameAsset"
```

---

### Task 7: `domain/assetName.ts` — 이름 정규화 + 충돌 접미

**Files:**
- Create: `src/domain/assetName.ts`
- Create: `src/domain/assetName.test.ts`

- [ ] **Step 7.1: 실패 테스트 작성**

`src/domain/assetName.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeAssetName, resolveNameCollision, NAME_MAX_LENGTH } from "./assetName";

describe("normalizeAssetName", () => {
  it("확장자를 제거하고 trim한다", () => {
    expect(normalizeAssetName("  kick.wav ")).toBe("kick");
    expect(normalizeAssetName("Bass-Drop-Lo.mp3")).toBe("Bass-Drop-Lo");
  });

  it("확장자 없는 파일은 그대로", () => {
    expect(normalizeAssetName("kick")).toBe("kick");
  });

  it(`${NAME_MAX_LENGTH}자를 초과하면 자른다`, () => {
    const long = "a".repeat(50);
    expect(normalizeAssetName(long).length).toBe(NAME_MAX_LENGTH);
  });

  it("점이 여러 개여도 마지막 점 이후만 확장자로 본다", () => {
    expect(normalizeAssetName("my.cool.sample.mp3")).toBe("my.cool.sample");
  });
});

describe("resolveNameCollision", () => {
  it("기존에 없으면 그대로", () => {
    expect(resolveNameCollision("kick", [])).toBe("kick");
    expect(resolveNameCollision("kick", ["snare", "hat"])).toBe("kick");
  });

  it("충돌 시 (2) 접미", () => {
    expect(resolveNameCollision("kick", ["kick"])).toBe("kick (2)");
  });

  it("(2)도 차 있으면 (3)", () => {
    expect(resolveNameCollision("kick", ["kick", "kick (2)"])).toBe("kick (3)");
  });

  it("접미 추가 후에도 32자 제한 유지", () => {
    const base = "a".repeat(NAME_MAX_LENGTH);
    const result = resolveNameCollision(base, [base]);
    expect(result.length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
    expect(result.endsWith(" (2)")).toBe(true);
  });
});
```

- [ ] **Step 7.2: 실패 확인**

`yarn vitest run src/domain/assetName.test.ts`

- [ ] **Step 7.3: 구현**

`src/domain/assetName.ts`:

```ts
export const NAME_MAX_LENGTH = 32;

/** 확장자 제거 + trim + 길이 컷. 입력은 파일명 또는 사용자 입력 문자열. */
export function normalizeAssetName(raw: string): string {
  const trimmed = raw.trim();
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  return base.slice(0, NAME_MAX_LENGTH);
}

/** 기존 이름들과 충돌 시 " (n)" 접미. 접미 추가로 길이 초과하면 base를 잘라낸다. */
export function resolveNameCollision(name: string, existing: string[]): string {
  const set = new Set(existing);
  if (!set.has(name)) return name;
  for (let n = 2; n < 1000; n++) {
    const suffix = ` (${n})`;
    const head = name.slice(0, Math.max(0, NAME_MAX_LENGTH - suffix.length));
    const candidate = head + suffix;
    if (!set.has(candidate)) return candidate;
  }
  // 1000회 충돌은 사실상 불가 — 마지막 안전망
  return name.slice(0, NAME_MAX_LENGTH - 8) + " (overflow)";
}
```

- [ ] **Step 7.4: 그린 확인 + 커밋**

```bash
yarn vitest run src/domain/assetName.test.ts
git add src/domain/assetName.ts src/domain/assetName.test.ts
git commit -m "feat(domain): asset name normalize + collision resolver"
```

---

### Task 8: `domain/recentSounds.ts` — MRU push + 빌트인 fallback

**Files:**
- Create: `src/domain/recentSounds.ts`
- Create: `src/domain/recentSounds.test.ts`

- [ ] **Step 8.1: 실패 테스트**

`src/domain/recentSounds.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SoundRef } from "../types";
import {
  pushRecent,
  fillWithBuiltins,
  removeAssetFromRecents,
  seedRecentSounds,
  RECENT_SLOTS,
} from "./recentSounds";

const b = (id: string): SoundRef => ({ kind: "builtin", sampleId: id });
const u = (id: string): SoundRef => ({ kind: "upload", assetId: id });

describe("pushRecent", () => {
  it("새 sound는 [0]에 오고 나머지는 뒤로 밀린다", () => {
    const prev = [b("kick"), b("snare"), b("hat")];
    expect(pushRecent(prev, b("clap"))).toEqual([b("clap"), b("kick"), b("snare"), b("hat")]);
  });

  it("중복은 제거되고 맨 앞으로 이동", () => {
    const prev = [b("kick"), b("snare"), b("hat")];
    expect(pushRecent(prev, b("hat"))).toEqual([b("hat"), b("kick"), b("snare")]);
  });

  it(`최대 ${RECENT_SLOTS}개로 잘린다`, () => {
    const prev = [b("a"), b("b"), b("c"), b("d"), b("e"), b("f")];
    const got = pushRecent(prev, b("g"));
    expect(got.length).toBe(RECENT_SLOTS);
    expect(got[0]).toEqual(b("g"));
    expect(got).not.toContainEqual(b("f")); // 마지막이 밀려남
  });

  it("upload sound도 동일 동작", () => {
    expect(pushRecent([b("kick")], u("a1"))).toEqual([u("a1"), b("kick")]);
  });
});

describe("removeAssetFromRecents", () => {
  it("주어진 assetId의 upload sound만 제거", () => {
    const prev = [u("a"), b("kick"), u("a"), b("snare")];
    expect(removeAssetFromRecents(prev, "a")).toEqual([b("kick"), b("snare")]);
  });

  it("빌트인은 영향 없음", () => {
    const prev = [b("kick"), b("snare")];
    expect(removeAssetFromRecents(prev, "kick")).toEqual([b("kick"), b("snare")]);
  });
});

describe("fillWithBuiltins", () => {
  it("부족한 슬롯을 빌트인 정의 순서로 채워 RECENT_SLOTS 개를 보장", () => {
    const got = fillWithBuiltins([b("kick"), b("snare")]);
    expect(got.length).toBe(RECENT_SLOTS);
    expect(got[0]).toEqual(b("kick"));
    expect(got[1]).toEqual(b("snare"));
    // 그 뒤로는 BUILTIN_SAMPLES에서 이미 포함된 것 빼고 정의 순으로
  });

  it("이미 RECENT_SLOTS 개면 그대로", () => {
    const arr: SoundRef[] = [b("a"), b("b"), b("c"), b("d"), b("e"), b("f")];
    expect(fillWithBuiltins(arr)).toEqual(arr);
  });
});

describe("seedRecentSounds", () => {
  it("현재 sound가 [0], 나머지는 빌트인 중복 제거 후 정의 순", () => {
    const seed = seedRecentSounds(b("snare"));
    expect(seed[0]).toEqual(b("snare"));
    expect(seed.length).toBe(RECENT_SLOTS);
    expect(seed.filter((s) => JSON.stringify(s) === JSON.stringify(b("snare"))).length).toBe(1);
  });

  it("현재 sound가 upload여도 OK", () => {
    const seed = seedRecentSounds(u("up1"));
    expect(seed[0]).toEqual(u("up1"));
    expect(seed.length).toBe(RECENT_SLOTS);
  });
});
```

- [ ] **Step 8.2: 실패 확인**

`yarn vitest run src/domain/recentSounds.test.ts`

- [ ] **Step 8.3: 구현**

`src/domain/recentSounds.ts`:

```ts
import type { SoundRef } from "../types";
import { BUILTIN_SAMPLES } from "../audio/builtinSamples";

export const RECENT_SLOTS = 6;

function sameRef(a: SoundRef, b: SoundRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "builtin" && b.kind === "builtin") return a.sampleId === b.sampleId;
  if (a.kind === "upload" && b.kind === "upload") return a.assetId === b.assetId;
  return false;
}

/** sound를 [0]에 두고 prev에서 중복 제거. 최대 RECENT_SLOTS 개로 자른다. */
export function pushRecent(prev: SoundRef[], sound: SoundRef): SoundRef[] {
  const filtered = prev.filter((s) => !sameRef(s, sound));
  return [sound, ...filtered].slice(0, RECENT_SLOTS);
}

/** upload assetId가 일치하는 항목만 제거. 빌트인은 영향 없음. */
export function removeAssetFromRecents(prev: SoundRef[], assetId: string): SoundRef[] {
  return prev.filter((s) => !(s.kind === "upload" && s.assetId === assetId));
}

/** 부족한 슬롯을 빌트인 정의 순으로 채워 RECENT_SLOTS 보장. 이미 있는 빌트인은 스킵. */
export function fillWithBuiltins(arr: SoundRef[]): SoundRef[] {
  if (arr.length >= RECENT_SLOTS) return arr.slice(0, RECENT_SLOTS);
  const result = arr.slice();
  for (const b of BUILTIN_SAMPLES) {
    if (result.length >= RECENT_SLOTS) break;
    const ref: SoundRef = { kind: "builtin", sampleId: b.id };
    if (!result.some((s) => sameRef(s, ref))) result.push(ref);
  }
  return result;
}

/** 새 트랙/마이그레이션용 시드. 현재 sound가 [0], 그 뒤로 빌트인 fallback. */
export function seedRecentSounds(currentSound: SoundRef): SoundRef[] {
  return fillWithBuiltins([currentSound]);
}
```

- [ ] **Step 8.4: 그린 + 커밋**

```bash
yarn vitest run src/domain/recentSounds.test.ts
git add src/domain/recentSounds.ts src/domain/recentSounds.test.ts
git commit -m "feat(domain): recent sounds MRU + builtin fallback"
```

---

### Task 9: `asset-library/validateUpload.ts` — 검증 파이프라인 (의존성 주입)

**Files:**
- Create: `src/ui/asset-library/validateUpload.ts`
- Create: `src/ui/asset-library/validateUpload.test.ts`

> 이 파일은 UI 폴더에 있지만 순수 함수. 파일 → ArrayBuffer → decode → 검증 결과. `decodeAudioData`는 의존성 주입.

- [ ] **Step 9.1: 실패 테스트**

`src/ui/asset-library/validateUpload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateUpload, MAX_BYTES, MAX_DURATION_MS, type DecodeFn } from "./validateUpload";

function mkFile(name: string, size: number, type: string): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

const okDecode: DecodeFn = async () => ({ durationMs: 2000 });
const tooLongDecode: DecodeFn = async () => ({ durationMs: MAX_DURATION_MS + 100 });
const failDecode: DecodeFn = async () => {
  throw new Error("bad bytes");
};

describe("validateUpload", () => {
  it("audio/* 가 아니면 not-audio 거부", async () => {
    const f = mkFile("img.png", 100, "image/png");
    const r = await validateUpload(f, okDecode);
    expect(r).toEqual({ ok: false, reason: "not-audio" });
  });

  it("5MB 초과는 too-large", async () => {
    const f = mkFile("big.wav", MAX_BYTES + 1, "audio/wav");
    const r = await validateUpload(f, okDecode);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-large");
  });

  it("decode 실패는 decode-failed", async () => {
    const f = mkFile("a.wav", 100, "audio/wav");
    const r = await validateUpload(f, failDecode);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("decode-failed");
  });

  it("길이 초과는 too-long", async () => {
    const f = mkFile("a.wav", 100, "audio/wav");
    const r = await validateUpload(f, tooLongDecode);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too-long");
  });

  it("정상 케이스는 durationMs 반환", async () => {
    const f = mkFile("a.wav", 100, "audio/wav");
    const r = await validateUpload(f, okDecode);
    expect(r).toEqual({ ok: true, durationMs: 2000 });
  });
});
```

- [ ] **Step 9.2: 실패 확인**

`yarn vitest run src/ui/asset-library/validateUpload.test.ts`

- [ ] **Step 9.3: 구현**

`src/ui/asset-library/validateUpload.ts`:

```ts
export const MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_DURATION_MS = 5_000; // 5s

export interface DecodeFn {
  (buf: ArrayBuffer): Promise<{ durationMs: number }>;
}

export type ValidateResult =
  | { ok: true; durationMs: number }
  | {
      ok: false;
      reason: "not-audio" | "too-large" | "decode-failed" | "too-long";
      detail?: string;
    };

export async function validateUpload(file: File, decode: DecodeFn): Promise<ValidateResult> {
  if (!file.type.startsWith("audio/")) {
    return { ok: false, reason: "not-audio", detail: file.type || "unknown" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "too-large", detail: `${(file.size / 1024 / 1024).toFixed(1)}MB` };
  }
  let durationMs: number;
  try {
    const buf = await file.arrayBuffer();
    ({ durationMs } = await decode(buf));
  } catch (e) {
    return { ok: false, reason: "decode-failed", detail: e instanceof Error ? e.message : String(e) };
  }
  if (durationMs > MAX_DURATION_MS) {
    return { ok: false, reason: "too-long", detail: `${(durationMs / 1000).toFixed(1)}s` };
  }
  return { ok: true, durationMs };
}
```

- [ ] **Step 9.4: 그린 + 커밋**

```bash
yarn vitest run src/ui/asset-library/validateUpload.test.ts
git add src/ui/asset-library/validateUpload.ts src/ui/asset-library/validateUpload.test.ts
git commit -m "feat(asset-library): validateUpload pipeline with injectable decode"
```

---

### Task 10: `persistence/projects.ts` — normalize 마이그레이션

**Files:**
- Modify: `src/persistence/projects.ts`
- Create: `src/persistence/projects.migrate.test.ts`

- [ ] **Step 10.1: 실패 테스트 작성**

`src/persistence/projects.migrate.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { saveProject, loadProject } from "./projects";
import { getDb, resetDbCache } from "./db";
import type { Project } from "../types";

describe("project load normalize", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("recentSounds 누락 트랙은 시드로 채워진다", async () => {
    const db = await getDb();
    const stored = {
      id: "p1",
      name: "old",
      createdAt: 0,
      updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
      master: { volume: 1 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "listening",
          sound: { kind: "builtin", sampleId: "snare" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
          // recentSounds 누락
        },
      ],
      // libraryAssetIds 누락
    } as unknown as Project;
    await db.put("projects", stored);

    const loaded = await loadProject("p1");
    expect(loaded).not.toBeNull();
    expect(loaded!.tracks[0].recentSounds[0]).toEqual({ kind: "builtin", sampleId: "snare" });
    expect(loaded!.tracks[0].recentSounds.length).toBe(6);
    expect(loaded!.libraryAssetIds).toEqual([]);
  });

  it("트랙 sound가 upload인데 libraryAssetIds에 없으면 자동 등록", async () => {
    const db = await getDb();
    const stored = {
      id: "p2",
      name: "old",
      createdAt: 0,
      updatedAt: 0,
      baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
      master: { volume: 1 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "listening",
          sound: { kind: "upload", assetId: "asset-orphan" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
        },
      ],
    } as unknown as Project;
    await db.put("projects", stored);

    const loaded = await loadProject("p2");
    expect(loaded!.libraryAssetIds).toContain("asset-orphan");
  });

  it("이미 정상 형태인 프로젝트는 그대로 통과 (저장 → 로드 라운드트립)", async () => {
    const p: Project = {
      id: "p3",
      name: "ok",
      createdAt: 1,
      updatedAt: 1,
      baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
      master: { volume: 0.5 },
      tracks: [
        {
          id: "t1",
          name: "T1",
          status: "listening",
          sound: { kind: "builtin", sampleId: "kick" },
          keyBinding: null,
          markers: [],
          volume: 1,
          color: "#fff",
          recentSounds: [{ kind: "builtin", sampleId: "kick" }],
        },
      ],
      libraryAssetIds: ["a", "b"],
    };
    await saveProject(p);
    const loaded = await loadProject("p3");
    expect(loaded!.libraryAssetIds).toEqual(["a", "b"]);
    // 마이그레이션이 부족한 슬롯은 채움
    expect(loaded!.tracks[0].recentSounds.length).toBe(6);
  });
});
```

- [ ] **Step 10.2: 실패 확인**

`yarn vitest run src/persistence/projects.migrate.test.ts`

- [ ] **Step 10.3: 마이그레이션 구현**

`src/persistence/projects.ts`에서 `loadProject` 갱신 + 헬퍼 추가:

```ts
import { getDb } from "./db";
import type { Project, Track } from "../types";
import { newId } from "../domain/ids";
import { copyAsset } from "./assets";
import { seedRecentSounds, fillWithBuiltins } from "../domain/recentSounds";

function normalizeTrack(t: Track): Track {
  const recentSounds = t.recentSounds && t.recentSounds.length > 0
    ? fillWithBuiltins(t.recentSounds)
    : seedRecentSounds(t.sound);
  return { ...t, recentSounds };
}

function normalizeProject(p: Project): Project {
  const tracks = p.tracks.map(normalizeTrack);
  const declared = new Set(p.libraryAssetIds ?? []);
  for (const t of tracks) {
    if (t.sound.kind === "upload") declared.add(t.sound.assetId);
    for (const s of t.recentSounds) {
      if (s.kind === "upload") declared.add(s.assetId);
    }
  }
  return { ...p, tracks, libraryAssetIds: Array.from(declared) };
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDb();
  await db.put("projects", project);
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDb();
  const raw = await db.get("projects", id);
  return raw ? normalizeProject(raw) : null;
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const all = await db.getAll("projects");
  return all.map(normalizeProject);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("projects", id);
}

// duplicateProject는 Task 11에서 확장.
export async function duplicateProject(project: Project): Promise<Project> {
  // Task 11 임시 통과용 — 기존 동작 + 새 필드 deep copy
  const clone: Project = structuredClone(project);
  clone.id = newId();
  clone.name = `${project.name} (사본)`;
  const now = Date.now();
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.baseFlow = { ...clone.baseFlow, assetId: await copyAsset(clone.baseFlow.assetId) };
  for (const track of clone.tracks) {
    track.id = newId();
    track.markers = track.markers.map((m) => ({ ...m, id: newId() }));
    if (track.sound.kind === "upload") {
      track.sound = { kind: "upload", assetId: await copyAsset(track.sound.assetId) };
    }
  }
  await saveProject(clone);
  return clone;
}
```

- [ ] **Step 10.4: 그린 확인**

```bash
yarn vitest run src/persistence/projects.migrate.test.ts
```

- [ ] **Step 10.5: 기존 projects 테스트 회귀 확인**

```bash
yarn vitest run src/persistence/projects.test.ts
```

기존 `duplicateProject`/`save/load` 테스트가 통과해야 함. 깨지면 normalize가 기존 필드를 깬 것 — 수정 후 다시.

- [ ] **Step 10.6: 커밋**

```bash
git add src/persistence/projects.ts src/persistence/projects.migrate.test.ts
git commit -m "feat(persistence): project load normalize (recentSounds + libraryAssetIds)"
```

---

### Task 11: `duplicateProject` 확장 — idMap + libraryAssetIds + recentSounds

**Files:**
- Modify: `src/persistence/projects.ts`
- Modify: `src/persistence/projects.test.ts`

- [ ] **Step 11.1: 실패 테스트 추가**

`src/persistence/projects.test.ts`에 케이스 추가:

```ts
it("duplicateProject는 libraryAssetIds를 깊은 복사하고 idMap으로 중복 copyAsset을 방지한다", async () => {
  const origAsset = await putAsset(new Blob(["x"]), "shared");
  const baseFlow = await putAsset(new Blob(["bf"]), "bf");
  const original: Project = {
    id: "p",
    name: "orig",
    createdAt: 0,
    updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: baseFlow, durationMs: 1000 },
    master: { volume: 1 },
    tracks: [
      {
        id: "t1",
        name: "T1",
        status: "listening",
        sound: { kind: "upload", assetId: origAsset },
        keyBinding: null,
        markers: [],
        volume: 1,
        color: "#fff",
        recentSounds: [{ kind: "upload", assetId: origAsset }, { kind: "builtin", sampleId: "kick" }],
      },
      {
        id: "t2",
        name: "T2",
        status: "listening",
        sound: { kind: "builtin", sampleId: "snare" },
        keyBinding: null,
        markers: [],
        volume: 1,
        color: "#fff",
        recentSounds: [{ kind: "builtin", sampleId: "snare" }, { kind: "upload", assetId: origAsset }],
      },
    ],
    libraryAssetIds: [origAsset],
  };
  await saveProject(original);

  const copy = await duplicateProject(original);

  // libraryAssetIds가 새 id로 교체되어야 함
  expect(copy.libraryAssetIds).toHaveLength(1);
  expect(copy.libraryAssetIds[0]).not.toBe(origAsset);

  // t1.sound와 t2.recentSounds 안의 upload, libraryAssetIds[0] 모두 같은 새 id (idMap)
  const t1Sound = copy.tracks[0].sound;
  const t2RecentUpload = copy.tracks[1].recentSounds.find((s) => s.kind === "upload");
  expect(t1Sound.kind).toBe("upload");
  if (t1Sound.kind === "upload") {
    expect(t1Sound.assetId).toBe(copy.libraryAssetIds[0]);
  }
  expect(t2RecentUpload?.kind).toBe("upload");
  if (t2RecentUpload?.kind === "upload") {
    expect(t2RecentUpload.assetId).toBe(copy.libraryAssetIds[0]);
  }

  // recentSounds[0] === sound 불변량
  expect(JSON.stringify(copy.tracks[0].recentSounds[0])).toBe(JSON.stringify(copy.tracks[0].sound));
});
```

- [ ] **Step 11.2: 실패 확인**

`yarn vitest run src/persistence/projects.test.ts -t "idMap"`

- [ ] **Step 11.3: `duplicateProject` 구현 갱신**

`src/persistence/projects.ts`의 `duplicateProject` 교체:

```ts
import type { Project, SoundRef } from "../types";
// ... 기존 import

export async function duplicateProject(project: Project): Promise<Project> {
  const clone: Project = structuredClone(project);
  clone.id = newId();
  clone.name = `${project.name} (사본)`;
  const now = Date.now();
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.baseFlow = { ...clone.baseFlow, assetId: await copyAsset(clone.baseFlow.assetId) };

  const idMap = new Map<string, string>();
  const remap = async (oldId: string): Promise<string> => {
    const hit = idMap.get(oldId);
    if (hit) return hit;
    const next = await copyAsset(oldId);
    idMap.set(oldId, next);
    return next;
  };

  clone.libraryAssetIds = await Promise.all((clone.libraryAssetIds ?? []).map(remap));

  for (const track of clone.tracks) {
    track.id = newId();
    track.markers = track.markers.map((m) => ({ ...m, id: newId() }));
    if (track.sound.kind === "upload") {
      track.sound = { kind: "upload", assetId: await remap(track.sound.assetId) };
    }
    track.recentSounds = await Promise.all(
      track.recentSounds.map(async (s): Promise<SoundRef> =>
        s.kind === "upload" ? { kind: "upload", assetId: await remap(s.assetId) } : s,
      ),
    );
  }

  await saveProject(clone);
  return clone;
}
```

- [ ] **Step 11.4: 그린 확인**

```bash
yarn vitest run src/persistence/projects.test.ts
```

- [ ] **Step 11.5: 커밋**

```bash
git add src/persistence/projects.ts src/persistence/projects.test.ts
git commit -m "feat(persistence): duplicateProject idMap + libraryAssetIds/recentSounds deep copy"
```

---

### Task 12: `exampleProject.ts` — recentSounds 시드 + libraryAssetIds

**Files:**
- Modify: `src/example/exampleProject.ts`
- Modify: `src/example/exampleProject.test.ts`

- [ ] **Step 12.1: 실패 테스트 추가**

`src/example/exampleProject.test.ts`에 추가:

```ts
it("각 트랙은 recentSounds 6개를 가진다 (현재 sound가 [0])", () => {
  const p = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "asset-1", 136032);
  for (const t of p.tracks) {
    expect(t.recentSounds.length).toBe(6);
    expect(JSON.stringify(t.recentSounds[0])).toBe(JSON.stringify(t.sound));
  }
});

it("libraryAssetIds는 빈 배열 (예제는 빌트인만 사용)", () => {
  const p = buildProjectFromBlueprint(EXAMPLE_BLUEPRINT, "asset-1", 136032);
  expect(p.libraryAssetIds).toEqual([]);
});
```

- [ ] **Step 12.2: 실패 확인**

`yarn vitest run src/example/exampleProject.test.ts`

- [ ] **Step 12.3: 구현 갱신**

`src/example/exampleProject.ts`의 `buildProjectFromBlueprint`:

```ts
import { seedRecentSounds } from "../domain/recentSounds";

export function buildProjectFromBlueprint(
  blueprint: ExampleBlueprint,
  assetId: string,
  durationMs: number,
): Project {
  const now = Date.now();
  const tracks: Track[] = blueprint.tracks.map((t) => ({
    id: newId(),
    name: t.name,
    status: t.status,
    sound: t.sound,
    keyBinding: t.keyBinding,
    markers: t.markersMs.map((timeMs) => ({ id: newId(), timeMs })),
    volume: t.volume,
    color: t.color,
    recentSounds: seedRecentSounds(t.sound),
  }));
  return {
    id: newId(),
    name: blueprint.name,
    createdAt: now,
    updatedAt: now,
    baseFlow: { kind: "audioFile", assetId, durationMs },
    tracks,
    master: { volume: blueprint.master.volume },
    transport: { playPauseKey: null },
    libraryAssetIds: [],
  };
}
```

- [ ] **Step 12.4: 그린 + 커밋**

```bash
yarn vitest run src/example/exampleProject.test.ts
git add src/example/exampleProject.ts src/example/exampleProject.test.ts
git commit -m "feat(example): seed recentSounds + libraryAssetIds=[]"
```

---

### Task 13: `useStore.addTrack` 마이그레이션 + `selectTrackSound` 단일 진입점

**Files:**
- Modify: `src/store/useStore.ts`
- Create: `src/store/useStore.recentSounds.test.ts`

- [ ] **Step 13.1: 실패 테스트 작성**

`src/store/useStore.recentSounds.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";
import { seedRecentSounds } from "../domain/recentSounds";

function mkProject(): Project {
  const sound = { kind: "builtin" as const, sampleId: "kick" };
  return {
    id: "p",
    name: "P",
    createdAt: 0,
    updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
    master: { volume: 1 },
    tracks: [
      {
        id: "t1",
        name: "T1",
        status: "listening",
        sound,
        keyBinding: null,
        markers: [],
        volume: 1,
        color: "#fff",
        recentSounds: seedRecentSounds(sound),
      },
    ],
    libraryAssetIds: [],
  };
}

describe("selectTrackSound", () => {
  beforeEach(() => {
    useStore.setState({ project: mkProject() });
  });

  it("track.sound와 recentSounds[0]을 동시에 갱신한다", () => {
    useStore.getState().selectTrackSound("t1", { kind: "builtin", sampleId: "snare" });
    const t = useStore.getState().project!.tracks[0];
    expect(t.sound).toEqual({ kind: "builtin", sampleId: "snare" });
    expect(t.recentSounds[0]).toEqual({ kind: "builtin", sampleId: "snare" });
  });

  it("기존에 있던 sound를 다시 고르면 중복 없이 [0]으로 이동", () => {
    useStore.getState().selectTrackSound("t1", { kind: "builtin", sampleId: "snare" });
    useStore.getState().selectTrackSound("t1", { kind: "builtin", sampleId: "kick" });
    const t = useStore.getState().project!.tracks[0];
    expect(t.recentSounds[0]).toEqual({ kind: "builtin", sampleId: "kick" });
    const kicks = t.recentSounds.filter((s) => s.kind === "builtin" && s.sampleId === "kick");
    expect(kicks.length).toBe(1);
  });
});

describe("addTrack은 recentSounds를 빌트인 시드로 만든다", () => {
  it("새 트랙의 recentSounds.length === 6, [0] === sound", () => {
    useStore.setState({ project: mkProject() });
    useStore.getState().addTrack();
    const tracks = useStore.getState().project!.tracks;
    const last = tracks[tracks.length - 1];
    expect(last.recentSounds.length).toBe(6);
    expect(JSON.stringify(last.recentSounds[0])).toBe(JSON.stringify(last.sound));
  });
});
```

- [ ] **Step 13.2: 실패 확인**

`yarn vitest run src/store/useStore.recentSounds.test.ts`

- [ ] **Step 13.3: 구현 갱신**

`src/store/useStore.ts`에 `selectTrackSound` 추가, `addTrack`은 `recentSounds` 시드, 기존 `setTrackSound`를 `selectTrackSound`로 위임.

```ts
import { seedRecentSounds, pushRecent } from "../domain/recentSounds";

// StoreState 인터페이스에 추가
//   selectTrackSound: (trackId: string, sound: SoundRef) => void;

// addTrack의 새 트랙 객체에 recentSounds 추가:
addTrack: () =>
  set((s) =>
    mutate(s, (tracks) => {
      const sound: SoundRef = { kind: "builtin", sampleId: "kick" };
      return [
        ...tracks,
        {
          id: newId(),
          name: `트랙 ${tracks.length + 1}`,
          status: "listening",
          sound,
          keyBinding: null,
          markers: [],
          volume: 1,
          color: pickColor(tracks.length),
          recentSounds: seedRecentSounds(sound),
        },
      ];
    }),
  ),

// 신규: selectTrackSound (모든 sound 변경의 단일 진입점)
selectTrackSound: (trackId, sound) =>
  set((s) =>
    mutate(s, (tracks) =>
      mapTrack(tracks, trackId, (t) => ({
        ...t,
        sound,
        recentSounds: pushRecent(t.recentSounds, sound),
      })),
    ),
  ),

// 기존 setTrackSound는 selectTrackSound로 위임 — 후속 마이그레이션
setTrackSound: (trackId, sound) => useStore.getState().selectTrackSound(trackId, sound),
```

> 위 `setTrackSound: (trackId, sound) => useStore.getState().selectTrackSound(...)` 는 zustand store 정의 시점에 `useStore`가 아직 없을 수 있으니, `set` 콜백 안에서 `s.selectTrackSound(...)`를 호출하는 형태로 작성:
> ```ts
> setTrackSound: (trackId, sound) => {
>   // selectTrackSound는 동일 set 패턴 — 직접 같은 변환 적용
> },
> ```
> 가장 간결한 방법은 `setTrackSound`를 `selectTrackSound`로 같은 본문을 갖게 두 번 정의(또는 alias 헬퍼). 본 plan에서는 **`setTrackSound`를 `selectTrackSound`와 동일 구현**으로 통일:
>
> ```ts
> setTrackSound: (trackId, sound) =>
>   set((s) =>
>     mutate(s, (tracks) =>
>       mapTrack(tracks, trackId, (t) => ({
>         ...t,
>         sound,
>         recentSounds: pushRecent(t.recentSounds, sound),
>       })),
>     ),
>   ),
> ```

`StoreState` 인터페이스에 `selectTrackSound` 시그니처 추가:

```ts
selectTrackSound: (trackId: string, sound: SoundRef) => void;
```

- [ ] **Step 13.4: 그린 확인 + 기존 회귀 확인**

```bash
yarn vitest run src/store/useStore.recentSounds.test.ts
yarn vitest run src/store/useStore.test.ts
yarn vitest run src/store/reorderTracks.persist.test.ts
```

기존 useStore 테스트는 새 필드(`recentSounds`/`libraryAssetIds`)를 알아서 시드해야 통과. 만약 픽스처가 깨지면 픽스처에 새 필드 추가.

- [ ] **Step 13.5: 커밋**

```bash
git add src/store/useStore.ts src/store/useStore.recentSounds.test.ts
git commit -m "feat(store): selectTrackSound (single entry for MRU)"
```

---

### Task 14: `useStore.addAssetToLibrary`

**Files:**
- Modify: `src/store/useStore.ts`
- Create: `src/store/useStore.library.test.ts`

- [ ] **Step 14.1: 실패 테스트**

`src/store/useStore.library.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { Project } from "../types";
import { seedRecentSounds } from "../domain/recentSounds";

function mkProject(libraryAssetIds: string[] = []): Project {
  const sound = { kind: "builtin" as const, sampleId: "kick" };
  return {
    id: "p", name: "P", createdAt: 0, updatedAt: 0,
    baseFlow: { kind: "audioFile", assetId: "bf", durationMs: 1000 },
    master: { volume: 1 },
    tracks: [{
      id: "t1", name: "T1", status: "listening", sound,
      keyBinding: null, markers: [], volume: 1, color: "#fff",
      recentSounds: seedRecentSounds(sound),
    }],
    libraryAssetIds,
  };
}

describe("addAssetToLibrary", () => {
  beforeEach(() => useStore.setState({ project: mkProject() }));

  it("libraryAssetIds에 추가한다", () => {
    useStore.getState().addAssetToLibrary("a1");
    expect(useStore.getState().project!.libraryAssetIds).toEqual(["a1"]);
  });

  it("중복은 추가하지 않는다", () => {
    useStore.getState().addAssetToLibrary("a1");
    useStore.getState().addAssetToLibrary("a1");
    expect(useStore.getState().project!.libraryAssetIds).toEqual(["a1"]);
  });
});
```

- [ ] **Step 14.2: 실패 확인**

`yarn vitest run src/store/useStore.library.test.ts -t "addAssetToLibrary"`

- [ ] **Step 14.3: 구현**

`StoreState`에:
```ts
addAssetToLibrary: (assetId: string) => void;
```

구현:
```ts
addAssetToLibrary: (assetId) =>
  set((s) => {
    if (!s.project) return s;
    if (s.project.libraryAssetIds.includes(assetId)) return s;
    return {
      project: {
        ...s.project,
        libraryAssetIds: [...s.project.libraryAssetIds, assetId],
        updatedAt: Date.now(),
      },
    };
  }),
```

- [ ] **Step 14.4: 그린 + 커밋**

```bash
yarn vitest run src/store/useStore.library.test.ts
git add src/store/useStore.ts src/store/useStore.library.test.ts
git commit -m "feat(store): addAssetToLibrary"
```

---

### Task 15: `useStore.removeAssetFromLibrary` — 가드 + fallback

**Files:**
- Modify: `src/store/useStore.ts`
- Modify: `src/store/useStore.library.test.ts`

- [ ] **Step 15.1: 실패 테스트 추가**

```ts
import { fillWithBuiltins, removeAssetFromRecents } from "../domain/recentSounds";

describe("canDeleteAsset", () => {
  it("어느 트랙에서도 현재 sound로 안 쓰면 ok", () => {
    useStore.setState({ project: mkProject(["a1"]) });
    const r = useStore.getState().canDeleteAsset("a1");
    expect(r.ok).toBe(true);
  });

  it("쓰는 트랙이 있으면 usedBy 반환", () => {
    const proj = mkProject(["a1"]);
    proj.tracks[0].sound = { kind: "upload", assetId: "a1" };
    proj.tracks[0].recentSounds = [{ kind: "upload", assetId: "a1" }, ...proj.tracks[0].recentSounds.slice(1)];
    useStore.setState({ project: proj });
    const r = useStore.getState().canDeleteAsset("a1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.usedBy.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("removeAssetFromLibrary", () => {
  it("libraryAssetIds에서 제거 + 모든 트랙 recentSounds에서 제거 후 빌트인 fallback", () => {
    const proj = mkProject(["a1", "a2"]);
    proj.tracks[0].recentSounds = [
      { kind: "builtin", sampleId: "kick" },
      { kind: "upload", assetId: "a1" },
    ];
    useStore.setState({ project: proj });
    useStore.getState().removeAssetFromLibrary("a1");
    const p = useStore.getState().project!;
    expect(p.libraryAssetIds).toEqual(["a2"]);
    const recents = p.tracks[0].recentSounds;
    expect(recents.length).toBe(6);
    expect(recents.some((s) => s.kind === "upload" && s.assetId === "a1")).toBe(false);
  });

  it("사용 중이면 no-op (가드 책임은 호출자, 단 store는 안전망으로 ignore)", () => {
    const proj = mkProject(["a1"]);
    proj.tracks[0].sound = { kind: "upload", assetId: "a1" };
    useStore.setState({ project: proj });
    useStore.getState().removeAssetFromLibrary("a1");
    expect(useStore.getState().project!.libraryAssetIds).toEqual(["a1"]); // 그대로
  });
});
```

- [ ] **Step 15.2: 실패 확인**

`yarn vitest run src/store/useStore.library.test.ts`

- [ ] **Step 15.3: 구현**

`StoreState`에 추가:

```ts
canDeleteAsset: (assetId: string) => { ok: true } | { ok: false; usedBy: Track[] };
removeAssetFromLibrary: (assetId: string) => void;
```

구현:

```ts
canDeleteAsset: (assetId) => {
  const p = useStore.getState().project;
  if (!p) return { ok: true };
  const usedBy = p.tracks.filter((t) => t.sound.kind === "upload" && t.sound.assetId === assetId);
  return usedBy.length === 0 ? { ok: true } : { ok: false, usedBy };
},

removeAssetFromLibrary: (assetId) =>
  set((s) => {
    if (!s.project) return s;
    // 가드: 사용 중이면 no-op
    const usedBy = s.project.tracks.filter(
      (t) => t.sound.kind === "upload" && t.sound.assetId === assetId,
    );
    if (usedBy.length > 0) return s;
    return {
      project: {
        ...s.project,
        libraryAssetIds: s.project.libraryAssetIds.filter((id) => id !== assetId),
        tracks: s.project.tracks.map((t) => ({
          ...t,
          recentSounds: fillWithBuiltins(removeAssetFromRecents(t.recentSounds, assetId)),
        })),
        updatedAt: Date.now(),
      },
    };
  }),
```

`Track` import:

```ts
import type { GlobalMode, Marker, Project, SoundRef, Track, TrackStatus } from "../types";
```

`fillWithBuiltins`, `removeAssetFromRecents` import 추가.

- [ ] **Step 15.4: 그린 + 커밋**

```bash
yarn vitest run src/store/useStore.library.test.ts
git add src/store/useStore.ts src/store/useStore.library.test.ts
git commit -m "feat(store): canDeleteAsset + removeAssetFromLibrary with builtin fallback"
```

---

### Task 16: `useStore.renameLibraryAsset` (이름은 IDB에도 반영)

> `renameLibraryAsset`은 store + IDB 양쪽 호출. store에선 단순히 위임 액션. IDB 호출은 UI 핸들러에서 `renameAsset(id, name)` 직접 호출 + 모달 refetch.

**이번 task는 별도 store 액션 없이 진행** — Task 21(AssetCard)와 Task 23(AssetLibraryModal)에서 직접 `renameAsset` API 호출 + refetch 패턴으로 처리. 별도 store 액션 도입은 YAGNI. 본 task는 **스킵** 표기만 남기고 Phase B로 이동.

- [ ] **Step 16.1: 결정 기록**

이 task는 의도적으로 액션을 추가하지 않음. UI 레벨에서 `renameAsset` 직접 호출 + 로컬 state refetch. 모달 내부 데이터는 store가 아니라 컴포넌트 로컬 state로 잡혀있기 때문(Spec 7.10).

---

## Phase B — UI Primitives

### Task 17: `store/loadingOverlay.ts` — 전역 오버레이 상태

**Files:**
- Create: `src/store/loadingOverlay.ts`
- Create: `src/store/loadingOverlay.test.ts`

- [ ] **Step 17.1: 실패 테스트**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useLoadingOverlay } from "./loadingOverlay";

describe("loadingOverlay", () => {
  beforeEach(() => useLoadingOverlay.setState({ open: false, mode: "indeterminate", progress: undefined, label: undefined }));

  it("show은 open=true와 mode/label을 설정", () => {
    useLoadingOverlay.getState().show({ mode: "determinate", label: "복사 중..." });
    const s = useLoadingOverlay.getState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe("determinate");
    expect(s.label).toBe("복사 중...");
  });

  it("setProgress는 0..1 사이로 클램프", () => {
    useLoadingOverlay.getState().show({ mode: "determinate" });
    useLoadingOverlay.getState().setProgress(0.5);
    expect(useLoadingOverlay.getState().progress).toBe(0.5);
    useLoadingOverlay.getState().setProgress(2);
    expect(useLoadingOverlay.getState().progress).toBe(1);
    useLoadingOverlay.getState().setProgress(-1);
    expect(useLoadingOverlay.getState().progress).toBe(0);
  });

  it("hide는 open=false로 리셋", () => {
    useLoadingOverlay.getState().show({ mode: "indeterminate" });
    useLoadingOverlay.getState().hide();
    expect(useLoadingOverlay.getState().open).toBe(false);
  });
});
```

- [ ] **Step 17.2: 실패 확인**

`yarn vitest run src/store/loadingOverlay.test.ts`

- [ ] **Step 17.3: 구현**

`src/store/loadingOverlay.ts`:

```ts
import { create } from "zustand";

export type OverlayMode = "indeterminate" | "determinate";

interface LoadingOverlayState {
  open: boolean;
  mode: OverlayMode;
  progress?: number; // 0..1
  label?: string;
  show: (opts: { mode: OverlayMode; label?: string }) => void;
  setProgress: (p: number) => void;
  hide: () => void;
}

function clamp01(p: number): number {
  return Math.max(0, Math.min(1, p));
}

export const useLoadingOverlay = create<LoadingOverlayState>((set) => ({
  open: false,
  mode: "indeterminate",
  progress: undefined,
  label: undefined,
  show: ({ mode, label }) =>
    set({ open: true, mode, label, progress: mode === "determinate" ? 0 : undefined }),
  setProgress: (p) => set({ progress: clamp01(p) }),
  hide: () => set({ open: false, progress: undefined, label: undefined }),
}));
```

- [ ] **Step 17.4: 그린 + 커밋**

```bash
yarn vitest run src/store/loadingOverlay.test.ts
git add src/store/loadingOverlay.ts src/store/loadingOverlay.test.ts
git commit -m "feat(store): loadingOverlay slice"
```

---

### Task 18: `<LoadingOverlay>` 컴포넌트

**Files:**
- Create: `src/ui/primitives/LoadingOverlay.tsx`
- Create: `src/ui/primitives/LoadingOverlay.module.css`
- Modify: `src/App.tsx` (루트에 한 번 마운트)

- [ ] **Step 18.1: 컴포넌트 작성**

`src/ui/primitives/LoadingOverlay.tsx`:

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { useLoadingOverlay } from "../../store/loadingOverlay";
import styles from "./LoadingOverlay.module.css";

export function LoadingOverlay() {
  const { open, mode, progress, label } = useLoadingOverlay();
  const pct = mode === "determinate" ? Math.round((progress ?? 0) * 100) : null;
  return (
    <Dialog.Root open={open} onOpenChange={() => { /* blocking — 무시 */ }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <Dialog.Title className={styles.srOnly}>로딩 중</Dialog.Title>
          <Dialog.Description className={styles.srOnly}>{label ?? "처리 중..."}</Dialog.Description>
          {mode === "determinate" ? (
            <div className={styles.bar} role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.barFill} style={{ width: `${pct}%` }} />
              <div className={styles.barText}>{pct}%</div>
            </div>
          ) : (
            <div className={styles.spinner} aria-hidden="true" />
          )}
          {label && <div className={styles.label}>{label}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 18.2: CSS 작성**

`src/ui/primitives/LoadingOverlay.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1000;
}
.content {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 1001;
  color: white;
  font-family: var(--font-ui, sans-serif);
}
.bar {
  position: relative;
  width: min(320px, 60vw);
  height: 14px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  overflow: hidden;
}
.barFill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, #a855f7, #ec4899);
  transition: width 120ms linear;
}
.barText {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: white;
  mix-blend-mode: difference;
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ec4899;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.label {
  font-size: 14px;
  font-weight: 500;
}
.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 18.3: App 루트에 마운트**

`src/App.tsx` (해당 라우터 outlet 또는 root 컴포넌트)에서 한 번만 마운트:

```tsx
import { LoadingOverlay } from "./ui/primitives/LoadingOverlay";

// 기존 return 안 맨 마지막(또는 루트 직속)에:
<>
  {/* 기존 트리 */}
  <LoadingOverlay />
</>
```

`App.tsx`의 정확한 구조를 먼저 읽어보고(예: `<Routes>` 옆) 한 번만 마운트. 두 번 마운트되면 같은 상태가 두 번 렌더된다 — 검색 후 단일 마운트 보장.

- [ ] **Step 18.4: 타입 통과 + 시각 확인 (수동)**

```bash
yarn tsc -b
```

`yarn dev`로 띄워 콘솔에서 `useLoadingOverlay.getState().show({ mode: "determinate", label: "test" })` 시 오버레이가 나타나는지 확인. 그리고 `setProgress(0.5)` → 50% 채워지는지. `hide()` → 사라지는지.

- [ ] **Step 18.5: 커밋**

```bash
git add src/ui/primitives/LoadingOverlay.tsx src/ui/primitives/LoadingOverlay.module.css src/App.tsx
git commit -m "feat(primitives): <LoadingOverlay> mounted at root"
```

---

### Task 19: `<Modal>` primitive

**Files:**
- Create: `src/ui/primitives/Modal.tsx`
- Create: `src/ui/primitives/Modal.module.css`

- [ ] **Step 19.1: 컴포넌트 작성**

`src/ui/primitives/Modal.tsx`:

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { cx } from "../cx";
import styles from "./Modal.module.css";
import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg";

interface ModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  size?: Size;
  children: ReactNode;
}

export function Modal({ open, onOpenChange, title, description, size = "md", children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={cx(styles.content, styles[`size_${size}`])} role="dialog">
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Close className={styles.closeBtn} aria-label="닫기">
              <X size={16} weight="bold" />
            </Dialog.Close>
          </header>
          {description && <Dialog.Description className={styles.description}>{description}</Dialog.Description>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
function Footer({ children }: { children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>;
}

Modal.Body = Body;
Modal.Footer = Footer;
```

- [ ] **Step 19.2: CSS 작성**

`src/ui/primitives/Modal.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 4, 24, 0.65);
  z-index: 900;
}
.content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #1a1230;
  color: #e8e2ff;
  border-radius: 14px;
  border: 1px solid rgba(168, 85, 247, 0.35);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  z-index: 901;
}
.size_sm { width: min(380px, 92vw); }
.size_md { width: min(560px, 92vw); }
.size_lg { width: min(840px, 94vw); }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(168, 85, 247, 0.2);
}
.title {
  font-family: var(--font-display, "Jua", sans-serif);
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}
.description {
  padding: 0 18px;
  font-size: 12px;
  color: #b8aedc;
}
.body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid rgba(168, 85, 247, 0.2);
}
.closeBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  color: inherit;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
.closeBtn:hover { background: rgba(168, 85, 247, 0.18); }
```

- [ ] **Step 19.3: tsc + 수동 시각 확인은 다음 task에서 모달을 실제 사용하며 검증**

```bash
yarn tsc -b
```

- [ ] **Step 19.4: 커밋**

```bash
git add src/ui/primitives/Modal.tsx src/ui/primitives/Modal.module.css
git commit -m "feat(primitives): <Modal> Radix Dialog wrapper"
```

---

## Phase C — Asset Library Feature

### Task 20: `store/assetLibrary.ts` — 모달 open/mode/targetTrackId

**Files:**
- Create: `src/store/assetLibrary.ts`
- Create: `src/store/assetLibrary.test.ts`

- [ ] **Step 20.1: 실패 테스트**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAssetLibrary } from "./assetLibrary";

describe("assetLibrary slice", () => {
  beforeEach(() => useAssetLibrary.setState({ open: false, mode: "manage", targetTrackId: null }));

  it("openManage", () => {
    useAssetLibrary.getState().openManage();
    const s = useAssetLibrary.getState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe("manage");
    expect(s.targetTrackId).toBeNull();
  });

  it("openSelect는 targetTrackId를 저장한다", () => {
    useAssetLibrary.getState().openSelect("t1");
    const s = useAssetLibrary.getState();
    expect(s.open).toBe(true);
    expect(s.mode).toBe("select");
    expect(s.targetTrackId).toBe("t1");
  });

  it("close는 리셋", () => {
    useAssetLibrary.getState().openSelect("t1");
    useAssetLibrary.getState().close();
    const s = useAssetLibrary.getState();
    expect(s.open).toBe(false);
    expect(s.targetTrackId).toBeNull();
  });
});
```

- [ ] **Step 20.2: 실패 확인 + 구현 + 그린 + 커밋**

`src/store/assetLibrary.ts`:

```ts
import { create } from "zustand";

export type AssetLibraryMode = "manage" | "select";

interface AssetLibraryState {
  open: boolean;
  mode: AssetLibraryMode;
  targetTrackId: string | null;
  openManage(): void;
  openSelect(trackId: string): void;
  close(): void;
}

export const useAssetLibrary = create<AssetLibraryState>((set) => ({
  open: false,
  mode: "manage",
  targetTrackId: null,
  openManage: () => set({ open: true, mode: "manage", targetTrackId: null }),
  openSelect: (trackId) => set({ open: true, mode: "select", targetTrackId: trackId }),
  close: () => set({ open: false, targetTrackId: null }),
}));
```

```bash
yarn vitest run src/store/assetLibrary.test.ts
git add src/store/assetLibrary.ts src/store/assetLibrary.test.ts
git commit -m "feat(store): assetLibrary modal slice"
```

---

### Task 21: `<AssetCard>` 컴포넌트

**Files:**
- Create: `src/ui/asset-library/AssetCard.tsx`
- Create: `src/ui/asset-library/AssetCard.module.css`

> 단위 테스트보다 시각 회귀 + 통합으로 검증. 이 task는 props 인터페이스 + 마크업/스타일 위주.

- [ ] **Step 21.1: 컴포넌트 작성**

`src/ui/asset-library/AssetCard.tsx`:

```tsx
import { useState } from "react";
import { Play, Lock, Pencil, Trash, Check, X } from "@phosphor-icons/react";
import { cx } from "../cx";
import { NAME_MAX_LENGTH } from "../../domain/assetName";
import styles from "./AssetCard.module.css";

export type AssetCardAsset =
  | { kind: "builtin"; sampleId: string; label: string }
  | { kind: "upload"; id: string; name: string; durationMs: number; createdAt: number };

interface Props {
  asset: AssetCardAsset;
  mode: "manage" | "select";
  isCurrent?: boolean;
  onSelect?(): void;
  onRename?(newName: string): void;
  onDelete?(): void;
  onPreview(): void;
}

function relative(ms: number): string {
  if (ms === 0) return "오래 전";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

export function AssetCard({ asset, mode, isCurrent, onSelect, onRename, onDelete, onPreview }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asset.kind === "upload" ? asset.name : "");

  const clickable = mode === "select";
  const isBuiltin = asset.kind === "builtin";

  return (
    <div
      className={cx(styles.card, isCurrent && styles.current, clickable && styles.clickable)}
      onClick={clickable ? onSelect : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      title={asset.kind === "upload" ? asset.name : undefined}
    >
      <button
        type="button"
        className={styles.previewBtn}
        aria-label="미리듣기"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
      >
        <Play size={14} weight="fill" />
      </button>

      {isBuiltin ? (
        <div className={styles.meta}>
          <div className={styles.name}>
            <Lock size={12} weight="bold" /> {asset.label}
          </div>
          <div className={styles.sub}>builtin</div>
        </div>
      ) : editing ? (
        <div className={styles.editRow} onClick={(e) => e.stopPropagation()}>
          <input
            className={styles.editInput}
            value={draft}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = draft.trim() || asset.name;
                if (next !== asset.name) onRename?.(next);
                setEditing(false);
              } else if (e.key === "Escape") {
                setDraft(asset.name);
                setEditing(false);
              }
            }}
            autoFocus
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              const next = draft.trim() || asset.name;
              if (next !== asset.name) onRename?.(next);
              setEditing(false);
            }}
            aria-label="확인"
          >
            <Check size={12} weight="bold" />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              setDraft(asset.name);
              setEditing(false);
            }}
            aria-label="취소"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      ) : (
        <div className={styles.meta}>
          <div className={styles.name}>{asset.name}</div>
          <div className={styles.sub}>
            {(asset.durationMs / 1000).toFixed(1)}s · {relative(asset.createdAt)}
          </div>
        </div>
      )}

      {mode === "manage" && !isBuiltin && !editing && (
        <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.iconBtn} aria-label="이름 변경" onClick={() => setEditing(true)}>
            <Pencil size={12} />
          </button>
          <button type="button" className={styles.iconBtn} aria-label="삭제" onClick={onDelete}>
            <Trash size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 21.2: CSS**

`src/ui/asset-library/AssetCard.module.css`:

```css
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: rgba(168, 85, 247, 0.10);
  border: 1px solid rgba(168, 85, 247, 0.25);
  border-radius: 10px;
  min-height: 84px;
}
.clickable { cursor: pointer; }
.clickable:hover { background: rgba(168, 85, 247, 0.18); }
.current { outline: 2px solid #ec4899; outline-offset: -2px; }

.previewBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.meta { display: flex; flex-direction: column; gap: 2px; }
.name {
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub { font-size: 11px; color: #b8aedc; }

.actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}
.iconBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: transparent;
  color: inherit;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.iconBtn:hover { background: rgba(168, 85, 247, 0.25); }

.editRow { display: flex; gap: 4px; align-items: center; }
.editInput {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  border: 1px solid rgba(168, 85, 247, 0.4);
  border-radius: 6px;
}
```

- [ ] **Step 21.3: tsc 통과 확인 + 커밋**

```bash
yarn tsc -b
git add src/ui/asset-library/AssetCard.tsx src/ui/asset-library/AssetCard.module.css
git commit -m "feat(asset-library): <AssetCard>"
```

---

### Task 22: 업로드 핸들러 + `<AssetUploadDropzone>`

**Files:**
- Create: `src/ui/asset-library/useAudioDecoder.ts` (`decodeAudioData` 어댑터)
- Create: `src/ui/asset-library/uploadAssets.ts` (벌크 업로드 파이프라인)
- Create: `src/ui/asset-library/AssetUploadDropzone.tsx`
- Create: `src/ui/asset-library/AssetUploadDropzone.module.css`

- [ ] **Step 22.1: `useAudioDecoder.ts` — decode 어댑터**

```ts
import type { DecodeFn } from "./validateUpload";
import { getAudioEngine } from "../../audio/AudioEngine";

/** 프로덕션용 decode 어댑터. AudioEngine의 AudioContext 재사용. */
export function makeDecoder(): DecodeFn {
  return async (buf) => {
    const ctx = getAudioEngine().context;
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    return { durationMs: Math.round(decoded.duration * 1000) };
  };
}
```

> `getAudioEngine`이 존재하지 않으면 기존 `AudioEngine` 인스턴스 접근 패턴을 확인해 어댑터를 맞춘다. 만약 `AudioContext` 인스턴스를 가져오는 헬퍼가 없으면 본 단계에서 추가(`src/audio/AudioEngine.ts`에 `get context(): AudioContext` getter 추가).

- [ ] **Step 22.2: `uploadAssets.ts` — 벌크 업로드 파이프라인**

```ts
import { validateUpload, type DecodeFn, type ValidateResult } from "./validateUpload";
import { normalizeAssetName, resolveNameCollision } from "../../domain/assetName";
import { putAsset, listAssetsByIds } from "../../persistence/assets";

export type UploadFailureReason = "not-audio" | "too-large" | "decode-failed" | "too-long";

export interface UploadFailure {
  fileName: string;
  reason: UploadFailureReason;
  detail?: string;
}

export interface UploadProgress {
  current: number;
  total: number;
}

export interface UploadOutcome {
  newAssetIds: string[];
  failures: UploadFailure[];
}

/**
 * 파일들을 검증 → IDB 저장 후 새 assetId 목록 반환.
 * 진행률 콜백은 매 파일 완료 직후 호출.
 */
export async function uploadAssets(
  files: File[],
  existingAssetIds: string[],
  decode: DecodeFn,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadOutcome> {
  const existing = await listAssetsByIds(existingAssetIds);
  const usedNames = new Set(existing.map((a) => a.name));

  const newAssetIds: string[] = [];
  const failures: UploadFailure[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const result = await validateUpload(f, decode);
    if (!result.ok) {
      failures.push({ fileName: f.name, reason: result.reason, detail: result.detail });
    } else {
      const base = normalizeAssetName(f.name);
      const name = resolveNameCollision(base, Array.from(usedNames));
      usedNames.add(name);
      const id = await putAsset(f, name);
      newAssetIds.push(id);
    }
    onProgress?.({ current: i + 1, total: files.length });
  }

  return { newAssetIds, failures };
}
```

- [ ] **Step 22.3: `uploadAssets` 테스트 추가**

`src/ui/asset-library/uploadAssets.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { uploadAssets } from "./uploadAssets";
import { resetDbCache } from "../../persistence/db";
import { listAssetsByIds } from "../../persistence/assets";
import type { DecodeFn } from "./validateUpload";

const okDecode: DecodeFn = async () => ({ durationMs: 1500 });

function f(name: string, bytes = 100, type = "audio/wav"): File {
  return new File([new Blob([new Uint8Array(bytes)], { type })], name, { type });
}

describe("uploadAssets", () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
    resetDbCache();
  });

  it("성공 파일만 newAssetIds에 들어가고 실패는 failures로", async () => {
    const files = [f("kick.wav"), f("img.png", 100, "image/png")];
    const out = await uploadAssets(files, [], okDecode);
    expect(out.newAssetIds.length).toBe(1);
    expect(out.failures.length).toBe(1);
    expect(out.failures[0].reason).toBe("not-audio");
  });

  it("동명 충돌 시 (2) 접미", async () => {
    const out = await uploadAssets([f("kick.wav"), f("kick.wav")], [], okDecode);
    const stored = await listAssetsByIds(out.newAssetIds);
    const names = stored.map((s) => s.name).sort();
    expect(names).toEqual(["kick", "kick (2)"]);
  });

  it("onProgress는 파일마다 current 증가", async () => {
    const seen: number[] = [];
    await uploadAssets([f("a.wav"), f("b.wav")], [], okDecode, (p) => seen.push(p.current));
    expect(seen).toEqual([1, 2]);
  });
});
```

- [ ] **Step 22.4: 그린 확인**

```bash
yarn vitest run src/ui/asset-library/uploadAssets.test.ts
```

- [ ] **Step 22.5: `AssetUploadDropzone.tsx`**

```tsx
import { useRef, useState, type DragEvent, type ChangeEvent, type ReactNode } from "react";
import { Plus } from "@phosphor-icons/react";
import { cx } from "../cx";
import styles from "./AssetUploadDropzone.module.css";

interface Props {
  onFiles(files: File[]): void;
  children: ReactNode;
}

export function AssetUploadDropzone({ onFiles, children }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = ""; // 같은 파일 재선택 가능
  }

  return (
    <div className={styles.zone} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={onChange}
      />
      <button
        type="button"
        className={styles.uploadBtn}
        onClick={() => inputRef.current?.click()}
      >
        <Plus size={14} weight="bold" /> 업로드
      </button>
      {children}
      {dragging && (
        <div className={cx(styles.dropOverlay)}>여기에 드롭하여 업로드</div>
      )}
    </div>
  );
}
```

- [ ] **Step 22.6: CSS**

`src/ui/asset-library/AssetUploadDropzone.module.css`:

```css
.zone { position: relative; }
.uploadBtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  background: linear-gradient(90deg, #a855f7, #ec4899);
  color: white;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}
.dropOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(168, 85, 247, 0.30);
  border: 2px dashed rgba(255, 255, 255, 0.5);
  border-radius: 12px;
  color: white;
  font-weight: 700;
  pointer-events: none;
}
```

- [ ] **Step 22.7: tsc + 커밋**

```bash
yarn tsc -b
git add src/ui/asset-library/useAudioDecoder.ts src/ui/asset-library/uploadAssets.ts src/ui/asset-library/uploadAssets.test.ts src/ui/asset-library/AssetUploadDropzone.tsx src/ui/asset-library/AssetUploadDropzone.module.css
git commit -m "feat(asset-library): upload pipeline + <AssetUploadDropzone>"
```

---

### Task 23: `<AssetLibraryModal>`

**Files:**
- Create: `src/ui/asset-library/AssetLibraryModal.tsx`
- Create: `src/ui/asset-library/AssetLibraryModal.module.css`
- Modify: `src/App.tsx` (Editor 라우트 또는 루트에 모달 한 번 마운트)

- [ ] **Step 23.1: 컴포넌트**

```tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { CaretRight, CaretDown } from "@phosphor-icons/react";
import { Modal } from "../primitives/Modal";
import { AssetCard, type AssetCardAsset } from "./AssetCard";
import { AssetUploadDropzone } from "./AssetUploadDropzone";
import { uploadAssets, type UploadFailure, type UploadFailureReason } from "./uploadAssets";
import { makeDecoder } from "./useAudioDecoder";
import { listAssetsByIds, deleteAsset, renameAsset, type } from "../../persistence/assets";
import { useStore } from "../../store/useStore";
import { useAssetLibrary } from "../../store/assetLibrary";
import { useLoadingOverlay } from "../../store/loadingOverlay";
import { BUILTIN_SAMPLES } from "../../audio/builtinSamples";
import { previewSound, stopPreview } from "./preview";
import { cx } from "../cx";
import styles from "./AssetLibraryModal.module.css";
import type { StoredAsset } from "../../persistence/db";
import type { SoundRef } from "../../types";

const BUILTINS_COLLAPSED_KEY = "assetLibrary.builtinsCollapsed";

function readBuiltinsCollapsed(): boolean {
  try { return localStorage.getItem(BUILTINS_COLLAPSED_KEY) !== "false"; } catch { return true; }
}
function writeBuiltinsCollapsed(v: boolean) {
  try { localStorage.setItem(BUILTINS_COLLAPSED_KEY, String(v)); } catch { /* ignore */ }
}

export function AssetLibraryModal() {
  const { open, mode, targetTrackId, close } = useAssetLibrary();
  const project = useStore((s) => s.project);
  const selectTrackSound = useStore((s) => s.selectTrackSound);
  const addAssetToLibrary = useStore((s) => s.addAssetToLibrary);
  const canDeleteAsset = useStore((s) => s.canDeleteAsset);
  const removeAssetFromLibrary = useStore((s) => s.removeAssetFromLibrary);

  const [uploads, setUploads] = useState<StoredAsset[]>([]);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [deleteWarn, setDeleteWarn] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(readBuiltinsCollapsed());

  const ids = useMemo(() => project?.libraryAssetIds ?? [], [project]);

  const refetch = useCallback(async () => {
    const xs = await listAssetsByIds(ids);
    xs.sort((a, b) => b.createdAt - a.createdAt);
    setUploads(xs);
  }, [ids]);

  useEffect(() => {
    if (open) refetch();
    else {
      stopPreview();
      setFailures([]);
      setDeleteWarn(null);
    }
  }, [open, refetch]);

  const currentSound: SoundRef | undefined = project?.tracks.find((t) => t.id === targetTrackId)?.sound;

  async function handleFiles(files: File[]) {
    setFailures([]);
    const { show, setProgress, hide } = useLoadingOverlay.getState();
    show({ mode: "determinate", label: "업로드 중..." });
    const { newAssetIds, failures: fs } = await uploadAssets(
      files,
      ids,
      makeDecoder(),
      ({ current, total }) => setProgress(current / total),
    );
    hide();
    for (const id of newAssetIds) addAssetToLibrary(id);
    setFailures(fs);
    await refetch();
  }

  function handleRename(assetId: string, newName: string) {
    renameAsset(assetId, newName).then(refetch);
  }

  function handleDelete(asset: StoredAsset) {
    const guard = canDeleteAsset(asset.id);
    if (!guard.ok) {
      setDeleteWarn(
        `${asset.name}은 트랙 ${guard.usedBy.map((t) => `'${t.name}'`).join(", ")}에서 사용 중입니다. 먼저 다른 사운드로 변경하세요.`,
      );
      return;
    }
    removeAssetFromLibrary(asset.id);
    deleteAsset(asset.id).then(refetch);
  }

  function handleSelect(sound: SoundRef) {
    if (mode !== "select" || !targetTrackId) return;
    selectTrackSound(targetTrackId, sound);
    close();
  }

  return (
    <Modal open={open} onOpenChange={(o) => (o ? null : close())} title="샘플 라이브러리" size="lg">
      <AssetUploadDropzone onFiles={handleFiles}>
        <Modal.Body>
          {failures.length > 0 && (
            <div className={styles.errorPanel}>
              <div className={styles.errorTitle}>⚠ {failures.length}개 파일을 추가하지 못했습니다.</div>
              <ul className={styles.errorList}>
                {failures.map((f, i) => (
                  <li key={i}>
                    <code>{f.fileName}</code> — {reasonText(f.reason, f.detail)}
                  </li>
                ))}
              </ul>
              <button className={styles.errorClose} onClick={() => setFailures([])}>닫기</button>
            </div>
          )}
          {deleteWarn && (
            <div className={styles.errorPanel}>
              <div>{deleteWarn}</div>
              <button className={styles.errorClose} onClick={() => setDeleteWarn(null)}>닫기</button>
            </div>
          )}

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <CaretDown size={12} weight="bold" />
              <span>내 에셋 ({uploads.length})</span>
            </header>
            {uploads.length === 0 ? (
              <div className={styles.emptyHint}>업로드된 에셋이 없습니다. 위 [업로드] 또는 파일을 끌어다 놓으세요.</div>
            ) : (
              <div className={styles.grid}>
                {uploads.map((a) => (
                  <AssetCard
                    key={a.id}
                    asset={{ kind: "upload", id: a.id, name: a.name, durationMs: 0, createdAt: a.createdAt }}
                    mode={mode}
                    isCurrent={mode === "select" && currentSound?.kind === "upload" && currentSound.assetId === a.id}
                    onSelect={() => handleSelect({ kind: "upload", assetId: a.id })}
                    onRename={(name) => handleRename(a.id, name)}
                    onDelete={() => handleDelete(a)}
                    onPreview={() => previewSound({ kind: "upload", assetId: a.id })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <button
              type="button"
              className={styles.sectionHeader}
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                writeBuiltinsCollapsed(next);
              }}
              aria-expanded={!collapsed}
            >
              {collapsed ? <CaretRight size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
              <span>빌트인 샘플 ({BUILTIN_SAMPLES.length})</span>
            </button>
            {!collapsed && (
              <div className={styles.grid}>
                {BUILTIN_SAMPLES.map((b) => (
                  <AssetCard
                    key={b.id}
                    asset={{ kind: "builtin", sampleId: b.id, label: b.label }}
                    mode={mode}
                    isCurrent={mode === "select" && currentSound?.kind === "builtin" && currentSound.sampleId === b.id}
                    onSelect={() => handleSelect({ kind: "builtin", sampleId: b.id })}
                    onPreview={() => previewSound({ kind: "builtin", sampleId: b.id })}
                  />
                ))}
              </div>
            )}
          </section>
        </Modal.Body>
      </AssetUploadDropzone>
      <Modal.Footer>
        <button type="button" className={styles.closeBtn} onClick={close}>닫기</button>
      </Modal.Footer>
    </Modal>
  );
}

function reasonText(reason: UploadFailureReason, detail?: string): string {
  switch (reason) {
    case "not-audio": return `음원 파일이 아닙니다${detail ? ` (${detail})` : ""}`;
    case "too-large": return `용량 초과${detail ? ` (${detail} > 5MB)` : ""}`;
    case "decode-failed": return `지원하지 않는 포맷 또는 손상됨${detail ? ` (${detail})` : ""}`;
    case "too-long": return `길이 초과${detail ? ` (${detail} > 5s)` : ""}`;
  }
}
```

> ⚠️ 위 코드에 `import { listAssetsByIds, deleteAsset, renameAsset, type } from "../../persistence/assets";` 에서 `type`은 빼고 정리. 정확한 import:
> ```ts
> import { listAssetsByIds, deleteAsset, renameAsset } from "../../persistence/assets";
> ```
> 그리고 `StoredAsset` 타입은 `import type { StoredAsset } from "../../persistence/db";` 사용.

- [ ] **Step 23.2: CSS**

`src/ui/asset-library/AssetLibraryModal.module.css`:

```css
.section { margin-top: 16px; }
.sectionHeader {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #d8cffc;
  background: transparent;
  border: 0;
  padding: 6px 0;
  cursor: pointer;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-top: 8px;
}
.emptyHint {
  font-size: 12px;
  color: #b8aedc;
  padding: 12px;
  border: 1px dashed rgba(168, 85, 247, 0.3);
  border-radius: 10px;
  margin-top: 8px;
}
.errorPanel {
  background: rgba(244, 63, 94, 0.15);
  border: 1px solid rgba(244, 63, 94, 0.5);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.errorTitle { font-weight: 700; margin-bottom: 4px; }
.errorList { padding-left: 16px; margin: 4px 0; font-size: 12px; }
.errorList code { font-family: ui-monospace, monospace; font-size: 11px; }
.errorClose {
  font-size: 11px;
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
.closeBtn {
  font-size: 13px;
  background: rgba(168, 85, 247, 0.2);
  color: inherit;
  border: 1px solid rgba(168, 85, 247, 0.5);
  border-radius: 8px;
  padding: 6px 14px;
  cursor: pointer;
}
```

- [ ] **Step 23.3: 미리듣기 헬퍼**

`src/ui/asset-library/preview.ts`:

```ts
import type { SoundRef } from "../../types";
import { getAudioEngine } from "../../audio/AudioEngine";
import { SampleLibrary } from "../../audio/SampleLibrary";

let preview: { source: AudioBufferSourceNode } | null = null;
let library: SampleLibrary | null = null;

function getLibrary(): SampleLibrary {
  const ctx = getAudioEngine().context;
  if (!library) library = new SampleLibrary(ctx);
  return library;
}

export async function previewSound(ref: SoundRef): Promise<void> {
  stopPreview();
  const ctx = getAudioEngine().context;
  const buf = await getLibrary().load(ref);
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.connect(getAudioEngine().master); // master gain 경유
  source.start();
  preview = { source };
  source.onended = () => { preview = null; };
}

export function stopPreview(): void {
  if (preview) {
    try { preview.source.stop(); } catch { /* already stopped */ }
    preview = null;
  }
}
```

> `getAudioEngine()`와 `.context`/`.master` API가 기존에 있는지 확인. 없으면 `AudioEngine.ts`에 getter 추가:
> ```ts
> get context(): AudioContext { return this._ctx; }
> get master(): GainNode { return this._master; }
> ```

- [ ] **Step 23.4: App 루트에 모달 한 번 마운트**

`src/App.tsx`에서:

```tsx
import { AssetLibraryModal } from "./ui/asset-library/AssetLibraryModal";

// 기존 트리 옆에
<AssetLibraryModal />
<LoadingOverlay />
```

- [ ] **Step 23.5: tsc + 커밋**

```bash
yarn tsc -b
yarn test:run
git add src/ui/asset-library/AssetLibraryModal.tsx src/ui/asset-library/AssetLibraryModal.module.css src/ui/asset-library/preview.ts src/App.tsx
git commit -m "feat(asset-library): <AssetLibraryModal> + preview channel"
```

---

### Task 24: `<TrackSoundSelect>` — Radix DropdownMenu

**Files:**
- Create: `src/ui/asset-library/TrackSoundSelect.tsx`
- Create: `src/ui/asset-library/TrackSoundSelect.module.css`

- [ ] **Step 24.1: 컴포넌트**

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, Lock } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cx } from "../cx";
import { BUILTIN_SAMPLES } from "../../audio/builtinSamples";
import { listAssetsByIds } from "../../persistence/assets";
import type { SoundRef } from "../../types";
import styles from "./TrackSoundSelect.module.css";

interface Props {
  trackId: string;
  sound: SoundRef;
  recentSounds: SoundRef[];
  onChange(next: SoundRef): void;
  onOpenLibrary(): void;
}

function builtinLabel(id: string): string {
  return BUILTIN_SAMPLES.find((b) => b.id === id)?.label ?? id;
}

export function TrackSoundSelect({ sound, recentSounds, onChange, onOpenLibrary }: Props) {
  // upload 항목의 표시 이름을 가져온다 (현재 드롭다운에 노출되는 upload ids만)
  const uploadIds = recentSounds.filter((s): s is Extract<SoundRef, { kind: "upload" }> => s.kind === "upload").map((s) => s.assetId);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (uploadIds.length === 0) { setNames({}); return; }
    listAssetsByIds(uploadIds).then((xs) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const a of xs) map[a.id] = a.name;
      setNames(map);
    });
    return () => { cancelled = true; };
  }, [uploadIds.join("|")]);

  function labelOf(s: SoundRef): { text: string; locked: boolean } {
    return s.kind === "builtin"
      ? { text: builtinLabel(s.sampleId), locked: true }
      : { text: names[s.assetId] ?? "...", locked: false };
  }

  const triggerLabel = labelOf(sound);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={styles.trigger} aria-label="사운드 선택" title={triggerLabel.text}>
        {triggerLabel.locked && <Lock size={11} weight="bold" />}
        <span className={styles.triggerLabel}>{triggerLabel.text}</span>
        <CaretDown size={11} weight="bold" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} sideOffset={4}>
          {recentSounds.map((s, i) => {
            const l = labelOf(s);
            const isCurrent = JSON.stringify(s) === JSON.stringify(sound);
            return (
              <DropdownMenu.Item
                key={i}
                className={cx(styles.item, isCurrent && styles.itemCurrent)}
                onSelect={() => onChange(s)}
                title={l.text}
              >
                {l.locked && <Lock size={11} weight="bold" />}
                <span className={styles.itemLabel}>{l.text}</span>
                {isCurrent && <span className={styles.currentMark}>●</span>}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className={styles.sep} />
          <DropdownMenu.Item className={cx(styles.item, styles.itemAction)} onSelect={onOpenLibrary}>
            전체 보기...
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

- [ ] **Step 24.2: CSS**

```css
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.3);
  color: inherit;
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 8px;
  cursor: pointer;
  max-width: 160px;
}
.triggerLabel {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.menu {
  min-width: 200px;
  background: #1a1230;
  color: #e8e2ff;
  border: 1px solid rgba(168, 85, 247, 0.35);
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  z-index: 50;
}
.item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.item[data-highlighted] { background: rgba(168, 85, 247, 0.25); outline: none; }
.itemLabel {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.itemCurrent { font-weight: 700; }
.currentMark { color: #ec4899; }
.itemAction { color: #d8cffc; }
.sep { height: 1px; background: rgba(168, 85, 247, 0.2); margin: 4px 0; }
```

- [ ] **Step 24.3: tsc + 커밋**

```bash
yarn tsc -b
git add src/ui/asset-library/TrackSoundSelect.tsx src/ui/asset-library/TrackSoundSelect.module.css
git commit -m "feat(asset-library): <TrackSoundSelect> (Radix DropdownMenu)"
```

---

### Task 25: `TrackEditor` 적용 — `<select>` → `<TrackSoundSelect>`

**Files:**
- Modify: `src/ui/TrackEditor.tsx`
- Modify: `src/ui/TrackEditor.module.css` (필요 시)

- [ ] **Step 25.1: 교체**

`src/ui/TrackEditor.tsx`에서 `<select>` 블록을 `<TrackSoundSelect>` 로 교체. `useAssetLibrary.openSelect`를 가져와 "전체 보기..." 핸들러에 연결.

```tsx
import { TrackSoundSelect } from "./asset-library/TrackSoundSelect";
import { useAssetLibrary } from "../store/assetLibrary";

// 기존 <select> 자리:
const openSelect = useAssetLibrary((s) => s.openSelect);
// ...
<TrackSoundSelect
  trackId={track.id}
  sound={track.sound}
  recentSounds={track.recentSounds}
  onChange={(next) => useStore.getState().selectTrackSound(track.id, next)}
  onOpenLibrary={() => openSelect(track.id)}
/>
```

기존 `BUILTIN_SAMPLES` import는 미사용이면 제거. `setTrackSound` 직접 호출 부분은 `selectTrackSound`로 교체(존재한다면).

- [ ] **Step 25.2: tsc + 회귀 테스트**

```bash
yarn tsc -b
yarn test:run
```

- [ ] **Step 25.3: 수동 시각 확인**

`yarn dev` — 트랙 행에서 새 드롭다운이 보이는지, "전체 보기..."가 모달을 여는지(아직 트리거 없이도 store 액션으로 동작) 확인.

- [ ] **Step 25.4: 커밋**

```bash
git add src/ui/TrackEditor.tsx src/ui/TrackEditor.module.css
git commit -m "feat(track): TrackEditor uses <TrackSoundSelect>"
```

---

### Task 26: `EditorToolbar` 라이브러리 트리거 버튼

**Files:**
- Modify: `src/ui/EditorToolbar.tsx`
- Modify: `src/ui/EditorToolbar.module.css` (필요 시)

- [ ] **Step 26.1: 버튼 추가**

```tsx
import { MusicNotes } from "@phosphor-icons/react";
import { useAssetLibrary } from "../store/assetLibrary";

// 기존 시퀀서 버튼 옆에:
const openManage = useAssetLibrary((s) => s.openManage);

<button
  type="button"
  className={cx(controls.btn, controls.btnGhost)}
  onClick={openManage}
  title="샘플 라이브러리 열기"
>
  <MusicNotes size={15} weight="bold" />라이브러리
</button>
```

- [ ] **Step 26.2: tsc + 수동 확인 + 커밋**

```bash
yarn tsc -b
git add src/ui/EditorToolbar.tsx src/ui/EditorToolbar.module.css
git commit -m "feat(toolbar): asset library trigger button"
```

---

### Task 27: ProjectList — 복사/예제 빌드에 `<LoadingOverlay>` 적용

**Files:**
- Modify: `src/ui/ProjectList.tsx`

- [ ] **Step 27.1: 복사 흐름**

`duplicateProject` 호출 주변을 try/finally로 감싸 오버레이 표시:

```tsx
import { useLoadingOverlay } from "../store/loadingOverlay";

// 복사 핸들러 안:
const { show, hide, setProgress } = useLoadingOverlay.getState();
show({ mode: "determinate", label: "복사 중..." });
try {
  // 진행률은 asset 개수 기반 — duplicateProject는 내부 진행률을 외부에 노출하지 않으므로
  // 단순화하여 indeterminate로 가도 OK. 본 task에선 determinate 0 → 1만 표시.
  setProgress(0.1);
  const copy = await duplicateProject(p);
  setProgress(1);
  // 이후 목록 갱신
} finally {
  hide();
}
```

> 더 정밀한 진행률이 필요하면 `duplicateProject(p, onProgress?)` 시그니처를 추가하고 step 단위로 콜백. 본 task에선 **단순 시작/끝** 표시만으로 충분(시간이 짧음). 향후 개선 여지로 남김.

- [ ] **Step 27.2: 예제 프로젝트 흐름**

`buildProjectFromBlueprint` 호출은 동기지만, 그 전후의 IDB put 호출 동안 indeterminate 표시:

```tsx
const { show, hide } = useLoadingOverlay.getState();
show({ mode: "indeterminate", label: "예제 프로젝트 준비 중..." });
try {
  const project = buildProjectFromBlueprint(/* ... */);
  // saveProject 등
} finally {
  hide();
}
```

- [ ] **Step 27.3: tsc + 수동 확인 + 커밋**

```bash
yarn tsc -b
git add src/ui/ProjectList.tsx
git commit -m "feat(project-list): <LoadingOverlay> on duplicate / example build"
```

---

## Phase D — 통합 검증

### Task 28: 회귀 + 빌드 + 시각 회귀 스냅 추가

**Files:**
- Modify: `scripts/visual-snap.mjs` (또는 동등 패턴)

- [ ] **Step 28.1: 전체 단위 테스트 그린 확인**

```bash
yarn test:run
```

새 테스트 + 기존 테스트 모두 통과해야 한다.

- [ ] **Step 28.2: 타입 체크 + 빌드**

```bash
yarn tsc -b
yarn build
```

- [ ] **Step 28.3: 시각 회귀 스냅 추가**

`scripts/visual-snap.mjs` 패턴을 따라 다음 케이스 추가:

1. 라이브러리 모달 — `mode="manage"` 빈 상태
2. 라이브러리 모달 — `mode="manage"` 업로드 N개
3. 라이브러리 모달 — `mode="select"` 현재 sound 강조
4. 빌트인 섹션 펼침 / 접힘
5. `<LoadingOverlay>` determinate 60% / indeterminate
6. `<TrackSoundSelect>` 펼침
7. 업로드 에러 인라인 패널

각 케이스마다 Playwright로 상태 설정 → 스냅. 기존 스냅 파이프라인을 따른다.

- [ ] **Step 28.4: 수동 검증 체크리스트**

다음을 `yarn dev`로 확인:

- [ ] `.wav` `.mp3` `.ogg` `.flac` `.m4a` 업로드 → decode 성공/실패 처리.
- [ ] 5MB 초과/5초 초과 파일 거부 메시지.
- [ ] 미리듣기 시 master gain 경유(마스터 볼륨 0 → 안 들림).
- [ ] 미리듣기 동시 1개(연속 클릭 시 이전 정지).
- [ ] 모달 열린 상태에서 트랙 키바인딩(S/D/F/J/K/L) 무시.
- [ ] 사용 중 에셋 삭제 시도 → 인라인 경고, 트랙명 노출.
- [ ] 이름 32자 초과 입력 시 컷.
- [ ] 동명 업로드 시 `(2)` 접미.
- [ ] 프로젝트 복사 후 — 사본의 트랙 sound·recentSounds upload assetId가 원본과 다른 새 id.
- [ ] 예제 프로젝트 빌드 후 — 각 트랙 `recentSounds.length === 6`, `libraryAssetIds === []`.
- [ ] 빌트인 섹션 접힘 상태가 localStorage에 기억되어 다음 모달 열기 시 유지.

- [ ] **Step 28.5: 커밋**

```bash
git add scripts/visual-snap.mjs
git commit -m "test(snap): asset library modal + dropdown + loading overlay cases"
```

- [ ] **Step 28.6: 푸시**

```bash
git push
```

---

## Phase E — 완료 처리

### Task 29: PR 생성 또는 main 병합 준비

- [ ] **Step 29.1: PR 본문 초안**

```
gh pr create -B main -H feat/asset-library-modal -t "feat: 트랙 에셋 라이브러리 모달 + UI primitives" -b "
Spec: docs/superpowers/specs/2026-05-29-asset-library-design.md
Plan: docs/superpowers/plans/2026-05-29-asset-library-modal.md

핵심:
- 프로젝트 스코프 에셋 라이브러리 (빌트인 6 + 업로드 N)
- 트랙 드롭다운 MRU 6슬롯 (recentSounds[0] === sound 불변량)
- Radix Dialog 기반 라이브러리 모달 + 그리드 카드
- @radix-ui/react-dialog / react-dropdown-menu 신규 도입
- <Modal>, <LoadingOverlay> primitive 시스템화
- 벌크 업로드, 검증 파이프라인(5초/5MB), 동명 충돌 (2) 접미
- 삭제는 사용 중 트랙 가드, 빌트인 fallback으로 슬롯 6개 유지
- 프로젝트 복제 idMap으로 중복 copyAsset 방지
- 예제 프로젝트 빌드 시 recentSounds 시드 + libraryAssetIds=[]
- 복사/예제/벌크 업로드에 <LoadingOverlay> 적용

검증:
- 단위 테스트 전체 통과 (회귀 없음)
- 타입 체크 / 빌드 통과
- Playwright 시각 회귀 케이스 추가
- 수동 검증: 디코드/미리듣기 채널/모바일 IDB
"
```

> 본 plan은 PR 생성/병합 자체는 사용자 결정에 맡긴다. 위 명령은 참고용. 사용자가 자동 PR을 원치 않으면 단순 푸시로 마무리.

---

## 자기 점검 메모

- 모든 task가 Spec 14장의 "작업 진입점 요약" 표 항목과 대응되는지 확인.
- `recentSounds[0] === sound` 불변량은 `selectTrackSound`·`duplicateProject`·`buildProjectFromBlueprint`·load normalize 네 곳에서 같은 헬퍼(`seedRecentSounds`/`pushRecent`/`fillWithBuiltins`)로 보장.
- 삭제 가드는 store 액션 내부에도 안전망(no-op), UI에선 명시적 경고를 띄움 — 이중 방어.
- 미리듣기는 라이브러리 모달 종속 라이프사이클(`open=false` 시 stop). 키바인딩 차단은 Radix Dialog의 focus trap에 의존.

