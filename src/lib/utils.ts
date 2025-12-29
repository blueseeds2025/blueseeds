import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ============================================================================
// Date Utilities (KST 기준)
// ============================================================================

/**
 * 로컬 시간 기준 날짜 문자열 반환 (YYYY-MM-DD)
 * UTC가 아닌 사용자 로컬 타임존 기준
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getTodayString(): string {
  return getLocalDateString(new Date());
}

/**
 * 이번 주 시작일 (일요일 또는 월요일 기준)
 */
export function getWeekStartString(date: Date = new Date(), startOnMonday = true): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = startOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  d.setDate(d.getDate() + diff);
  return getLocalDateString(d);
}

/**
 * n일 전 날짜 문자열
 */
export function getDaysAgoString(days: number, date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return getLocalDateString(d);
}

/**
 * 이번 달 1일 날짜 문자열
 */
export function getMonthStartString(date: Date = new Date()): string {
  return getLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
}

/**
 * 날짜 포맷 (M/D (요일))
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[date.getDay()];
  return `${month}/${day} (${dayOfWeek})`;
}
