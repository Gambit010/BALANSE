import { detectAllConflicts } from './conflictService';

// ──────────────────────────────────────────────
// HELPER: Get the Monday (start) of a given week
// ──────────────────────────────────────────────
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ──────────────────────────────────────────────
// HELPER: Format a date as "MMM D" (e.g. "Jun 9")
// ──────────────────────────────────────────────
const formatShortDate = (date) => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ──────────────────────────────────────────────
// HELPER: Parse Firestore createdAt into a Date
// ──────────────────────────────────────────────
const parseCreatedAt = (createdAt) => {
  if (!createdAt) return null;
  if (createdAt.toDate) return createdAt.toDate();
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? null : d;
};

// ──────────────────────────────────────────────
// HELPER: Filter out class schedule tasks
// ──────────────────────────────────────────────
const excludeClassSchedules = (tasks) => {
  return tasks.filter(t => !t.recurrence?.isClassSchedule);
};

// ══════════════════════════════════════════════
// 1. TASK STATS — Overall completion metrics
// ══════════════════════════════════════════════
export const computeTaskStats = (tasks) => {
  const regular = excludeClassSchedules(tasks);
  const total = regular.length;
  const completed = regular.filter(t => t.progress === 100).length;
  const inProgress = regular.filter(t => t.progress > 0 && t.progress < 100).length;
  const notStarted = regular.filter(t => t.progress === 0).length;

  const now = new Date();
  const overdue = regular.filter(t => {
    if (t.progress === 100) return false;
    if (!t.deadline) return false;
    const dl = new Date(t.deadline);
    return dl < now;
  }).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, inProgress, notStarted, overdue, completionRate };
};

// ══════════════════════════════════════════════
// 2. CATEGORY BREAKDOWN — Per-domain stats
// ══════════════════════════════════════════════
export const computeCategoryBreakdown = (tasks) => {
  const regular = excludeClassSchedules(tasks);
  const categories = ['Academic', 'Organization', 'Personal'];

  return categories.map(cat => {
    const catTasks = regular.filter(t => t.category === cat);
    const total = catTasks.length;
    const completed = catTasks.filter(t => t.progress === 100).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { category: cat, total, completed, active: total - completed, completionRate: rate };
  });
};

// ══════════════════════════════════════════════
// 3. WEEKLY COMPLETIONS — For bar chart
// ══════════════════════════════════════════════
export const computeWeeklyCompletions = (tasks, numWeeks = 4) => {
  const regular = excludeClassSchedules(tasks);
  const now = new Date();
  const weeks = [];

  for (let i = numWeeks - 1; i >= 0; i--) {
    const weekStart = getWeekStart(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const completed = regular.filter(t => {
      if (t.progress !== 100) return false;
      const created = parseCreatedAt(t.createdAt);
      if (!created) return false;
      return created >= weekStart && created < weekEnd;
    }).length;

    const added = regular.filter(t => {
      const created = parseCreatedAt(t.createdAt);
      if (!created) return false;
      return created >= weekStart && created < weekEnd;
    }).length;

    weeks.push({
      label: formatShortDate(weekStart),
      weekStart: weekStart.toISOString(),
      completed,
      added,
    });
  }

  return weeks;
};

// ══════════════════════════════════════════════
// 4. PRIORITY DISTRIBUTION — For pie chart
// ══════════════════════════════════════════════
export const computePriorityDistribution = (tasks) => {
  const regular = excludeClassSchedules(tasks);
  const active = regular.filter(t => t.progress < 100);

  const high = active.filter(t => t.priorityLabel === 'High' || t.priorityScore >= 70).length;
  const medium = active.filter(t => {
    const score = t.priorityScore ?? 0;
    const label = t.priorityLabel;
    return (label === 'Medium' || (score >= 40 && score < 70)) && score < 70;
  }).length;
  const low = active.filter(t => {
    const score = t.priorityScore ?? 0;
    return t.priorityLabel === 'Low' || score < 40;
  }).length;

  return [
    { label: 'High', count: high, color: '#ef4444' },
    { label: 'Medium', count: medium, color: '#f59e0b' },
    { label: 'Low', count: low, color: '#22c55e' },
  ];
};

// ══════════════════════════════════════════════
// 5. WELLNESS TREND — For line chart
// ══════════════════════════════════════════════
export const computeWellnessTrend = (wellnessHistory) => {
  if (!wellnessHistory || wellnessHistory.length === 0) return [];

  return wellnessHistory
    .slice()
    .reverse()
    .map(entry => {
      const date = entry.date instanceof Date
        ? entry.date
        : (entry.createdAt?.toDate?.() ?? new Date(entry.createdAt));

      return {
        label: formatShortDate(date),
        date: date.toISOString(),
        percentage: entry.percentage ?? (entry.rawScore ? entry.rawScore * 4 : 0),
        status: entry.status ?? 'unknown',
      };
    });
};

// ══════════════════════════════════════════════
// 6. WELLNESS–WORKLOAD CORRELATION
//    Pairs each wellness assessment with the
//    active task count at that point in time.
//    This is the thesis differentiator.
// ══════════════════════════════════════════════
export const computeWellnessWorkloadCorrelation = (tasks, wellnessHistory) => {
  if (!wellnessHistory || wellnessHistory.length === 0) return [];

  const regular = excludeClassSchedules(tasks);

  return wellnessHistory
    .slice()
    .reverse()
    .map(entry => {
      const entryDate = entry.date instanceof Date
        ? entry.date
        : (entry.createdAt?.toDate?.() ?? new Date(entry.createdAt));

      const activeAtTime = regular.filter(t => {
        const created = parseCreatedAt(t.createdAt);
        if (!created || created > entryDate) return false;
        if (t.progress === 100) {
          const deadline = t.deadline ? new Date(t.deadline) : null;
          if (deadline && deadline < entryDate) return false;
        }
        return t.progress < 100 || (t.deadline && new Date(t.deadline) >= entryDate);
      }).length;

      return {
        label: formatShortDate(entryDate),
        date: entryDate.toISOString(),
        wellnessPercentage: entry.percentage ?? (entry.rawScore ? entry.rawScore * 4 : 0),
        activeTaskCount: activeAtTime,
      };
    });
};

// ══════════════════════════════════════════════
// 7. WEEKDAY HEATMAP — Which days are busiest
// ══════════════════════════════════════════════
export const computeWeekdayHeatmap = (tasks) => {
  const regular = excludeClassSchedules(tasks);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = new Array(7).fill(0);

  regular.forEach(t => {
    if (!t.deadline) return;
    const d = new Date(t.deadline);
    if (!isNaN(d.getTime())) {
      counts[d.getDay()]++;
    }
  });

  const maxCount = Math.max(...counts, 1);

  return dayNames.map((name, i) => ({
    day: name,
    count: counts[i],
    intensity: counts[i] / maxCount,
  }));
};

// ══════════════════════════════════════════════
// 8. WEEKLY REPORT — This week vs last week
// ══════════════════════════════════════════════
export const computeWeeklyReport = (tasks, wellnessHistory) => {
  const regular = excludeClassSchedules(tasks);
  const now = new Date();

  const thisWeekStart = getWeekStart(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);

  const isInRange = (dateInput, start, end) => {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return d >= start && d < end;
  };

  const thisWeekTasks = regular.filter(t => {
    const created = parseCreatedAt(t.createdAt);
    return created && isInRange(created, thisWeekStart, thisWeekEnd);
  });

  const lastWeekTasks = regular.filter(t => {
    const created = parseCreatedAt(t.createdAt);
    return created && isInRange(created, lastWeekStart, thisWeekStart);
  });

  const thisCompleted = thisWeekTasks.filter(t => t.progress === 100).length;
  const lastCompleted = lastWeekTasks.filter(t => t.progress === 100).length;
  const thisAdded = thisWeekTasks.length;
  const lastAdded = lastWeekTasks.length;

  const conflictMap = detectAllConflicts(regular.filter(t => t.progress < 100));
  let currentConflicts = 0;
  conflictMap.forEach(arr => { currentConflicts += arr.length; });

  const latestWellness = wellnessHistory.length > 0 ? wellnessHistory[0] : null;
  const previousWellness = wellnessHistory.length > 1 ? wellnessHistory[1] : null;

  const wellnessChange = (latestWellness && previousWellness)
    ? (latestWellness.percentage ?? 0) - (previousWellness.percentage ?? 0)
    : null;

  return {
    period: `${formatShortDate(thisWeekStart)} – ${formatShortDate(now)}`,
    thisWeek: { completed: thisCompleted, added: thisAdded },
    lastWeek: { completed: lastCompleted, added: lastAdded },
    completionDelta: thisCompleted - lastCompleted,
    addedDelta: thisAdded - lastAdded,
    activeConflicts: currentConflicts,
    wellness: {
      current: latestWellness?.percentage ?? null,
      change: wellnessChange,
      status: latestWellness?.status ?? null,
    },
  };
};

// ══════════════════════════════════════════════
// 9. PERSONALIZED INSIGHTS — Pattern detection
// ══════════════════════════════════════════════
export const generatePersonalizedInsights = (tasks, wellnessHistory) => {
  const insights = [];
  const regular = excludeClassSchedules(tasks);

  // --- Insight: Most productive day of the week ---
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const completedByDay = new Array(7).fill(0);
  regular.filter(t => t.progress === 100).forEach(t => {
    const created = parseCreatedAt(t.createdAt);
    if (created) completedByDay[created.getDay()]++;
  });
  const maxDayCount = Math.max(...completedByDay);
  if (maxDayCount > 0) {
    const bestDayIndex = completedByDay.indexOf(maxDayCount);
    insights.push({
      icon: 'trending-up-outline',
      text: `You complete the most tasks on ${dayNames[bestDayIndex]}s (${maxDayCount} total).`,
      type: 'productivity',
    });
  }

  // --- Insight: Category strength ---
  const categories = ['Academic', 'Organization', 'Personal'];
  let bestCat = null;
  let bestRate = 0;
  categories.forEach(cat => {
    const catTasks = regular.filter(t => t.category === cat);
    if (catTasks.length < 2) return;
    const rate = catTasks.filter(t => t.progress === 100).length / catTasks.length;
    if (rate > bestRate) {
      bestRate = rate;
      bestCat = cat;
    }
  });
  if (bestCat && bestRate > 0) {
    insights.push({
      icon: 'ribbon-outline',
      text: `Your strongest category is ${bestCat} with a ${Math.round(bestRate * 100)}% completion rate.`,
      type: 'category',
    });
  }

  // --- Insight: Overdue pattern ---
  const now = new Date();
  const overdueTasks = regular.filter(t => {
    if (t.progress === 100 || !t.deadline) return false;
    return new Date(t.deadline) < now;
  });
  if (overdueTasks.length >= 3) {
    const overdueCategories = {};
    overdueTasks.forEach(t => {
      overdueCategories[t.category] = (overdueCategories[t.category] || 0) + 1;
    });
    const worstCat = Object.entries(overdueCategories).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      icon: 'alert-circle-outline',
      text: `You have ${overdueTasks.length} overdue tasks — most are in ${worstCat[0]} (${worstCat[1]}).`,
      type: 'warning',
    });
  }

  // --- Insight: Wellness-workload relationship ---
  if (wellnessHistory.length >= 2) {
    const correlation = computeWellnessWorkloadCorrelation(tasks, wellnessHistory);
    const highLoad = correlation.filter(p => p.activeTaskCount >= 5);
    const lowLoad = correlation.filter(p => p.activeTaskCount < 5);

    if (highLoad.length > 0 && lowLoad.length > 0) {
      const avgHighLoad = highLoad.reduce((s, p) => s + p.wellnessPercentage, 0) / highLoad.length;
      const avgLowLoad = lowLoad.reduce((s, p) => s + p.wellnessPercentage, 0) / lowLoad.length;

      if (avgLowLoad - avgHighLoad > 8) {
        insights.push({
          icon: 'heart-circle-outline',
          text: `Your well-being averages ${Math.round(avgLowLoad)}% with fewer tasks vs ${Math.round(avgHighLoad)}% when overloaded.`,
          type: 'wellness',
        });
      }
    }
  }

  // --- Insight: Streak ---
  const completedDates = regular
    .filter(t => t.progress === 100)
    .map(t => parseCreatedAt(t.createdAt))
    .filter(Boolean)
    .sort((a, b) => b - a);

  if (completedDates.length > 0) {
    let streak = 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const latestCompletion = new Date(completedDates[0]);
    latestCompletion.setHours(0, 0, 0, 0);

    const diffFromToday = Math.round((today - latestCompletion) / (1000 * 60 * 60 * 24));
    if (diffFromToday <= 1) {
      for (let i = 1; i < completedDates.length; i++) {
        const prev = new Date(completedDates[i - 1]);
        const curr = new Date(completedDates[i]);
        prev.setHours(0, 0, 0, 0);
        curr.setHours(0, 0, 0, 0);
        const gap = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
        if (gap <= 1) streak++;
        else break;
      }
    }

    if (streak >= 3) {
      insights.push({
        icon: 'flame-outline',
        text: `You're on a ${streak}-day task completion streak! Keep it going.`,
        type: 'streak',
      });
    }
  }

  return insights;
};

// ══════════════════════════════════════════════
// 10. EXPORT SUMMARY — Shareable text report
// ══════════════════════════════════════════════
export const generateExportSummary = (tasks, wellnessHistory) => {
  const stats = computeTaskStats(tasks);
  const categories = computeCategoryBreakdown(tasks);
  const report = computeWeeklyReport(tasks, wellnessHistory);
  const insights = generatePersonalizedInsights(tasks, wellnessHistory);

  const lines = [
    '📊 BALANSE — Weekly Summary Report',
    `📅 ${report.period}`,
    '',
    '── Task Overview ──',
    `Total tasks: ${stats.total}`,
    `Completed: ${stats.completed} (${stats.completionRate}%)`,
    `In progress: ${stats.inProgress}`,
    `Overdue: ${stats.overdue}`,
    '',
    '── By Category ──',
    ...categories.map(c => `${c.category}: ${c.completed}/${c.total} completed (${c.completionRate}%)`),
    '',
    '── This Week vs Last Week ──',
    `Tasks completed: ${report.thisWeek.completed} (${report.completionDelta >= 0 ? '+' : ''}${report.completionDelta} from last week)`,
    `Tasks added: ${report.thisWeek.added} (${report.addedDelta >= 0 ? '+' : ''}${report.addedDelta} from last week)`,
    `Active conflicts: ${report.activeConflicts}`,
  ];

  if (report.wellness.current !== null) {
    lines.push('');
    lines.push('── Well-being ──');
    lines.push(`Current WHO-5 score: ${report.wellness.current}%`);
    if (report.wellness.change !== null) {
      lines.push(`Change: ${report.wellness.change >= 0 ? '+' : ''}${report.wellness.change} points`);
    }
  }

  if (insights.length > 0) {
    lines.push('');
    lines.push('── Insights ──');
    insights.forEach(i => lines.push(`• ${i.text}`));
  }

  lines.push('');
  lines.push('Generated by BALANSE');

  return lines.join('\n');
};