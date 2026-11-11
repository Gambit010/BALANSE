import {
  teamNameKey,
  teamDisplayName,
  getTeamNameError,
  MAX_ACRONYM_LENGTH,
  MAX_FULL_NAME_LENGTH,
} from '../../src/utils/teamName';

describe('TC-U10: Unique Team Names', () => {
  test('TC-U10-01: Capital letters, spaces and symbols are ignored', () => {
    expect(teamNameKey('ComSoc')).toBe('comsoc');
    expect(teamNameKey('  com soc ')).toBe('comsoc');
    expect(teamNameKey('Com-Soc!')).toBe('comsoc');
    expect(teamNameKey('J.P.I.A.')).toBe(teamNameKey('JPIA'));
  });

  test('TC-U10-02: Small words like "of" and "the" are ignored', () => {
    const key = teamNameKey('Council Student Council');
    expect(teamNameKey('Council of Student Council')).toBe(key);
    expect(teamNameKey('The Council of the Student Council')).toBe(key);
    expect(teamNameKey('Samahan ng mga Mag-aaral')).toBe(teamNameKey('Samahan Mag-aaral'));
  });

  test('TC-U10-03: A plural "s" at the end of a word is ignored', () => {
    expect(teamNameKey('Council of Student Councils')).toBe(teamNameKey('Council of Student Council'));
    expect(teamNameKey('ATHOMS')).toBe(teamNameKey('athom'));
    expect(teamNameKey('Bus')).toBe('bus'); // short words keep their "s"
  });

  test('TC-U10-04: Accents are ignored and ñ is kept', () => {
    expect(teamNameKey('Café Club')).toBe(teamNameKey('Cafe Club'));
    expect(teamNameKey('NIÑO Group')).toBe(teamNameKey('niño group'));
    expect(teamNameKey('Niño Group')).not.toBe(teamNameKey('Nino Group'));
  });

  test('TC-U10-05: Different names stay different', () => {
    expect(teamNameKey('ComSoc')).not.toBe(teamNameKey('Computer Society'));
    expect(teamNameKey('JPIA')).not.toBe(teamNameKey('JPMA'));
  });

  test('TC-U10-06: The team is shown as "Acronym – Full Name"', () => {
    expect(teamDisplayName(' JPIA ', ' Junior Philippine Institute of Accountants '))
      .toBe('JPIA – Junior Philippine Institute of Accountants');
    expect(teamDisplayName('', 'Computer Society')).toBe('Computer Society');
  });

  test('TC-U10-07: A full name is required, the acronym is optional', () => {
    expect(getTeamNameError('', 'Computer Society')).toBeNull();
    expect(getTeamNameError('ComSoc', 'Computer Society')).toBeNull();
    expect(getTeamNameError('ComSoc', '   ')).toEqual({ field: 'fullName', reason: 'empty' });
  });

  test('TC-U10-08: Names with only symbols or small words are rejected', () => {
    expect(getTeamNameError('', 'The')).toEqual({ field: 'fullName', reason: 'no-letters' });
    expect(getTeamNameError('!!!', 'Computer Society')).toEqual({ field: 'acronym', reason: 'no-letters' });
  });

  test('TC-U10-09: Names longer than the limit are rejected', () => {
    expect(getTeamNameError('', 'a'.repeat(MAX_FULL_NAME_LENGTH + 1))).toEqual({ field: 'fullName', reason: 'too-long' });
    expect(getTeamNameError('a'.repeat(MAX_ACRONYM_LENGTH + 1), 'Computer Society')).toEqual({ field: 'acronym', reason: 'too-long' });
    expect(getTeamNameError('a'.repeat(MAX_ACRONYM_LENGTH), 'a'.repeat(MAX_FULL_NAME_LENGTH))).toBeNull();
  });
});
