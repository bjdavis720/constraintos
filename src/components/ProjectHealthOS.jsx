import { useState } from "react";
import * as XLSX from "xlsx";
function ProjectHealthOS({
  project,
  projectHealthOS,
  updateProjectHealthOS,
  teamMembers,
}) {
  const healthData = projectHealthOS || {
    reviewItems: [],
    issues: [],
    todos: [],
    reviewHistory: [],
  };

  const reviewItems = healthData.reviewItems || [];
  const issues = healthData.issues || [];
  const todos = healthData.todos || [];
  const [expandedIssueId, setExpandedIssueId] = useState(null);
const [todoDrafts, setTodoDrafts] = useState({});

  function saveHealthData(updates) {
    updateProjectHealthOS({
      ...healthData,
      ...updates,
    });
  }

  function addReviewItem(e) {
    e.preventDefault();

    const form = new FormData(e.target);
    const heading = form.get("heading")?.trim();
    const item = form.get("item")?.trim();
    const status = form.get("status") || "Green";
const notes = form.get("notes")?.trim() || "";

    if (!heading || !item) {
      alert("Please enter a heading and review item.");
      return;
    }

    const newItem = {
      id: Date.now(),
      heading,
      item,
      status,
notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveHealthData({
      reviewItems: [...reviewItems, newItem],
    });

    e.target.reset();
  }

  function importReviewItems(e) {
    const text = e.target.value;

    if (!text.trim()) return;

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const imported = lines
      .map((line, index) => {
        const parts = line.split(",").map((part) => part.trim());

        if (parts.length < 2) return null;

        return {
          id: Date.now() + index,
          heading: parts[0],
          item: parts[1],
          status,
notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (imported.length === 0) {
      alert("Use this format: Heading, Item");
      return;
    }

    saveHealthData({
      reviewItems: [...reviewItems, ...imported],
    });

    e.target.value = "";
  }

  function updateReviewItem(id, updates) {
    saveHealthData({
      reviewItems: reviewItems.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : item
      ),
    });
  }

  function deleteReviewItem(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this review item?"
    );

    if (!confirmed) return;

    saveHealthData({
      reviewItems: reviewItems.filter((item) => item.id !== id),
    });
  }

  function createIssueFromReviewItem(item) {
    const existingIssue = issues.find(
      (issue) => issue.sourceReviewItemId === item.id && !issue.archived
    );

    if (existingIssue) {
      alert("An open ProjectHealthOS issue already exists for this item.");
      return;
    }

    const newIssue = {
      id: Date.now(),
      source: "ProjectHealthOS",
      sourceReviewItemId: item.id,
      heading: item.heading,
      title: item.item,
      status: "Open",
      manuallyEscalated: false,
      notes: item.notes || "",
      createdAt: new Date().toISOString(),
      archived: false,
    };

    saveHealthData({
      issues: [...issues, newIssue],
    });
  }

  function updateIssueStatus(id) {
    const statusFlow = ["Open", "Discussing", "Action Assigned", "Closed"];

    saveHealthData({
      issues: issues.map((issue) => {
        if (issue.id !== id) return issue;

        const currentIndex = statusFlow.indexOf(issue.status);
        const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];

        return {
          ...issue,
          status: nextStatus,
        };
      }),
    });
  }

  function updateIssueNotes(id, notes) {
    saveHealthData({
      issues: issues.map((issue) =>
        issue.id === id ? { ...issue, notes } : issue
      ),
    });
  }

  function createTodoFromIssue(issue, formData) {
    const action = formData.get("action")?.trim();
    const owner = formData.get("owner")?.trim();
    const dueDate = formData.get("dueDate");
    const assignedToUserId = formData.get("assignedToUserId") || "";

    if (!action || !owner || !dueDate) {
      alert("Please enter an action, owner, and due date.");
      return;
    }

    const newTodo = {
      id: Date.now(),
      action,
      owner,
      assignedToUserId,
      reminderEnabled: true,
      dueDate,
      status: "Open",
      sourceIssueId: issue.id,
      sourceIssueTitle: issue.title,
      discussionNotes: issue.notes || "",
      createdAt: new Date().toISOString(),
    };

    saveHealthData({
      todos: [...todos, newTodo],
      issues: issues.map((item) =>
        item.id === issue.id
          ? {
              ...item,
              status: "Action Assigned",
              assignedActionOwner: owner,
              assignedActionUserId: assignedToUserId,
              assignedActionDueDate: dueDate,
            }
          : item
      ),
    });
  }

  function completeTodo(id) {
    saveHealthData({
      todos: todos.filter((todo) => todo.id !== id),
    });
  }

  const groupedItems = reviewItems.reduce((groups, item) => {
    if (!groups[item.heading]) groups[item.heading] = [];
    groups[item.heading].push(item);
    return groups;
  }, {});
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadCsvTemplate() {
  const csv =
    "Heading,Review Item,Status,Notes\n" +
    "Safety,Weekly safety inspections completed,Green,\n" +
    "Schedule,Monthly update submitted,Yellow,Needs review\n" +
    "Staffing,Staffing plan reviewed,Red,Open discussion item\n";

  downloadFile(
    "projecthealthos-review-template.csv",
    csv,
    "text/csv;charset=utf-8;"
  );
}

function downloadExcelTemplate() {
  const rows = [
    {
      Heading: "Safety",
      "Review Item": "Weekly safety inspections completed",
      Status: "On Track",
      Notes: "",
    },
    {
      Heading: "Schedule",
      "Review Item": "Monthly update submitted",
      Status: "At Risk",
      Notes: "Needs review",
    },
    {
      Heading: "Staffing",
      "Review Item": "Staffing plan reviewed",
      Status: "Off Track",
      Notes: "Open discussion item",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Review Items"
  );

  XLSX.writeFile(
    workbook,
    "projecthealthos-review-template.xlsx"
  );
}
function archiveHealthIssue(id) {
  saveHealthData({
    issues: issues.map((issue) =>
      issue.id === id ? { ...issue, archived: true } : issue
    ),
  });
}
  return (
    <div className="page project-health-os-page">
      <div className="page-header">
        <div>
          <h1>ProjectHealthOS</h1>
                  </div>
      </div>

      <div className="card">
        <h2>Add Review Item</h2>

        <form className="entry-form milestone-form" onSubmit={addReviewItem}>
  <div className="form-group">
    <label>Heading</label>
    <input
      name="heading"
      placeholder="Safety, Schedule, Staffing..."
    />
  </div>

  <div className="form-group">
    <label>Review Item</label>
    <input
      name="item"
      placeholder="Item to review..."
    />
  </div>

  <div className="form-group">
    <label>Status</label>
    <select name="status">
     <option value="Green">On Track</option>
<option value="Yellow">At Risk</option>
<option value="Red">Off Track</option>
<option value="N/A">Not Applicable</option>
    </select>
  </div>

  <div className="form-group">
    <label>Notes</label>
    <input
      name="notes"
      placeholder="Optional notes..."
    />
  </div>

  <div className="form-button-group">
    <label>&nbsp;</label>
    <button type="submit">
      Add Item
    </button>
  </div>
</form>
      </div>

      <div className="card">
  <h2>Import Review Items</h2>

  <div className="button-row">
    <button
  type="button"
  className="secondary-button"
  onClick={downloadCsvTemplate}
>
  Download CSV Template
</button>

    <button
  type="button"
  className="secondary-button"
  onClick={downloadExcelTemplate}
>
  Download Excel Template
</button>

    <input
      type="file"
      accept=".csv,.xlsx,.xls"
    />
  </div>

  <p className="table-subtext">
    Template columns:
    Heading | Review Item | Status | Notes
  </p>
</div>

      <div className="data-card project-health-review-card">
  <div className="section-header-row">
    <h2>Review Items</h2>
  </div>

  <table className="data-table">
          <thead>
            <tr>
              <th>Heading</th>
              <th>Review Item</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Create Issue</th>
              <th>Delete</th>
            </tr>
          </thead>

          <tbody>
            {Object.entries(groupedItems).map(([heading, items]) =>
              items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index === 0 ? heading : ""}</td>
                  <td>{item.item}</td>
                  <td>
  <button
    type="button"
    className={`health-status-pill ${item.status.toLowerCase()}`}
    onClick={() => {
      const statusFlow = ["Green", "Yellow", "Red", "N/A"];

      const currentIndex = statusFlow.indexOf(item.status);

      updateReviewItem(item.id, {
        status:
          statusFlow[
            (currentIndex + 1) % statusFlow.length
          ],
      });
    }}
  >
    {
  item.status === "Green"
    ? "On Track"
    : item.status === "Yellow"
    ? "At Risk"
    : item.status === "Red"
    ? "Off Track"
    : "N/A"
}
  </button>
</td>
                  <td>
                    <textarea
  className="project-health-notes"
  value={item.notes}
  onChange={(e) =>
    updateReviewItem(item.id, { notes: e.target.value })
  }
  placeholder="Notes..."
/>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => createIssueFromReviewItem(item)}
                    >
                      Create Issue
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => deleteReviewItem(item.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}

            {reviewItems.length === 0 && (
              <tr>
                <td colSpan="6">
                  No ProjectHealthOS review items have been added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="data-card project-health-issues-card">
  <h2>Health Review Issues</h2>

  <table className="data-table issues-table">
    <thead>
      <tr>
        <th>Issue</th>
        <th>Heading</th>
        <th>Age</th>
        <th>Status</th>
        <th>Assigned To</th>
        <th>Action Due</th>
        <th>Action</th>
      </tr>
    </thead>

    <tbody>
      {issues.filter((issue) => !issue.archived).length === 0 && (
        <tr>
          <td colSpan="7">No Health Review issues have been created.</td>
        </tr>
      )}

      {issues
        .filter((issue) => !issue.archived)
        .map((issue) => {
          const statusClass = String(issue.status || "Open")
            .replaceAll(" ", "-")
            .toLowerCase();

          const age = issue.createdAt
            ? Math.floor(
                (new Date() - new Date(issue.createdAt)) /
                  (1000 * 60 * 60 * 24)
              )
            : 0;

          return (
            <>
              <tr key={issue.id}>
                <td>{issue.title || "-"}</td>
                <td>{issue.heading || "-"}</td>
                <td>{age} days</td>
                <td>
                  <button
                    type="button"
                    className={`status-pill-button ${statusClass}`}
                    onClick={() => updateIssueStatus(issue.id)}
                  >
                    {issue.status || "Open"}
                  </button>
                </td>
                <td>{issue.assignedActionOwner || "-"}</td>
                <td>{issue.assignedActionDueDate || "-"}</td>
                <td>
                  <button
                    type="button"
                    className="secondary-button small-button"
                    onClick={() =>
                      setExpandedIssueId(
                        expandedIssueId === issue.id ? null : issue.id
                      )
                    }
                  >
                    {expandedIssueId === issue.id
                      ? "Close Workflow"
                      : "Open Workflow"}
                  </button>
                </td>
              </tr>

              {expandedIssueId === issue.id && (
                <tr>
                  <td colSpan="7">
                    <div className="card">
                      <h3>Discuss / Solve</h3>

                      <p>
                        <strong>Issue:</strong> {issue.title}
                      </p>

                      <label>
                        Discussion Notes
                        <textarea
                          className="project-health-notes"
                          value={issue.notes || ""}
                          onChange={(e) =>
                            updateIssueNotes(issue.id, e.target.value)
                          }
                          rows="4"
                          placeholder="Capture discussion, root cause, decision needed, or resolution notes..."
                        />
                      </label>

                      <div className="form-grid workflow-form-grid">
                        <label>
                          Action Item
                          <input
                            type="text"
                            value={todoDrafts[issue.id]?.action || ""}
                            onChange={(e) =>
                              setTodoDrafts({
                                ...todoDrafts,
                                [issue.id]: {
                                  ...(todoDrafts[issue.id] || {}),
                                  action: e.target.value,
                                },
                              })
                            }
                          />
                        </label>

                        <label>
                          Assigned To
                          <select
                            value={todoDrafts[issue.id]?.assignedToUserId || ""}
                            onChange={(e) => {
                              const selectedMember = teamMembers.find(
                                (member) => member.id === e.target.value
                              );

                              setTodoDrafts({
                                ...todoDrafts,
                                [issue.id]: {
                                  ...(todoDrafts[issue.id] || {}),
                                  assignedToUserId: e.target.value,
                                  owner: selectedMember?.name || "",
                                },
                              });
                            }}
                          >
                            <option value="">Select Team Member</option>

                            {teamMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name} - {member.email}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Due Date
                          <input
                            type="date"
                            value={todoDrafts[issue.id]?.dueDate || ""}
                            onChange={(e) =>
                              setTodoDrafts({
                                ...todoDrafts,
                                [issue.id]: {
                                  ...(todoDrafts[issue.id] || {}),
                                  dueDate: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="workflow-button-row">
                        <button
                          type="button"
                          className="primary-button small-button"
                          onClick={() => {
                            createTodoFromIssue(
                              issue,
                              new Map([
                                ["action", todoDrafts[issue.id]?.action || ""],
                                ["owner", todoDrafts[issue.id]?.owner || ""],
                                [
                                  "assignedToUserId",
                                  todoDrafts[issue.id]?.assignedToUserId || "",
                                ],
                                [
                                  "dueDate",
                                  todoDrafts[issue.id]?.dueDate || "",
                                ],
                              ])
                            );

                            setTodoDrafts({
                              ...todoDrafts,
                              [issue.id]: {
                                action: "",
                                owner: "",
                                assignedToUserId: "",
                                dueDate: "",
                              },
                            });
                          }}
                        >
                          Create Action
                        </button>

                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() => updateIssueStatus(issue.id)}
                        >
                          Move Status
                        </button>
                        <button
  type="button"
  className="secondary-button small-button"
  onClick={() => archiveHealthIssue(issue.id)}
>
  Archive Issue
</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
    </tbody>
  </table>
</div>

      <div className="data-card project-health-todos-card">
        <h2>ProjectHealthOS To-Dos</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Owner</th>
              <th>Due Date</th>
              <th>Source Issue</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {todos.map((todo) => (
              <tr key={todo.id}>
                <td>{todo.action}</td>
                <td>{todo.owner}</td>
                <td>{todo.dueDate}</td>
                <td>{todo.sourceIssueTitle}</td>
                <td>
                  <button
                    type="button"
                    className="secondary-button small-button"
                    onClick={() => completeTodo(todo.id)}
                  >
                    Complete
                  </button>
                </td>
              </tr>
            ))}

            {todos.length === 0 && (
              <tr>
                <td colSpan="5">No ProjectHealthOS to-dos have been created.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectHealthOS;