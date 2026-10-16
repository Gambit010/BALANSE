import { useState, useRef, useEffect, useCallback } from 'react';

// Hides an item right away and only runs onCommit once the undo window
// closes, so "Undo" never has to recreate anything in Firestore.
export const useUndoDelete = (onCommit, windowMs = 5000) => {
  const [pendingDelete, setPendingDelete] = useState(null);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    const item = pendingRef.current;
    pendingRef.current = null;
    setPendingDelete(null);
    if (item) onCommitRef.current(item);
  }, []);

  const scheduleDelete = useCallback((item) => {
    flush(); // a second delete inside the window finalizes the first one
    pendingRef.current = item;
    setPendingDelete(item);
    timerRef.current = setTimeout(flush, windowMs);
  }, [flush, windowMs]);

  const undoDelete = useCallback(() => {
    clearTimeout(timerRef.current);
    pendingRef.current = null;
    setPendingDelete(null);
  }, []);

  // Leaving the screen mid-window still completes the delete.
  useEffect(() => flush, [flush]);

  return { pendingDelete, scheduleDelete, undoDelete };
};