// Date helpers for repeating class schedules. Kept free of Firebase and
// React so the screen and the save function share one rule, and so it can
// be unit-tested.

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Longest a class can repeat after its start date (about one semester).
// Keeps the number of sessions, and the Firestore reads that come with them, reasonable.
export const MAX_SCHEDULE_MONTHS = 6;

// ['Monday', 'Wednesday'] -> [1, 3], matching Date.getDay()
export const toWeekdayNumbers = (names = []) =>
  names.map((name) => WEEKDAY_NAMES.indexOf(name)).filter((n) => n >= 0);

export const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// A date `value` weeks or months after `from`.
export const addDuration = (from, value, unit) => {
  const d = new Date(from);
  if (unit === 'weeks') d.setDate(d.getDate() + value * 7);
  else d.setMonth(d.getMonth() + value);
  return d;
};

// The latest end date allowed for a schedule that starts on startDate.
export const getMaxEndDate = (startDate) =>
  addDuration(startOfDay(startDate), MAX_SCHEDULE_MONTHS, 'months');

// Every date from startDate to endDate (both included) that falls on one of
// the given weekdays, each at midnight local time.
export const getSessionDates = (startDate, endDate, weekdays) => {
  if (!startDate || !endDate || !weekdays || weekdays.length === 0) return [];
  const days = new Set(weekdays);
  const cursor = startOfDay(startDate);
  const last = startOfDay(endDate);
  const dates = [];
  while (cursor <= last) {
    if (days.has(cursor.getDay())) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};