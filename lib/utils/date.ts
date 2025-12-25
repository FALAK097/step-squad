export type DateRange = {
  start: string;
  end: string;
};

/**
 * Returns ISO8601 timestamps for the current day's start (midnight) and now.
 * Uses UTC format which Health Connect expects.
 */
export function getTodayRange(): DateRange {
  const now = new Date();

  // Create start of day in local time (midnight)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Health Connect SDK can be sensitive to fractional seconds on some devices.
  // We truncate to whole seconds to be safe.
  const startTime = Math.floor(startOfDay.getTime() / 1000) * 1000;
  let endTime = Math.floor(now.getTime() / 1000) * 1000;

  // Health Connect SDK strictly requires startTime < endTime.
  // We ensure end is at least 1 second after start.
  if (endTime <= startTime) {
    endTime = startTime + 1000;
  }

  return {
    start: new Date(startTime).toISOString(),
    end: new Date(endTime).toISOString(),
  };
}

export function getLastNDaysRange(n: number): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1), 0, 0, 0, 0);
  const startTime = Math.floor(start.getTime() / 1000) * 1000;
  const endTime = Math.floor(now.getTime() / 1000) * 1000;
  return {
    start: new Date(startTime).toISOString(),
    end: new Date(endTime).toISOString(),
  };
}

/**
 * Returns the start of the week (Sunday) for a given date.
 */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

/**
 * Returns the end of the week (Saturday) for a given date.
 */
export function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  return new Date(start.setDate(start.getDate() + 6));
}

/**
 * Returns a range for a specific week based on an offset from the current week.
 * offset 0 = current week, -1 = last week, etc.
 */
export function getWeekRange(offset: number = 0): DateRange {
  const now = new Date();
  const targetDate = new Date(now.setDate(now.getDate() + offset * 7));

  const start = getStartOfWeek(targetDate);
  start.setHours(0, 0, 0, 0);

  const end = getEndOfWeek(targetDate);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Returns the current date in YYYY-MM-DD format based on LOCAL time.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes an ISO string or Date to a local date string (YYYY-MM-DD).
 */
export function toDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return getLocalDateString(d);
}

/**
 * Formats a timestamp into a short, locale-aware time string suitable for UI.
 */
export function formatTime(time: Date | string | null | undefined): string {
  if (!time) return '';
  const date = typeof time === 'string' ? new Date(time) : time;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

/**
 * Formats a date for display.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}
