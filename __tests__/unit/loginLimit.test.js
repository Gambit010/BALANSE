import {
  MAX_LOGIN_ATTEMPTS,
  FIRST_LOCK_MINUTES,
  REPEAT_LOCK_MINUTES,
  ATTEMPT_WINDOW_MINUTES,
  lockLogin,
  recordFailedLogin,
  getLockRemainingMs,
  getLockMinutes,
  attemptsLeft,
  formatCountdown,
} from '../../src/utils/loginLimit';

const MINUTE = 60000;
const start = new Date(2026, 10, 1, 9, 0, 0).getTime();

// Fail `times` times, ten seconds apart, starting at `from`
const fail = (times, entry = undefined, from = start) => {
  let e = entry;
  for (let i = 0; i < times; i++) e = recordFailedLogin(e, from + i * 10000);
  return e;
};
const lastTry = (from, times) => from + (times - 1) * 10000;

describe('TC-U07: Login Attempt Limit', () => {
  test('TC-U07-01: The first failed try leaves 4 tries and does not lock', () => {
    const entry = fail(1);
    expect(attemptsLeft(entry)).toBe(MAX_LOGIN_ATTEMPTS - 1);
    expect(getLockRemainingMs(entry, start)).toBe(0);
  });

  test('TC-U07-02: Four failed tries leave 1 try and do not lock', () => {
    const entry = fail(4);
    expect(attemptsLeft(entry)).toBe(1);
    expect(getLockRemainingMs(entry, lastTry(start, 4))).toBe(0);
  });

  test('TC-U07-03: The fifth failed try locks logging in for 1 minute', () => {
    const entry = fail(5);
    expect(getLockMinutes(entry)).toBe(FIRST_LOCK_MINUTES);
    expect(getLockRemainingMs(entry, lastTry(start, 5))).toBe(FIRST_LOCK_MINUTES * MINUTE);
  });

  test('TC-U07-04: The first lock ends after 1 minute, with 5 fresh tries', () => {
    const entry = fail(5);
    const afterLock = lastTry(start, 5) + FIRST_LOCK_MINUTES * MINUTE;
    expect(getLockRemainingMs(entry, afterLock)).toBe(0);
    expect(attemptsLeft(entry)).toBe(MAX_LOGIN_ATTEMPTS);
  });

  test('TC-U07-05: Failing 5 more times soon after locks for 5 minutes', () => {
    const firstLock = fail(5);
    const resumeAt = lastTry(start, 5) + FIRST_LOCK_MINUTES * MINUTE;
    const secondLock = fail(5, firstLock, resumeAt);
    expect(getLockMinutes(secondLock)).toBe(REPEAT_LOCK_MINUTES);
    expect(getLockRemainingMs(secondLock, lastTry(resumeAt, 5))).toBe(REPEAT_LOCK_MINUTES * MINUTE);
  });

  test('TC-U07-06: After 15 minutes with no failed tries, the next lock is 1 minute again', () => {
    const firstLock = fail(5);
    const muchLater = lastTry(start, 5) + ATTEMPT_WINDOW_MINUTES * MINUTE;
    expect(getLockMinutes(fail(5, firstLock, muchLater))).toBe(FIRST_LOCK_MINUTES);
  });

  test('TC-U07-07: Failed tries older than 15 minutes are forgotten', () => {
    const entry = fail(4);
    const muchLater = lastTry(start, 4) + ATTEMPT_WINDOW_MINUTES * MINUTE;
    expect(attemptsLeft(recordFailedLogin(entry, muchLater))).toBe(MAX_LOGIN_ATTEMPTS - 1);
  });

  test('TC-U07-08: Firebase blocking the account also locks it here', () => {
    const entry = lockLogin(undefined, start);
    expect(getLockRemainingMs(entry, start)).toBe(FIRST_LOCK_MINUTES * MINUTE);
  });

  test('TC-U07-09: The countdown is shown as minutes and seconds', () => {
    expect(formatCountdown(REPEAT_LOCK_MINUTES * MINUTE)).toBe('5:00');
    expect(formatCountdown(52000)).toBe('0:52');
    expect(formatCountdown(5000)).toBe('0:05');
  });
});
