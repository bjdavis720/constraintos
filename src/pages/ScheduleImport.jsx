import { useState } from "react";

function ScheduleImport({
  project,
  milestones = [],
  importMilestones,
  importIssuesFromSchedule,
  permissions = {},
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim());

      const parsedRows = lines.slice(1).map((line, index) => {
        const values = line.split(",").map((v) => v.trim());
        const row = { id: index + 1 };

        headers.forEach((header, i) => {
          row[header] = values[i] || "";
        });

        return row;
      });

      setRows(parsedRows);
    };

    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csvContent = [
      [
        "Activity ID",
        "Activity Name",
        "Start",
        "Finish",
        "Total Float",
        "Critical",
        "Activity Type",
      ],
      ["A1000", "Notice to Proceed", "2026-05-01", "2026-05-01", "0", "Yes", "Milestone"],
      ["A1020", "Site Mobilization", "2026-05-02", "2026-05-10", "0", "Yes", "Task"],
      ["A2000", "65% Design Submission", "2026-06-01", "2026-06-15", "5", "No", "Milestone"],
      ["A3000", "Foundation Complete", "2026-07-01", "2026-08-01", "0", "Yes", "Milestone"],
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "constraintos_schedule_template.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const criticalRows = rows.filter((row) => {
    const totalFloat = Number(row["Total Float"] || row["Float"] || 999);
    const criticalFlag = String(row["Critical"] || "").toLowerCase();

    return totalFloat <= 0 || criticalFlag === "yes" || criticalFlag === "true";
  });
  const sortedCriticalRows = [...criticalRows].sort((a, b) => {
  const dateA = new Date(a["Finish"] || a["Start"] || "9999-12-31");
  const dateB = new Date(b["Finish"] || b["Start"] || "9999-12-31");
  return dateA - dateB;
});

  const milestoneRows = rows.filter((row) => {
    const type = String(row["Activity Type"] || row["Type"] || "").toLowerCase();
    const name = String(row["Activity Name"] || row["Name"] || "").toLowerCase();

    return type.includes("milestone") || name.includes("milestone");
  });
  const sortedMilestoneRows = [...milestoneRows].sort((a, b) => {
  const dateA = new Date(a["Finish"] || a["Target Date"] || "9999-12-31");
  const dateB = new Date(b["Finish"] || b["Target Date"] || "9999-12-31");
  return dateA - dateB;
});

  function moveOneCriticalRowToIssues(row) {
    const importedIssue = {
      activityId: row["Activity ID"] || row["ID"],
      name: row["Activity Name"] || row["Name"],
      start: row["Start"],
      finish: row["Finish"],
      totalFloat: row["Total Float"] || row["Float"],
    };

    importIssuesFromSchedule([importedIssue]);
    setRows(
  rows.map((item) =>
    item.id === row.id
      ? { ...item, issueCreated: true }
      : item
  )
);
  }

  function milestoneAlreadyExists(row) {
    const importedName = String(row["Activity Name"] || row["Name"] || "")
      .trim()
      .toLowerCase();

    return milestones.some(
      (milestone) =>
        String(milestone.name).trim().toLowerCase() === importedName
    );
  }

  function moveOneMilestoneToProject(row) {
    const importedMilestone = {
      name: row["Activity Name"] || row["Name"],
      due: row["Finish"] || row["Target Date"],
      status: "Imported",
    };

    importMilestones([importedMilestone]);
    setRows(
  rows.map((item) =>
    item.id === row.id
      ? { ...item, milestoneAdded: true }
      : item
  )
);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Schedule Import</h1>
        <p>{project}</p>
      </div>

      <div className="data-card import-card">
        <h2>Import Schedule CSV</h2>

        <div className="import-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={downloadTemplate}
          >
            Download Sample CSV Template
          </button>
        </div>

        <p>
          Upload a schedule export to identify critical path activities and project milestones.
        </p>

        <input type="file" accept=".csv" onChange={handleFileUpload} />

        {fileName && <p className="import-file-name">Imported: {fileName}</p>}
      </div>

      <div className="grid import-summary-grid">
        <div className="card">
          <h3>Total Activities</h3>
          <p className="metric-number">{rows.length}</p>
        </div>

        <div className="card">
          <h3>Critical Path Activities</h3>
          <p className="metric-number">{criticalRows.length}</p>
        </div>

        <div className="card">
          <h3>Milestones Found</h3>
          <p className="metric-number">{milestoneRows.length}</p>
        </div>
      </div>

      <div className="data-card">
        <h2>Critical Path Activities</h2>

<table className="data-table">
  <thead>
    <tr>
      <th>Activity ID</th>
      <th>Activity Name</th>
      <th>Start</th>
      <th>Finish</th>
      <th>Total Float</th>
      <th>Action</th>
    </tr>
  </thead>

            <tbody>
            {sortedCriticalRows.map((row) => (
              <tr key={row.id}>
                <td>{row["Activity ID"] || row["ID"]}</td>
                <td>{row["Activity Name"] || row["Name"]}</td>
                <td>{row["Start"]}</td>
                <td>{row["Finish"]}</td>
                <td>{row["Total Float"] || row["Float"]}</td>
                <td>
                  {row.issueCreated ? (
                    <span className="status Closed">Issue Created</span>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button small-button"
                      onClick={() => moveOneCriticalRowToIssues(row)}
                      disabled={!permissions.canMoveScheduleToIssues}
                    >
                      Move to Issues
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="data-card">
        <h2>Project Milestones Found</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Activity ID</th>
              <th>Milestone Name</th>
              <th>Target / Finish Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {sortedMilestoneRows.map((row) => {
              const alreadyAdded =
                row.milestoneAdded || milestoneAlreadyExists(row);

              return (
                <tr key={row.id}>
                  <td>{row["Activity ID"] || row["ID"]}</td>
                  <td>{row["Activity Name"] || row["Name"]}</td>
                  <td>{row["Finish"] || row["Target Date"]}</td>
                  <td>{alreadyAdded ? "Already Added" : "Imported Candidate"}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button small-button"
                      disabled={alreadyAdded || !permissions.canImportSchedule}
                      onClick={() => moveOneMilestoneToProject(row)}
                    >
                      {alreadyAdded ? "Already Added" : "Add Milestone"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ScheduleImport;