export const NAME_MAX_LENGTH = 32;

/**
 * 확장자 제거 + trim + 길이 컷. 입력은 파일명 또는 사용자 입력 문자열.
 *
 * 의도적 동작:
 * - `lastDot > 0`이므로 선행 점만 있는 이름(".hidden", ".wav")은 확장자로 보지 않고 그대로 둔다.
 *   (Unix 숨김 파일 관례 + "확장자만 있는 입력은 무의미"라는 사용자 인식의 절충.)
 */
export function normalizeAssetName(raw: string): string {
  const trimmed = raw.trim();
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  return base.slice(0, NAME_MAX_LENGTH);
}

/**
 * 기존 이름들과 충돌 시 " (n)" 접미. 접미 추가로 길이 초과하면 base를 잘라낸다.
 * 1000회 충돌은 사실상 불가능 — 만약 발생한다면 호출 측 버그(무한 루프 가능성 등)이므로 던진다.
 */
export function resolveNameCollision(name: string, existing: string[]): string {
  const set = new Set(existing);
  if (!set.has(name)) return name;
  for (let n = 2; n < 1000; n++) {
    const suffix = ` (${n})`;
    const head = name.slice(0, Math.max(0, NAME_MAX_LENGTH - suffix.length));
    const candidate = head + suffix;
    if (!set.has(candidate)) return candidate;
  }
  throw new Error(`resolveNameCollision: 1000회 이상 충돌 — 호출 측 버그 가능성 (name="${name}")`);
}
