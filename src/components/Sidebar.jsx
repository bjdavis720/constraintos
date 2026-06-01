function Sidebar({
  activePage,
  setActivePage,
  selectedProject,
  setSelectedProject,
  projects,
}) {
  const constraintOSSections = [
    {
      label: "CONSTRAINTOS",
      items: [
        "Project Dashboard",
        "Schedule Intelligence",
        "4-Week Look Ahead and Pull Plan",
        "Submittal Readiness",
        "Schedule Milestones",
        "TIA Intelligence",
        "Constraint Board",
        "Issues Board",
        "To-Dos",
      ],
    },
    {
      label: "REVENUEOS",
      items: ["Revenue Forecast"],
    },
    {
      label: "EXECUTIVECOMMANDOS",
      items: ["Executive Dashboard", "Executive Attention"],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-card sidebar-brand-card">
        <img
  src={`${import.meta.env.BASE_URL}sentinel-logo.png`}
  alt="SentinelOS"
  className="logo sidebar-logo"
/>

        <h1 className="sidebar-brand-title">
  Sentinel<span className="os-highlight">OS</span>
</h1>

        <p className="sidebar-brand-subtitle">
          Project Risk & Execution Intelligence
        </p>
      </div>

      <button
        type="button"
        className={
          activePage === "SentinelOS Home"
            ? "project-setup-button active"
            : "project-setup-button"
        }
        onClick={() => setActivePage("SentinelOS Home")}
      >
        SentinelOS Home
      </button>

       {activePage !== "SentinelOS Home" && (
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
)}

      {selectedProject && activePage !== "SentinelOS Home" && (
        <>
          {constraintOSSections.map((section) => (
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

          <div className="nav-section">
            <div className="nav-section-label">COMING SOON</div>

            {["ProjectHealthOS", "RiskIntegratorOS", "ResourceOS"].map((item) => (
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
        </>
      )}
    </aside>
  );
}

export default Sidebar;