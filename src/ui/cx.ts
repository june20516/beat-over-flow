/** falsy 값을 걸러 공백으로 결합하는 className 헬퍼. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
