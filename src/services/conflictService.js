import { getUserTasks } from './taskService';
import { createNotification } from './notificationService';

// Default task duration in minutes when no end time is specified
const DEFAULT_TASK_DURATION = 60;

/**
 * Parse a task's deadline into a time range { start, end }.
 * - Tasks with time (ISO string containing 'T'): start = deadline, end = start + DEFAULT_TASK_DURATION
 * - Tasks without time (date-only string): treated as all-day tasks
 */
const getTaskTimeRange = (task) => {
  const hasTime = task.deadline && task.deadline.includes('T');

  if (!hasTime) {
    const dayStart = new Date(task.deadline + 'T00:00:00');
    const dayEnd = new Date(task.deadline + 'T23:59:59');
    return { start: dayStart, end: dayEnd, isAllDay: true };
  }

  const start = new Date(task.deadline);
  const end = new Date(start.getTime() + DEFAULT_TASK_DURATION * 60 * 1000);
  return { start, end, isAllDay: false };
};

/**
 * Check if two time ranges overlap.
 */
const rangesOverlap = (range1, range2) => {
  return range1.start < range2.end && range2.start < range1.end;
};

const isSameDay = (dateA, dateB) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

/**
 * Detect conflicts between a target task and a list of existing tasks.
 *
 * Returns an array of conflict objects:
 * {
 *   task: <the conflicting task>,
 *   type: 'time_overlap' | 'same_day_high_load' | 'near_overlap',
 *   severity: 'high' | 'medium' | 'low',
 *   message: string,
 *   suggestion: string,
 * }
 */
export const detectConflicts = (targetTask, existingTasks, targetTaskId = null) => {
  const conflicts = [];
  const targetRange = getTaskTimeRange(targetTask);
  const targetHasTime = targetTask.deadline && targetTask.deadline.includes('T');

  // Filter out the task itself (for edit mode) and completed tasks
  const otherTasks = existingTasks.filter(
    (t) => t.id !== targetTaskId && t.progress !== 100
  );

  // --- 1. Direct time overlap detection ---
  if (targetHasTime) {
    for (const task of otherTasks) {
      const taskHasTime = task.deadline && task.deadline.includes('T');
      if (!taskHasTime) continue;

      const taskRange = getTaskTimeRange(task);

      if (rangesOverlap(targetRange, taskRange)) {
        const isCrossCategory = task.category !== targetTask.category;
        conflicts.push({
          task,
          type: 'time_overlap',
          severity: 'high',
          message: `"${task.title}" is scheduled at the same time (${formatTime(taskRange.start)} - ${formatTime(taskRange.end)})${isCrossCategory ? ` in ${task.category}` : ''}.`,
          suggestion: suggestAlternativeTime(targetRange, otherTasks),
        });
      }
    }
  }

  // --- 2. Same-day overload detection ---
  const sameDayTasks = otherTasks.filter((t) => {
    const taskDeadline = t.deadline.includes('T') ? t.deadline : t.deadline + 'T12:00:00';
    const targetDeadline = targetTask.deadline.includes('T')
      ? targetTask.deadline
      : targetTask.deadline + 'T12:00:00';
    return isSameDay(taskDeadline, targetDeadline);
  });

  if (sameDayTasks.length >= 3) {
    const highPriorityCount = sameDayTasks.filter(
      (t) => t.priorityLabel === 'High' || t.priorityScore >= 70
    ).length;

    conflicts.push({
      task: null,
      type: 'same_day_high_load',
      severity: highPriorityCount >= 2 ? 'high' : 'medium',
      message: `You already have ${sameDayTasks.length} task${sameDayTasks.length > 1 ? 's' : ''} on this day${highPriorityCount > 0 ? ` (${highPriorityCount} high priority)` : ''}.`,
      suggestion: findLeastBusyDay(targetTask.deadline, otherTasks),
    });
  }

  // --- 3. Cross-domain near-overlap detection (within 30 min buffer) ---
  if (targetHasTime) {
    const crossDomainConflicts = otherTasks.filter((t) => {
      if (t.category === targetTask.category) return false;
      const taskHasTime = t.deadline && t.deadline.includes('T');
      if (!taskHasTime) return false;

      const taskRange = getTaskTimeRange(t);
      const buffer = 30 * 60 * 1000;
      const bufferedTarget = {
        start: new Date(targetRange.start.getTime() - buffer),
        end: new Date(targetRange.end.getTime() + buffer),
      };
      return rangesOverlap(bufferedTarget, taskRange);
    });

    for (const task of crossDomainConflicts) {
      if (conflicts.some((c) => c.type === 'time_overlap' && c.task?.id === task.id)) continue;

      conflicts.push({
        task,
        type: 'near_overlap',
        severity: 'low',
        message: `"${task.title}" (${task.category}) is scheduled within 30 minutes — tight transition between ${targetTask.category} and ${task.category}.`,
        suggestion: 'Consider adding buffer time between tasks from different domains.',
      });
    }
  }

  return conflicts;
};

/**
 * Find an alternative time slot on the same day that doesn't conflict.
 */
const suggestAlternativeTime = (targetRange, otherTasks) => {
  const targetDate = new Date(targetRange.start);
  const duration = targetRange.end.getTime() - targetRange.start.getTime();

  const sameDayTimedTasks = otherTasks
    .filter((t) => {
      if (!t.deadline || !t.deadline.includes('T')) return false;
      return isSameDay(new Date(t.deadline), targetDate);
    })
    .map((t) => getTaskTimeRange(t));

  for (let hour = 7; hour <= 21; hour++) {
    const slotStart = new Date(targetDate);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + duration);

    const candidate = { start: slotStart, end: slotEnd };
    const hasConflict = sameDayTimedTasks.some((r) => rangesOverlap(candidate, r));

    if (!hasConflict) {
      return `Try ${formatTime(slotStart)} instead — that slot is open.`;
    }
  }

  return 'No open slots found on this day. Consider moving this task to another day.';
};

/**
 * Find the least busy nearby day (within +/- 3 days).
 */
const findLeastBusyDay = (deadline, allTasks) => {
  const baseDate = new Date(deadline.includes('T') ? deadline : deadline + 'T12:00:00');
  let bestDay = null;
  let bestCount = Infinity;

  for (let offset = -3; offset <= 3; offset++) {
    if (offset === 0) continue;
    const candidate = new Date(baseDate);
    candidate.setDate(candidate.getDate() + offset);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (candidate < today) continue;

    const count = allTasks.filter((t) => {
      const d = t.deadline.includes('T') ? t.deadline : t.deadline + 'T12:00:00';
      return isSameDay(new Date(d), candidate);
    }).length;

    if (count < bestCount) {
      bestCount = count;
      bestDay = candidate;
    }
  }

  if (bestDay) {
    const dayName = bestDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return `${dayName} has ${bestCount === 0 ? 'no' : `only ${bestCount}`} task${bestCount !== 1 ? 's' : ''} — consider moving this task there.`;
  }

  return 'Try spreading tasks across different days to reduce overload.';
};

const formatTime = (date) => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Check for conflicts and create notifications for high-severity ones.
 * Call this after saving a task.
 */
export const checkAndNotifyConflicts = async (userId, savedTask, existingTasks) => {
  const conflicts = detectConflicts(savedTask, existingTasks, savedTask.id);

  const highConflicts = conflicts.filter((c) => c.severity === 'high');

  for (const conflict of highConflicts) {
    const message = conflict.type === 'time_overlap'
      ? `Schedule conflict: "${savedTask.title}" overlaps with ${conflict.message}`
      : `Busy day alert: ${conflict.message}`;

    await createNotification(userId, message, 'conflict');
  }

  return conflicts;
};

/**
 * Get all conflicts across all tasks (for calendar overview).
 * Returns a Map of dateString -> conflict[]
 */
export const detectAllConflicts = (tasks) => {
  const conflictMap = new Map();
  const activeTasks = tasks.filter((t) => t.progress !== 100);

  for (let i = 0; i < activeTasks.length; i++) {
    const task = activeTasks[i];
    const conflicts = detectConflicts(task, activeTasks, task.id);

    if (conflicts.length > 0) {
      const dateKey = task.deadline.includes('T')
        ? task.deadline.split('T')[0]
        : task.deadline;

      const existing = conflictMap.get(dateKey) || [];
      existing.push({ task, conflicts });
      conflictMap.set(dateKey, existing);
    }
  }

  return conflictMap;
};
