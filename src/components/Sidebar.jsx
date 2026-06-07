function Sidebar({
  activePage,
  setActivePage,
  selectedProject,
  setSelectedProject,
  projects,
}) {
  const constraintOSPages = [
    "Schedule Intelligence",
    "4-Week Look Ahead and Sprint Plan",
    "Submittal Readiness",
    "Schedule Milestones",
    "TIA Intelligence",
    "Constraint Board",
    "Issues Board",
    "To-Dos",
  ];

  const projectHealthPages = [
    "Project Health Dashboard",
    "Project Health Reviews",
    "Design Integration Dashboard",
    "Long Lead Dashboard",
    "Procurement Dashboard",
    "Executive Attention",
  ];

  const revenueOSPages = ["Revenue Forecast"];

  const inSentinelHome = activePage === "SentinelOS Home";
  const inProjectSetup = activePage === "Project Setup";
  const inConstraintOS = constraintOSPages.includes(activePage);
  const inProjectHealthOS = projectHealthPages.includes(activePage);
  const inRevenueOS = revenueOSPages.includes(activePage);

  const activeSections = inConstraintOS
    ? [{ label: "Workflow", items: constraintOSPages }]
    : inProjectHealthOS
    ? [{ label: "Health", items: projectHealthPages }]
    : inRevenueOS
    ? [{ label: "RevenueOS", items: revenueOSPages }]
    : [];

  return (
    <aside className="sidebar">
      <button
        type="button"
        className={
          inSentinelHome
            ? "sidebar-card sidebar-brand-card sidebar-home-brand active"
            : "sidebar-card sidebar-home-link"
        }
        onClick={() => setActivePage("SentinelOS Home")}
      >
        <img
          src={`${import.meta.env.BASE_URL}sentinel-logo.png`}
          alt="SentinelOS"
          className={inSentinelHome ? "logo sidebar-logo" : "sidebar-home-logo"}
        />

        {inSentinelHome && (
          <>
            <h1 className="sidebar-brand-title">
              Sentinel<span className="os-highlight">OS</span>
            </h1>

            <p className="sidebar-brand-subtitle">
              Project Risk & Execution Intelligence
            </p>
          </>
        )}
      </button>

      {!inSentinelHome && (
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

      {selectedProject && !inSentinelHome && !inProjectSetup && (
        <>
          {activeSections.map((section) => (
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