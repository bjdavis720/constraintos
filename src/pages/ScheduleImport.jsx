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
  const [importType, setImportType] = useState("");

  function getFileType(name) {
    const lower = name.toLowerCase();

    if (lower.endsWith(".csv")) return "CSV";
    if (lower.endsWith(".xer")) return "P6 XER";
    if (lower.endsWith(".xml")) return "MS Project XML";

    return "Unsupported";
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0]).map((h) => h.trim());

    return lines.slice(1).map((line, index) => {
      const values = parseCsvLine(line).map((v) => v.trim());
      const row = { id: index + 1 };

      headers.forEach((header, i) => {
        row[header] = values[i] || "";
      });

      return row;
    });
  }

  function parseCsvLine(line) {
    const values = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current);
    return values.map((value) => value.replace(/^"|"$/g, ""));
  }

  function cleanDate(value) {
    if (!value) return "";

    return String(value).split(" ")[0].replace("T", " ");
  }

  function cleanFloat(value) {
    if (!value) return "";

    const number = Number(value);

    if (Number.isNaN(number)) return value;

    // P6 XER usually stores float in hours.
    if (Math.abs(number) > 24) {
      return Math.round(number / 8);
    }

    return number;
  }

  function parseXer(text) {
    const lines = text.split(/\r?\n/);
    const parsedRows = [];

    let inTaskTable = false;
    let fields = [];

    lines.forEach((line) => {
      const parts = line.split("\t");

      if (parts[0] === "%T") {
        inTaskTable = parts[1] === "TASK";
        fields = [];
        return;
      }

      if (!inTaskTable) return;

      if (parts[0] === "%F") {
        fields = parts.slice(1);
        return;
      }

      if (parts[0] === "%R") {
        const values = parts.slice(1);
        const record = {};

        fields.forEach((field, index) => {
          record[field] = values[index] || "";
        });

        parsedRows.push({
          id: parsedRows.length + 1,
          "Activity ID": record.task_code || record.task_id || "",
          "Activity Name": record.task_name || "",
          Start: cleanDate(
            record.act_start_date ||
              record.target_start_date ||
              record.early_start_date
          ),
          Finish: cleanDate(
            record.act_end_date ||
              record.target_end_date ||
              record.early_end_date
          ),
          "Total Float": cleanFloat(record.total_float_hr_cnt),
          Critical:
            Number(record.total_float_hr_cnt || 999999) <= 0 ? "Yes" : "No",
          "Activity Type": record.task_type || "",
          WBS: record.wbs_id || "",
          Source: "P6 XER",
        });
      }
    });

    return parsedRows;
  }

  function getXmlText(parent, tagName) {
    const node = Array.from(parent.children).find(
      (child) => child.localName === tagName
    );

    return node?.textContent || "";
  }

  function parseMicrosoftProjectXml(text) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");

    const tasks = Array.from(xml.getElementsByTagName("*")).filter(
      (node) => node.localName === "Task"
    );

    return tasks
      .filter((task) => {
        const name = getXmlText(task, "Name");
        return name && name.trim();
      })
      .map((task, index) => {
        const name = getXmlText(task, "Name");
        const id = getXmlText(task, "ID") || getXmlText(task, "UID");

        const milestone =
          getXmlText(task, "Milestone") === "1" ||
          getXmlText(task, "Milestone").toLowerCase() === "true";

        const critical =
          getXmlText(task, "Critical") === "1" ||
          getXmlText(task, "Critical").toLowerCase() === "true";

        return {
          id: index + 1,
          "Activity ID": id,
          "Activity Name": name,
          Start: cleanDate(getXmlText(task, "Start")),
          Finish: cleanDate(getXmlText(task, "Finish")),
          "Total Float": critical ? "0" : "",
          Critical: critical ? "Yes" : "No",
          "Activity Type": milestone ? "Milestone" : "Task",
          "Percent Complete": getXmlText(task, "PercentComplete"),
          Source: "MS Project XML",
        };
      });
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = getFileType(file.name);

    if (fileType === "Unsupported") {
      alert("Unsupported file type. Please upload a CSV, XER, or MS Project XML file.");
      return;
    }

    setFileName(file.name);
    setImportType(fileType);

    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target.result;

      let parsedRows = [];

      if (fileType === "CSV") {
        parsedRows = parseCsv(text);
      }

      if (fileType === "P6 XER") {
        parsedRows = parseXer(text);
      }

      if (fileType === "MS Project XML") {
        parsedRows = parseMicrosoftProjectXml(text);
      }

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
        item.id === row.id ? { ...item, issueCreated: true } : item
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
        item.id === row.id ? { ...item, milestoneAdded: true } : item
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
        <h2>Import Schedule</h2>

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

        <p className="helper-text">
          Supported formats: Primavera P6 XER, CSV, and Microsoft Project XML.
        </p>

        <input
          type="file"
          accept=".csv,.xer,.xml"
          onChange={handleFileUpload}
        />

        {fileName && (
          <p className="import-file-name">
            Imported: {fileName} {importType && `(${importType})`}
          </p>
        )}
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