import { useEffect, useState } from "react";
import { useSiteSettings, DEFAULT_HOURS, type WeekDay, type DayHours } from "@/lib/menu-data";

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
};

function computeNextOpen(now: Date, hours: DayHours[]): Date | null {
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    const key = jsDay(d.getDay());
    const day = hours.find((h) => h.day === key);
    if (!day || day.closed) continue;
    const openMins = toMins(day.open);
    const candidate = new Date(d);
    candidate.setHours(0, 0, 0, 0);
    candidate.setMinutes(openMins);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}

export function computeStoreStatus(
  hours: DayHours[],
  override: "auto" | "open" | "closed",
  now: Date = new Date(),
): StoreStatus {
  const todayKey = jsDay(now.getDay());
  const todayHours = hours.find((h) => h.day === todayKey);
  const todayLabel = DAY_LABEL_FULL[todayKey];
  const curMins = now.getHours() * 60 + now.getMinutes();

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
    // check yesterday's overnight window
    const yesterdayKey = jsDay(now.getDay() + 6);
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

  const nextOpenAt = isOpen ? null : computeNextOpen(now, hours);
  const minsUntilOpen = nextOpenAt
    ? Math.max(0, Math.round((nextOpenAt.getTime() - now.getTime()) / 60000))
    : null;

  const nextOpenLabel = nextOpenAt ? formatNextOpen(now, nextOpenAt) : null;

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
  };
}

function formatNextOpen(now: Date, next: Date): string {
  const hh = String(next.getHours()).padStart(2, "0");
  const mm = String(next.getMinutes()).padStart(2, "0");
  const sameDay =
    now.getFullYear() === next.getFullYear() &&
    now.getMonth() === next.getMonth() &&
    now.getDate() === next.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    tomorrow.getFullYear() === next.getFullYear() &&
    tomorrow.getMonth() === next.getMonth() &&
    tomorrow.getDate() === next.getDate();
  if (sameDay) return `hoje às ${hh}:${mm}`;
  if (isTomorrow) return `amanhã às ${hh}:${mm}`;
  const key = jsDay(next.getDay());
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
  return computeStoreStatus(hours, override, now);
}
