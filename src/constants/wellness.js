
// WHO-5 QUESTIONS
export const WHO5_QUESTIONS = [
 {
    id: 1,
    text: 'I have felt cheerful and in good spirits',
 },

 {
    id: 2,
    text: 'I have felt calm and relaxed',
 },

 {
    id: 3,
    text: 'I have felt active and vigorous',
 },

 {
    id: 4,
    text: 'I woke up feeling fresh and rested',
 },

 {
    id: 5,
    text: 'My daily life has been filled with things that interest me',
 },
 ];

//WHO-5 LIKERT SCALES
export const LIKERT_OPTIONS = [
{value: 5, label: 'All of the time'},
{value: 4, label: 'Most of the time'},
{value: 3, label: 'More than half the time'},
{value: 2, label: 'Less than half the time'},
{value: 1, label: 'Some of the time'},
{value: 0, label: 'At no time'},
];

// TIMEFRAME
export const TIMEFRAME_TEXT = 'Over the last 2 weeks....';

export const getRawScore = (answers) => {
    return Object.values(answers).reduce((sum, val) => sum + val, 0);
};
// Scoring raw score (0-25) x 4 = percentage (0-100)
export const computeWellnessPercentage = (answers) => {
    return getRawScore(answers) * 4;
};


// Thresholds
export const WELLNESS_THRESHOLDS = {
    POSITIVE: 50,
    RISK: 28,
};

export const getWellnessStatus = (percentage) => {
  if (percentage >= WELLNESS_THRESHOLDS.POSITIVE) {
    return {
      level: 'positive',
      label: 'Positive Well-being',
      color: '#4ade80',
      description: 'Your well-being score is in a healthy range. Keep up the good work!',
    };
  }
  if (percentage >= WELLNESS_THRESHOLDS.RISK) {
    return {
      level: 'risk',
      label: 'At Risk',
      color: '#fbbf24',
      description: 'Your well-being score suggests some concerns. Consider reviewing your workload and self-care habits.',
    };
  }
  return {
    level: 'severe',
    label: 'Low Well-being',
    color: '#f87171',
    description: 'Your score indicates low well-being. Please consider reaching out to a counselor or trusted support person.',
  };
};

// Decline detection (>10 drop between assessments)
export const detectDecline = (history) => {
    if (history.length < 2) return null;

    const latest = history[0]; // most recent answers
    const previous = history[1]; // previous answer

    const drop = previous.percentage - latest.percentage;

    if(drop > 10){
        return{
            hasDrop: true,
            drop,
            message: `Your well-being score dropped by ${drop} points since your last check-in. Consider taking a break or lightening your schedule.`,
        };
    
    }
    return {hasDrop: false, drop: 0, message: null };
};
    // Rules based on score and workload
export const getInterventions = (percentage, taskCount = 0, conflictCount = 0) =>  {
       const interventions = [];

       if(percentage < WELLNESS_THRESHOLDS.POSITIVE){
        interventions.push({
        icon: 'leaf-outline',
        title: 'Take a Break',
        text: 'Short breaks improve focus and mood. Try a 10-minute walk or breathing exercise.',
        });
       }

       if(percentage < WELLNESS_THRESHOLDS.RISK){
        interventions.push({
        icon: 'chatbubble-ellipses-outline',
        title: 'Talk to Someone',
        text: 'If you\'re struggling, reach out to a friend, family member, or counselor.',
        });
        interventions.push({
        icon: 'moon-outline',
        title: 'Prioritize Sleep',
        text: 'Poor sleep strongly affects well-being. Aim for 7-9 hours tonight.',
        });
        interventions.push({
        icon: 'heart-outline',
        title: 'Self-Compassion Resources',
        text: 'Explore guided exercises and tools for self-compassion.',
        link: 'https://self-compassion.org/',
        });
        interventions.push({
        icon: 'globe-outline',
        title: 'Mental Health Philippines',
        text: 'Access local mental health resources, hotlines, and support services.',
        link: 'https://mentalhealthph.org/',
        });
    }

    if(percentage >= WELLNESS_THRESHOLDS.RISK && percentage < WELLNESS_THRESHOLDS.POSITIVE){
        interventions.push({
        icon: 'globe-outline',
        title: 'Mental Health Resources',
        text: 'Your guidance counselor recommends these if you need support.',
        link: 'https://mentalhealthph.org/',
        });
    }

    if(taskCount > 5){
        interventions.push({
        icon: 'list-outline',
        title: 'Reduce Workload',
        text: `You have ${taskCount} active tasks. Consider postponing or delegating lower-priority items.`,
        });
    }

    if (conflictCount > 0){
        interventions.push({
        icon: 'warning-outline',
        title: 'Resolve Schedule Conflicts',
        text: `You have ${conflictCount} scheduling conflict${conflictCount > 1 ? 's' : ''}. Resolving these can reduce stress.`,
        });
    }
    if (percentage >= WELLNESS_THRESHOLDS.POSITIVE && interventions.length === 0){
        interventions.push({
        icon: 'sunny-outline',
        title: 'Keep It Up!',
        text: 'Your well-being is in a good place. Maintain your current routines and balance.',
        });
    }

    return interventions;
};
// Wellness-aware throttle advice — identifies tasks that can be deferred
// when the student's well-being is below positive threshold.
export const getWellnessThrottleAdvice = (percentage, tasks) => {
  if (percentage == null || percentage >= WELLNESS_THRESHOLDS.POSITIVE) {
    return { shouldThrottle: false, message: null, deferrableTasks: [], deferrableCount: 0 };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const deferrable = tasks.filter(t => {
    if (t.progress === 100) return false;
    if (t.priority === 'High') return false;
    if (t.recurrence?.isClassSchedule) return false;
    if (!t.deadline) return true;
    const dl = new Date(t.deadline);
    dl.setHours(0, 0, 0, 0);
    return Math.ceil((dl - now) / (1000 * 60 * 60 * 24)) > 2;
  });

  const isSevere = percentage < WELLNESS_THRESHOLDS.RISK;

  if (deferrable.length === 0) {
    return {
      shouldThrottle: true,
      severity: isSevere ? 'severe' : 'risk',
      message: 'All your current tasks are urgent or high priority. Focus on what matters most and take breaks when you can.',
      deferrableTasks: [],
      deferrableCount: 0,
    };
  }

  return {
    shouldThrottle: true,
    severity: isSevere ? 'severe' : 'risk',
    message: isSevere
      ? `Your well-being needs care. ${deferrable.length} non-urgent task${deferrable.length !== 1 ? 's' : ''} could be deferred to lighten your load.`
      : `${deferrable.length} lower-priority task${deferrable.length !== 1 ? 's are' : ' is'} not urgent — consider postponing if you need breathing room.`,
    deferrableTasks: deferrable,
    deferrableCount: deferrable.length,
  };
};

// Workload-Wellness Trend Insight — compares the two most recent assessments
// and generates a plain-language interpretation linking score change to workload change.
export const getTrendInsight = (history) => {
    if (!history || history.length < 2) return null;

    const latest = history[0];
    const previous = history[1];

    const scoreDelta = Math.round(latest.percentage - previous.percentage);
    const absScore = Math.abs(scoreDelta);

    // Well-being direction (small ±2% swings count as steady)
    let direction;
    if (scoreDelta >= 3) direction = 'improved';
    else if (scoreDelta <= -3) direction = 'declined';
    else direction = 'steady';

    // Workload comparison only if BOTH entries stored a task count
    const hasWorkload =
        typeof latest.activeTaskCount === 'number' &&
        typeof previous.activeTaskCount === 'number';
    const latestTasks = latest.activeTaskCount;
    const prevTasks = previous.activeTaskCount;
    const taskDelta = hasWorkload ? latestTasks - prevTasks : 0;

    let message;
    let tone; // 'positive' | 'warning' | 'neutral'

    if (direction === 'improved') {
        tone = 'positive';
        if (hasWorkload && taskDelta < 0) {
            message = `Your well-being improved by ${absScore}% since your last check-in, and your active tasks dropped from ${prevTasks} to ${latestTasks}. Lightening your load appears to be helping.`;
        } else if (hasWorkload && taskDelta > 0) {
            message = `Your well-being improved by ${absScore}% even though your active tasks rose from ${prevTasks} to ${latestTasks}. You're managing a heavier load well — keep an eye on it.`;
        } else if (hasWorkload) {
            message = `Your well-being improved by ${absScore}% with a steady workload of ${latestTasks} active task${latestTasks === 1 ? '' : 's'}. Your current balance is working.`;
        } else {
            message = `Your well-being improved by ${absScore}% since your last check-in. Whatever you're doing is working — keep it up.`;
        }
    } else if (direction === 'declined') {
        tone = 'warning';
        if (hasWorkload && taskDelta > 0) {
            message = `Your well-being dropped by ${absScore}% while your active tasks increased from ${prevTasks} to ${latestTasks}. A rising workload may be affecting your mood — consider prioritizing or delegating.`;
        } else if (hasWorkload && taskDelta < 0) {
            message = `Your well-being dropped by ${absScore}% even though your active tasks decreased from ${prevTasks} to ${latestTasks}. Something beyond workload may be at play — be gentle with yourself.`;
        } else if (hasWorkload) {
            message = `Your well-being dropped by ${absScore}% with a steady workload of ${latestTasks} active task${latestTasks === 1 ? '' : 's'}. Factors outside your task list may be affecting you.`;
        } else {
            message = `Your well-being dropped by ${absScore}% since your last check-in. Take a moment to check in with yourself and review your recommendations below.`;
        }
    } else {
        tone = 'neutral';
        if (hasWorkload && taskDelta > 0) {
            message = `Your well-being held steady, though your active tasks rose from ${prevTasks} to ${latestTasks}. Watch for signs of strain as your load grows.`;
        } else if (hasWorkload && taskDelta < 0) {
            message = `Your well-being held steady and your active tasks eased from ${prevTasks} to ${latestTasks}. A lighter load may help you recover.`;
        } else {
            message = `Your well-being has held steady since your last check-in. Consistency is a good sign — keep monitoring how you feel.`;
        }
    }

    return {
        scoreDelta,
        taskDelta: hasWorkload ? taskDelta : null,
        direction,
        tone,
        message,
        hasWorkload,
    };
};