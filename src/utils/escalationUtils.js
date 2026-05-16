export function getAgeInDays(dateValue) {
  if (!dateValue) return 0;

  const created = new Date(dateValue);
  const today = new Date();

  created.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diff = today - created;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function isOverdue(todo) {
  if (!todo?.dueDate) return false;

  const due = new Date(`${todo.dueDate}T00:00:00`);
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return due < today;
}

export function needsExecutiveAttention(issue) {
  const age = getAgeInDays(issue.createdAt);

  return (
    !issue.archived &&
    issue.status !== "Closed" &&
    (age >= 7 || issue.status === "Discussing")
  );
}

export function getIssueEscalationLevel(issue) {
  const age = getAgeInDays(issue.createdAt);

  if (issue.archived || issue.status === "Closed") return "closed";
  if (age >= 14) return "critical";
  if (age >= 3) return "medium";

  return "normal";
}

export function getConstraintEscalationLevel(constraint) {
  if (constraint.status === "Closed") return "closed";
  if (constraint.status === "Escalated") return "critical";
  if (constraint.status === "Waiting") return "high";

  return "normal";
}

export function getTodoEscalationLevel(todo) {
  if (todo.status === "Closed" || todo.status === "Complete") return "closed";
  if (isOverdue(todo)) return "critical";

  return "normal";
}

export function getMilestoneEscalationLevel(milestone) {
  if (milestone.archived) return "closed";
  if (milestone.status === "Off Track") return "critical";
  if (milestone.status === "At Risk") return "high";

  return "normal";
}