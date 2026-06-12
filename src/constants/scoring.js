// Priority Scoring Formula of Balanse Heuristic Engine
// Formula: Score = A (deadline) + B (priority) + C (category)
// Max score = 100 points

// A — Deadline proximity (max 40 pts)
const getDeadlineScore = (deadline) => {
  if (!deadline) return 10;
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) return 10;

  // Compare by calendar day so "overdue" and "due today" are distinct
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dl = new Date(deadlineDate);
  dl.setHours(0, 0, 0, 0);
  const daysUntilDeadline = Math.round((dl - today) / (1000 * 60 * 60 * 24));

  if (daysUntilDeadline < 0) return 40;   // overdue — most urgent
  if (daysUntilDeadline === 0) return 38; // due today
  if (daysUntilDeadline <= 2) return 30;
  if (daysUntilDeadline <= 5) return 20;
  return 10;
};

// B — User priority level (max 40 pts)
const getPriorityScore = (priority) => {
  switch (priority) {
    case 'High':   return 40;
    case 'Medium': return 25;
    case 'Low':    return 10;
    default:       return 10;
  }
};

// C — Task category (max 20 pts)
const getCategoryScore = (category) => {
  switch (category) {
    case 'Organization': return 20;
    case 'Academic':     return 15;
    case 'Personal':     return 10;
    default:             return 10;
  }
};

// Main scoring function — combines A + B + C
export const computePriorityScore = (task) => {
  // Completed tasks carry no priority — they shouldn't compete for attention
  if (task.progress === 100) return 0;

  const A = getDeadlineScore(task.deadline);
  const B = getPriorityScore(task.priority);
  const C = getCategoryScore(task.category);
  const total = A + B + C;
  return Math.min(total, 100); // Cap at 100
};

// Convert numeric score to label
export const getPriorityLabel = (score) => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

// Returns a detailed breakdown of how the score was computed
export const getPriorityBreakdown = (task) => {
  const A = getDeadlineScore(task.deadline);
  const B = getPriorityScore(task.priority);
  const C = getCategoryScore(task.category);
  const total = Math.min(A + B + C, 100);

  // Human-readable deadline proximity label
  let deadlineReason;
  if (!task.deadline || isNaN(new Date(task.deadline).getTime())) {
    deadlineReason = 'No deadline set';
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(task.deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((deadlineDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) deadlineReason = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? 's' : ''} overdue`;
    else if (daysUntil === 0) deadlineReason = 'Due today';
    else if (daysUntil === 1) deadlineReason = 'Due tomorrow';
    else deadlineReason = `Due in ${daysUntil} days`;
  }

  return {
    total,
    factors: [
      { label: 'Deadline', score: A, maxScore: 40, reason: deadlineReason },
      { label: 'Priority', score: B, maxScore: 40, reason: `${task.priority} priority` },
      { label: 'Category', score: C, maxScore: 20, reason: `${task.category}` },
    ],
  };

};






