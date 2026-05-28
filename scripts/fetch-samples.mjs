// 내장 드럼 원샷을 TR-808(Fischer) CC0 샘플로 받아온다.
// 출처: https://github.com/tidalcycles/sounds-tr808-fischer (CC0 1.0 Universal)
// 재현성을 위해 특정 커밋에 고정한다. 변형 버전을 쓰려면 MAPPING의 경로만 바꾸고 재실행한다.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = "tidalcycles/sounds-tr808-fischer";
const COMMIT = "85fbecf1bec32553395625ea659e2a56dfd7c0e1";

// 내장 샘플 ID → Fischer 저장소 내 경로
const MAPPING = {
  kick: "bd8/BD5000.WAV",
  snare: "sd8/SD5050.WAV",
  hat: "ch8/CH.WAV",
  clap: "cp8/CP.WAV",
  tom: "mt8/MT50.WAV",
  perc: "cb8/CB.WAV",
};

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples");
mkdirSync(OUT, { recursive: true });

function rawUrl(path) {
  return `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${path}`;
}

async function fetchSample(id, path) {
  const url = rawUrl(path);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${id}: ${url} → HTTP ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const dest = join(OUT, `${id}.wav`);
  writeFileSync(dest, bytes);
  console.log(`✓ ${id}.wav  ← ${path}  (${bytes.length.toLocaleString()} bytes)`);
}

async function main() {
  console.log(`TR-808(Fischer) 샘플 다운로드 — commit ${COMMIT.slice(0, 7)}`);
  for (const [id, path] of Object.entries(MAPPING)) {
    await fetchSample(id, path);
  }
  console.log("완료. 라이선스: CC0 1.0 Universal (public/samples/licenses.md 참고)");
}

main().catch((err) => {
  console.error("실패:", err.message);
  process.exit(1);
});
