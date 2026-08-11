import {
  WHO5_QUESTIONS,
  LIKERT_OPTIONS,
  TIMEFRAME_TEXT,
  getRawScore,
  computeWellnessPercentage,
  WELLNESS_THRESHOLDS,
  getWellnessStatus,
  detectDecline,
  getInterventions,
  getWellnessThrottleAdvice,
  getTrendInsight,
} from '../../src/constants/wellness';

describe('TC-U03: Wellness Assessment and Recommendation Engine', () => {

  // ─── WHO-5 Questions ───
  describe('WHO-5 Questions', () => {

    test('TC-U03-01: WHO-5 should contain exactly 5 questions', () => {
      expect(WHO5_QUESTIONS).toHaveLength(5);
    });

    test('TC-U03-02: WHO-5 questions should have sequential IDs', () => {
      expect(WHO5_QUESTIONS.map(question => question.id)).toEqual([1, 2, 3, 4, 5]);
    });

    test('TC-U03-03: WHO-5 questions should contain required text', () => {
      WHO5_QUESTIONS.forEach(question => {
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('text');
        expect(typeof question.text).toBe('string');
        expect(question.text.length).toBeGreaterThan(0);
      });
    });

  });

  // ─── Likert Scale ───
  describe('WHO-5 Likert Scale Options', () => {

    test('TC-U03-04: Likert scale should contain 6 response options', () => {
      expect(LIKERT_OPTIONS).toHaveLength(6);
    });

    test('TC-U03-05: Likert values should range from 5 to 0', () => {
      expect(LIKERT_OPTIONS.map(option => option.value)).toEqual([5, 4, 3, 2, 1, 0]);
    });

    test('TC-U03-06: Each Likert option should contain value and label', () => {
      LIKERT_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('number');
        expect(typeof option.label).toBe('string');
      });
    });

  });


  // ─── Timeframe ───
  describe('WHO-5 Assessment Timeframe', () => {

    test('TC-U03-07: Assessment should use the last two weeks timeframe', () => {
      expect(TIMEFRAME_TEXT).toBe('Over the last 2 weeks....');
    });

  });


  // ─── Raw Score ───
  describe('Raw Wellness Score Calculation', () => {

    test('TC-U03-08: All maximum answers should produce raw score of 25', () => {
      const answers = {
        1: 5,
        2: 5,
        3: 5,
        4: 5,
        5: 5,
      };

      expect(getRawScore(answers)).toBe(25);
    });

    test('TC-U03-09: All minimum answers should produce raw score of 0', () => {
      const answers = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      expect(getRawScore(answers)).toBe(0);
    });

    test('TC-U03-10: Mixed answers should produce correct raw score', () => {
      const answers = {
        1: 5,
        2: 4,
        3: 3,
        4: 2,
        5: 1,
      };

      expect(getRawScore(answers)).toBe(15);
    });

    test('TC-U03-11: Empty answers object should return raw score of 0', () => {
      expect(getRawScore({})).toBe(0);
    });

  });


  // ─── Wellness Percentage ───
  describe('Wellness Percentage Calculation', () => {

    test('TC-U03-12: Maximum raw score should produce 100 percent', () => {
      const answers = {
        1: 5,
        2: 5,
        3: 5,
        4: 5,
        5: 5,
      };

      expect(computeWellnessPercentage(answers)).toBe(100);
    });

    test('TC-U03-13: Minimum raw score should produce 0 percent', () => {
      const answers = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      expect(computeWellnessPercentage(answers)).toBe(0);
    });

    test('TC-U03-14: Raw score of 12 should produce 48 percent', () => {
      const answers = {
        1: 3,
        2: 3,
        3: 2,
        4: 2,
        5: 2,
      };

      expect(computeWellnessPercentage(answers)).toBe(48);
    });

    test('TC-U03-15: Raw score of 13 should produce 52 percent', () => {
      const answers = {
        1: 3,
        2: 3,
        3: 3,
        4: 2,
        5: 2,
      };

      expect(computeWellnessPercentage(answers)).toBe(52);
    });

  });


  // ─── Wellness Status ───
  describe('Wellness Status Classification', () => {

    test('TC-U03-16: Score of 50 should return Positive Well-being', () => {
      const status = getWellnessStatus(50);

      expect(status.level).toBe('positive');
      expect(status.label).toBe('Positive Well-being');
      expect(status.color).toBe('#4ade80');
    });

    test('TC-U03-17: Score above 50 should return Positive Well-being', () => {
      const status = getWellnessStatus(75);

      expect(status.level).toBe('positive');
      expect(status.label).toBe('Positive Well-being');
    });

    test('TC-U03-18: Score of 49 should return At Risk', () => {
      const status = getWellnessStatus(49);

      expect(status.level).toBe('risk');
      expect(status.label).toBe('At Risk');
      expect(status.color).toBe('#fbbf24');
    });

    test('TC-U03-19: Score of 28 should return At Risk', () => {
      const status = getWellnessStatus(28);

      expect(status.level).toBe('risk');
      expect(status.label).toBe('At Risk');
    });

    test('TC-U03-20: Score of 27 should return Low Well-being', () => {
      const status = getWellnessStatus(27);

      expect(status.level).toBe('severe');
      expect(status.label).toBe('Low Well-being');
      expect(status.color).toBe('#f87171');
    });

    test('TC-U03-21: Score of 0 should return Low Well-being', () => {
      const status = getWellnessStatus(0);

      expect(status.level).toBe('severe');
      expect(status.label).toBe('Low Well-being');
    });

    test('TC-U03-22: Wellness thresholds should be 50 and 28', () => {
      expect(WELLNESS_THRESHOLDS.POSITIVE).toBe(50);
      expect(WELLNESS_THRESHOLDS.RISK).toBe(28);
    });

  });


  // ─── Decline Detection ───
  describe('Wellness Decline Detection', () => {

    test('TC-U03-23: Less than two assessments should return null', () => {
      expect(detectDecline([])).toBeNull();

      expect(
        detectDecline([
          { percentage: 50 }
        ])
      ).toBeNull();
    });

    test('TC-U03-24: Drop greater than 10 points should be detected', () => {
      const history = [
        { percentage: 40 },
        { percentage: 55 },
      ];

      const result = detectDecline(history);

      expect(result.hasDrop).toBe(true);
      expect(result.drop).toBe(15);
    });

    test('TC-U03-25: Drop of exactly 10 points should not be detected', () => {
      const history = [
        { percentage: 40 },
        { percentage: 50 },
      ];

      const result = detectDecline(history);

      expect(result.hasDrop).toBe(false);
      expect(result.drop).toBe(0);
      expect(result.message).toBeNull();
    });

    test('TC-U03-26: Drop of 11 points should be detected', () => {
      const history = [
        { percentage: 39 },
        { percentage: 50 },
      ];

      const result = detectDecline(history);

      expect(result.hasDrop).toBe(true);
      expect(result.drop).toBe(11);
    });

    test('TC-U03-27: Improved wellness score should not be treated as decline', () => {
      const history = [
        { percentage: 70 },
        { percentage: 50 },
      ];

      const result = detectDecline(history);

      expect(result.hasDrop).toBe(false);
      expect(result.drop).toBe(0);
    });

  });


  // ─── Interventions ───
  describe('Wellness Interventions', () => {

    test('TC-U03-28: Positive wellness with no workload issue should recommend keeping it up', () => {
      const interventions = getInterventions(75, 0, 0);

      expect(interventions).toHaveLength(1);
      expect(interventions[0].title).toBe('Keep It Up!');
    });

    test('TC-U03-29: At-risk wellness should recommend mental health resources', () => {
      const interventions = getInterventions(40, 0, 0);

      expect(interventions).toHaveLength(2);
      expect(interventions.map(i => i.title)).toEqual([
        'Take a Break',
        'Mental Health Resources',
    ]);
      expect(interventions[1].link).toBe('https://mentalhealthph.org/');
    });

    test('TC-U03-30: Wellness exactly at 50 should not trigger Take a Break intervention', () => {
      const interventions = getInterventions(50, 0, 0);

      expect(interventions).toHaveLength(1);
      expect(interventions[0].title).toBe('Keep It Up!');
    });

    test('TC-U03-31: Wellness below 50 should recommend taking a break', () => {
      const interventions = getInterventions(49, 0, 0);

      expect(
        interventions.some(intervention => intervention.title === 'Take a Break')
      ).toBe(true);
    });

    test('TC-U03-32: Severe wellness should provide multiple support interventions', () => {
      const interventions = getInterventions(27, 0, 0);

      expect(
        interventions.some(intervention => intervention.title === 'Take a Break')
      ).toBe(true);

      expect(
        interventions.some(intervention => intervention.title === 'Talk to Someone')
      ).toBe(true);

      expect(
        interventions.some(intervention => intervention.title === 'Prioritize Sleep')
      ).toBe(true);
    });

    test('TC-U03-33: More than 5 active tasks should recommend reducing workload', () => {
      const interventions = getInterventions(75, 6, 0);

      expect(
        interventions.some(intervention => intervention.title === 'Reduce Workload')
      ).toBe(true);
    });

    test('TC-U03-34: Exactly 5 active tasks should not trigger workload intervention', () => {
      const interventions = getInterventions(75, 5, 0);

      expect(
        interventions.some(intervention => intervention.title === 'Reduce Workload')
      ).toBe(false);
    });

    test('TC-U03-35: Schedule conflict should recommend resolving conflicts', () => {
      const interventions = getInterventions(75, 0, 1);

      expect(
        interventions.some(
          intervention => intervention.title === 'Resolve Schedule Conflicts'
        )
      ).toBe(true);
    });

    test('TC-U03-36: Multiple schedule conflicts should use plural wording', () => {
      const interventions = getInterventions(75, 0, 2);

      const conflictIntervention = interventions.find(
        intervention => intervention.title === 'Resolve Schedule Conflicts'
      );

      expect(conflictIntervention.text).toContain('2 scheduling conflicts');
    });

    test('TC-U03-37: Zero conflicts should not create conflict intervention', () => {
      const interventions = getInterventions(75, 0, 0);

      expect(
        interventions.some(
          intervention => intervention.title === 'Resolve Schedule Conflicts'
        )
      ).toBe(false);
    });

  });


  // ─── Wellness Throttle Advice ───
  describe('Wellness Throttle Advice', () => {

    test('TC-U03-38: Positive wellness should not activate throttling', () => {
      const result = getWellnessThrottleAdvice(50, []);

      expect(result.shouldThrottle).toBe(false);
      expect(result.deferrableTasks).toEqual([]);
      expect(result.deferrableCount).toBe(0);
    });

    test('TC-U03-39: Wellness above positive threshold should not activate throttling', () => {
      const result = getWellnessThrottleAdvice(75, []);

      expect(result.shouldThrottle).toBe(false);
    });

    test('TC-U03-40: Null wellness percentage should not activate throttling', () => {
      const result = getWellnessThrottleAdvice(null, []);

      expect(result.shouldThrottle).toBe(false);
      expect(result.deferrableTasks).toEqual([]);
    });

    test('TC-U03-41: Low wellness should identify non-urgent task as deferrable', () => {
      const tasks = [
        {
          id: 1,
          progress: 0,
          priority: 'Low',
          deadline: null,
        },
      ];

      const result = getWellnessThrottleAdvice(40, tasks);

      expect(result.shouldThrottle).toBe(true);
      expect(result.deferrableCount).toBe(1);
      expect(result.deferrableTasks).toHaveLength(1);
      expect(result.severity).toBe('risk');
    });

    test('TC-U03-42: Completed task should not be deferrable', () => {
      const tasks = [
        {
          id: 1,
          progress: 100,
          priority: 'Low',
          deadline: null,
        },
      ];

      const result = getWellnessThrottleAdvice(40, tasks);

      expect(result.deferrableCount).toBe(0);
    });

    test('TC-U03-43: High priority task should not be deferrable', () => {
      const tasks = [
        {
          id: 1,
          progress: 0,
          priority: 'High',
          deadline: null,
        },
      ];

      const result = getWellnessThrottleAdvice(40, tasks);

      expect(result.deferrableCount).toBe(0);
    });

    test('TC-U03-44: Class schedule task should not be deferrable', () => {
      const tasks = [
        {
          id: 1,
          progress: 0,
          priority: 'Low',
          recurrence: {
            isClassSchedule: true,
          },
          deadline: null,
        },
      ];

      const result = getWellnessThrottleAdvice(40, tasks);

      expect(result.deferrableCount).toBe(0);
    });

    test('TC-U03-45: Task due more than 2 days away should be deferrable', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const tasks = [
        {
          id: 1,
          progress: 0,
          priority: 'Low',
          deadline: futureDate.toISOString(),
        },
      ];

      const result = getWellnessThrottleAdvice(40, tasks);

      expect(result.deferrableCount).toBe(1);
    });

    test('TC-U03-46: When no tasks are deferrable, throttle advice should indicate urgent workload', () => {
      const tasks = [
        {
          id: 1,
          progress: 0,
          priority: 'High',
          deadline: null,
        },
      ];

      const result = getWellnessThrottleAdvice(20, tasks);

      expect(result.shouldThrottle).toBe(true);
      expect(result.severity).toBe('severe');
      expect(result.deferrableCount).toBe(0);
      expect(result.message).toContain('urgent or high priority');
    });

  });


  // ─── Trend Insight ───
  describe('Workload-Wellness Trend Insight', () => {

    test('TC-U03-47: Less than two assessments should return null', () => {
      expect(getTrendInsight([])).toBeNull();

      expect(
        getTrendInsight([{ percentage: 50 }])
      ).toBeNull();
    });

    test('TC-U03-48: Wellness improvement of 3 points should be classified as improved', () => {
      const history = [
        { percentage: 53 },
        { percentage: 50 },
      ];

      const result = getTrendInsight(history);

      expect(result.direction).toBe('improved');
      expect(result.tone).toBe('positive');
      expect(result.scoreDelta).toBe(3);
    });

    test('TC-U03-49: Wellness decline of 3 points should be classified as declined', () => {
      const history = [
        { percentage: 47 },
        { percentage: 50 },
      ];

      const result = getTrendInsight(history);

      expect(result.direction).toBe('declined');
      expect(result.tone).toBe('warning');
      expect(result.scoreDelta).toBe(-3);
    });

    test('TC-U03-50: Wellness change of 2 points should be classified as steady', () => {
      const history = [
        { percentage: 52 },
        { percentage: 50 },
      ];

      const result = getTrendInsight(history);

      expect(result.direction).toBe('steady');
      expect(result.tone).toBe('neutral');
      expect(result.scoreDelta).toBe(2);
    });

    test('TC-U03-51: Wellness change of exactly -2 points should be classified as steady', () => {
      const history = [
        { percentage: 48 },
        { percentage: 50 },
      ];

      const result = getTrendInsight(history);

      expect(result.direction).toBe('steady');
      expect(result.tone).toBe('neutral');
      expect(result.scoreDelta).toBe(-2);
    });

    test('TC-U03-52: Improvement with reduced workload should mention lighter workload', () => {
      const history = [
        {
          percentage: 70,
          activeTaskCount: 3,
        },
        {
          percentage: 60,
          activeTaskCount: 7,
        },
      ];

      const result = getTrendInsight(history);

      expect(result.direction).toBe('improved');
      expect(result.taskDelta).toBe(-4);
      expect(result.hasWorkload).toBe(true);
      expect(result.message).toContain('Lightening your load appears to be helping');
    });

    test('TC-U03-53: Decline with increased workload should warn about rising workload', () => {
      const history = [
        {
          percentage: 40,
          activeTaskCount: 8,
        },
        {
          percentage: 50,
          activeTaskCount: 4,
        },
      ];

      const result = getTrendInsight(history);

      expect(result.direction).toBe('declined');
      expect(result.taskDelta).toBe(4);
      expect(result.hasWorkload).toBe(true);
      expect(result.message).toContain('rising workload');
    });

    test('TC-U03-54: Missing workload data should set hasWorkload to false', () => {
      const history = [
        { percentage: 60 },
        { percentage: 50 },
      ];

      const result = getTrendInsight(history);

      expect(result.hasWorkload).toBe(false);
      expect(result.taskDelta).toBeNull();
    });

    test('TC-U03-55: Same workload should produce zero task delta', () => {
      const history = [
        {
          percentage: 60,
          activeTaskCount: 5,
        },
        {
          percentage: 50,
          activeTaskCount: 5,
        },
      ];

      const result = getTrendInsight(history);

      expect(result.hasWorkload).toBe(true);
      expect(result.taskDelta).toBe(0);
    });

  });

});

