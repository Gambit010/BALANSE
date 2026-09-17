import { 
  computePriorityScore, 
  getPriorityLabel,
  getPriorityBreakdown,
  getWellnessAdjustedScore 
} from '../../src/constants/scoring';

// Helper to create dates relative to today
const getDate = (daysFromToday) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

describe('TC-U01: Priority Scoring Engine', () => {

  // ─── Factor A: Deadline Proximity ───
  describe('Factor A — Deadline Proximity (max 40 pts)', () => {

    test('TC-U01-01: Overdue task should receive 40 deadline points', () => {
      const task = { 
        deadline: getDate(-1), 
        priority: 'High', 
        category: 'Organization',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(100); // 40 + 40 + 20
    });

    test('TC-U01-02: Task due today should receive 38 deadline points', () => {
      const task = { 
        deadline: getDate(0), 
        priority: 'High', 
        category: 'Organization',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(98); // 38 + 40 + 20
    });

    test('TC-U01-03: Task due in 1-2 days should receive 30 deadline points', () => {
      const task = { 
        deadline: getDate(2), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(50); // 30 + 10 + 10
    });

    test('TC-U01-04: Task due in 3-5 days should receive 20 deadline points', () => {
      const task = { 
        deadline: getDate(5), 
        priority: 'Medium', 
        category: 'Academic',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(60); // 20 + 25 + 15
    });

    test('TC-U01-05: Task due in 6+ days should receive 10 deadline points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });

    test('TC-U01-06: Task with no deadline should receive default 10 deadline points', () => {
      const task = { 
        deadline: null, 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });
  });

  // ─── Factor B: User Priority Level ───
  describe('Factor B — User Priority Level (max 40 pts)', () => {

    test('TC-U01-07: High priority should contribute 40 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'High', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(60); // 10 + 40 + 10
    });

    test('TC-U01-08: Medium priority should contribute 25 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Medium', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(45); // 10 + 25 + 10
    });

    test('TC-U01-09: Low priority should contribute 10 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });

    test('TC-U01-09b: Unknown priority should default to 10 points', () => {
      const task = {
        deadline: getDate(10),
        priority: 'URGENT',
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });
  });

  // ─── Factor C: Task Category ───
  describe('Factor C — Task Category (max 20 pts)', () => {

    test('TC-U01-10: Organization category should contribute 20 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Organization',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(40); // 10 + 10 + 20
    });

    test('TC-U01-11: Academic category should contribute 15 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Academic',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(35); // 10 + 10 + 15
    });

    test('TC-U01-12: Personal category should contribute 10 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });

    test('TC-U01-12b: Unknown category should default to 10 points', () => {
      const task = {
        deadline: getDate(10),
        priority: 'Low',
        category: 'Sports',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });
  });

  // ─── Score Cap and Edge Cases ───
  describe('Score Cap and Edge Cases', () => {

    test('TC-U01-13: Score should never exceed 100', () => {
      const task = { 
        deadline: getDate(-1), 
        priority: 'High', 
        category: 'Organization',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('TC-U01-14: Completed task (progress 100) should always return score 0', () => {
      const task = { 
        deadline: getDate(-1), 
        priority: 'High', 
        category: 'Organization',
        progress: 100
      };
      const score = computePriorityScore(task);
      expect(score).toBe(0);
    });

    test('TC-U01-15: Invalid deadline should return default 10 deadline points', () => {
      const task = { 
        deadline: 'not-a-date', 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const score = computePriorityScore(task);
      expect(score).toBe(30); // 10 + 10 + 10
    });
  });

  // ─── Priority Label ───
  describe('Priority Label Classification', () => {

    test('TC-U01-16: Score 70 and above should return High label', () => {
      expect(getPriorityLabel(70)).toBe('High');
      expect(getPriorityLabel(85)).toBe('High');
      expect(getPriorityLabel(100)).toBe('High');
    });

    test('TC-U01-17: Score 40-69 should return Medium label', () => {
      expect(getPriorityLabel(40)).toBe('Medium');
      expect(getPriorityLabel(55)).toBe('Medium');
      expect(getPriorityLabel(69)).toBe('Medium');
    });

    test('TC-U01-18: Score below 40 should return Low label', () => {
      expect(getPriorityLabel(39)).toBe('Low');
      expect(getPriorityLabel(20)).toBe('Low');
      expect(getPriorityLabel(0)).toBe('Low');
    });
  });

  // ─── Priority Breakdown ───
  describe('Priority Score Breakdown', () => {

    test('TC-U01-19: Breakdown should return correct factor scores', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'High', 
        category: 'Academic',
        progress: 0
      };
      const breakdown = getPriorityBreakdown(task);
      expect(breakdown.total).toBe(65); // 10 + 40 + 15
      expect(breakdown.factors).toHaveLength(3);
      expect(breakdown.factors[0].label).toBe('Deadline');
      expect(breakdown.factors[1].label).toBe('Priority');
      expect(breakdown.factors[2].label).toBe('Category');
    });

    test('TC-U01-20: Breakdown total should match computePriorityScore', () => {
      const task = { 
        deadline: getDate(2), 
        priority: 'Medium', 
        category: 'Organization',
        progress: 0
      };
      const score = computePriorityScore(task);
      const breakdown = getPriorityBreakdown(task);
      expect(breakdown.total).toBe(score);
    });

    test('TC-U01-21: Breakdown should describe overdue deadline correctly', () => {
      const task = {
        deadline: getDate(-1),
        priority: 'High',
        category: 'Academic',
        progress: 0
      };

      const breakdown = getPriorityBreakdown(task);
      expect(breakdown.total).toBe(95); // 40 + 40 + 15
      expect(breakdown.factors[0].reason).toBe('1 day overdue');
    });
  });

  // ─── Wellness Adjusted Score ───
  describe('TC-U02: Wellness-Aware Score Adjustment', () => {

    test('TC-U02-01: Positive wellness (50+) should not adjust score', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const baseScore = 30;
      const adjusted = getWellnessAdjustedScore(task, baseScore, 75);
      expect(adjusted).toBe(30); // no adjustment
    });

    test('TC-U02-02: At-risk wellness should boost Personal category task by 8 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const baseScore = 30;
      const adjusted = getWellnessAdjustedScore(task, baseScore, 40);
      expect(adjusted).toBe(33); // 30 + 8
    });

    test('TC-U02-03: At-risk wellness should reduce Low priority non-urgent task by 5 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Academic',
        progress: 0
      };
      const baseScore = 35;
      const adjusted = getWellnessAdjustedScore(task, baseScore, 40);
      expect(adjusted).toBe(30); // 35 - 5
    });

    test('TC-U02-04: Severe wellness should boost Personal category task by 15 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const baseScore = 30;
      const adjusted = getWellnessAdjustedScore(task, baseScore, 20);
      expect(adjusted).toBe(35); // 30 + 15
    });

    test('TC-U02-04b: At-risk wellness boost on Personal task without reduction', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'High',  // High priority — no reduction applied
        category: 'Personal',
        progress: 0
      };
      const baseScore = 60;
      const adjusted = getWellnessAdjustedScore(task, baseScore, 40);
      expect(adjusted).toBe(68); // 60 + 8
    });

    test('TC-U02-04c: Severe wellness boost on Personal task without reduction', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'High',  // High priority — no reduction applied
        category: 'Personal',
        progress: 0
      };
      const baseScore = 60;
      const adjusted = getWellnessAdjustedScore(task, baseScore, 20);
      expect(adjusted).toBe(75); // 60 + 15
    });

    test('TC-U02-05: Severe wellness should reduce Low priority non-urgent task by 10 points', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Academic',
        progress: 0
      };
      const baseScore = 35;
      const adjusted = getWellnessAdjustedScore(task, baseScore, 20);
      expect(adjusted).toBe(25); // 35 - 10
    });

    test('TC-U02-06: Adjusted score should never exceed 100', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const adjusted = getWellnessAdjustedScore(task, 95, 20);
      expect(adjusted).toBeLessThanOrEqual(100);
    });

    test('TC-U02-07: Adjusted score should never go below 0', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Academic',
        progress: 0
      };
      const adjusted = getWellnessAdjustedScore(task, 3, 20);
      expect(adjusted).toBeGreaterThanOrEqual(0);
    });

    test('TC-U02-08: Null wellness percentage should not adjust score', () => {
      const task = { 
        deadline: getDate(10), 
        priority: 'Low', 
        category: 'Personal',
        progress: 0
      };
      const baseScore = 30;
      const adjusted = getWellnessAdjustedScore(task, baseScore, null);
      expect(adjusted).toBe(30);
    });
  });
});