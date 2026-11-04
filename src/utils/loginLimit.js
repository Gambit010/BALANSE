// Failed-login limit on this phone. Every failed try counts, whatever the
// reason: wrong password, no such account, or an email that isn't valid.
// After MAX_LOGIN_ATTEMPTS failed tries the Log In button is paused: for
// FIRST_LOCK_MINUTES the first time, and REPEAT_LOCK_MINUTES if it happens
// again soon after. Firebase also blocks repeated attempts on its own servers;
// this makes the limit visible.
//
// The phone keeps one entry: { count, lastFailedAt, lockedUntil, locks }
// (times in ms; locks = how many times it was paused recently).

export const MAX_LOGIN_ATTEMPTS = 5;
export const FIRST_LOCK_MINUTES = 1;
export const REPEAT_LOCK_MINUTES = 5;
// After this long with no failed tries, everything starts over
export const ATTEMPT_WINDOW_MINUTES = 15;

const isRecent = (entry, now) =>
  !!entry?.lastFailedAt && now - entry.lastFailedAt < ATTEMPT_WINDOW_MINUTES * 60000;

// Pause logging in now. Used after the 5th failed try, and when Firebase
// itself blocks the account.
export const lockLogin = (entry, now = Date.now()) => {
  const locks = (isRecent(entry, now) ? entry.locks || 0 : 0) + 1;
  const minutes = locks === 1 ? FIRST_LOCK_MINUTES : REPEAT_LOCK_MINUTES;
  return { count: 0, lastFailedAt: now, lockedUntil: now + minutes * 60000, locks };
};

export const recordFailedLogin = (entry, now = Date.now()) => {
  const recent = isRecent(entry, now);
  const count = (recent ? entry.count || 0 : 0) + 1;
  if (count >= MAX_LOGIN_ATTEMPTS) return lockLogin(entry, now);
  return { count, lastFailedAt: now, lockedUntil: 0, locks: recent ? entry.locks || 0 : 0 };
};

export const getLockRemainingMs = (entry, now = Date.now()) =>
  Math.max(0, (entry?.lockedUntil || 0) - now);

// How long the current pause lasts, in minutes
export const getLockMinutes = (entry) =>
  entry?.lockedUntil ? Math.round((entry.lockedUntil - entry.lastFailedAt) / 60000) : 0;

export const attemptsLeft = (entry) => MAX_LOGIN_ATTEMPTS - (entry?.count || 0);

// 52000 ms -> "0:52"
export const formatCountdown = (ms) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
