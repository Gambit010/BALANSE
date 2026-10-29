import { normalizeEmail, inviteIdFor, getInviteError } from '../../src/utils/inviteUtils';

const team = {
  myEmail: 'owner@gmail.com',
  members: [
    { uid: 'a', email: 'owner@gmail.com', name: 'Owner' },
    { uid: 'b', email: 'Member@Gmail.com', name: 'Member' },
  ],
  pendingEmails: ['waiting@gmail.com'],
};

describe('TC-U06: Team Invitations', () => {
  test('TC-U06-01: Emails are trimmed and lowercased', () => {
    expect(normalizeEmail('  Juan@Gmail.COM ')).toBe('juan@gmail.com');
  });

  test('TC-U06-02: The invitation ID is the team ID plus the lowercased email', () => {
    expect(inviteIdFor('team1', 'Juan@Gmail.com')).toBe('team1_juan@gmail.com');
  });

  test('TC-U06-03: A new, valid email can be invited', () => {
    expect(getInviteError('newmember@gmail.com', team)).toBeNull();
  });

  test('TC-U06-04: An invalid email cannot be invited', () => {
    expect(getInviteError('not-an-email', team)).toBe('invalid');
  });

  test('TC-U06-05: An empty email cannot be invited', () => {
    expect(getInviteError('   ', team)).toBe('invalid');
  });

  test('TC-U06-06: An email with "/" cannot be invited', () => {
    expect(getInviteError('a/b@gmail.com', team)).toBe('invalid');
  });

  test('TC-U06-07: You cannot invite yourself, whatever the capitalization', () => {
    expect(getInviteError('OWNER@gmail.com', team)).toBe('self');
  });

  test('TC-U06-08: A current member cannot be invited again', () => {
    expect(getInviteError('member@gmail.com', team)).toBe('already-member');
  });

  test('TC-U06-09: An email with a pending invitation cannot be invited again', () => {
    expect(getInviteError('Waiting@gmail.com', team)).toBe('already-invited');
  });
});