// YYYY-MM-DD in the phone's own timezone. toISOString() converts to UTC first,
// which in the Philippines (UTC+8) turns any time before 8:00 AM into the
// previous day.
export const toLocalDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};