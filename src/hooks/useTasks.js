import { useState, useEffect } from 'react';
import { auth } from '../../firebase';
import { getUserTasks } from '../services/taskService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setTasks([]);
        return;
      }

      const rawTasks = await getUserTasks(currentUser.uid);

      // Compute priority score for each task
      const scoredTasks = rawTasks.map(task => {
        const score = computePriorityScore(task);
        return {
          ...task,
          priorityScore: score,
          priorityLabel: getPriorityLabel(score),
        };
      });

      // Sort by priority score — highest first.
      // Tie-breaker: tasks already in progress rank above not-yet-started ones.
      const sortedTasks = scoredTasks.sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        const aStarted = a.progress > 0 && a.progress < 100 ? 1 : 0;
        const bStarted = b.progress > 0 && b.progress < 100 ? 1 : 0;
        return bStarted - aStarted;
      });

      setTasks(sortedTasks);
    } catch (err) {
      setError(err.message);
      console.error('Error in useTasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return { tasks, loading, error, refetch: fetchTasks };
};
