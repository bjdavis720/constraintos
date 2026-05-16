function formatFeedDate(dateValue) {
  if (!dateValue) return "Recently";

  const date = new Date(dateValue);
  const today = new Date();

  date.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function buildOperationalFeed(projects, projectData, isOverdue, getAgeInDays) {
  const feedItems = [];

  projects
    .filter((project) => project.status !== "Archived")
    .forEach((project) => {
      const data = projectData[project.id] || {
        milestones: [],
        constraints: [],
        issues: [],
        todos: [],
      };

      (data.milestones || []).forEach((milestone) => {
        if (!milestone.archived && milestone.status === "Off Track") {
          feedItems.push({
            type: "critical",
            icon: "🔴",
            message: `${project.name}: Milestone off track — ${milestone.name}`,
            date: milestone.due,
          });
        }

        if (!milestone.archived && milestone.status === "At Risk") {
          feedItems.push({
            type: "warning",
            icon: "🟠",
            message: `${project.name}: Milestone at risk — ${milestone.name}`,
            date: milestone.due,
          });
        }
      });

      (data.constraints || []).forEach((constraint) => {
        if (constraint.status === "Escalated") {
          feedItems.push({
            type: "critical",
            icon: "🔴",
            message: `${project.name}: Constraint escalated — ${constraint.description}`,
            date: constraint.requiredBy,
          });
        }
      });

      (data.issues || []).forEach((issue) => {
        const age = getAgeInDays(issue.createdAt);

        if (!issue.archived && issue.status !== "Closed" && age >= 14) {
          feedItems.push({
            type: "critical",
            icon: "🔴",
            message: `${project.name}: Issue critical at ${age} days — ${issue.title}`,
            date: issue.createdAt,
          });
        } else if (!issue.archived && issue.status !== "Closed" && age >= 7) {
          feedItems.push({
            type: "warning",
            icon: "🟠",
            message: `${project.name}: Issue aging at ${age} days — ${issue.title}`,
            date: issue.createdAt,
          });
        }
      });

      (data.todos || []).forEach((todo) => {
        if (isOverdue(todo)) {
          feedItems.push({
            type: "critical",
            icon: "🔴",
            message: `${project.name}: To-Do overdue — ${todo.action}`,
            date: todo.dueDate,
          });
        }
      });
    });

  return feedItems.slice(0, 10);
}

function OperationalFeed({ projects, projectData, isOverdue, getAgeInDays }) {
  const feedItems = buildOperationalFeed(
    projects,
    projectData,
    isOverdue,
    getAgeInDays
  );

  return (
    <div className="data-card operational-feed-card">
      <h2>Operational Activity Feed</h2>
      <p className="feed-subtitle">
        Live operational narrative generated from schedule, constraints, issues,
        and overdue commitments.
      </p>

      <div className="feed-list">
        {feedItems.length === 0 && (
          <div className="feed-empty">No urgent operational activity detected.</div>
        )}

        {feedItems.map((item, index) => (
          <div key={index} className={`feed-item ${item.type}`}>
            <div className="feed-icon">{item.icon}</div>

            <div className="feed-content">
              <strong>{item.message}</strong>
              <span>{formatFeedDate(item.date)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OperationalFeed;