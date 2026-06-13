import { useState } from "react";
import ModuleHeader from "./ModuleHeader.jsx";
import * as XLSX from "xlsx";

function ProjectHealthOS({
  project,
  projectHealthOS,
  updateProjectHealthOS,
  teamMembers = [],
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
const [expandedHeadings, setExpandedHeadings] = useState({});

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
    const status = "N/A";
const notes = "";

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
  const fileInput = e.target;
  const file = fileInput.files?.[0];

  if (!file) return;
  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const data = event.target.result;
      let rows = [];

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        rows = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        });
      } else {
        const text = String(data || "");
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        const headers = lines[0].split(",").map((h) => h.trim());

        rows = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());

          return headers.reduce((row, header, index) => {
            row[header] = values[index] || "";
            return row;
          }, {});
        });
      }

      const imported = rows
        .map((row, index) => {
          const heading = String(row.Heading || "").trim();
          const item = String(row["Review Item"] || "").trim();

          if (!heading || !item) return null;

          return {
            id: Date.now() + index,
            heading,
            item,
            status: "N/A",
            notes: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      if (imported.length === 0) {
        alert("No review items found. Use columns: Heading and Review Item.");
        return;
      }

      saveHealthData({
        reviewItems: [...reviewItems, ...imported],
      });

      fileInput.value = "";
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import failed. Please confirm the file uses columns: Heading and Review Item.");
    }
  };

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
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
    "Heading,Review Item\n" +
    "Safety,Weekly safety inspections completed\n" +
    "Schedule,Monthly update submitted\n" +
    "Staffing,Staffing plan reviewed\n" +
    "Quality,Quality Control\n";

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
         },
    {
      Heading: "Schedule",
      "Review Item": "Monthly update submitted",
          },
    {
      Heading: "Staffing",
      "Review Item": "Staffing plan reviewed",
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
function scrollToHealthSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}
  return (
    <div className="page project-health-os-page">
      <ModuleHeader
  logo="projecthealth-logo.png"
  title="ProjectHealthOS"
  subtitle="Project Health & Accountability"
  description="Project health reviews, executive attention, risk trends, and accountability tracking."
/>

<div className="health-executive-layout">
  <aside className="health-executive-sidebar">
    <button
      type="button"
      className="health-home-button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("sentinel:navigate-home"))
      }
    >
      🛡️ SentinelOS Home
    </button>
<div className="health-sidebar-section">
      <div className="health-sidebar-heading">Setup</div>

      <button
        type="button"
        className="health-nav-item"
        onClick={() => scrollToHealthSection("add-review-item")}
      >
        ➕ Add / Import Items
      </button>
    </div>
    <div className="health-sidebar-section">
      <div className="health-sidebar-heading">Health</div>

      <button
        type="button"
        className="health-nav-item"
        onClick={() => scrollToHealthSection("review-items")}
      >
        💚 Review Items
      </button>

      <button
        type="button"
        className="health-nav-item"
        onClick={() => scrollToHealthSection("health-review-issues")}
      >
        ⚠️ Health Issues
      </button>

      <button
        type="button"
        className="health-nav-item"
        onClick={() => scrollToHealthSection("project-health-todos")}
      >
        ✅ Health To-Dos
      </button>
    </div>

    
  </aside>

  <main className="health-executive-main">

      <div id="add-review-item" className="data-card">
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


  <div className="form-button-group">
    <label>&nbsp;</label>
    <button type="submit">
      Add Item
    </button>
  </div>
</form>
<div className="import-divider">
  <span>OR IMPORT REVIEW ITEMS</span>
</div>

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
  onChange={importReviewItems}
/>
</div>

<p className="table-subtext">
  
</p>
      </div>

      

  <div id="review-items" className="data-card project-health-review-card">
  <div className="section-header-row">
    <h2>Review Items</h2>
  </div>

  {reviewItems.length === 0 && (
    <div className="empty-state">
      No ProjectHealthOS review items have been added yet.
    </div>
  )}

  {Object.entries(groupedItems).map(([heading, items]) => {
    const isExpanded = expandedHeadings[heading] !== false;

    return (
      <div className="health-review-group" key={heading}>
        <button
          type="button"
          className="health-review-heading-row"
          onClick={() =>
            setExpandedHeadings({
              ...expandedHeadings,
              [heading]: !isExpanded,
            })
          }
        >
          <span>
  {isExpanded ? "▼" : "▶"} {heading} ({items.length})
</span>
        </button>

        {isExpanded && (
          <table className="data-table health-review-items-table">
            <thead>
              <tr>
                <th>Review Item</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Create Issue</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.item}</td>

                  <td>
                    <button
                      type="button"
                      className={`health-status-pill ${item.status
                        .toLowerCase()
                        .replace("/", "-")}`}
                      onClick={() => {
                        const statusFlow = [
                          "Green",
                          "Yellow",
                          "Red",
                          "N/A",
                        ];

                        const currentIndex =
                          statusFlow.indexOf(item.status);

                        updateReviewItem(item.id, {
                          status:
                            statusFlow[
                              (currentIndex + 1) %
                                statusFlow.length
                            ],
                        });
                      }}
                    >
                      {item.status === "Green"
                        ? "On Track"
                        : item.status === "Yellow"
                        ? "At Risk"
                        : item.status === "Red"
                        ? "Off Track"
                        : "N/A"}
                    </button>
                  </td>

                  <td>
                    <textarea
                      className="project-health-notes"
                      value={item.notes || ""}
                      onChange={(e) =>
                        updateReviewItem(item.id, {
                          notes: e.target.value,
                        })
                      }
                      placeholder="Notes..."
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() =>
                        createIssueFromReviewItem(item)
                      }
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  })}
</div>

      <div id="health-review-issues" className="data-card project-health-issues-card">
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
                    <div className="data-card">
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

      <div id="project-health-todos" className="data-card project-health-todos-card">
        <h2>ProjectHealthOS To-Dos</h2>

        <table className="data-table project-health-table">
  <colgroup>
    <col style={{ width: "45%" }} />
    <col style={{ width: "12%" }} />
    <col style={{ width: "28%" }} />
    <col style={{ width: "10%" }} />
    <col style={{ width: "5%" }} />
  </colgroup>
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
        </main>
  </div>
</div>
  );
}

export default ProjectHealthOS;