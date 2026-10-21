// conflictService imports Firebase through taskService/notificationService;
// mocking them keeps these tests offline.
jest.mock('../../src/services/taskService', () => ({ getUserTasks: jest.fn() }));
jest.mock('../../src/services/notificationService', () => ({
  createNotification: jest.fn(),
  hasRecentNotification: jest.fn(),
}));
jest.mock('../../src/services/pushNotificationServices', () => ({ sendImmediateNotification: jest.fn() }));

import { detectConflicts, detectAllConflicts } from '../../src/services/conflictService';
import { toLocalDateKey } from '../../src/utils/dateUtils';

// A day a week from now, at a given local time, as the ISO string the app saves
const at = (hour, minute = 0, daysFromToday = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const task = (id, hour, extra = {}) => ({
  id, title: `Task ${id}`, deadline: at(hour), category: 'Academic', priority: 'Medium', progress: 0, ...extra,
});

const classSession = (id, hour) => ({
  id, title: `Class ${id}`, deadline: at(hour), endTime: at(hour + 1, 30), category: 'Academic',
  priority: 'Medium', progress: 0, recurrence: { isClassSchedule: true },
});

describe('TC-U02: Conflict Detection', () => {
  test('TC-U02-01: Two tasks at the same time should be a high-severity overlap', () => {
    const conflicts = detectConflicts(task('a', 14), [task('b', 14, { category: 'Organization' })], 'a');
    expect(conflicts.some(c => c.type === 'time_overlap' && c.severity === 'high')).toBe(true);
  });

  test('TC-U02-02: A task during a class should be a class overlap', () => {
    const conflicts = detectConflicts(task('a', 9), [classSession('c', 8)], 'a');
    expect(conflicts.some(c => c.type === 'class_overlap')).toBe(true);
  });

  test('TC-U02-03: Back-to-back tasks should not overlap', () => {
    const first = task('a', 13, { endTime: at(14) });
    const second = task('b', 14);
    const conflicts = detectConflicts(second, [first], 'b');
    expect(conflicts.some(c => c.type === 'time_overlap')).toBe(false);
  });

  test('TC-U02-04: A completed task should not cause a conflict', () => {
    const conflicts = detectConflicts(task('a', 14), [task('b', 14, { progress: 100 })], 'a');
    expect(conflicts).toHaveLength(0);
  });

  test('TC-U02-05: A day with only classes should not be flagged as a conflict', () => {
    const classes = [8, 10, 13, 15].map((h, i) => classSession(`c${i}`, h));
    expect(detectAllConflicts(classes).size).toBe(0);
  });

  test('TC-U02-06: Four tasks on one day should trigger a busy-day warning', () => {
    const tasks = [8, 11, 14, 17].map((h, i) => task(`t${i}`, h));
    const conflicts = detectConflicts(tasks[0], tasks, 't0');
    expect(conflicts.some(c => c.type === 'same_day_high_load')).toBe(true);
  });

  test('TC-U02-07: Classes should not count toward the busy-day warning', () => {
    const tasks = [task('t1', 18), classSession('c1', 8), classSession('c2', 10), classSession('c3', 13)];
    const conflicts = detectConflicts(tasks[0], tasks, 't1');
    expect(conflicts.some(c => c.type === 'same_day_high_load')).toBe(false);
  });

  test('TC-U02-08: A 7:00 AM conflict should be listed under its own local date', () => {
    const a = task('a', 7);
    const b = task('b', 7, { category: 'Organization' });
    const keys = [...detectAllConflicts([a, b]).keys()];
    expect(keys).toEqual([toLocalDateKey(new Date(a.deadline))]);
  });
});