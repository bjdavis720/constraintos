function ProjectSetup({
  projectForm,
  setProjectForm,
  createProject,
  projects,
  selectedProject,
  setSelectedProject,
  archiveProject,
  restoreProject,
  deleteProject,
  clearCurrentProjectData,
  permissions,
}) {
  function handleChange(e) {
    const { name, value } = e.target;
    setProjectForm({ ...projectForm, [name]: value });
  }

  const activeProjects = projects.filter(
    (project) => project.status !== "Archived"
  );

  const archivedProjects = projects.filter(
    (project) => project.status === "Archived"
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Project Setup</h1>
        <p>Create and manage projects before using workflow tools.</p>
      </div>

      <form className="entry-form project-setup-form" onSubmit={createProject}>
        <div className="form-group">
          <label>Project Name</label>
          <input
            name="name"
            value={projectForm.name}
            onChange={handleChange}
            placeholder="Example: Dunseith LPOE"
          />
        </div>

        <div className="form-group">
          <label>Project Number</label>
          <input
            name="number"
            value={projectForm.number}
            onChange={handleChange}
            placeholder="Project number"
          />
        </div>

        <div className="form-group">
          <label>Client / Agency</label>
          <input
            name="client"
            value={projectForm.client}
            onChange={handleChange}
            placeholder="Example: GSA"
          />
        </div>

        <div className="form-group">
          <label>Location</label>
          <input
            name="location"
            value={projectForm.location}
            onChange={handleChange}
            placeholder="City, State"
          />
        </div>

        <div className="form-group">
          <label>Project Type</label>
          <select
            name="type"
            value={projectForm.type}
            onChange={handleChange}
          >
            <option>Design-Build</option>
            <option>Design-Bid-Build</option>
            <option>CMAR</option>
            <option>Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Status</label>
          <select
            name="status"
            value={projectForm.status}
            onChange={handleChange}
          >
            <option>Active</option>
            <option>Pursuit</option>
            <option>Preconstruction</option>
            <option>Construction</option>
            <option>Closeout</option>
            <option>Archived</option>
          </select>
        </div>

        <div className="form-button-group">
          <label>&nbsp;</label>
          <button type="submit" disabled={!permissions.canCreateProject}>
  + Create Project
</button>
        </div>
      </form>

      <div className="data-card">
        <h2>Active Projects</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Number</th>
              <th>Client</th>
              <th>Location</th>
              <th>Type</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {activeProjects.length === 0 && (
              <tr>
                <td colSpan="7">No active projects exist.</td>
              </tr>
            )}

            {activeProjects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.number || "-"}</td>
                <td>{project.client || "-"}</td>
                <td>{project.location || "-"}</td>
                <td>{project.type}</td>
                <td>{project.status}</td>

                <td>
  <button
    type="button"
    className="secondary-button small-button"
    onClick={() => setSelectedProject(project.id)}
    disabled={selectedProject === project.id}
  >
    {selectedProject === project.id ? "Selected" : "Select"}
  </button>

  <button
    type="button"
    className="secondary-button small-button"
    onClick={() => archiveProject(project.id)}
    disabled={!permissions.canArchiveProject}
  >
    Archive
  </button>

  <button
    type="button"
    className="secondary-button small-button danger-button"
    onClick={() => deleteProject(project.id)}
    disabled={!permissions.canDeleteProject}
  >
    Delete
  </button>
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {archivedProjects.length > 0 && (
        <div className="data-card">
          <h2>Archived Projects</h2>

          <table className="data-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Client</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {archivedProjects.map((project) => (
               <tr key={project.id}>
  <td>{project.name}</td>
  <td>{project.client || "-"}</td>
  <td>{project.status}</td>
  <td>
    <button
      type="button"
      className="secondary-button small-button"
      onClick={() => restoreProject(project.id)}
    >
      Restore
    </button>
  </td>
</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ProjectSetup;