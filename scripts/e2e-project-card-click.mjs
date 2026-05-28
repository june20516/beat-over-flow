// 사용법: node scripts/e2e-project-card-click.mjs
// 프로젝트 카드 클릭 영역 회귀 방지를 위한 헤드리스 e2e 검증.
// - 카드 본체(타이틀/푸터/패딩) 클릭 → 프로젝트 열림
// - 카드 내부 액션 버튼(복사·삭제·이름 수정) 클릭 → 카드 열림이 트리거되지 않고 각자 동작
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = Number(process.env.E2E_PORT ?? 5181);
const BASE = `http://localhost:${PORT}`;
const HEADLESS = process.env.E2E_HEADED !== "1";

const dev = spawn("yarn", ["vite", "--port", String(PORT), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("dev server start timeout")), 30000);
  const onData = (chunk) => {
    const s = chunk.toString();
    if (s.includes("Local:") || s.includes("ready in")) {
      clearTimeout(timer);
      resolve();
    }
  };
  dev.stdout.on("data", onData);
  dev.stderr.on("data", onData);
});

let exitCode = 0;
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: HEADLESS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const log = (msg) => console.log(`  ${msg}`);
  const assertNav = async (label) => {
    await page.waitForURL(/\/edit\/[^/]+$/, { timeout: 3000 });
    log(`✅ ${label}`);
  };
  const assertNoNav = async (label, before) => {
    await page.waitForTimeout(300);
    if (page.url() !== before) throw new Error(`${label} — URL changed: ${before} → ${page.url()}`);
    log(`✅ ${label}`);
  };
  const goList = async () => {
    await page.goto(`${BASE}/edit`, { waitUntil: "networkidle" });
  };
  const createExample = async () => {
    await page.getByRole("button", { name: /예제 프로젝트/ }).click();
    await page.waitForURL(/\/edit\/[^/]+$/);
  };

  console.log("→ 초기 진입 & 예제 프로젝트 생성");
  await goList();
  await createExample();

  console.log("\n→ Test 1: 카드 타이틀 클릭");
  await goList();
  await page.locator("li[role='button']").first().getByText(/.*/, { exact: false }).first();
  await page.locator("li[role='button']").first().locator("span").first().click();
  await assertNav("타이틀 영역 클릭 → 프로젝트 열림");

  console.log("\n→ Test 2: 카드 푸터(트랙 카운트) 클릭");
  await goList();
  await page.getByText(/\d+개 트랙/).first().click();
  await assertNav("푸터 클릭 → 프로젝트 열림");

  console.log("\n→ Test 3: 카드 패딩(빈 영역) 클릭");
  await goList();
  const card = page.locator("li[role='button']").first();
  const box = await card.boundingBox();
  if (!box) throw new Error("card bounding box not found");
  // 우측 상단 패딩 영역(타이틀 텍스트·아이콘 버튼과 떨어진 곳)
  await card.click({ position: { x: box.width - 6, y: 6 } });
  await assertNav("패딩 클릭 → 프로젝트 열림");

  console.log("\n→ Test 4: 삭제 버튼은 카드 열기를 트리거하지 않음");
  await goList();
  const beforeDelete = page.url();
  await page.getByRole("button", { name: /^삭제$/ }).click();
  await assertNoNav("삭제 → URL 변동 없음", beforeDelete);
  await page.waitForFunction(() => document.querySelectorAll("li[role='button']").length === 0);
  log("✅ 삭제 → 카드 0개로 줄어듦");

  console.log("\n→ Test 5: 복사 버튼은 카드 열기를 트리거하지 않음");
  await createExample();
  await goList();
  const beforeCopy = page.url();
  await page.getByTitle("복사").first().click();
  await assertNoNav("복사 → URL 변동 없음", beforeCopy);
  await page.waitForFunction(() => document.querySelectorAll("li[role='button']").length === 2);
  log("✅ 복사 → 카드 2개로 증가");

  console.log("\n→ Test 6: 이름 수정 버튼은 카드 열기를 트리거하지 않고 입력 모드 진입");
  const beforeRename = page.url();
  await page.getByTitle("이름 수정").first().click();
  await assertNoNav("이름 수정 클릭 → URL 변동 없음", beforeRename);
  const renameInput = page.locator("li input").first();
  await renameInput.waitFor({ state: "visible", timeout: 1000 });
  log("✅ 이름 수정 → 입력창 표시");

  console.log("\n→ Test 7: 이름 수정 입력창 클릭은 카드 열기를 트리거하지 않음");
  const beforeInputClick = page.url();
  await renameInput.click();
  await assertNoNav("입력창 클릭 → URL 변동 없음", beforeInputClick);

  console.log("\n→ Test 8: 키보드(Enter)로 카드 열기");
  // 입력 모드 종료(Escape)
  await renameInput.press("Escape");
  await page.waitForSelector("li[role='button']");
  await goList();
  await page.locator("li[role='button']").first().focus();
  await page.keyboard.press("Enter");
  await assertNav("focus + Enter → 프로젝트 열림");

  console.log("\n✨ 모든 테스트 통과");
} catch (err) {
  console.error("\n❌ 테스트 실패:", err.message);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  dev.kill("SIGTERM");
}

process.exit(exitCode);
