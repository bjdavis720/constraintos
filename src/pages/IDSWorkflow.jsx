import { useState } from "react";

function IDSWorkflow({
  project,
  issues = [],
  updateIssueStatus = () => {},
  updateIssueNotes = () => {},
  createManualTodoFromIssue = () => {},
  permissions = {},
}) {
  const [todoDrafts, setTodoDrafts] = useState({});

  const canUpdateIssueStatus = permissions.canUpdateIssueStatus ?? false;
  const canCreateTodoFromIssue = permissions.canCreateTodoFromIssue ?? false;

  const identifyIssues = issues.filter(
    (issue) => (issue.status || "Open") === "Open" && !issue.archived
  );

  const discussIssues = issues.filter(
    (issue) => issue.status === "Discussing" && !issue.archived
  );

  const solveIssues = issues.filter(
    (issue) =>
      (issue.status === "Action Assigned" || issue.status === "Closed") &&
      !issue.archived
  );

  function updateTodoDraft(issueId, field, value) {
    setTodoDrafts({
      ...todoDrafts,
      [issueId]: {
        ...(todoDrafts[issueId] || {}),
        [field]: value,
      },
    });
  }

  function handleCreateTodo(issue) {
    const draft = todoDrafts[issue.id] || {};

    createManualTodoFromIssue(issue, {
      action: draft.action || "",
      owner: draft.owner || "",
      dueDate: draft.dueDate || "",
    });

    setTodoDrafts({
      ...todoDrafts,
      [issue.id]: {
        action: "",
        owner: "",
        dueDate: "",
      },
    });
  }

  function renderIssueCard(issue, showDiscussTools = false, showSolveTools = false) {
    const draft = todoDrafts[issue.id] || {
      action: "",
      owner: "",
      dueDate: "",
    };

    const issueStatus = issue.status || "Open";

    return (
      <div className="ids-card" key={issue.id}>
        <h3>{issue.title || "Untitled Issue"}</h3>

        <p>
          <strong>Source:</strong> {issue.source || "-"}
        </p>

        <p>
          <strong>Owner:</strong> {issue.owner || "Unassigned"}
        </p>

        <p>
          <strong>Milestone:</strong> {issue.milestone || "-"}
        </p>

        <button
          type="button"
          className={`status-pill-button ${issueStatus
            .replaceAll(" ", "-")
            .toLowerCase()}`}
          onClick={() => updateIssueStatus(issue.id)}
          disabled={!canUpdateIssueStatus}
        >
          {issueStatus}
        </button>

        {showDiscussTools && (
          <div className="ids-discussion">
            <label>Discussion Notes</label>
            <textarea
              value={issue.notes || ""}
              onChange={(e) => updateIssueNotes(issue.id, e.target.value)}
              placeholder="Capture discussion, decisions, risks, or needed follow-up..."
              disabled={!canUpdateIssueStatus}
            />
          </div>
        )}

        {showSolveTools && (
          <div className="ids-todo-form">
            <label>To-Do / Action Item</label>
            <input
              value={draft.action}
              onChange={(e) =>
                updateTodoDraft(issue.id, "action", e.target.value)
              }
              placeholder="Write the specific action item"
              disabled={!canCreateTodoFromIssue}
            />

            <label>Owner</label>
            <input
              value={draft.owner}
              onChange={(e) =>
                updateTodoDraft(issue.id, "owner", e.target.value)
              }
              placeholder="Owner"
              disabled={!canCreateTodoFromIssue}
            />

            <label>Due Date</label>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) =>
                updateTodoDraft(issue.id, "dueDate", e.target.value)
              }
              disabled={!canCreateTodoFromIssue}
            />

            <button
              type="button"
              className="secondary-button small-button"
              onClick={() => handleCreateTodo(issue)}
              disabled={!canCreateTodoFromIssue}
            >
              Create To-Do
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>IDS Workflow</h1>
        <p>{project}</p>
      </div>

      <div className="ids-board">
        <div className="ids-column">
          <h2>Identify</h2>
          <p className="ids-column-note">New issues requiring clarity.</p>
          {identifyIssues.map((issue) => renderIssueCard(issue))}
        </div>

        <div className="ids-column">
          <h2>Discuss</h2>
          <p className="ids-column-note">
            Capture discussion notes and define the action needed.
          </p>
          {discussIssues.map((issue) => renderIssueCard(issue, true, false))}
        </div>

        <div className="ids-column">
          <h2>Solve</h2>
          <p className="ids-column-note">
            Issues with assigned actions or closed decisions.
          </p>
          {solveIssues.map((issue) => renderIssueCard(issue, false, true))}
        </div>
      </div>
    </div>
  );
}

export default IDSWorkflow;