function Sidebar({
  activePage,
  setActivePage,
  selectedProject,
  setSelectedProject,
  projects,
}) {
  const navSections = [
    {
      label: "SCHEDULE",
      items: [
        "Schedule Intelligence",
        "4-Week Look Ahead and Pull Plan",
        "Submittal Readiness",
        "Schedule Milestones",
        "Revenue Forecast",
        "TIA Intelligence",
      ],
    },
    {
      label: "WORKFLOW",
      items: ["Constraint Board", "Issues Board", "To-Dos"],
    },
    {
      label: "DASHBOARDS & ESCALATION",
      items: ["Project Dashboard", "Executive Dashboard", "Executive Attention"],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-card sidebar-brand-card">
        <img src="/logo.png" alt="ConstraintOS" className="logo sidebar-logo" />

        <h1 className="sidebar-brand-title">ConstraintOS</h1>

        <p className="sidebar-brand-subtitle">
          Operational Constraint Intelligence
        </p>
      </div>

      <button
        type="button"
        className={
          activePage === "Project Setup"
            ? "project-setup-button active"
            : "project-setup-button"
        }
        onClick={() => setActivePage("Project Setup")}
      >
        + Project Setup
      </button>

      <div className="project-selector">
        <label>Project</label>

        <select
          value={selectedProject || ""}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          <option value="">Select Project</option>

          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProject && (
        <>
          {navSections.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-label">{section.label}</div>

              {section.items.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={activePage === item ? "nav-link active" : "nav-link"}
                  onClick={() => setActivePage(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ))}
        </>
      )}
    </aside>
  );
}

export default Sidebar;