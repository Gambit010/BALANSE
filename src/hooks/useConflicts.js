import { useState, useEffect, useCallback } from 'react';
import { detectConflicts, detectAllConflicts } from '../services/conflictService';

/**
 * Build a lightweight fingerprint of the task list so useEffect
 * re-runs whenever any task's deadline/category/progress changes,
 * not just when the array length changes.
 */
const getTasksFingerprint = (tasks) => {
  if (!tasks || tasks.length === 0) return '';
  return tasks
    .map((t) => `${t.id}|${t.deadline}|${t.category}|${t.progress}`)
    .join(';');
};

/**
 * Hook to detect conflicts for a specific task being created/edited.
 */
export const useTaskConflicts = (taskData, existingTasks) => {
  const [conflicts, setConflicts] = useState([]);

  const tasksFingerprint = getTasksFingerprint(existingTasks);

  useEffect(() => {
    if (!taskData || !taskData.deadline || !existingTasks || existingTasks.length === 0) {
      setConflicts([]);
      return;
    }

    try {
      const detected = detectConflicts(taskData, existingTasks, taskData.id || null);
      setConflicts(detected);
    } catch (err) {
      console.warn('Conflict detection failed:', err.message);
      setConflicts([]);
    }
  }, [taskData?.deadline, taskData?.category, taskData?.id, tasksFingerprint]);

  const highConflicts = conflicts.filter((c) => c.severity === 'high');
  const mediumConflicts = conflicts.filter((c) => c.severity === 'medium');
  const lowConflicts = conflicts.filter((c) => c.severity === 'low');

  return {
    conflicts,
    highConflicts,
    mediumConflicts,
    lowConflicts,
    hasConflicts: conflicts.length > 0,
    hasHighConflicts: highConflicts.length > 0,
  };
};


/**
 * Hook to detect all conflicts across all tasks (for calendar view).
 */
export const useAllConflicts = (tasks) => {
  const [conflictMap, setConflictMap] = useState(new Map());

  const refresh = useCallback(() => {
    if (!tasks || tasks.length === 0) {
      setConflictMap(new Map());
      return;
    }
    const map = detectAllConflicts(tasks);
    setConflictMap(map);
  }, [tasks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getConflictsForDate = (dateString) => {
    return conflictMap.get(dateString) || [];
  };

  const hasConflictsOnDate = (dateString) => {
    return conflictMap.has(dateString);
  };

  return {
    conflictMap,
    getConflictsForDate,
    hasConflictsOnDate,
    refresh,
  };
};
