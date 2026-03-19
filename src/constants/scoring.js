// Priority Scoring Formula of Balanse Heuristic Engine
// Formula: Score = A (deadline) + B (priority) + C (category)
// Max score = 100 points

// A — Deadline proximity (max 40 pts)
const getDeadlineScore = (deadline) => {
  const today = new Date();
  const deadlineDate = new Date(deadline);
  const daysUntilDeadline = Math.ceil(
    (deadlineDate - today) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilDeadline <= 0) return 40;  // Overdue or due today
  if (daysUntilDeadline <= 2) return 30;  // Due in 1-2 days
  if (daysUntilDeadline <= 5) return 20;  // Due in 3-5 days
  return 10;                               // Due in 6+ days
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



