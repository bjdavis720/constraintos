import { useState } from "react";
function getAgeInDays(dateValue) {
  if (!dateValue) return 0;

  const created = new Date(dateValue);
  const today = new Date();

  created.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return Math.floor((today - created) / (1000 * 60 * 60 * 24));
}

function getEscalation(issue) {
  if (issue.manuallyEscalated) {
    return { className: "critical", label: "Escalated" };
  }

  const age = getAgeInDays(issue.createdAt);

  if (age >= 14) return { className: "high", label: "High" };
  if (age >= 7) return { className: "medium", label: "Aging" };

  return { className: "low", label: "Normal" };
}

function getScheduleImpact(issue) {
  if (!issue.scheduleDeltaType) return "-";

  if (issue.scheduleDeltaType === "Slipped Activity") {
    return issue.notes?.match(/\d+-day slip/)?.[0] || "Schedule slip";
  }

  if (issue.scheduleDeltaType === "Float Erosion") {
    return issue.notes || "Float erosion";
  }

  if (issue.scheduleDeltaType === "New Critical Activity") {
    return "Now critical";
  }

  if (issue.scheduleDeltaType === "Recovered Activity") {
    return issue.notes?.match(/\d+-day recovery/)?.[0] || "Recovered";
  }

  return issue.scheduleDeltaType;
}

function IssuesBoard({
  project,
  issues = [],
  updateIssueStatus,
  updateIssueNotes,
  createManualTodoFromIssue,
  archiveIssue,
  deleteIssue,
  toggleIssueEscalation,
  permissions = {},
  dashboardFilter,
}) {
  const [expandedIssueId, setExpandedIssueId] = useState(null);

const [todoDrafts, setTodoDrafts] = useState({});
const [showArchivedIssues, setShowArchivedIssues] = useState(false);
  const activeIssues = issues.filter((issue) => !issue.archived);
  const archivedIssues = issues.filter((issue) => issue.archived);

  const filteredIssues = activeIssues.filter((issue) => {
    if (dashboardFilter === "aging-issues") {
      return issue.status !== "Closed" && getAgeInDays(issue.createdAt) >= 7;
    }

    if (dashboardFilter === "exec-attention") {
      return issue.status !== "Closed" && issue.manuallyEscalated;
    }

    if (dashboardFilter === "open-issues") {
      return issue.status !== "Closed";
    }

    return true;
  });

  return (
    <div className="page">
      <div className="print-report-header print-only">
  <img src="/logo.png" alt="ConstraintOS" className="print-logo" />
  <div>
    <h1>ConstraintOS Operational Report</h1>
    <p>{project}</p>
  </div>
</div>
      <div className="page-header">
  <div>
    <h1>Issues Board</h1>
    <p>{project}</p>
  </div>

  <button
    type="button"
    className="secondary-button no-print"
    onClick={() => window.print()}
  >
    Print / Export
  </button>
</div>

      <div className="data-card">
        <h2>Active Issues</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Issue</th>
              <th>Source</th>
              <th>Activity ID</th>
<th>Linked Milestone</th>
<th>Delta Type</th>
              <th>Schedule Impact</th>
              <th>Start</th>
              <th>Finish</th>
              <th>Total Float</th>
              <th>Age</th>
              <th>Escalation</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredIssues.length === 0 && (
              <tr>
                <td colSpan="13">No issues match this view.</td>
              </tr>
            )}

            {filteredIssues.map((issue) => {
              const escalation = getEscalation(issue);
              const statusClass = String(issue.status || "Open")
                .replaceAll(" ", "-")
                .toLowerCase();

              return (
                <>
  <tr key={issue.id}>
                  <td>{issue.title || "-"}</td>
                  <td>{issue.source || "-"}</td>
                  <td>{issue.activityId || "-"}</td>
<td>{issue.milestone || "-"}</td>
<td>{issue.scheduleDeltaType || "-"}</td>
                  <td>{getScheduleImpact(issue)}</td>
                  <td>{issue.start || "-"}</td>
                  <td>{issue.finish || "-"}</td>
                  <td>{issue.totalFloat || "-"}</td>
                  <td>{getAgeInDays(issue.createdAt)} days</td>

                  <td>
                    <span className={`urgency-pill ${escalation.className}`}>
                      {escalation.label}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className={`status-pill-button ${statusClass}`}
                      onClick={() => updateIssueStatus(issue.id)}
                      disabled={!permissions.canUpdateIssueStatus}
                    >
                      {issue.status || "Open"}
                    </button>
                  </td>

                  <td>
                    <button
  type="button"
  className="secondary-button small-button"
  onClick={() =>
    setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id)
  }
>
  {expandedIssueId === issue.id ? "Close Workflow" : "Open Workflow"}
</button>

                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => toggleIssueEscalation(issue.id)}
                      disabled={!permissions.canUpdateIssueStatus}
                    >
                      {issue.manuallyEscalated ? "De-escalate" : "Escalate"}
                    </button>
                  </td>
                </tr>

{expandedIssueId === issue.id && (
  <tr>
    <td colSpan="13">
      <div className="card">
        <h3>Discuss / Solve</h3>

        <p>
          <strong>Issue:</strong> {issue.title}
        </p>

        <label>
  Discussion Notes
  <textarea
    value={issue.notes || ""}
    onChange={(e) => updateIssueNotes(issue.id, e.target.value)}
    rows="4"
    placeholder="Capture discussion, root cause, decision needed, or resolution notes..."
  />
</label>

        <div className="form-grid workflow-form-grid">
          <label>
            Action Item
            <input
              type="text"
              value={todoDrafts[issue.id]?.action || ""}
              onChange={(e) =>
                setTodoDrafts({
                  ...todoDrafts,
                  [issue.id]: {
                    ...(todoDrafts[issue.id] || {}),
                    action: e.target.value,
                  },
                })
              }
            />
          </label>

          <label>
            Owner
            <input
              type="text"
              value={todoDrafts[issue.id]?.owner || ""}
              onChange={(e) =>
                setTodoDrafts({
                  ...todoDrafts,
                  [issue.id]: {
                    ...(todoDrafts[issue.id] || {}),
                    owner: e.target.value,
                  },
                })
              }
            />
          </label>

          <label>
            Due Date
            <input
              type="date"
              value={todoDrafts[issue.id]?.dueDate || ""}
              onChange={(e) =>
                setTodoDrafts({
                  ...todoDrafts,
                  [issue.id]: {
                    ...(todoDrafts[issue.id] || {}),
                    dueDate: e.target.value,
                  },
                })
              }
            />
          </label>
        </div>

        <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
  <button
    type="button"
    className="primary-button small-button"
    onClick={() => {
      createManualTodoFromIssue(issue, todoDrafts[issue.id] || {});
      setTodoDrafts({
        ...todoDrafts,
        [issue.id]: {
          action: "",
          owner: "",
          dueDate: "",
        },
      });
    }}
    disabled={!permissions.canCreateTodoFromIssue}
  >
    Create Action
  </button>

  <button
    type="button"
    className="secondary-button small-button"
    onClick={() => updateIssueStatus(issue.id)}
    disabled={!permissions.canUpdateIssueStatus}
  >
    Move Status
  </button>

  <button
    type="button"
    className="secondary-button small-button"
    onClick={() => archiveIssue(issue.id)}
    disabled={!permissions.canArchiveIssue}
  >
    Archive Issue
  </button>
</div>
      </div>
    </td>
  </tr>
)}
</>
              );
            })}
          </tbody>
        </table>
      </div>

      {archivedIssues.length > 0 && !dashboardFilter && (
  <div className="data-card">
    <div className="section-header-row">
      <h2>Archived Issues</h2>

      <button
        type="button"
        className="secondary-button small-button"
        onClick={() => setShowArchivedIssues(!showArchivedIssues)}
      >
        {showArchivedIssues
          ? "Hide Archived Issues"
          : `View Archived Issues (${archivedIssues.length})`}
      </button>
    </div>

    {showArchivedIssues && (

          <table className="data-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Source</th>
                <th>Activity ID</th>
<th>Linked Milestone</th>
<th>Delta Type</th>
                <th>Status</th>
<th>Action</th>
              </tr>
            </thead>

            <tbody>
              {archivedIssues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.title || "-"}</td>
                  <td>{issue.source || "-"}</td>
                  <td>{issue.activityId || "-"}</td>
<td>{issue.milestone || "-"}</td>
<td>{issue.scheduleDeltaType || "-"}</td>
                  <td>{issue.status || "Open"}</td>
<td>
  <button
    type="button"
    className="secondary-button small-button"
    onClick={() => deleteIssue(issue.id)}
    disabled={!permissions.canArchiveIssue}
  >
    Delete
  </button>
</td>
                </tr>
              ))}
            </tbody>
              </table>
    )}
  </div>
)}
    </div>
  );
}

export default IssuesBoard;