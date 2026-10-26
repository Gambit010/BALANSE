import {
  WEEKDAY_NAMES,
  MAX_SCHEDULE_MONTHS,
  toWeekdayNumbers,
  addDuration,
  getMaxEndDate,
  getSessionDates,
} from '../../src/utils/scheduleUtils';

// Local dates, so the tests mean the same thing in any time zone
const day = (y, m, d) => new Date(y, m - 1, d);
const keys = (dates) => dates.map((d) => `${d.getMonth() + 1}/${d.getDate()}`);

// Oct 2026: Thu 1, Mon 5, Wed 7, Mon 12, Wed 14, Mon 19, Wed 21 ...
const MON = 1;
const WED = 3;

describe('TC-U05: Class Schedule Dates', () => {
  test('TC-U05-01: Day names should convert to weekday numbers', () => {
    expect(toWeekdayNumbers(['Monday', 'Wednesday', 'Sunday'])).toEqual([1, 3, 0]);
    expect(WEEKDAY_NAMES[day(2026, 10, 5).getDay()]).toBe('Monday');
  });

  test('TC-U05-02: Sessions should start on the chosen start date, not today', () => {
    const dates = getSessionDates(day(2026, 10, 12), day(2026, 10, 21), [MON, WED]);
    expect(keys(dates)).toEqual(['10/12', '10/14', '10/19', '10/21']);
  });

  test('TC-U05-03: No session should fall before the start date', () => {
    // Starts on a Tuesday, so that Monday is skipped
    const dates = getSessionDates(day(2026, 10, 13), day(2026, 10, 21), [MON, WED]);
    expect(keys(dates)).toEqual(['10/14', '10/19', '10/21']);
  });

  test('TC-U05-04: The end date should be included when it falls on a class day', () => {
    const dates = getSessionDates(day(2026, 10, 5), day(2026, 10, 7), [WED]);
    expect(keys(dates)).toEqual(['10/7']);
  });

  test('TC-U05-05: Only the selected weekdays should get sessions', () => {
    const dates = getSessionDates(day(2026, 10, 1), day(2026, 10, 31), [MON]);
    expect(dates.every((d) => d.getDay() === MON)).toBe(true);
    expect(dates).toHaveLength(4); // Oct 5, 12, 19, 26
  });

  test('TC-U05-06: An end date before the start date should create no sessions', () => {
    expect(getSessionDates(day(2026, 10, 21), day(2026, 10, 12), [MON, WED])).toEqual([]);
  });

  test('TC-U05-07: No days selected should create no sessions', () => {
    expect(getSessionDates(day(2026, 10, 1), day(2026, 10, 31), [])).toEqual([]);
  });

  test('TC-U05-08: Shortcuts should count from the start date', () => {
    expect(keys([addDuration(day(2026, 11, 2), 4, 'weeks')])).toEqual(['11/30']);
    expect(keys([addDuration(day(2026, 8, 10), 4, 'months')])).toEqual(['12/10']);
  });

  test('TC-U05-09: The latest end date should be 6 months after the start date', () => {
    expect(MAX_SCHEDULE_MONTHS).toBe(6);
    const max = getMaxEndDate(day(2026, 8, 10));
    expect(max.getFullYear()).toBe(2027);
    expect(keys([max])).toEqual(['2/10']);
  });

  test('TC-U05-10: A full semester of Mon/Wed classes should give the right number of sessions', () => {
    // Aug 10 (Mon) to Dec 14 (Mon), 2026: 19 Mondays and 18 Wednesdays
    const dates = getSessionDates(day(2026, 8, 10), day(2026, 12, 14), [MON, WED]);
    expect(dates).toHaveLength(37);
    expect(keys([dates[0], dates[dates.length - 1]])).toEqual(['8/10', '12/14']);
  });
});