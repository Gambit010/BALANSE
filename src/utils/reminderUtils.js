// When the phone reminds a student about a task, worked out from the task's
// deadline. Kept free of Expo code so the times can be unit tested.

export const REMINDER_HOUR = 20; // 8:00 PM the evening before the deadline
export const OVERDUE_HOUR = 8; // 8:00 AM the day after, for date-only deadlines
export const SNOOZE_MINUTES = 60;

const isDateOnly = (deadline) => typeof deadline === 'string' && !deadline.includes('T');

// When the task is due. A date-only deadline ("2026-11-05") lasts until the
// end of that day; a timed one is due at its exact time.
export const getDueTime = (deadline) => {
  if (!deadline) return null;
  if (isDateOnly(deadline)) {
    const [y, m, d] = deadline.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  const due = new Date(deadline);
  return isNaN(due.getTime()) ? null : due;
};

// "Deadline approaching": 8:00 PM the evening before the due day
export const getReminderTime = (deadline) => {
  const due = getDueTime(deadline);
  if (!due) return null;
  const reminder = new Date(due);
  reminder.setDate(reminder.getDate() - 1);
  reminder.setHours(REMINDER_HOUR, 0, 0, 0);
  return reminder;
};

// "Task overdue": right at a timed deadline, or 8:00 AM the next morning for a
// date-only one (so nobody is woken at midnight)
export const getOverdueTime = (deadline) => {
  const due = getDueTime(deadline);
  if (!due) return null;
  if (!isDateOnly(deadline)) return due;
  const overdue = new Date(due);
  overdue.setDate(overdue.getDate() + 1);
  overdue.setHours(OVERDUE_HOUR, 0, 0, 0);
  return overdue;
};
