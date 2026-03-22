
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
export const TIMEFRAME_TEXT = 'Over the last week....';

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
        })
       
    }
    if(taskCount > 5){
        interventions.push({
        icon: 'list-outline',
        title: 'Reduce Workload',
        text: `You have ${taskCount} active tasks. Consider postponing or delegating lower-priority items.`,
        })
    }

    if (conflictCount > 0){
        interventions.push({
        icon: 'warning-outline',
        title: 'Resolve Schedule Conflicts',
        text: `You have ${conflictCount} scheduling conflict${conflictCount > 1 ? 's' : ''}. Resolving these can reduce stress.`,
        })
    }
    if (percentage >= WELLNESS_THRESHOLDS.POSITIVE && interventions.length === 0){
        interventions.push({
        icon: 'sunny-outline',
        title: 'Keep It Up!',
        text: 'Your well-being is in a good place. Maintain your current routines and balance.',
        })
    }

    return interventions;
};
