/** 유튜브 영상 ID는 11자의 [A-Za-z0-9_-]. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** URL 또는 순수 ID에서 11자 영상 ID를 추출한다. 실패 시 null. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (ID_RE.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/embed/")) {
      candidate = url.pathname.slice("/embed/".length).split("/")[0] ?? null;
    }
  }

  return candidate && ID_RE.test(candidate) ? candidate : null;
}
