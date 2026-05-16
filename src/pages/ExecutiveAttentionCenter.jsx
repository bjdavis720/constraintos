import {
  getAgeInDays,
  isOverdue,
  getIssueEscalationLevel,
} from "../utils/escalationUtils.js";

function ExecutiveAttentionCenter({
  project,
  milestones,
  constraints,
  issues,
  todos,
  updateIssueStatus,
  archiveIssue,
  permissions,
}) {
  const offTrackMilestones = milestones.filter(
    (milestone) => !milestone.archived && milestone.status === "Off Track"
  );

  const escalatedConstraints = constraints.filter(
    (constraint) => constraint.status === "Escalated"
  );

  const executiveIssues = issues.filter(
    (issue) =>
      !issue.archived &&
      issue.status !== "Closed" &&
      (getAgeInDays(issue.createdAt) >= 7 || issue.status === "Discussing")
  );

  const overdueTodos = todos.filter((todo) => isOverdue(todo));

  const criticalItems =
    executiveIssues.filter((issue) => getAgeInDays(issue.createdAt) >= 14)
      .length +
    offTrackMilestones.length +
    overdueTodos.length;

  const totalAttentionItems =
    executiveIssues.length +
    escalatedConstraints.length +
    offTrackMilestones.length +
    overdueTodos.length;

  const operationalHealth = Math.max(
    0,
    100 -
      executiveIssues.length * 5 -
      escalatedConstraints.length * 8 -
      offTrackMilestones.length * 12 -
      overdueTodos.length * 4
  );

  return (
    <div className="page executive-attention-page">
      <div className="page-header">
        <h1>Executive Attention Center</h1>
        <p>{project}</p>
      </div>

      <div className="executive-risk-banner">
        <div>
          <p className="risk-label">🔴 Executive Attention Required</p>
          <h2>{totalAttentionItems} items need leadership focus</h2>
          <p className="risk-subtitle">
            Automatically elevated from aging issues, escalated constraints,
            off-track milestones, and overdue commitments.
          </p>
        </div>

        <div className="health-score-box">
          <span>Operational Health</span>
          <strong>{operationalHealth}/100</strong>
        </div>
      </div>

      <div className="executive-summary-grid">
        <div className="summary-tile critical">
          <span>Critical Items</span>
          <strong>{criticalItems}</strong>
        </div>

        <div className="summary-tile high">
          <span>Aging Issues</span>
          <strong>{executiveIssues.length}</strong>
        </div>

        <div className="summary-tile high">
          <span>Escalated Constraints</span>
          <strong>{escalatedConstraints.length}</strong>
        </div>

        <div className="summary-tile critical">
          <span>Overdue To-Dos</span>
          <strong>{overdueTodos.length}</strong>
        </div>
      </div>

      <div className="data-card executive-section-card">
        <h2>
          🔴 Issues Needing Leadership Attention
          <span className="executive-count-pill">{executiveIssues.length}</span>
        </h2>

        <table className="data-table executive-table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Source</th>
              <th>Age</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {executiveIssues.length === 0 && (
              <tr>
                <td colSpan="6">No issues currently need executive attention.</td>
              </tr>
            )}

            {executiveIssues.map((issue) => {
              const age = getAgeInDays(issue.createdAt);
              const severity = getIssueEscalationLevel(issue);

              return (
                <tr key={issue.id} className={`executive-row ${severity}`}>
                  <td>{issue.title}</td>
                  <td>{issue.source || "-"}</td>
                  <td>{age} days</td>
                  <td>
                    <span className={`urgency-pill ${severity}`}>
                      {severity === "critical"
  ? "Critical"
  : severity === "high"
  ? "Escalated"
  : severity === "medium"
  ? "Aging"
  : "Normal"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`status-pill-button ${issue.status
                        .replaceAll(" ", "-")
                        .toLowerCase()}`}
                      onClick={() => updateIssueStatus(issue.id)}
                      disabled={!permissions.canUpdateIssueStatus}
                    >
                      {issue.status}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => archiveIssue(issue.id)}
                      disabled={!permissions.canArchiveIssue}
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="data-card executive-section-card">
        <h2>
          🟠 Escalated Constraints
          <span className="executive-count-pill">
            {escalatedConstraints.length}
          </span>
        </h2>

        <table className="data-table executive-table">
          <thead>
            <tr>
              <th>Constraint</th>
              <th>Owner</th>
              <th>Required By</th>
              <th>Milestone</th>
            </tr>
          </thead>

          <tbody>
            {escalatedConstraints.length === 0 && (
              <tr>
                <td colSpan="4">No escalated constraints.</td>
              </tr>
            )}

            {escalatedConstraints.map((constraint) => (
              <tr key={constraint.id} className="executive-row high">
                <td>{constraint.description}</td>
                <td>{constraint.owner || "Unassigned"}</td>
                <td>{constraint.requiredBy || "-"}</td>
                <td>{constraint.milestone || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-card executive-section-card">
        <h2>
          🔴 Off Track Milestones
          <span className="executive-count-pill">
            {offTrackMilestones.length}
          </span>
        </h2>

        <table className="data-table executive-table">
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Target Date</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {offTrackMilestones.length === 0 && (
              <tr>
                <td colSpan="3">No off-track milestones.</td>
              </tr>
            )}

            {offTrackMilestones.map((milestone) => (
              <tr key={milestone.id} className="executive-row critical">
                <td>{milestone.name}</td>
                <td>{milestone.due}</td>
                <td>
                  <span className="urgency-pill critical">
                    {milestone.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-card executive-section-card">
        <h2>
          🔴 Overdue To-Dos
          <span className="executive-count-pill">{overdueTodos.length}</span>
        </h2>

        <table className="data-table executive-table">
          <thead>
            <tr>
              <th>To-Do</th>
              <th>Owner</th>
              <th>Due Date</th>
            </tr>
          </thead>

          <tbody>
            {overdueTodos.length === 0 && (
              <tr>
                <td colSpan="3">No overdue To-Dos.</td>
              </tr>
            )}

            {overdueTodos.map((todo) => (
              <tr key={todo.id} className="executive-row critical">
                <td>{todo.action}</td>
                <td>{todo.owner || "Unassigned"}</td>
                <td>{todo.dueDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExecutiveAttentionCenter;