import {
  isOverdue,
  needsExecutiveAttention,
} from "../utils/escalationUtils.js";

function SentinelHome({
  projects,
  projectData,
  selectedProject,
  setSelectedProject,
  setActivePage,
}) {
  const activeProjects = projects.filter((project) => project.status !== "Archived");

  const totals = activeProjects.reduce(
    (acc, project) => {
      const data = projectData[project.id] || {};
      const milestones = data.milestones || [];
      const constraints = data.constraints || [];
      const issues = data.issues || [];
      const todos = data.todos || [];

      const offTrackMilestones = milestones.filter(
        (item) => !item.archived && item.status === "Off Track"
      );
      const escalatedConstraints = constraints.filter(
        (item) => item.status === "Escalated"
      );
      const openIssues = issues.filter(
        (item) => item.status !== "Closed" && !item.archived
      );
      const executiveIssues = openIssues.filter((item) =>
        needsExecutiveAttention(item)
      );
      const openTodos = todos.filter((item) => item.status === "Open");
      const overdueTodos = todos.filter((item) => isOverdue(item));

      acc.openIssues += openIssues.length;
      acc.openConstraints += constraints.filter((item) => item.status !== "Closed").length;
      acc.openTodos += openTodos.length;
      acc.executiveAttention +=
        offTrackMilestones.length +
        escalatedConstraints.length +
        executiveIssues.length +
        overdueTodos.length;

      return acc;
    },
    {
      openIssues: 0,
      openConstraints: 0,
      openTodos: 0,
      executiveAttention: 0,
    }
  );

  function openModule(page) {
    setActivePage(page);
  }

  return (
    <div className="page sentinel-home">
      <div className="sentinel-hero compact">
        <img
          src={`${import.meta.env.BASE_URL}sentinel-logo.png`}
          alt="SentinelOS"
          className="sentinel-hero-logo"
        />

        <div>
          <h1>
  Sentinel<span className="os-highlight">OS</span>
</h1>
          <p className="sentinel-tagline">Project Risk & Execution Intelligence</p>
          <p>
            Identify risk early.  Create accountability.  Drive resolution across
            every project.
          </p>
        </div>
      </div>

      {activeProjects.length === 0 ? (
        <div className="sentinel-welcome-card">
          <h2>Welcome to SentinelOS</h2>
          <p>
            Create your first project to begin tracking constraints, project health,
            risks, revenue forecasts, executive attention, and accountable action.
          </p>

          <button
  type="button"
  className="secondary-button"
  onClick={() => setActivePage("Project Setup")}
>
  {activeProjects.length === 0 ? "Create First Project" : "Project Setup"}
</button>
        </div>
      ) : (
        <div className="sentinel-metric-grid">
          <div className="sentinel-metric-card">
            <span>Active Projects</span>
            <strong>{activeProjects.length}</strong>
          </div>

          <div className="sentinel-metric-card warning">
            <span>Executive Attention</span>
            <strong>{totals.executiveAttention}</strong>
          </div>

          <div className="sentinel-metric-card">
            <span>Open Issues</span>
            <strong>{totals.openIssues}</strong>
          </div>

          <div className="sentinel-metric-card">
            <span>Open To-Dos</span>
            <strong>{totals.openTodos}</strong>
          </div>
        </div>
      )}

      <div className="sentinel-section-header">
        <div>
          <h2>Modules</h2>
          <p>Each module feeds the same project risk and accountability structure.</p>
        </div>
      </div>

      <div className="sentinel-module-grid">
        <button
          type="button"
          className="sentinel-module-card module-constraint active-module"
          onClick={() => {
  if (activeProjects.length === 0) {
    setActivePage("Project Setup");
    return;
  }

  if (!selectedProject) {
    alert(
      "Select a project from the Project Registry below before opening ConstraintOS."
    );
    return;
  }

  setActivePage("Project Dashboard");
}}
        >
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" />
          <span>Active Module</span>
          <h3>ConstraintOS</h3>
          <p>Schedule, milestones, constraints, issues, pull planning, and execution risk.</p>
        </button>

        <button
          type="button"
          className="sentinel-module-card module-health"
          onClick={() => setActivePage("ProjectHealthOS")}
        >
          <img
  src={`${import.meta.env.BASE_URL}projecthealth-logo.png`}
  alt="ProjectHealthOS"
/>
          <span>Active Module</span>
          <h3>ProjectHealthOS</h3>
          <p>
  Project health reviews, accountability tracking,
  issue management, and action resolution.
</p>
        </button>

        <button
          type="button"
          className="sentinel-module-card module-revenue"
          onClick={() => openModule("Revenue Forecast")}
        >
          <img
  src={`${import.meta.env.BASE_URL}revenue-logo.png`}
  alt="RevenueOS"
/>
          <span>Active Module</span>
          <h3>RevenueOS</h3>
          <p>Revenue forecasting, billing movement, BAC analysis, and financial risk.</p>
        </button>

        <button
          type="button"
          className="sentinel-module-card module-risk"
          onClick={() => openModule("RiskIntegratorOS")}
        >
          <img
  src={`${import.meta.env.BASE_URL}riskintegrator-logo.png`}
  alt="RiskIntegratorOS"
/>
          <span>Coming Soon</span>
          <h3>RiskIntegratorOS</h3>
          <p>Risk register, risk playbooks, escalation logic, and accountability governance.</p>
        </button>
      </div>

      <div className="data-card sentinel-project-card">
  <div className="section-header-row">
    <h2>Project Registry</h2>

    <button
      type="button"
      className="secondary-button"
      onClick={() => setActivePage("Project Setup")}
    >
      + Add Project
    </button>
  </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Client</th>
              <th>Location</th>
            </tr>
          </thead>

          <tbody>
            {activeProjects.map((project) => (
              <tr
                key={project.id}
                className={
                  selectedProject === project.id ? "clickable-row selected-row" : "clickable-row"
                }
                onClick={() => {
                  setSelectedProject(project.id);
                  setActivePage("Project Dashboard");
                }}
              >
                <td>{project.name}</td>
                <td>{project.status}</td>
                <td>{project.client || "-"}</td>
                <td>{project.location || "-"}</td>
              </tr>
            ))}

            {activeProjects.length === 0 && (
              <tr>
                <td colSpan="4">No active projects have been created yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SentinelHome;