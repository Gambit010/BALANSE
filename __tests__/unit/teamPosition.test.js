import {
  cleanPosition,
  getPositionError,
  POSITION_SUGGESTIONS,
  MAX_POSITION_LENGTH,
} from '../../src/utils/teamPosition';

describe('TC-U11: Team Member Positions', () => {
  test('TC-U11-01: Extra spaces are removed from a position', () => {
    expect(cleanPosition('  VP   for  External ')).toBe('VP for External');
  });

  test('TC-U11-02: Any position can be typed, not only the suggestions', () => {
    expect(getPositionError('Thesis Leader')).toBeNull();
    expect(getPositionError('VP for Internal Affairs')).toBeNull();
  });

  test('TC-U11-03: An empty position is allowed (it removes the position)', () => {
    expect(cleanPosition('   ')).toBe('');
    expect(getPositionError('   ')).toBeNull();
  });

  test('TC-U11-04: A position longer than the limit is rejected', () => {
    expect(getPositionError('a'.repeat(MAX_POSITION_LENGTH + 1))).toBe('too-long');
    expect(getPositionError('a'.repeat(MAX_POSITION_LENGTH))).toBeNull();
  });

  test('TC-U11-05: Every suggestion fits within the limit', () => {
    POSITION_SUGGESTIONS.forEach((p) => {
      expect(getPositionError(p)).toBeNull();
      expect(cleanPosition(p)).toBe(p);
    });
  });
});
