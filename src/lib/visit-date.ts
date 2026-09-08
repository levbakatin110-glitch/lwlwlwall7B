const YMD = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const RU = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const HM = /^(\d{1,2}):(\d{2})$/;

function localMs(y: number, m: number, d: number, hh: number, mm: number): number | null {
  if (y < 2000 || y > 2100) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }
  return dt.getTime();
}

/** Дата YYYY-MM-DD или ДД.ММ.ГГГГ, время ЧЧ:ММ необязательно. */
export function parseVisitDateTime(
  dateStr: string,
  timeStr = "",
): { ms: number | null; hasTime: boolean; invalid: boolean } {
  const raw = dateStr.trim();
  if (!raw) return { ms: null, hasTime: false, invalid: false };
  let y: number;
  let m: number;
  let d: number;
  const iso = YMD.exec(raw);
  const ru = RU.exec(raw);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (ru) {
    d = Number(ru[1]);
    m = Number(ru[2]);
    y = Number(ru[3]);
  } else {
    return { ms: null, hasTime: false, invalid: true };
  }
  const tm = HM.exec(timeStr.trim());
  const hasTime = Boolean(tm);
  const hh = tm ? Number(tm[1]) : 0;
  const mm = tm ? Number(tm[2]) : 0;
  if (timeStr.trim() && !tm) {
    return { ms: null, hasTime: false, invalid: true };
  }
  const ms = localMs(y, m, d, hh, mm);
  if (ms == null) return { ms: null, hasTime: false, invalid: true };
  return { ms, hasTime, invalid: false };
}

export function formatVisitWhen(ms: number, withTime: boolean): string {
  const d = new Date(ms);
  const date = d
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
    .replace(/\./g, "");
  if (!withTime) return date;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}
