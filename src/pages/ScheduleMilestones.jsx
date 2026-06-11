import React, { useState } from "react";

function ScheduleMilestones({
  project,
  milestones,
  milestoneForm,
  setMilestoneForm,
  addMilestone,
  updateMilestoneStatus,
  archiveMilestone,
  unarchiveMilestone,
  permissions,
  issues = [],
  todos = [],
  updateCurrentProjectData,
}) {
  const activeMilestones = milestones.filter((milestone) => !milestone.archived);
  const archivedMilestones = milestones.filter((milestone) => milestone.archived);
  const [expandedMilestoneId, setExpandedMilestoneId] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setMilestoneForm({ ...milestoneForm, [name]: value });
  }

  function getMilestoneIssues(milestone) {
    return issues.filter(
      (issue) =>
        issue.milestoneId === milestone.id || issue.milestone === milestone.name
    );
  }

  function getMilestoneOpenIssues(milestone) {
    return getMilestoneIssues(milestone).filter(
      (issue) => issue.status !== "Closed" && !issue.archived
    );
  }

  function getMilestoneOpenTodos(milestone) {
    const milestoneIssueIds = getMilestoneIssues(milestone).map(
      (issue) => issue.id
    );

    return todos.filter(
      (todo) =>
        milestoneIssueIds.includes(todo.sourceIssueId) &&
        todo.status !== "Complete" &&
        todo.status !== "Closed"
    );
  }

  function createIssueFromMilestone(milestone) {
    const newIssue = {
      id: Date.now(),
      title: `Milestone Issue: ${milestone.name}`,
      source: "Schedule Milestones",
      milestoneId: milestone.id,
      milestone: milestone.name,
      status: "Open",
      manuallyEscalated: milestone.status === "Off Track",
      createdAt: new Date().toISOString(),
      notes: `Issue created from Schedule Milestone: ${milestone.name}.  Target date: ${
        milestone.due || "Not set"
      }.  Current milestone status: ${milestone.status || "Not set"}.`,
    };

    updateCurrentProjectData({
      issues: [...issues, newIssue],
    });

    alert("Milestone issue created.");
  }

  function toggleMilestoneDrilldown(milestoneId) {
    setExpandedMilestoneId(
      expandedMilestoneId === milestoneId ? null : milestoneId
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Schedule Milestones</h1>
        <p>{project}</p>
      </div>

      {!permissions.canAddMilestone && (
        <div className="card">
          <p>You have read-only access to schedule milestones.</p>
        </div>
      )}

      <form className="entry-form milestone-form" onSubmit={addMilestone}>
        <div className="form-group">
          <label>Milestone Name</label>
          <input
            name="name"
            value={milestoneForm.name}
            onChange={handleChange}
            placeholder="Milestone name"
            disabled={!permissions.canAddMilestone}
          />
        </div>

        <div className="form-group">
          <label>Target Date</label>
          <input
            name="due"
            type="date"
            value={milestoneForm.due}
            onChange={handleChange}
            disabled={!permissions.canAddMilestone}
          />
        </div>

        <div className="form-group">
          <label>Status</label>
          <select
            name="status"
            value={milestoneForm.status}
            onChange={handleChange}
            disabled={!permissions.canAddMilestone}
          >
            <option>On Track</option>
            <option>At Risk</option>
            <option>Off Track</option>
            <option>Complete</option>
            <option>Imported</option>
          </select>
        </div>

        <div className="form-button-group">
          <label>&nbsp;</label>
          <button type="submit" disabled={!permissions.canAddMilestone}>
            + Add Milestone
          </button>
        </div>
      </form>

      <div className="data-card">
        <h2>Active Milestones</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
<th>Original Baseline</th>
<th>Current Date</th>
<th>Variance</th>
<th>Status</th>
              <th>Open Issues</th>
              <th>Open Actions</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {activeMilestones.length === 0 && (
              <tr>
                <td colSpan="8">No active milestones.</td>
              </tr>
            )}

            {[...activeMilestones]
              .sort((a, b) => new Date(a.due) - new Date(b.due))
              .map((milestone) => (
                <React.Fragment key={milestone.id}>
                  <tr>
                    <td>{milestone.name}</td>

<td>{milestone.originalBaselineDate || milestone.due || "-"}</td>

<td>{milestone.due || "-"}</td>

<td>
  {milestone.originalBaselineDate && milestone.due
    ? `${Math.ceil(
        (new Date(milestone.due) -
          new Date(milestone.originalBaselineDate)) /
          (1000 * 60 * 60 * 24)
      )} days`
    : "-"}
</td>

<td>
  <button
                        type="button"
                        className={`status-pill-button ${milestone.status
                          .replaceAll(" ", "-")
                          .toLowerCase()}`}
                        onClick={() => updateMilestoneStatus(milestone.id)}
                        disabled={!permissions.canAddMilestone}
                      >
                        {milestone.status}
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => toggleMilestoneDrilldown(milestone.id)}
                      >
                        {getMilestoneOpenIssues(milestone).length}
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => toggleMilestoneDrilldown(milestone.id)}
                      >
                        {getMilestoneOpenTodos(milestone).length}
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => createIssueFromMilestone(milestone)}
                      >
                        Create Issue
                      </button>

                      <button
                        type="button"
                        className="secondary-button small-button"
                        disabled={milestone.status !== "Complete"}
                        title={
                          milestone.status !== "Complete"
                            ? "Milestone must be marked Complete before it can be archived."
                            : "Archive milestone"
                        }
                        onClick={() => archiveMilestone(milestone.id)}
                      >
                        Archive
                      </button>
                    </td>
                  </tr>

                  {expandedMilestoneId === milestone.id && (
                    <tr>
                      <td colSpan="6">
                        <div className="card">
                          <h3>Related Issues</h3>

                          {getMilestoneOpenIssues(milestone).length === 0 ? (
                            <p>No open issues.</p>
                          ) : (
                            <ul>
                              {getMilestoneOpenIssues(milestone).map(
                                (issue) => (
                                  <li key={issue.id}>
                                    {issue.title} ({issue.status})
                                  </li>
                                )
                              )}
                            </ul>
                          )}

                          <h3>Related Actions</h3>

                          {getMilestoneOpenTodos(milestone).length === 0 ? (
                            <p>No open actions.</p>
                          ) : (
                            <ul>
                              {getMilestoneOpenTodos(milestone).map((todo) => (
                                <li key={todo.id}>
                                  {todo.action}
                                  {todo.owner ? ` — ${todo.owner}` : ""}
                                  {todo.dueDate
                                    ? ` (Due ${todo.dueDate})`
                                    : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
          </tbody>
        </table>
      </div>

      {archivedMilestones.length > 0 && (
        <div className="data-card">
          <h2>Archived Milestones</h2>

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Target Date</th>
                <th>Status</th>
                <th>Open Issues</th>
                <th>Open Actions</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {archivedMilestones.map((milestone) => (
                <tr key={milestone.id}>
                  <td>{milestone.name}</td>
                  <td>{milestone.due}</td>
                  <td>{milestone.status}</td>
                  <td>{getMilestoneOpenIssues(milestone).length}</td>
                  <td>{getMilestoneOpenTodos(milestone).length}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => unarchiveMilestone(milestone.id)}
                    >
                      Unarchive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ScheduleMilestones;