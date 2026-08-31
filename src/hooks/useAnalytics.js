import { useMemo } from 'react';
import { useTasks } from './useTasks';
import { useWellness } from './useWellness';
import {
  computeTaskStats,
  computeCategoryBreakdown,
  computeWeeklyCompletions,
  computePriorityDistribution,
  computeWellnessTrend,
  computeWellnessWorkloadCorrelation,
  computeWeekdayHeatmap,
  computeWeeklyReport,
  generatePersonalizedInsights,
  generateExportSummary,
} from '../services/analyticsService';

export const useAnalytics = () => {
  const { tasks, loading: tasksLoading } = useTasks();
  const { history: wellnessHistory, loading: wellnessLoading } = useWellness();

  const loading = tasksLoading || wellnessLoading;

  const taskStats = useMemo(
    () => (loading ? null : computeTaskStats(tasks)),
    [tasks, loading]
  );

  const categoryBreakdown = useMemo(
    () => (loading ? [] : computeCategoryBreakdown(tasks)),
    [tasks, loading]
  );

  const weeklyCompletions = useMemo(
    () => (loading ? [] : computeWeeklyCompletions(tasks, 4)),
    [tasks, loading]
  );

  const priorityDistribution = useMemo(
    () => (loading ? [] : computePriorityDistribution(tasks)),
    [tasks, loading]
  );

  const wellnessTrend = useMemo(
    () => (loading ? [] : computeWellnessTrend(wellnessHistory)),
    [wellnessHistory, loading]
  );

  const correlation = useMemo(
    () => (loading ? [] : computeWellnessWorkloadCorrelation(tasks, wellnessHistory)),
    [tasks, wellnessHistory, loading]
  );

  const weekdayHeatmap = useMemo(
    () => (loading ? [] : computeWeekdayHeatmap(tasks)),
    [tasks, loading]
  );

  const weeklyReport = useMemo(
    () => (loading ? null : computeWeeklyReport(tasks, wellnessHistory)),
    [tasks, wellnessHistory, loading]
  );

  const insights = useMemo(
    () => (loading ? [] : generatePersonalizedInsights(tasks, wellnessHistory)),
    [tasks, wellnessHistory, loading]
  );

  const exportSummary = useMemo(
    () => (loading ? '' : generateExportSummary(tasks, wellnessHistory)),
    [tasks, wellnessHistory, loading]
  );

  return {
    loading,
    taskStats,
    categoryBreakdown,
    weeklyCompletions,
    priorityDistribution,
    wellnessTrend,
    correlation,
    weekdayHeatmap,
    weeklyReport,
    insights,
    exportSummary,
  };
};