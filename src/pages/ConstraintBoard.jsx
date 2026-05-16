function ConstraintBoard({
  project,
  milestones,
  constraints,
  constraintForm,
  setConstraintForm,
  addConstraint,
  updateConstraintStatus,
  moveConstraintToIssue,
}) {
  function handleChange(e) {
    const { name, value } = e.target;
    setConstraintForm({ ...constraintForm, [name]: value });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Constraint Board</h1>
        <p>{project}</p>
      </div>

      <form className="entry-form" onSubmit={addConstraint}>
        <input
          name="description"
          value={constraintForm.description}
          onChange={handleChange}
          placeholder="Constraint / blocker"
        />

        <input
          name="owner"
          value={constraintForm.owner}
          onChange={handleChange}
          placeholder="Owner"
        />

        <input
          name="requiredBy"
          type="date"
          value={constraintForm.requiredBy}
          onChange={handleChange}
        />

        <select
          name="milestone"
          value={constraintForm.milestone}
          onChange={handleChange}
        >
          <option value="">Select Milestone</option>
          {milestones.map((milestone) => (
            <option key={milestone.id} value={milestone.name}>
              {milestone.name}
            </option>
          ))}
        </select>

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

        <button type="submit">+ Add Constraint</button>
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