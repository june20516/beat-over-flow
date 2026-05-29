// 사용법: node scripts/visual-snap.mjs <outDir>
// dev 서버(http://localhost:5173)가 떠 있어야 한다.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { request } from "node:http";

const outDir = process.argv[2] ?? "snapshots/baseline";
const BASE = process.env.SNAP_BASE ?? "http://localhost:5173";
const VIEWPORT = { width: 1440, height: 900 };

// Fix A: dev 서버 preflight — 미기동 시 친절한 에러로 즉시 종료
async function preflight(url) {
  await new Promise((resolve, reject) => {
    const req = request(url, (res) => {
      res.resume();
      resolve();
    });
    req.on("error", () =>
      reject(new Error(`Dev server not reachable at ${url}. Run 'yarn dev' first.`)),
    );
    req.end();
  });
}

await preflight(BASE);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: VIEWPORT });

  async function snap(name) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400); // 폰트/애니메이션 안정화
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
  }

  async function goto(path) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  }

  // 1) 정적 라우트
  await goto("/");            await snap("01-home");
  await goto("/play");        await snap("02-play");
  await goto("/nope");        await snap("03-notfound");
  await goto("/edit");        await snap("04-projectlist");

  // 5) 예제 프로젝트로 에디터 진입 (랜딩의 "예제" CTA 클릭)
  await goto("/edit");
  await page.getByRole("button", { name: /예제/ }).first().click();
  await page.waitForURL(/\/edit\/.+/, { timeout: 15000 });
  await snap("05-editor");

  // 6) 상호작용 상태: 첫 트랙 행 포커스 확장
  // Fix B: 트랙 행이 렌더될 때까지 명시적 대기(에디터 로딩 지연 대비)
  const trackRow = page.locator(".track-row, [class*='trackRow']").first();
  await trackRow.waitFor({ timeout: 10000 });
  await trackRow.click();
  await snap("06-track-focused");

  // 7) 샘플 라이브러리 모달 (manage 모드, 빈 상태)
  // 에디터에서 toolbar의 [라이브러리] 버튼을 클릭하면 manage 모드로 열린다.
  // 빌트인 섹션은 기본 접힌 상태로 표시된다.
  await page.getByRole("button", { name: /라이브러리/ }).click();
  await page.getByRole("dialog", { name: /샘플 라이브러리/ }).waitFor({ timeout: 5000 });
  await snap("07-library-modal-manage-empty");

  // 8) 빌트인 섹션 펼침
  await page.getByRole("button", { name: /빌트인 샘플/ }).click();
  await page.waitForTimeout(120); // 펼침 애니메이션
  await snap("08-library-modal-builtins-expanded");

  // 모달 닫기
  await page.getByRole("button", { name: /닫기/ }).last().click();
  await page.waitForTimeout(120);

  // 9) TrackSoundSelect 드롭다운 펼침
  // 첫 트랙 행의 사운드 선택 트리거(aria-label에 '사운드 선택' 포함)를 클릭.
  // TrackSoundSelect의 aria-label은 "사운드 선택: {currentLabel}" 형태다(Task 24 fixup).
  await page.getByRole("button", { name: /사운드 선택/ }).first().click();
  await page.waitForTimeout(120);
  await snap("09-tracksoundselect-open");

  console.log(`✔ snapshots written to ${outDir}`);
} finally {
  // Fix C: 예외 발생 시에도 Chrome 프로세스가 고아로 남지 않도록 보장
  await browser.close();
}
