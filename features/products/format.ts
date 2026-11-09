/**
 * 화면 표시용 형식 함수 (서버·브라우저 공용)
 * 시간대를 Asia/Seoul로 고정해 서버와 브라우저의 결과가 같도록 합니다.
 */

const wonFormatter = new Intl.NumberFormat("ko-KR");

/** 12000 → "12,000원" */
export function formatWon(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${wonFormatter.format(value)}원`;
}

/** 1234 → "1,234" */
export function formatCount(value: number) {
  return wonFormatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "2026-11-09T01:00:00Z" → "2026. 11. 09." (화면 표시 전용, 비교용으로 쓰지 않음) */
export function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return dateTimeFormatter.format(new Date(iso));
}

/** 마진율(%) = (판매가 - 원가) / 판매가. 계산할 수 없으면 null */
export function marginRate(price: number | null, cost: number | null) {
  if (price === null || cost === null || price <= 0) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}
