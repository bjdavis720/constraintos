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

  const projectHealthPages = ["ProjectHealthOS"];
  const inProjectHealthOS = projectHealthPages.includes(activePage);

  const inSentinelHome = activePage === "SentinelOS Home";

  const inConstraintOS =
    selectedProject &&
    activePage !== "SentinelOS Home" &&
    activePage !== "Project Setup" &&
    !inProjectHealthOS;

  const activeModuleLogo = inProjectHealthOS
    ? "projecthealth-logo.png"
    : inConstraintOS
    ? "logo.png"
    : "sentinel-logo.png";

  const activeModuleTitle = inProjectHealthOS
    ? "ProjectHealthOS"
    : inConstraintOS
    ? "ConstraintOS"
    : "SentinelOS";

  const activeModuleSubtitle = inProjectHealthOS
    ? "Project Health & Accountability"
    : inConstraintOS
    ? "Operational Constraint Intelligence"
    : "Project Risk & Execution Intelligence";

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
        <div className="sidebar-card sidebar-brand-card">
          <img
            src={`${import.meta.env.BASE_URL}${activeModuleLogo}`}
            alt={activeModuleTitle}
            className="logo sidebar-logo"
          />

          <h1 className="sidebar-brand-title">
            {inProjectHealthOS ? (
              <>
                ProjectHealth<span className="os-highlight">OS</span>
              </>
            ) : (
              <>
                Constraint<span className="os-highlight">OS</span>
              </>
            )}
          </h1>

          <p className="sidebar-brand-subtitle">{activeModuleSubtitle}</p>
        </div>
      )}

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

      {selectedProject && inConstraintOS && (
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