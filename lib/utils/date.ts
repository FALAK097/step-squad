export type DateRange = {
  start: string;
  end: string;
};

/**
 * Returns ISO8601 timestamps for the current day's start (midnight) and now.
 */
export function getTodayRange(): DateRange {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

/**
 * Formats a timestamp into a short, locale-aware time string suitable for UI.
 */
export function formatTime(time: Date | string | null | undefined): string {
  if (!time) return '';
  const date = typeof time === 'string' ? new Date(time) : time;
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    // Fallback for environments without Intl
    return date.toLocaleTimeString();
  }
}
