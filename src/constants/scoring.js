// Priority Scoring Formula of Balanse Heuristic Engine
// Formula: Score = A (deadline) + B (priority) + C (category)
// Max score = 100 points

// A — Deadline proximity (max 40 pts)
const getDeadlineScore = (deadline) => {
  if (!deadline) return 10;
  const today = new Date();
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) return 10;
  const daysUntilDeadline = Math.ceil(
    (deadlineDate - today) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDeadline <= 0) return 40;
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
  const today = new Date();
  const deadlineDate = new Date(task.deadline);
  const daysUntil = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
  let deadlineReason;
  if (daysUntil <= 0) deadlineReason = 'Overdue / Due today';
  else if (daysUntil <= 2) deadlineReason = `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
  else if (daysUntil <= 5) deadlineReason = `Due in ${daysUntil} days`;
  else deadlineReason = `Due in ${daysUntil} days`;

  return {
    total,
    factors: [
      { label: 'Deadline', score: A, maxScore: 40, reason: deadlineReason },
      { label: 'Priority', score: B, maxScore: 40, reason: `${task.priority} priority` },
      { label: 'Category', score: C, maxScore: 20, reason: `${task.category}` },
    ],
  };

};






