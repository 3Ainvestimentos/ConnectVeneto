import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";

export interface HolidayItem {
  dateISO: string;
  name: string;
  type: string;
}

export interface HolidaysQuery {
  year: number;
}

const holidayCache = new Map<string, HolidayItem[]>();

function toCacheKey(query: HolidaysQuery) {
  return String(query.year);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isHoliday(date: Date, holidays: HolidayItem[]) {
  const key = toDateKey(date);
  return holidays.some((holiday) => holiday.dateISO === key);
}

export function isBusinessDay(date: Date, holidays: HolidayItem[]) {
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return false;
  return !isHoliday(date, holidays);
}

export function calculateBusinessDays(startDate: Date, endDate: Date, holidays: HolidayItem[]) {
  if (endDate < startDate) return 0;
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  let total = 0;

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (isBusinessDay(d, holidays)) {
      total += 1;
    }
  }
  return total;
}

export async function fetchHolidays(query: HolidaysQuery): Promise<HolidayItem[]> {
  const key = toCacheKey(query);
  const cached = holidayCache.get(key);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams();
  params.set("year", String(query.year));

  const auth = getAuth(getFirebaseApp());
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error("Nao foi possivel validar autenticacao para consultar feriados.");
  }

  const response = await fetch(`/api/holidays?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar os feriados.");
  }

  const payload = (await response.json()) as { holidays?: HolidayItem[] };
  const holidays = payload.holidays ?? [];
  holidayCache.set(key, holidays);
  return holidays;
}
