import { getDueTime, getReminderTime, getOverdueTime } from '../../src/utils/reminderUtils';

// Expected times are built with local dates, so the tests pass in any time zone.
describe('TC-U08: Deadline and Overdue Reminders', () => {
  test('TC-U08-01: A date-only deadline is due at the end of that day', () => {
    expect(getDueTime('2026-11-05')).toEqual(new Date(2026, 10, 5, 23, 59, 59, 999));
  });

  test('TC-U08-02: A timed deadline is due at its exact time', () => {
    const deadline = new Date(2026, 10, 5, 14, 30).toISOString();
    expect(getDueTime(deadline)).toEqual(new Date(2026, 10, 5, 14, 30));
  });

  test('TC-U08-03: The reminder is at 8:00 PM the evening before', () => {
    expect(getReminderTime('2026-11-05')).toEqual(new Date(2026, 10, 4, 20, 0));
    const timed = new Date(2026, 10, 5, 14, 30).toISOString();
    expect(getReminderTime(timed)).toEqual(new Date(2026, 10, 4, 20, 0));
  });

  test('TC-U08-04: A timed task is overdue right at its deadline', () => {
    const deadline = new Date(2026, 10, 5, 14, 30).toISOString();
    expect(getOverdueTime(deadline)).toEqual(new Date(2026, 10, 5, 14, 30));
  });

  test('TC-U08-05: A date-only task gets its overdue reminder at 8:00 AM the next day', () => {
    expect(getOverdueTime('2026-11-05')).toEqual(new Date(2026, 10, 6, 8, 0));
  });

  test('TC-U08-06: The overdue reminder for the last day of a month falls on the 1st', () => {
    expect(getOverdueTime('2026-11-30')).toEqual(new Date(2026, 11, 1, 8, 0));
  });

  test('TC-U08-07: A missing or invalid deadline gives no reminder', () => {
    expect(getDueTime(null)).toBeNull();
    expect(getReminderTime('not-a-date')).toBeNull();
    expect(getOverdueTime('')).toBeNull();
  });
});
