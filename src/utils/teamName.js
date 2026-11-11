// Team names must be unique, so there can't be two JPIA or two ComSoc teams.
//
// A team has a full name (required) and an acronym (optional). Both are saved
// in teamNames, and a new team can't use an acronym or full name that any
// other team already uses, in either field. "ComSoc" is blocked once a team
// has ComSoc as its acronym or as its full name.
//
// Names are compared by a "key" that ignores:
//   - capital letters, spaces, symbols and accents ("Com-Soc" = "comsoc")
//   - small words: of, the, and, ng, mga... ("Council of Student Councils"
//     = "Council Student Councils")
//   - a plural "s" at the end of a word ("Councils" = "Council")
//
// The Firestore rules repeat the same steps (see teamNameKey in the rules),
// so the two must always be changed together.

export const MAX_ACRONYM_LENGTH = 15;
export const MAX_FULL_NAME_LENGTH = 60;

const SMALL_WORDS = / (an|and|at|for|in|of|on|the|ng|mga|sa|ang) /g;

export const teamNameKey = (text) => {
  if (typeof text !== 'string') return '';
  const words = text
    .replace(/[ÁÀÂÄáàâä]/g, 'a')
    .replace(/[ÉÈÊËéèêë]/g, 'e')
    .replace(/[ÍÌÎÏíìîï]/g, 'i')
    .replace(/[ÓÒÔÖóòôö]/g, 'o')
    .replace(/[ÚÙÛÜúùûü]/g, 'u')
    .replace(/Ñ/g, 'ñ')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .replace(/[^a-z0-9ñ]+/g, ' ');
  return ` ${words} `
    .replace(SMALL_WORDS, ' ')
    .replace(SMALL_WORDS, ' ') // twice, for two small words in a row ("of the")
    .replace(/([a-z0-9ñ]{3})s /g, '$1 ')
    .replace(/ /g, '');
};

// How the team is shown: "JPIA – Junior Philippine Institute of Accountants"
export const teamDisplayName = (acronym, fullName) => {
  const a = (acronym || '').trim();
  const f = (fullName || '').trim();
  return a ? `${a} – ${f}` : f;
};

// What's wrong with the acronym or full name, or null if both are fine.
// Returns { field: 'acronym' | 'fullName', reason: 'empty' | 'too-long' | 'no-letters' }.
// Whether the name is already used is checked separately, in the database.
export const getTeamNameError = (acronym, fullName) => {
  const a = typeof acronym === 'string' ? acronym.trim() : '';
  const f = typeof fullName === 'string' ? fullName.trim() : '';
  if (!f) return { field: 'fullName', reason: 'empty' };
  if (f.length > MAX_FULL_NAME_LENGTH) return { field: 'fullName', reason: 'too-long' };
  if (!teamNameKey(f)) return { field: 'fullName', reason: 'no-letters' };
  if (a.length > MAX_ACRONYM_LENGTH) return { field: 'acronym', reason: 'too-long' };
  if (a && !teamNameKey(a)) return { field: 'acronym', reason: 'no-letters' };
  return null;
};
