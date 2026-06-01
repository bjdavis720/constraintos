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
  teamMembers,
  teamMemberForm,
setTeamMemberForm,
editingTeamMemberId,
setEditingTeamMemberId,
addTeamMember,
deleteTeamMember,
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
            {selectedProject && (
        <div className="data-card">
          <h2>Project Team Members</h2>
          <p>Add people who can be assigned To-Dos and receive reminder emails.</p>

          <form className="entry-form" onSubmit={addTeamMember}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder="Name"
                value={teamMemberForm.name}
                onChange={(e) =>
                  setTeamMemberForm({
                    ...teamMemberForm,
                    name: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Email"
                value={teamMemberForm.email}
                onChange={(e) =>
                  setTeamMemberForm({
                    ...teamMemberForm,
                    email: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-group">
  <label>Company</label>
  <input
    type="text"
    placeholder="Company"
    value={teamMemberForm.company}
    onChange={(e) =>
      setTeamMemberForm({
        ...teamMemberForm,
        company: e.target.value,
      })
    }
  />
</div>

<div className="form-group">
  <label>Role</label>
  <input
    type="text"
    placeholder="Role"
    value={teamMemberForm.role}
    onChange={(e) =>
      setTeamMemberForm({
        ...teamMemberForm,
        role: e.target.value,
      })
    }
  />
</div>

            <div className="form-button-group">
  <label>&nbsp;</label>

  <button type="submit">
    {editingTeamMemberId ? "Save Contact" : "Add Contact"}
  </button>

  {editingTeamMemberId && (
    <button
      type="button"
      className="secondary-button cancel-button"
      onClick={() => {
        setEditingTeamMemberId(null);

        setTeamMemberForm({
          name: "",
          email: "",
          company: "",
          role: "",
        });
      }}
    >
      Cancel
    </button>
  )}
</div>
          </form>

          {teamMembers.length === 0 ? (
            <p>No team members added yet for this project.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
  <th>Name</th>
  <th>Email</th>
  <th>Company</th>
  <th>Role</th>
  <th>Actions</th>
</tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => (
                  <tr key={member.id}>
  <td>{member.name}</td>
  <td>{member.email}</td>
  <td>{member.company || "-"}</td>
  <td>{member.role || "-"}</td>
  <td>
  <button
    type="button"
    className="secondary-button small-button"
    onClick={() => {
      setEditingTeamMemberId(member.id);
      setTeamMemberForm({
        name: member.name || "",
        email: member.email || "",
        company: member.company || "",
        role: member.role || "",
      });
    }}
  >
    Edit
  </button>

  <button
    type="button"
    className="secondary-button small-button danger-button"
    onClick={() => deleteTeamMember(member.id)}
  >
    Delete
  </button>
</td>
</tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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