import { useEffect, useState } from "react";
import { useSiteSettings, DEFAULT_HOURS, type WeekDay, type DayHours } from "@/lib/menu-data";

/**
 * Timezone canônico da loja. Todo o cálculo de horário é feito neste fuso,
 * independentemente do relógio/timezone do dispositivo do cliente.
 * Se um dia a loja mudar de fuso, alterar apenas esta constante (ou expor
 * via site_settings.timezone).
 */
export const STORE_TIMEZONE = "America/Sao_Paulo";

const DAY_ORDER: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LABEL_FULL: Record<WeekDay, string> = {
  mon: "segunda-feira",
  tue: "terça-feira",
  wed: "quarta-feira",
  thu: "quinta-feira",
  fri: "sexta-feira",
  sat: "sábado",
  sun: "domingo",
};

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function jsDay(idx: number): WeekDay {
  return DAY_ORDER[((idx % 7) + 7) % 7];
}

// -------------------------------------------------------------------
// Timezone helpers — Intl.DateTimeFormat é a única fonte da hora "de parede"
// -------------------------------------------------------------------

type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;
  weekday: number; // 0=Sun … 6=Sat (compatível com Date.getDay)
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const zonedFormatterCache = new Map<string, Intl.DateTimeFormat>();
function getZonedFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = zonedFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    zonedFormatterCache.set(tz, fmt);
  }
  return fmt;
}

function getZonedParts(date: Date, tz: string = STORE_TIMEZONE): ZonedParts {
  const parts = getZonedFormatter(tz).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const hour = Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: hour === 24 ? 0 : hour, // Safari podia devolver 24 em h23; normaliza
    minute: Number(map.minute),
    weekday: WEEKDAY_MAP[map.weekday] ?? 0,
  };
}

/**
 * Converte um "wall time" (Y/M/D HH:mm) do fuso da loja para o instante UTC
 * absoluto correspondente. Robusto a DST via dois passos de correção.
 */
function zonedWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string = STORE_TIMEZONE,
): Date {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute);
  const firstParts = getZonedParts(new Date(guessMs), tz);
  const firstZonedMs = Date.UTC(
    firstParts.year,
    firstParts.month - 1,
    firstParts.day,
    firstParts.hour,
    firstParts.minute,
  );
  const offset = guessMs - firstZonedMs;
  const correctedMs = guessMs + offset;
  // Segunda passada — cobre a transição de DST (que a maior parte do Brasil
  // não usa mais, mas mantemos a robustez para outros fusos configuráveis).
  const secondParts = getZonedParts(new Date(correctedMs), tz);
  const secondZonedMs = Date.UTC(
    secondParts.year,
    secondParts.month - 1,
    secondParts.day,
    secondParts.hour,
    secondParts.minute,
  );
  const drift = correctedMs - secondZonedMs;
  return new Date(correctedMs + drift - offset + offset); // == correctedMs + drift
}

/**
 * Retorna o `ZonedParts` do dia com `offset` dias após `now`, sempre calculado
 * no fuso da loja. Usa âncora ao meio-dia local para evitar drift em DST.
 */
function zonedDayAfter(now: Date, offset: number, tz: string = STORE_TIMEZONE): ZonedParts {
  const today = getZonedParts(now, tz);
  const anchor = zonedWallToUtc(today.year, today.month, today.day, 12, 0, tz);
  const shifted = new Date(anchor.getTime() + offset * 86_400_000);
  return getZonedParts(shifted, tz);
}

// -------------------------------------------------------------------
// Tipos e cálculo
// -------------------------------------------------------------------

export type StoreStatus = {
  isOpen: boolean;
  isClosed: boolean;
  override: "auto" | "open" | "closed";
  reason: "override-open" | "override-closed" | "auto-open" | "auto-closed" | "day-closed";
  todayHours: DayHours | undefined;
  todayLabel: string;
  minutesUntilClose: number | null;
  minutesUntilOpen: number | null;
  closingSoon: boolean;
  nextOpenAt: Date | null;
  nextOpenLabel: string | null;
  /** Timezone usado no cálculo — útil para debug/telemetria. */
  timezone: string;
};

function computeNextOpen(now: Date, hours: DayHours[], tz: string): Date | null {
  for (let offset = 0; offset < 8; offset++) {
    const parts = zonedDayAfter(now, offset, tz);
    const key = jsDay(parts.weekday);
    const day = hours.find((h) => h.day === key);
    if (!day || day.closed) continue;
    const openMins = toMins(day.open);
    const oh = Math.floor(openMins / 60);
    const om = openMins % 60;
    const candidate = zonedWallToUtc(parts.year, parts.month, parts.day, oh, om, tz);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}

export function computeStoreStatus(
  hours: DayHours[],
  override: "auto" | "open" | "closed",
  now: Date = new Date(),
  tz: string = STORE_TIMEZONE,
): StoreStatus {
  const zoned = getZonedParts(now, tz);
  const todayKey = jsDay(zoned.weekday);
  const todayHours = hours.find((h) => h.day === todayKey);
  const todayLabel = DAY_LABEL_FULL[todayKey];
  const curMins = zoned.hour * 60 + zoned.minute;

  let autoOpen = false;
  let minsToClose: number | null = null;

  const openAndInWindow = (d: DayHours, cur: number, addYesterday: boolean) => {
    const openM = toMins(d.open);
    let closeM = toMins(d.close);
    if (closeM <= openM) closeM += 24 * 60;
    let c = cur;
    if (addYesterday) c += 24 * 60;
    if (c >= openM && c < closeM) return closeM - c;
    return null;
  };

  if (todayHours && !todayHours.closed) {
    const remain = openAndInWindow(todayHours, curMins, false);
    if (remain !== null) {
      autoOpen = true;
      minsToClose = remain;
    }
  }
  if (!autoOpen) {
    // janela overnight iniciada ontem
    const yesterdayKey = jsDay(zoned.weekday + 6);
    const yesterdayHours = hours.find((h) => h.day === yesterdayKey);
    if (yesterdayHours && !yesterdayHours.closed) {
      const remain = openAndInWindow(yesterdayHours, curMins, true);
      if (remain !== null) {
        autoOpen = true;
        minsToClose = remain;
      }
    }
  }

  let isOpen: boolean;
  let reason: StoreStatus["reason"];
  if (override === "open") {
    isOpen = true;
    reason = "override-open";
  } else if (override === "closed") {
    isOpen = false;
    reason = "override-closed";
  } else {
    isOpen = autoOpen;
    if (autoOpen) reason = "auto-open";
    else if (!todayHours || todayHours.closed) reason = "day-closed";
    else reason = "auto-closed";
  }

  const nextOpenAt = isOpen ? null : computeNextOpen(now, hours, tz);
  const minsUntilOpen = nextOpenAt
    ? Math.max(0, Math.round((nextOpenAt.getTime() - now.getTime()) / 60000))
    : null;

  const nextOpenLabel = nextOpenAt ? formatNextOpen(now, nextOpenAt, tz) : null;

  return {
    isOpen,
    isClosed: !isOpen,
    override,
    reason,
    todayHours,
    todayLabel,
    minutesUntilClose: isOpen ? minsToClose : null,
    minutesUntilOpen: minsUntilOpen,
    closingSoon: isOpen && minsToClose !== null && minsToClose <= 30,
    nextOpenAt,
    nextOpenLabel,
    timezone: tz,
  };
}

function formatNextOpen(now: Date, next: Date, tz: string): string {
  const nowP = getZonedParts(now, tz);
  const nextP = getZonedParts(next, tz);
  const hh = String(nextP.hour).padStart(2, "0");
  const mm = String(nextP.minute).padStart(2, "0");
  const sameDay =
    nowP.year === nextP.year && nowP.month === nextP.month && nowP.day === nextP.day;
  const tomorrowP = zonedDayAfter(now, 1, tz);
  const isTomorrow =
    tomorrowP.year === nextP.year &&
    tomorrowP.month === nextP.month &&
    tomorrowP.day === nextP.day;
  if (sameDay) return `hoje às ${hh}:${mm}`;
  if (isTomorrow) return `amanhã às ${hh}:${mm}`;
  const key = jsDay(nextP.weekday);
  return `${DAY_LABEL_FULL[key]} às ${hh}:${mm}`;
}

export function useStoreStatus(): StoreStatus {
  const { data: settings } = useSiteSettings();
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const hours = settings?.hoursJson?.length ? settings.hoursJson : DEFAULT_HOURS;
  const override = settings?.openOverride ?? "auto";
  const tz = (settings as { timezone?: string } | undefined)?.timezone || STORE_TIMEZONE;
  return computeStoreStatus(hours, override, now, tz);
}

/**
 * Textos oficiais de status da loja — fonte única de verdade.
 * Não recriar variações fora deste módulo.
 */
export const STORE_COPY = {
  closedHeadline(status: Pick<StoreStatus, "reason">): string {
    return status.reason === "override-closed"
      ? "Estamos temporariamente fechados"
      : "Loja fechada no momento";
  },
  closedShort(status: Pick<StoreStatus, "nextOpenLabel">): string {
    return status.nextOpenLabel
      ? `Loja fechada. Reabrimos ${status.nextOpenLabel}.`
      : "Loja fechada no momento.";
  },
  closedButtonLabel(status: Pick<StoreStatus, "nextOpenLabel">): string {
    return status.nextOpenLabel
      ? `Fechado · reabrimos ${status.nextOpenLabel}`
      : "Loja fechada no momento";
  },
  nowPill(isOpen: boolean): string {
    return isOpen ? "Aberto agora" : "Fechado agora";
  },
  dayScheduleClosed: "Fechado hoje",
} as const;
