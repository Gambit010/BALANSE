import { getUserTasks } from './taskService';
import { createNotification, hasRecentNotification } from './notificationService';
import { sendImmediateNotification } from './pushNotificationServices'; 

// Default task duration in minutes when no end time is specified
const DEFAULT_TASK_DURATION = 60;

// Number of tasks on a single calendar day that triggers a "busy day" overload warning.
// Set to 3 based on typical student daily capacity — beyond this, same-day load tends to
// correlate with schedule strain. Adjust here to tune the heuristic.
const SAME_DAY_OVERLOAD_THRESHOLD = 3;

/**
 * Parse a task's deadline into a time range { start, end }.
 * - Tasks with time (ISO string containing 'T'): start = deadline, end = start + DEFAULT_TASK_DURATION
 * - Tasks without time (date-only string): treated as all-day tasks
 */
/**
 * Parse a task's deadline into a time range { start, end }.
 * - Timed task (ISO with 'T'): start = deadline (in user's local view), end = start + DEFAULT_TASK_DURATION
 * - Date-only task: treated as all-day in the user's local timezone
 *
 * Returns null if the deadline is missing or invalid.
 */
const getTaskTimeRange = (task) => {
  if (!task || !task.deadline) return null;

  const hasTime = task.deadline.includes('T');

  if (!hasTime) {
    // Date-only string like "2026-04-05" — interpret as local calendar day
    const [year, month, day] = task.deadline.split('-').map(Number);
    if (!year || !month || !day) return null;
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start: dayStart, end: dayEnd, isAllDay: true };
  }

  // Timed task — parse the ISO string (gives UTC instant, comparisons use .getTime() which is timezone-agnostic)
  const start = new Date(task.deadline);
  if (isNaN(start.getTime())) return null;

  // Use the task's real end time when available (class schedules store endTime);
  // otherwise fall back to the default duration.
  let end;
  if (task.endTime) {
    const parsedEnd = new Date(task.endTime);
    end = !isNaN(parsedEnd.getTime()) && parsedEnd > start
      ? parsedEnd
      : new Date(start.getTime() + DEFAULT_TASK_DURATION * 60 * 1000);
  } else {
    end = new Date(start.getTime() + DEFAULT_TASK_DURATION * 60 * 1000);
  }
  return { start, end, isAllDay: false };
};


/**
 * Check if two time ranges overlap.
 */
const rangesOverlap = (range1, range2) => {
  return range1.start < range2.end && range2.start < range1.end;
};

/**
 * Check if two dates fall on the same calendar day in the user's local timezone.
 * Uses local getters so that UTC timestamps are interpreted correctly for display.
 */
const isSameDay = (dateA, dateB) => {
  const a = dateA instanceof Date ? dateA : new Date(dateA);
  const b = dateB instanceof Date ? dateB : new Date(dateB);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
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

  // Guard: invalid target deadline — nothing to compare
  if (!targetRange) return conflicts;

  const targetHasTime = targetTask.deadline && targetTask.deadline.includes('T');

  // Filter out the task itself (for edit mode), completed tasks, and tasks with invalid deadlines
  const otherTasks = existingTasks.filter((t) => {
    if (t.id === targetTaskId) return false;
    if (t.progress === 100) return false;
    if (!t.deadline) return false;
    return true;
  });

  // --- 1. Direct time overlap detection ---
  if (targetHasTime) {
    for (const task of otherTasks) {
      const taskHasTime = task.deadline && task.deadline.includes('T');
      if (!taskHasTime) continue;

      const taskRange = getTaskTimeRange(task);
      if (!taskRange) continue; // Skip invalid

      if (rangesOverlap(targetRange, taskRange)) {
        const isCrossCategory = task.category !== targetTask.category;
        const isClass = task.recurrence?.isClassSchedule;
        const alt = suggestAlternativeTime(targetRange, otherTasks);
        conflicts.push({
          task,
          type: isClass ? 'class_overlap' : 'time_overlap',
          severity: 'high',
          message: isClass
            ? `Overlaps your "${task.title}" class (${formatTime(taskRange.start)} - ${formatTime(taskRange.end)}).`
            : `"${task.title}" is scheduled at the same time (${formatTime(taskRange.start)} - ${formatTime(taskRange.end)})${isCrossCategory ? ` in ${task.category}` : ''}.`,
          suggestion: isClass
            ? `Classes are fixed commitments. ${alt.message}`
            : alt.message,
          suggestedSlot: alt.slot,
        });
      }
    }
  }

  // --- 2. Same-day overload detection ---
  const sameDayTasks = otherTasks.filter((t) => {
    const taskRange = getTaskTimeRange(t);
    if (!taskRange) return false;
    return isSameDay(taskRange.start, targetRange.start);
  });

  if (sameDayTasks.length >= SAME_DAY_OVERLOAD_THRESHOLD) {
    const highPriorityCount = sameDayTasks.filter(
      (t) => t.priorityLabel === 'High' || t.priorityScore >= 70
    ).length;

    const alt = findLeastBusyDay(targetTask.deadline, otherTasks);
    conflicts.push({
      task: null,
      type: 'same_day_high_load',
      severity: highPriorityCount >= 2 ? 'high' : 'medium',
      message: `You already have ${sameDayTasks.length} task${sameDayTasks.length > 1 ? 's' : ''} on this day${highPriorityCount > 0 ? ` (${highPriorityCount} high priority)` : ''}.`,
      suggestion: alt.message,
      suggestedSlot: alt.slot,
    });
  }

  // --- 3. Cross-domain near-overlap detection (within 30 min buffer) ---
  if (targetHasTime) {
    const buffer = 30 * 60 * 1000;
    const bufferedTarget = {
      start: new Date(targetRange.start.getTime() - buffer),
      end: new Date(targetRange.end.getTime() + buffer),
    };

    const crossDomainConflicts = otherTasks.filter((t) => {
      if (t.category === targetTask.category) return false;
      const taskHasTime = t.deadline && t.deadline.includes('T');
      if (!taskHasTime) return false;

      const taskRange = getTaskTimeRange(t);
      if (!taskRange) return false;

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
        suggestedSlot: null,
      });
    }
  }

  return conflicts;
};

/**
 * Find an alternative time slot on the same day that doesn't conflict.
 * Checks 30-minute slots from 7:00 AM to 9:00 PM, skipping slots in the past.
 * Returns { message, slot } where slot is actionable data for one-tap apply.
 */
const suggestAlternativeTime = (targetRange, otherTasks) => {
  const targetDate = new Date(targetRange.start);
  const duration = targetRange.end.getTime() - targetRange.start.getTime();
  const now = new Date();
  const isToday = isSameDay(targetDate, now);

  // Get all timed tasks on the same day as ranges
  const sameDayTimedTasks = otherTasks
    .map((t) => getTaskTimeRange(t))
    .filter((r) => r && !r.isAllDay && isSameDay(r.start, targetDate));

  // Try 30-minute slots from 7 AM to 9 PM
  for (let minutes = 7 * 60; minutes <= 21 * 60; minutes += 30) {
    const slotStart = new Date(targetDate);
    slotStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + duration);

    // Skip slots that are already in the past (relevant when task is for today)
    if (isToday && slotStart <= now) continue;

    const candidate = { start: slotStart, end: slotEnd };
    const hasConflict = sameDayTimedTasks.some((r) => rangesOverlap(candidate, r));

    if (!hasConflict) {
      const label = formatTime(slotStart);
      return {
        message: `Try ${label} instead — that slot is open.`,
        slot: { type: 'time', value: slotStart.toISOString(), label },
      };
    }
  }

  return {
    message: 'No open slots found on this day. Consider moving this task to another day.',
    slot: null,
  };
};
/**
 * Find the least busy nearby day (within +/- 3 days).
 * Returns { message, slot } where slot is actionable data for one-tap apply.
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
      if (!t.deadline) return false;
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
    const dateStr = bestDay.toISOString().split('T')[0];
    return {
      message: `${dayName} has ${bestCount === 0 ? 'no' : `only ${bestCount}`} task${bestCount !== 1 ? 's' : ''} — consider moving this task there.`,
      slot: { type: 'date', value: dateStr, label: dayName },
    };
  }

  return {
    message: 'Try spreading tasks across different days to reduce overload.',
    slot: null,
  };
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
/**
 * Check for conflicts and create notifications for high-severity ones.
 * Dedupes: skips if an identical notification was created in the last 24 hours.
 * Call this after saving a task.
 */
export const checkAndNotifyConflicts = async (userId, savedTask, existingTasks) => {
  const conflicts = detectConflicts(savedTask, existingTasks, savedTask.id);
  const highConflicts = conflicts.filter((c) => c.severity === 'high');

  for (const conflict of highConflicts) {
    let message;
    if (conflict.type === 'class_overlap') {
      message = `Class conflict: "${savedTask.title}" overlaps your "${conflict.task.title}" class.`;
    } else if (conflict.type === 'time_overlap') {
      message = `Schedule conflict: "${savedTask.title}" overlaps with ${conflict.message}`;
    } else {
      message = `Busy day alert: ${conflict.message}`;
    }

    // Dedupe: skip if the same notification was already created recently
    const isDuplicate = await hasRecentNotification(userId, message);
    if (isDuplicate) continue;

    await createNotification(userId, message, 'conflict');
    await sendImmediateNotification('Scheduling conflict', message, {
      type: 'conflict',
      taskId: savedTask.id,
    });
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
