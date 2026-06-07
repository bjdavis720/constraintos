function ConstraintBoard({
  project,
  teamMembers = [],
  milestones,
  constraints,
  constraintForm,
  setConstraintForm,
  addConstraint,
  updateConstraintStatus,
  moveConstraintToIssue,
}) {
  const projectTeamMembers = teamMembers || [];
  const projectName =
  typeof project === "object" ? project.name : "";

  function handleChange(e) {
    const { name, value } = e.target;
    setConstraintForm({ ...constraintForm, [name]: value });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Constraint Board</h1>
        <p>{projectName}</p>
      </div>

      <form className="entry-form" onSubmit={addConstraint}>
        <div className="constraint-form-grid">
          <div className="form-field">
            <label>Constraint</label>
            <input
              name="description"
              value={constraintForm.description}
              onChange={handleChange}
              placeholder="Describe the constraint"
            />
          </div>

          <div className="form-field">
  <label>Owner</label>
  <select
    name="owner"
    value={constraintForm.owner}
    onChange={handleChange}
  >
    <option value="">Select owner</option>
    {projectTeamMembers.map((member) => {
      const memberName =
        member.name || member.fullName || member.email || "Unnamed";

      return (
        <option
          key={member.id || member.email || memberName}
          value={memberName}
        >
          {memberName}
        </option>
      );
    })}
  </select>
</div>

          <div className="form-field">
            <label>Required By</label>
            <input
              type="date"
              name="requiredBy"
              value={constraintForm.requiredBy}
              onChange={handleChange}
            />
          </div>

          <div className="form-field">
            <label>Linked Milestone</label>
            <select
              name="milestone"
              value={constraintForm.milestone}
              onChange={handleChange}
            >
              <option value="">Select milestone</option>
              {milestones.map((milestone) => (
                <option key={milestone.id} value={milestone.name}>
                  {milestone.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Status</label>
            <select
              name="status"
              value={constraintForm.status}
              onChange={handleChange}
            >
              <option>Open</option>
              <option>Waiting</option>
              <option>Escalated</option>
              <option>Closed</option>
            </select>
          </div>

          <button type="submit">+ Add Constraint</button>
        </div>
      </form>

      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Constraint</th>
              <th>Owner</th>
              <th>Required By</th>
              <th>Linked Milestone</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {constraints.map((constraint) => (
              <tr key={constraint.id}>
                <td>{constraint.description}</td>
                <td>{constraint.owner}</td>
                <td>{constraint.requiredBy}</td>
                <td>{constraint.milestone}</td>

                <td>
                  <button
                    type="button"
                    className={`status-pill-button ${constraint.status
                      .replaceAll(" ", "-")
                      .toLowerCase()}`}
                    onClick={() => updateConstraintStatus(constraint.id)}
                  >
                    {constraint.status}
                  </button>
                </td>

                <td>
                  <button
                    type="button"
                    className="secondary-button small-button"
                    onClick={() => moveConstraintToIssue(constraint)}
                  >
                    Move to Issues
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ConstraintBoard;