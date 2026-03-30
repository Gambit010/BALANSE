import { useState, useEffect, useCallback } from 'react';
import { detectConflicts, detectAllConflicts } from '../services/conflictService';

/**
 * Hook to detect conflicts for a specific task being created/edited.
 */
export const useTaskConflicts = (taskData, existingTasks) => {
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    if (!taskData || !taskData.deadline || !existingTasks.length) {
      setConflicts([]);
      return;
    }

    const detected = detectConflicts(taskData, existingTasks, taskData.id || null);
    setConflicts(detected);
  }, [taskData?.deadline, taskData?.category, existingTasks.length]);

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
