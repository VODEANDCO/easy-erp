/** 조건부 className 을 공백으로 이어 붙입니다. (false, null, undefined 는 무시) */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
