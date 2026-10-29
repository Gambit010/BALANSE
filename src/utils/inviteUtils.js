import { isValidEmailFormat } from '../constants/validation';

// Emails are compared in lowercase everywhere, so "Juan@Gmail.com" and
// "juan@gmail.com" are the same invitation.
export const normalizeEmail = (email) =>
  typeof email === 'string' ? email.trim().toLowerCase() : '';

// One invitation per team and email. A fixed ID stops the same person from
// being invited twice, and lets the rules find the invitation when they accept.
export const inviteIdFor = (teamId, email) => `${teamId}_${normalizeEmail(email)}`;

// Why an invitation can't be sent, or null if it can.
export const getInviteError = (email, { myEmail, members = [], pendingEmails = [] } = {}) => {
  const e = normalizeEmail(email);
  // A "/" would break the invitation's ID
  if (!e || !isValidEmailFormat(e) || e.includes('/')) return 'invalid';
  if (e === normalizeEmail(myEmail)) return 'self';
  if (members.some((m) => normalizeEmail(m.email) === e)) return 'already-member';
  if (pendingEmails.some((p) => normalizeEmail(p) === e)) return 'already-invited';
  return null;
};