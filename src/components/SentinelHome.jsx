import { useState } from "react";
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
  const [projectSearch, setProjectSearch] = useState("");

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  const visibleProjects = activeProjects.filter((project) => {
    const search = projectSearch.toLowerCase();

    return (
      project.name?.toLowerCase().includes(search) ||
      project.client?.toLowerCase().includes(search) ||
      project.location?.toLowerCase().includes(search)
    );
  });

  function getProjectSummary(project) {
    const data = projectData[project.id] || {};
    const issues = data.issues || [];
    const todos = data.todos || [];
    const riskPlaybook = data.riskPlaybook || [];

    const openIssues = issues.filter(
      (item) => item.status !== "Closed" && !item.archived
    );

    const openTodos = todos.filter((item) => item.status === "Open");
    const overdueTodos = todos.filter((item) => isOverdue(item));

    const executiveIssues = openIssues.filter((item) =>
      needsExecutiveAttention(item)
    );

    const openRisks = riskPlaybook.filter((risk) => risk.status !== "Closed");

    const riskScore = openRisks.reduce((total, risk) => {
      const probability = Number(risk.probability || 0);
      const impact = Number(risk.impact || 0);
      return total + probability * impact;
    }, 0);

    return {
      openIssues,
      openTodos,
      openRisks,
      executiveAttention: executiveIssues.length + overdueTodos.length,
      riskScore,
    };
  }

  function openModule(page) {
    if (activeProjects.length === 0) {
      setActivePage("Project Setup");
      return;
    }

    if (!selectedProject) {
      alert("Select a project from the Project Registry before opening a module.");
      return;
    }

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
          <p className="sentinel-tagline">
            Project Risk & Execution Intelligence
          </p>
          <p>
            Identify risk early. Create accountability. Drive resolution across
            every project.
          </p>
        </div>
      </div>

      <div className="sentinel-home-layout">
        <aside className="sentinel-home-module-sidebar">
          <button
            type="button"
            className="sentinel-home-module-button"
            onClick={() => openModule("Schedule Intelligence")}
          >
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ConstraintOS" />
            <span>ConstraintOS</span>
          </button>

          <button
            type="button"
            className="sentinel-home-module-button"
            onClick={() => openModule("Project Health Reviews")}
          >
            <img
              src={`${import.meta.env.BASE_URL}projecthealth-logo.png`}
              alt="ProjectHealthOS"
            />
            <span>ProjectHealthOS</span>
          </button>

          <button
            type="button"
            className="sentinel-home-module-button"
            onClick={() => openModule("Revenue Forecast")}
          >
            <img
              src={`${import.meta.env.BASE_URL}revenue-logo.png`}
              alt="RevenueOS"
            />
            <span>RevenueOS</span>
          </button>

          <button
            type="button"
            className="sentinel-home-module-button"
            onClick={() => openModule("RiskIntegratorOS")}
          >
            <img
              src={`${import.meta.env.BASE_URL}riskintegrator-logo.png`}
              alt="RiskIntegratorOS"
            />
            <span>RiskIntegratorOS</span>
          </button>

          <button type="button" className="sentinel-home-module-button coming-soon">
            <div className="accountability-logo-placeholder">A</div>
            <span>AccountabilityOS</span>
            <small>Coming Soon</small>
          </button>
        </aside>

        <main className="sentinel-home-main">
          <div className="data-card sentinel-project-card sentinel-primary-card">
            <div className="section-header-row">
              <div>
                <h2>Project Registry</h2>
                <p>Select or create a project before entering a SentinelOS module.</p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => setActivePage("Project Setup")}
              >
                + Add / Manage Projects & Teams
              </button>
            </div>

            <input
              type="text"
              className="project-search-input"
              placeholder="Search projects by name, client, or location..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
            />

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
                {visibleProjects.map((project) => (
                  <tr
                    key={project.id}
                    className={
                      selectedProject === project.id
                        ? "clickable-row selected-row"
                        : "clickable-row"
                    }
                    onClick={() => setSelectedProject(project.id)}
                  >
                    <td>{project.name}</td>
                    <td>{project.status}</td>
                    <td>{project.client || "-"}</td>
                    <td>{project.location || "-"}</td>
                  </tr>
                ))}

                {visibleProjects.length === 0 && (
                  <tr>
                    <td colSpan="4">No matching projects found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="data-card sentinel-portfolio-card">
            <div className="section-header-row">
              <div>
                <h2>Project Portfolio Summary</h2>
                <p>Executive view across risks, issues, actions, and revenue.</p>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Risk Score</th>
                  <th>Risks</th>
                  <th>Issues</th>
                  <th>To-Dos</th>
                  <th>Executive Attention</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {visibleProjects.map((project) => {
                  const summary = getProjectSummary(project);

                  return (
                    <tr
                      key={project.id}
                      className={
                        selectedProject === project.id
                          ? "clickable-row selected-row"
                          : "clickable-row"
                      }
                      onClick={() => setSelectedProject(project.id)}
                    >
                      <td>{project.name}</td>
                      <td>
                        <span
                          className={`portfolio-risk-score ${
                            summary.riskScore >= 40
                              ? "high"
                              : summary.riskScore >= 15
                              ? "medium"
                              : "low"
                          }`}
                        >
                          {summary.riskScore}
                        </span>
                      </td>
                      <td>{summary.openRisks.length}</td>
                      <td>{summary.openIssues.length}</td>
                      <td>{summary.openTodos.length}</td>
                      <td>{summary.executiveAttention}</td>
                      <td>{project.status}</td>
                    </tr>
                  );
                })}

                {visibleProjects.length === 0 && (
                  <tr>
                    <td colSpan="7">No matching projects found.</td>
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

export default SentinelHome;