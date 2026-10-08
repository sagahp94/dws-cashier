/**
 * Pure timezone-safe date utilities for DWS Scheduling.
 * Avoids any timezone shift bugs caused by `new Date("YYYY-MM-DD")` in UTC/local conversions.
 */

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Parse 'YYYY-MM-DD' safely into year, month, day numbers
 */
export function parseDateParts(dateStr: string): DateParts {
  if (!dateStr) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/**
 * Format year, month, day into 'YYYY-MM-DD'
 */
export function formatToYMD(year: number, month: number, day: number): string {
  const y = year.toString().padStart(4, '0');
  const m = month.toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Create a local Date object set at 12:00:00 PM (Noon)
 * Setting time to Noon guarantees that daylight saving time or timezone offsets
 * will never shift the day forwards or backwards!
 */
export function parseYMDToLocalDate(dateStr: string): Date {
  const { year, month, day } = parseDateParts(dateStr);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Format a Date object to 'YYYY-MM-DD' based on local year, month, date
 */
export function formatDateToYMD(d: Date): string {
  return formatToYMD(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Add or subtract days to a 'YYYY-MM-DD' string safely
 */
export function addDaysToDateStr(dateStr: string, daysToAdd: number): string {
  const d = parseYMDToLocalDate(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  return formatDateToYMD(d);
}

/**
 * Get Day of Week Index: 1 for Monday, 2 for Tuesday, ..., 6 for Saturday, 7 for Sunday
 */
export function getDayOfWeekIndex(dateStr: string): number {
  const d = parseYMDToLocalDate(dateStr);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  return day === 0 ? 7 : day;
}

/**
 * Get Vietnamese Day Name (e.g. 'Thứ 2', 'Thứ 3', ..., 'Chủ Nhật')
 */
export function getDayNameVietnamese(dateStr: string): string {
  const idx = getDayOfWeekIndex(dateStr);
  const names: Record<number, string> = {
    1: 'Thứ 2',
    2: 'Thứ 3',
    3: 'Thứ 4',
    4: 'Thứ 5',
    5: 'Thứ 6',
    6: 'Thứ 7',
    7: 'Chủ Nhật',
  };
  return names[idx] || 'Thứ 2';
}

/**
 * Format 'YYYY-MM-DD' to 'DD/MM/YYYY'
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const { year, month, day } = parseDateParts(dateStr);
  const dd = day.toString().padStart(2, '0');
  const mm = month.toString().padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

/**
 * Format 'YYYY-MM-DD' to 'DD/MM'
 */
export function formatDisplayDayMonth(dateStr: string): string {
  if (!dateStr) return '';
  const { month, day } = parseDateParts(dateStr);
  const dd = day.toString().padStart(2, '0');
  const mm = month.toString().padStart(2, '0');
  return `${dd}/${mm}`;
}

/**
 * Given any date string or Date object, return the Monday of that week in 'YYYY-MM-DD'
 */
export function getMondayOfWeek(input: string | Date): string {
  let d: Date;
  if (typeof input === 'string') {
    d = parseYMDToLocalDate(input);
  } else {
    d = new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12, 0, 0, 0);
  }

  const day = d.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days. If Monday, 0. If Tuesday, -1...
  d.setDate(d.getDate() + diff);
  return formatDateToYMD(d);
}

/**
 * Get all 7 days for a week starting from Monday (YYYY-MM-DD)
 */
export function getDaysInWeek(mondayStr: string): Array<{
  dateStr: string;
  dayIndex: number; // 1 -> 7
  dayName: string; // 'Thứ 2' -> 'Chủ Nhật'
  dayFormatted: string; // 'DD/MM'
}> {
  const result = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysToDateStr(mondayStr, i);
    const dayIndex = i + 1;
    const dayName = getDayNameVietnamese(dateStr);
    const dayFormatted = formatDisplayDayMonth(dateStr);
    result.push({ dateStr, dayIndex, dayName, dayFormatted });
  }
  return result;
}
