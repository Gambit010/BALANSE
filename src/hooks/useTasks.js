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

      // Sort by priority score — highest first
      const sortedTasks = scoredTasks.sort(
        (a, b) => b.priorityScore - a.priorityScore
      );

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
