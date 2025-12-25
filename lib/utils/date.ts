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
