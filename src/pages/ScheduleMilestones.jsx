function ScheduleMilestones({
  project,
  milestones,
  milestoneForm,
  setMilestoneForm,
  addMilestone,
  updateMilestoneStatus,
  archiveMilestone,
  permissions,
  issues = [],
  updateCurrentProjectData,
}) {
  const activeMilestones = milestones.filter((milestone) => !milestone.archived);
  const archivedMilestones = milestones.filter((milestone) => milestone.archived);

  function handleChange(e) {
    const { name, value } = e.target;
    setMilestoneForm({ ...milestoneForm, [name]: value });
  }

  function createIssueFromMilestone(milestone) {
    const alreadyExists = issues.some(
      (issue) =>
        issue.source === "Schedule Milestones" &&
        issue.milestoneId === milestone.id &&
        issue.status !== "Closed"
    );

    if (alreadyExists) {
      alert("An open issue already exists for this milestone.");
      return;
    }

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
              <th>Target Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {activeMilestones.length === 0 && (
              <tr>
                <td colSpan="4">No active milestones.</td>
              </tr>
            )}

            {[...activeMilestones]
              .sort((a, b) => new Date(a.due) - new Date(b.due))
              .map((milestone) => {
                const issueAlreadyExists = issues.some(
                  (issue) =>
                    issue.source === "Schedule Milestones" &&
                    issue.milestoneId === milestone.id &&
                    issue.status !== "Closed"
                );

                return (
                  <tr key={milestone.id}>
                    <td>{milestone.name}</td>
                    <td>{milestone.due}</td>
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
                        onClick={() => createIssueFromMilestone(milestone)}
                        disabled={issueAlreadyExists}
                      >
                        {issueAlreadyExists ? "Issue Created" : "Create Issue"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button small-button"
                        onClick={() => archiveMilestone(milestone.id)}
                        disabled={!permissions.canArchiveMilestone}
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

      {archivedMilestones.length > 0 && (
        <div className="data-card">
          <h2>Archived Milestones</h2>

          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Target Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {archivedMilestones.map((milestone) => (
                <tr key={milestone.id}>
                  <td>{milestone.name}</td>
                  <td>{milestone.due}</td>
                  <td>{milestone.status}</td>
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