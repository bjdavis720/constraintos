function Sidebar({
  activePage,
  setActivePage,
  selectedProject,
  setSelectedProject,
  projects,
}) {
  const navSections = [
    {
      label: "DASHBOARDS & ESCALATION",
      items: ["Executive Dashboard", "Project Dashboard", "Executive Attention"],
    },
    {
      label: "WORKFLOW",
      items: [
  "Schedule Intelligence",
  "Schedule Milestones",  
  "Constraint Board",
  "Issues Board",
  "To-Dos",
],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-card">
        <img src="/logo.png" alt="ConstraintOS" className="logo" />
        <p>From Schedule Variance to Action</p>
      </div>

      <button
        type="button"
        className="project-setup-button"
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
                  className={
                    activePage === item ? "nav-link active" : "nav-link"
                  }
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