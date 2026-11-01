import {
  MAX_LOGIN_ATTEMPTS,
  LOCK_MINUTES,
  ATTEMPT_WINDOW_MINUTES,
  lockLogin,
  recordFailedLogin,
  getLockRemainingMs,
  attemptsLeft,
  formatCountdown,
} from '../../src/utils/loginLimit';

const MINUTE = 60000;
const start = new Date(2026, 10, 1, 9, 0, 0).getTime();

// Wrong password `times` times, one minute apart
const failTimes = (times) => {
  let entry;
  for (let i = 0; i < times; i++) entry = recordFailedLogin(entry, start + i * MINUTE);
  return entry;
};

describe('TC-U07: Login Attempt Limit', () => {
  test('TC-U07-01: The first wrong password leaves 4 tries and does not lock', () => {
    const entry = recordFailedLogin(undefined, start);
    expect(attemptsLeft(entry)).toBe(MAX_LOGIN_ATTEMPTS - 1);
    expect(getLockRemainingMs(entry, start)).toBe(0);
  });

  test('TC-U07-02: Four wrong passwords leave 1 try and do not lock', () => {
    const entry = failTimes(4);
    expect(attemptsLeft(entry)).toBe(1);
    expect(getLockRemainingMs(entry, start + 4 * MINUTE)).toBe(0);
  });

  test('TC-U07-03: The fifth wrong password locks logging in for 5 minutes', () => {
    const entry = failTimes(5);
    const lockedAt = start + 4 * MINUTE;
    expect(getLockRemainingMs(entry, lockedAt)).toBe(LOCK_MINUTES * MINUTE);
  });

  test('TC-U07-04: Logging in is still locked 4 minutes later', () => {
    const lockedAt = start + 4 * MINUTE;
    expect(getLockRemainingMs(failTimes(5), lockedAt + 4 * MINUTE)).toBe(MINUTE);
  });

  test('TC-U07-05: The lock ends after 5 minutes, with 5 fresh tries', () => {
    const entry = failTimes(5);
    const afterLock = start + 4 * MINUTE + LOCK_MINUTES * MINUTE;
    expect(getLockRemainingMs(entry, afterLock)).toBe(0);
    expect(attemptsLeft(entry)).toBe(MAX_LOGIN_ATTEMPTS);
  });

  test('TC-U07-06: Wrong tries older than 15 minutes are forgotten', () => {
    const entry = failTimes(4);
    const later = start + 3 * MINUTE + ATTEMPT_WINDOW_MINUTES * MINUTE;
    expect(attemptsLeft(recordFailedLogin(entry, later))).toBe(MAX_LOGIN_ATTEMPTS - 1);
  });

  test('TC-U07-07: Firebase blocking the account also locks it here for 5 minutes', () => {
    expect(getLockRemainingMs(lockLogin(start), start)).toBe(LOCK_MINUTES * MINUTE);
  });

  test('TC-U07-08: The countdown is shown as minutes and seconds', () => {
    expect(formatCountdown(LOCK_MINUTES * MINUTE)).toBe('5:00');
    expect(formatCountdown(272000)).toBe('4:32');
    expect(formatCountdown(5000)).toBe('0:05');
  });
});
