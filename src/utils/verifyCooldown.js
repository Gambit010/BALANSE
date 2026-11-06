// Wait time before another verification email can be sent to the same
// address from this phone. Firebase decides how long the link itself lasts;
// this only stops students from asking for a new link again and again.
//
// The phone keeps one map: { "student@email.com": <time the last link was sent, in ms> }

export const RESEND_COOLDOWN_SECONDS = 60;
export const VERIFY_SENT_KEY = 'balanse_verify_sent';

const keyFor = (email) => (email || '').trim().toLowerCase();

// Record that a link was just sent. Entries older than an hour are dropped so
// the map stays small.
export const recordVerificationSent = (sentTimes, email, now = Date.now()) => {
  const next = {};
  Object.entries(sentTimes || {}).forEach(([key, time]) => {
    if (now - time < 60 * 60000) next[key] = time;
  });
  next[keyFor(email)] = now;
  return next;
};

// How long until another link may be sent to this email (0 = it can be sent now)
export const getResendRemainingMs = (sentTimes, email, now = Date.now()) => {
  const sentAt = (sentTimes || {})[keyFor(email)];
  if (!sentAt) return 0;
  return Math.max(0, sentAt + RESEND_COOLDOWN_SECONDS * 1000 - now);
};

// Read the saved map; anything unreadable counts as "nothing sent yet"
export const parseSentTimes = (raw) => {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};
