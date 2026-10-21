import { getUserTasks } from './taskService';
import { createNotification, hasRecentNotification } from './notificationService';
import { sendImmediateNotification } from './pushNotificationServices'; 
import { toLocalDateKey } from '../utils/dateUtils';

// Default task duration in minutes when no end time is specified
const DEFAULT_TASK_DURATION = 60;

// Number of tasks on a single calendar day that triggers a "busy day" overload warning.
// Set to 3 based on typical student daily capacity — beyond this, same-day load tends to
// correlate with schedule strain. Adjust here to tune the heuristic.
const SAME_DAY_OVERLOAD_THRESHOLD = 3;

// The part of the day the app plans around (also used when suggesting a free slot).
const ACTIVE_DAY_START_HOUR = 7;  // 7:00 AM
const ACTIVE_DAY_END_HOUR = 21;   // 9:00 PM

// When classes take up a third or more of that active day (4 h 40 min of the
// 14 hours), one task fewer is enough to make it a busy day.
const HEAVY_CLASS_DAY_SHARE = 1 / 3;
const HEAVY_CLASS_DAY_THRESHOLD = SAME_DAY_OVERLOAD_THRESHOLD - 1;

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
    // Date-only string: All day task
    const [year, month, day] = task.deadline.split('-').map(Number);
    if (!year || !month || !day) return null;
    const dayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
    const dayEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
    return { start: dayStart, end: dayEnd, isAllDay: true };
  }

  // Timed task
  const start = new Date(task.deadline);
  if (isNaN(start.getTime())) return null;

  let end;
  
  // PRIORITY 1: Use explicit endTime (from class schedules or calculated start+dur)
  if (task.endTime) {
    const parsedEnd = new Date(task.endTime);
    end = !isNaN(parsedEnd.getTime()) && parsedEnd > start ? parsedEnd : null;
  }
  
  // PRIORITY 2: If no endTime, calculate from duration field
  if (!end && task.duration) {
    end = new Date(start.getTime() + task.duration * 60000);
  }
  
  // PRIORITY 3: Fallback to default 60 mins
  if (!end) {
    end = new Date(start.getTime() + DEFAULT_TASK_DURATION * 60000);
  }

  return { start, end, isAllDay: false };
};

/**
 * True when a class-schedule task's session has already ended and its
 * progress is still untouched (0) — i.e. nobody manually edited it. Used to
 * derive a "Done" display/exclude-from-counts treatment for past classes
 * without ever writing progress: 100 to Firestore, so a manual edit (e.g.
 * repurposing a cancelled class into something else) always wins.
 */
export const isElapsedClass = (task) => {
  if (!task?.recurrence?.isClassSchedule) return false;
  if (task.progress > 0) return false;
  const range = getTaskTimeRange(task);
  if (!range) return false;
  return range.end < new Date();
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
    if (isElapsedClass(t)) return false;
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
  // Counts tasks, not classes, so a normal school day of classes is never a
  // "busy day" by itself. Classes still add weight: on a heavy class day the
  // task threshold drops by one.
  const targetIsClass = !!targetTask.recurrence?.isClassSchedule;
  const sameDayTasks = targetIsClass ? [] : otherTasks.filter((t) => {
    if (t.recurrence?.isClassSchedule) return false;
    const taskRange = getTaskTimeRange(t);
    if (!taskRange) return false;
    return isSameDay(taskRange.start, targetRange.start);
  });

  const classMinutes = targetIsClass ? 0 : getClassMinutesOnDay(otherTasks, targetRange.start);
  const isHeavyClassDay = classMinutes >= activeDayMinutes() * HEAVY_CLASS_DAY_SHARE;
  const overloadThreshold = isHeavyClassDay ? HEAVY_CLASS_DAY_THRESHOLD : SAME_DAY_OVERLOAD_THRESHOLD;

  if (sameDayTasks.length >= overloadThreshold) {
    const highPriorityCount = sameDayTasks.filter(
      (t) => t.priorityLabel === 'High' || t.priorityScore >= 70
    ).length;

    const alt = findLeastBusyDay(targetTask.deadline, otherTasks);
    conflicts.push({
      task: null,
      type: 'same_day_high_load',
      severity: highPriorityCount >= 2 ? 'high' : 'medium',
      message: `You already have ${sameDayTasks.length} task${sameDayTasks.length > 1 ? 's' : ''} on this day${highPriorityCount > 0 ? ` (${highPriorityCount} high priority)` : ''}${isHeavyClassDay ? `, on top of ${formatDuration(classMinutes)} of classes` : ''}.`,
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
      // Back-to-back classes are just the timetable, not a tight transition.
      if (targetIsClass && t.recurrence?.isClassSchedule) return false;
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

  // Try 30-minute slots across the active day (7 AM to 9 PM)
  for (let minutes = ACTIVE_DAY_START_HOUR * 60; minutes <= ACTIVE_DAY_END_HOUR * 60; minutes += 30) {
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
    const dateStr = toLocalDateKey(bestDay);
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

const activeDayMinutes = () => (ACTIVE_DAY_END_HOUR - ACTIVE_DAY_START_HOUR) * 60;

/**
 * Total minutes of class on the given day, counting only the part that falls
 * inside the active day (7 AM to 9 PM).
 */
const getClassMinutesOnDay = (tasks, day) => {
  const windowStart = new Date(day);
  windowStart.setHours(ACTIVE_DAY_START_HOUR, 0, 0, 0);
  const windowEnd = new Date(day);
  windowEnd.setHours(ACTIVE_DAY_END_HOUR, 0, 0, 0);

  return tasks.reduce((total, t) => {
    if (!t.recurrence?.isClassSchedule) return total;
    const range = getTaskTimeRange(t);
    if (!range || range.isAllDay || !isSameDay(range.start, day)) return total;
    const start = Math.max(range.start.getTime(), windowStart.getTime());
    const end = Math.min(range.end.getTime(), windowEnd.getTime());
    return end > start ? total + (end - start) / 60000 : total;
  }, 0);
};

// 280 -> "4 h 40 min", 300 -> "5 h"
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
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
  const activeTasks = tasks.filter((t) => t.progress !== 100 && !isElapsedClass(t));  

  for (let i = 0; i < activeTasks.length; i++) {
    const task = activeTasks[i];
    const conflicts = detectConflicts(task, activeTasks, task.id);

    if (conflicts.length > 0) {
      // Local date, same as the Calendar's keys. Splitting the ISO string
      // would give the UTC date, which is the previous day before 8:00 AM
      // in the Philippines.
      const dateKey = task.deadline.includes('T')
        ? toLocalDateKey(new Date(task.deadline))
        : task.deadline;

      const existing = conflictMap.get(dateKey) || [];
      existing.push({ task, conflicts });
      conflictMap.set(dateKey, existing);
    }
  }

  return conflictMap;
};
