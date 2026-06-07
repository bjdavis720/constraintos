import Metric from "../components/Metric.jsx";

function getConstraintAge(constraint) {
  const createdDate = constraint.createdAt
    ? new Date(constraint.createdAt)
    : constraint.requiredBy
    ? new Date(constraint.requiredBy)
    : null;

  if (!createdDate || Number.isNaN(createdDate.getTime())) return 0;

  const today = new Date();
  return Math.max(
    0,
    Math.ceil((today - createdDate) / (1000 * 60 * 60 * 24))
  );
}

function getAgingClass(age) {
  if (age >= 30) return "red";
  if (age >= 15) return "yellow";
  return "green";
}

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
  archiveConstraint,
  deleteConstraint,
  setActivePage,
}) {
  const projectTeamMembers = teamMembers || [];
  const projectName = typeof project === "object" ? project.name : "";

  const activeConstraints = constraints
    .filter((constraint) => !constraint.archived)
    .sort((a, b) => getConstraintAge(b) - getConstraintAge(a));

  const openConstraints = activeConstraints.filter(
  (constraint) =>
    constraint.status !== "Closed" &&
    constraint.status !== "Archived"
);

  const overdueConstraints = openConstraints.filter((constraint) => {
    if (!constraint.requiredBy) return false;
    return new Date(constraint.requiredBy) < new Date();
  });

  const averageAge =
    openConstraints.length > 0
      ? Math.round(
          openConstraints.reduce(
            (total, constraint) => total + getConstraintAge(constraint),
            0
          ) / openConstraints.length
        )
      : 0;

  const oldestConstraint =
    openConstraints.length > 0
      ? Math.max(...openConstraints.map((constraint) => getConstraintAge(constraint)))
      : 0;

  function handleChange(e) {
    const { name, value } = e.target;
    setConstraintForm({ ...constraintForm, [name]: value });
  }

  function returnToSource() {
    const savedPath = sessionStorage.getItem("sentinel_return_path");
    if (!savedPath) return;

    const returnPath = JSON.parse(savedPath);

    if (returnPath.page && setActivePage) {
      setActivePage(returnPath.page);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Constraint Board</h1>
          <p>{projectName}</p>
        </div>

        {sessionStorage.getItem("sentinel_return_path") && (
          <button
            type="button"
            className="secondary-button"
            onClick={returnToSource}
          >
            Return to Sprint Plan
          </button>
        )}
      </div>

      <div className="grid">
        <Metric
          title="Open Constraints"
          value={openConstraints.length}
          note="Not closed"
        />

        <Metric
          title="Overdue Constraints"
          value={overdueConstraints.length}
          note="Required date has passed"
        />

        <Metric
          title="Average Age"
          value={`${averageAge} days`}
          note="Open constraints"
        />

        <Metric
          title="Oldest Constraint"
          value={`${oldestConstraint} days`}
          note="Oldest open item"
        />
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
              <th>Aging</th>
              <th>Linked Milestone</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {activeConstraints.map((constraint) => {
              const age = getConstraintAge(constraint);

              return (
                <tr key={constraint.id}>
                  <td>{constraint.description}</td>
                  <td>{constraint.owner}</td>
                  <td>{constraint.requiredBy}</td>
                  <td>
                    <span className={`status-pill ${getAgingClass(age)}`}>
                      {age} days
                    </span>
                  </td>
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

                    {constraint.status === "Closed" && (
                      <>
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => archiveConstraint(constraint.id)}
                        >
                          Archive
                        </button>

                        <button
                          type="button"
                          className="delete-button small-button"
                          onClick={() => deleteConstraint(constraint.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ConstraintBoard;