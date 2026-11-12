// Positions in a team, like "President" or "VP – External".
//
// Every org is set up differently, so the team owner can type any position.
// The suggestions are only shortcuts. Positions are labels: they don't change
// what a member can do on the board.
//
// Saved as teams/<teamId>/positions/<memberId> = { title }.

export const MAX_POSITION_LENGTH = 30;

export const POSITION_SUGGESTIONS = [
  'President',
  'Vice President',
  'VP – Internal',
  'VP – External',
  'Secretary',
  'Treasurer',
  'Auditor',
  'P.R.O.',
];

// Trim and squeeze extra spaces: "  VP   for  External " -> "VP for External"
export const cleanPosition = (text) =>
  typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';

// Why a position can't be saved, or null if it can.
// An empty position is allowed: it removes the member's position.
export const getPositionError = (text) =>
  cleanPosition(text).length > MAX_POSITION_LENGTH ? 'too-long' : null;
