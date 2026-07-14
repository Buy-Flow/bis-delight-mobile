// Central timezone utility. All user-visible timestamps and "today" date
// resolutions for the store must use these helpers instead of raw Date
// methods, so behavior is identical on:
//   - Browsers outside Brazil
//   - Cloudflare Workers (server runs in UTC)
//   - Cron / scheduled jobs
//
// Never use `new Date().toISOString().slice(0, 10)` to derive "today":
// near midnight São Paulo (03:00 UTC) it silently returns tomorrow.
export const SP_TZ = "America/Sao_Paulo";

// Cache formatters (allocating Intl.DateTimeFormat is expensive).
const dateCache = new Map<string, Intl.DateTimeFormat>();
function getFmt(key: string, opts: Intl.DateTimeFormatOptions, locale = "pt-BR"): Intl.DateTimeFormat {
  let f = dateCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: SP_TZ });
    dateCache.set(key, f);
  }
  return f;
}

/** Returns YYYY-MM-DD for the given instant in São Paulo (default: now). */
export function todayInSP(date: Date = new Date()): string {
  // en-CA locale reliably produces "YYYY-MM-DD".
  const f = getFmt("iso-date", { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA");
  return f.format(date);
}

/** Full date+time in pt-BR for São Paulo (e.g. "14/07/2026 22:31"). */
export function formatSP(
  date: Date | string | number | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
): string {
  if (date == null) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const key = `pt-BR|${JSON.stringify(opts)}`;
  return getFmt(key, opts).format(d);
}

/** Date-only in pt-BR for São Paulo (e.g. "14/07/2026"). */
export function formatDateSP(
  date: Date | string | number | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
): string {
  return formatSP(date, opts);
}

/** Time-only HH:mm in São Paulo. */
export function formatTimeSP(date: Date | string | number | null | undefined): string {
  return formatSP(date, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Parse a `YYYY-MM-DD` string as noon São Paulo time, safe for display formatting.
 * Using noon avoids any DST edge from crossing a wall-clock day boundary.
 */
export function parseDateOnlySP(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00-03:00`);
}
