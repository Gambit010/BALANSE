import { computePriorityScore, getPriorityLabel } from '../../src/constants/scoring';

describe('TC-U01: Priority Scoring Algorithm', () => {

  describe('Deadline Proximity Score (Factor A - max 40 pts)', () => {
    
    test('TC-U01-01: Task due today should receive 40 deadline points', () => {
      const today = new Date().toISOString().split('T')[0];
      const task = { deadline: today, priority: 'High', category: 'Organization' };
      const score = computePriorityScore(task);
      expect(score).toBe(100); // 40 + 40 + 20
    });

    test('TC-U01-02: Overdue task should receive maximum deadline points', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const task = { 
        deadline: yesterday.toISOString().split('T')[0], 
        priority: 'High', 
        category: 'Academic' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(95); // 40 + 40 + 15
    });

    test('TC-U01-03: Task due in 1-2 days should receive 30 deadline points', () => {
      const twoDays = new Date();
      twoDays.setDate(twoDays.getDate() + 2);
      const task = { 
        deadline: twoDays.toISOString().split('T')[0], 
        priority: 'Low', 
        category: 'Personal' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(50); // 30 + 10 + 10
    });

    test('TC-U01-04: Task due in 3-5 days should receive 20 deadline points', () => {
      const fiveDays = new Date();
      fiveDays.setDate(fiveDays.getDate() + 5);
      const task = { 
        deadline: fiveDays.toISOString().split('T')[0], 
        priority: 'Medium', 
        category: 'Academic' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(60); // 20 + 25 + 15
    });

    test('TC-U01-05: Task due in 6+ days should receive 10 deadline points', () => {
      const tenDays = new Date();
      tenDays.setDate(tenDays.getDate() + 10);
      const task = { 
        deadline: tenDays.toISOString().split('T')[0], 
        priority: 'Low', 
        category: 'Personal' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });
  });

  describe('User Priority Score (Factor B - max 40 pts)', () => {
    
    test('TC-U01-06: High priority should receive 40 points', () => {
      const tenDays = new Date();
      tenDays.setDate(tenDays.getDate() + 10);
      const task = { 
        deadline: tenDays.toISOString().split('T')[0], 
        priority: 'High', 
        category: 'Personal' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(60); // 10 + 40 + 10
    });

    test('TC-U01-07: Medium priority should receive 25 points', () => {
      const tenDays = new Date();
      tenDays.setDate(tenDays.getDate() + 10);
      const task = { 
        deadline: tenDays.toISOString().split('T')[0], 
        priority: 'Medium', 
        category: 'Personal' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(45); // 10 + 25 + 10
    });

    test('TC-U01-08: Low priority should receive 10 points', () => {
      const tenDays = new Date();
      tenDays.setDate(tenDays.getDate() + 10);
      const task = { 
        deadline: tenDays.toISOString().split('T')[0], 
        priority: 'Low', 
        category: 'Personal' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });
  });

  describe('Category Score (Factor C - max 20 pts)', () => {
    
    test('TC-U01-09: Organization category should receive 20 points', () => {
      const tenDays = new Date();
      tenDays.setDate(tenDays.getDate() + 10);
      const task = { 
        deadline: tenDays.toISOString().split('T')[0], 
        priority: 'Low', 
        category: 'Organization' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(40); // 10 + 10 + 20
    });

    test('TC-U01-10: Academic category should receive 15 points', () => {
      const tenDays = new Date();
      tenDays.setDate(tenDays.getDate() + 10);
      const task = { 
        deadline: tenDays.toISOString().split('T')[0], 
        priority: 'Low', 
        category: 'Academic' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(35); // 10 + 10 + 15
    });

    test('TC-U01-11: Personal category should receive 10 points', () => {
      const tenDays = new Date();
      tenDays.setDate(tenDays.getDate() + 10);
      const task = { 
        deadline: tenDays.toISOString().split('T')[0], 
        priority: 'Low', 
        category: 'Personal' 
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });
  });

  describe('Score Cap and Priority Label', () => {
    
    test('TC-U01-12: Score should never exceed 100', () => {
      const today = new Date().toISOString().split('T')[0];
      const task = { deadline: today, priority: 'High', category: 'Organization' };
      const score = computePriorityScore(task);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('TC-U01-13: Score 70 and above should return High label', () => {
      expect(getPriorityLabel(70)).toBe('High');
      expect(getPriorityLabel(85)).toBe('High');
      expect(getPriorityLabel(100)).toBe('High');
    });

    test('TC-U01-14: Score 40-69 should return Medium label', () => {
      expect(getPriorityLabel(40)).toBe('Medium');
      expect(getPriorityLabel(55)).toBe('Medium');
      expect(getPriorityLabel(69)).toBe('Medium');
    });

    test('TC-U01-15: Score below 40 should return Low label', () => {
      expect(getPriorityLabel(39)).toBe('Low');
      expect(getPriorityLabel(20)).toBe('Low');
      expect(getPriorityLabel(0)).toBe('Low');
    });
  });
});