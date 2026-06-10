/**
 * Today's date as YYYY-MM-DD in the browser's LOCAL timezone.
 *
 * Note: `new Date().toISOString().slice(0, 10)` returns the UTC date, which is
 * one day ahead for US users in the evening. Building the string from local
 * date parts avoids that off-by-one.
 */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
