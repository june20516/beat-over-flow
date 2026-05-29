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
  return name.slice(0, NAME_MAX_LENGTH - 8) + " (overflow)";
}
