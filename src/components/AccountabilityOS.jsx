import ModuleHeader from "./ModuleHeader.jsx";
import { useState } from "react";

function AccountabilityOS({
  project,
  projectData,
  selectedProject,
}) {
  const [projectFilter, setProjectFilter] = useState("All Projects");
  const [ownerFilter, setOwnerFilter] = useState("All Owners");

  const allActions = Object.entries(projectData || {}).flatMap(
    ([projectId, data]) => {
      const constraintTodos = data.todos || [];
      const healthTodos = data.projectHealthOS?.todos || [];

      const projectName =
        data.projectName ||
        data.name ||
        (projectId === selectedProject ? project : "Unknown Project");

      return [
        ...constraintTodos.map((todo) => ({
          ...todo,
          projectId,
          projectName,
          source: "ConstraintOS",
        })),

        ...healthTodos.map((todo) => ({
          ...todo,
          projectId,
          projectName,
          source: "ProjectHealthOS",
        })),
      ];
    }
  );

  const projectOptions = [
    "All Projects",
    ...new Set(allActions.map((action) => action.projectName).filter(Boolean)),
  ];

  const ownerOptions = [
    "All Owners",
    ...new Set(allActions.map((action) => action.owner).filter(Boolean)),
  ];

  const actions = allActions.filter((action) => {
    const matchesProject =
      projectFilter === "All Projects" || action.projectName === projectFilter;

    const matchesOwner =
      ownerFilter === "All Owners" || action.owner === ownerFilter;

    return matchesProject && matchesOwner;
  });

  const openActions = actions.filter((action) => action.status === "Open");

  const overdueActions = actions.filter((action) => {
    if (!action.dueDate) return false;
    return new Date(action.dueDate) < new Date();
  });
  

  return (
  <div className="page accountability-page">
    <ModuleHeader
      logo="Accountability-logo.png"
      title="AccountabilityOS"
      subtitle="OWNERSHIP • ACTION • RESULTS"
      project={project}
      description="Centralized ownership, due dates, escalation, and action resolution."
    />

    <div className="accountability-executive-layout">
      <aside className="accountability-executive-sidebar">
        <button
          type="button"
          className="accountability-home-button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("sentinel:navigate-home"))
          }
        >
          🛡️ SentinelOS Home
        </button>

        <div className="accountability-sidebar-section">
          <div className="accountability-sidebar-heading">Accountability</div>

          <button
            type="button"
            className="accountability-nav-item"
            onClick={() =>
              document
                .getElementById("accountability-metrics")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            📊 Executive Metrics
          </button>

          <button
            type="button"
            className="accountability-nav-item"
            onClick={() =>
              document
                .getElementById("action-register")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            ✅ Action Register
          </button>
        </div>
      </aside>

      <main className="accountability-executive-main">
        <div id="accountability-metrics" className="sentinel-metric-grid">
          <div className="sentinel-metric-card">
            <span>Open Actions</span>
            <strong>{openActions.length}</strong>
          </div>

          <div className="sentinel-metric-card warning">
            <span>Overdue Actions</span>
            <strong>{overdueActions.length}</strong>
          </div>

          <div className="sentinel-metric-card">
            <span>Total Actions</span>
            <strong>{actions.length}</strong>
          </div>
        </div>
<div className="data-card accountability-filter-card">
  <h2>Filter Actions</h2>

  <div className="accountability-filter-row">
    <label>
      Project
      <select
        value={projectFilter}
        onChange={(e) => setProjectFilter(e.target.value)}
      >
        {projectOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>

    <label>
      Owner
      <select
        value={ownerFilter}
        onChange={(e) => setOwnerFilter(e.target.value)}
      >
        {ownerOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  </div>
</div>
        <div id="action-register" className="data-card">
          <h2>Action Register</h2>

          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Action</th>
                <th>Owner</th>
                <th>Source</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {actions.map((action) => (
                <tr key={`${action.source}-${action.id}`}>
                    <td>{action.projectName}</td>
                  <td>{action.action}</td>
                  <td>{action.owner || "-"}</td>
                  <td>{action.source}</td>
                  <td>{action.dueDate || "-"}</td>
                  <td>{action.status || "Open"}</td>
                </tr>
              ))}

              {actions.length === 0 && (
                <tr>
                  <td colSpan="6">No actions currently exist.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
);
}

export default AccountabilityOS;