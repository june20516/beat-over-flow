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

  console.log(`✔ snapshots written to ${outDir}`);
} finally {
  // Fix C: 예외 발생 시에도 Chrome 프로세스가 고아로 남지 않도록 보장
  await browser.close();
}
