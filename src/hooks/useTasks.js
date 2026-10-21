import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { auth } from '../../firebase';
import { getUserTasks } from '../services/taskService';
import { computePriorityScore, getPriorityLabel } from '../constants/scoring';

// Several screens load tasks at once, so the alert is shown at most once a minute.
let lastLoadAlert = 0;
const showLoadError = (err) => {
  if (Date.now() - lastLoadAlert < 60000) return;
  lastLoadAlert = Date.now();
  if (err?.code === 'resource-exhausted') {
    Alert.alert(
      'BALANSE is busy right now',
      'The app has reached its usage limit for today. Your tasks are safe. Please try again later and let the BALANSE team know.'
    );
  } else {
    Alert.alert(
      "Couldn't load your tasks",
      'Your tasks are safe. Check your internet connection and try again.'
    );
  }
};

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

      const rawTasks = await getUserTasks(currentUser.uid, { throwOnError: true });

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
      // Keep the list that's already on screen instead of clearing it.
      setError(err.message);
      console.error('Error in useTasks:', err);
      showLoadError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return { tasks, loading, error, refetch: fetchTasks };
};