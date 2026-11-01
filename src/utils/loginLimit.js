// Wrong-password limit on this phone. After MAX_LOGIN_ATTEMPTS wrong tries for
// an email, logging in with it is paused for LOCK_MINUTES. Firebase also blocks
// repeated attempts on its own servers; this makes the limit visible.
//
// Each email has an entry: { count, lastFailedAt, lockedUntil } (times in ms).

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 5;
// Wrong tries older than this are forgotten, so a typo last week doesn't count
export const ATTEMPT_WINDOW_MINUTES = 15;

export const lockLogin = (now = Date.now()) => ({
  count: 0,
  lastFailedAt: now,
  lockedUntil: now + LOCK_MINUTES * 60000,
});

export const recordFailedLogin = (entry, now = Date.now()) => {
  const recent = entry?.lastFailedAt && now - entry.lastFailedAt < ATTEMPT_WINDOW_MINUTES * 60000;
  const count = (recent ? entry.count || 0 : 0) + 1;
  if (count >= MAX_LOGIN_ATTEMPTS) return lockLogin(now);
  return { count, lastFailedAt: now, lockedUntil: 0 };
};

export const getLockRemainingMs = (entry, now = Date.now()) =>
  Math.max(0, (entry?.lockedUntil || 0) - now);

export const attemptsLeft = (entry) => MAX_LOGIN_ATTEMPTS - (entry?.count || 0);

// 272000 ms -> "4:32"
export const formatCountdown = (ms) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
