import Papa from "papaparse";
import * as XLSX from "xlsx";


function SubmittalReadiness({
  project = "",
  submittals = [],
  scheduleActivities = [],
  issues = [],
  updateCurrentProjectData = () => {},
}) {
  const safeSubmittals = Array.isArray(submittals) ? submittals : [];
  const safeIssues = Array.isArray(issues) ? issues : [];
    function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) return;

    function normalizeRow(row, index) {
      return {
        id: Date.now() + index,

        title:
          row.Title ||
          row.title ||
          row["Submittal"] ||
          row["Submittal Title"] ||
          "Unnamed Submittal",

        specSection:
          row["Spec Section"] ||
          row["Spec Section Number"] ||
          row.specSection ||
          "",

        responsibleContractor:
          row["Responsible Contractor"] ||
          row["Ball In Court"] ||
          row["Contractor"] ||
          row.responsibleContractor ||
          "",

        status:
          row.Status ||
          row.status ||
          "Open",

        submitBy:
          row["Submit By"] ||
          row["Submit By Date"] ||
          row.submitBy ||
          "",

        dueDate:
          row["Due Date"] ||
          row["Required Date"] ||
          row.dueDate ||
          "",

        returnedDate:
          row["Returned Date"] ||
          row["Date Returned"] ||
          row.returnedDate ||
          "",

        leadTimeDays: 30,

        readinessStatus: "Imported",
      };
    }

    function saveImportedRows(rows) {
      const formattedSubmittals = rows
        .filter((row) => {
          if (!row || typeof row !== "object") {
            return false;
          }

          return Object.values(row).some(
            (value) =>
              value !== null &&
              value !== undefined &&
              String(value).trim() !== ""
          );
        })
        .map((row, index) =>
          normalizeRow(row, index)
        );

      updateCurrentProjectData({
        submittals: formattedSubmittals,
      });

      alert(
        `${formattedSubmittals.length} submittals imported successfully.`
      );
    }

    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase();

    if (
      extension === "xlsx" ||
      extension === "xls"
    ) {
      const reader = new FileReader();

      reader.onload = function (loadEvent) {
        try {
          const data = new Uint8Array(
            loadEvent.target.result
          );

          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true,
          });

          const firstSheetName =
            workbook.SheetNames[0];

          const worksheet =
            workbook.Sheets[firstSheetName];

          const rows = XLSX.utils.sheet_to_json(
            worksheet,
            {
              defval: "",
              raw: false,
            }
          );

          saveImportedRows(rows);
        } catch (error) {
          console.error(
            "Excel import failed:",
            error
          );

          alert(
            "Unable to import the Excel file. Please confirm that it contains a valid worksheet with column headers."
          );
        }
      };

      reader.readAsArrayBuffer(file);

      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: function (results) {
        saveImportedRows(results.data);
      },

      error: function (error) {
        console.error(
          "CSV import failed:",
          error
        );

        alert(
          "Unable to import the CSV file."
        );
      },
    });
  }

  function findSuggestedActivity(submittal) {
    if (
      !Array.isArray(scheduleActivities) ||
      scheduleActivities.length === 0
    ) {
      return null;
    }

    const submittalText = [
      submittal?.title,
      submittal?.specSection,
      submittal?.responsibleContractor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!submittalText.trim()) {
      return null;
    }

    const scoredActivities = scheduleActivities
      .filter(
        (activity) =>
          activity && typeof activity === "object"
      )
      .map((activity) => {
        const activityName =
          activity.activityName ||
          activity.name ||
          activity.ActivityName ||
          activity["Activity Name"] ||
          "";

        const activityId =
          activity.activityId ||
          activity.id ||
          activity.ActivityID ||
          activity["Activity ID"] ||
          "";

        const activityText =
          `${activityId} ${activityName}`.toLowerCase();

        let score = 0;

        submittalText
          .split(/\s+/)
          .filter((word) => word.length >= 4)
          .forEach((word) => {
            if (activityText.includes(word)) {
              score += 1;
            }
          });

        return {
          activityId,
          activityName,

          activityStart:
            activity.start ||
            activity.Start ||
            activity["Start"] ||
            "",

          activityFinish:
            activity.finish ||
            activity.Finish ||
            activity["Finish"] ||
            "",

          score,
        };
      });

    return (
      scoredActivities
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)[0] ||
      null
    );
  }

  function getNeededByDate(
    submittal,
    suggestedMatch
  ) {
    if (
      !suggestedMatch ||
      !suggestedMatch.activityStart
    ) {
      return "-";
    }

    const activityStart = new Date(
      suggestedMatch.activityStart
    );

    if (
      Number.isNaN(activityStart.getTime())
    ) {
      return "-";
    }

    const leadTimeDays = Number(
      submittal?.leadTimeDays || 30
    );

    const neededByDate = new Date(
      activityStart
    );

    neededByDate.setDate(
      neededByDate.getDate() - leadTimeDays
    );

    return neededByDate
      .toISOString()
      .split("T")[0];
  }

  function getReadinessStatus(
    submittal,
    suggestedMatch
  ) {
    if (!suggestedMatch) return "Unmapped";

    const status = (
      submittal.status || ""
    ).toLowerCase();

    const activityStart =
      suggestedMatch.activityStart
        ? new Date(
            suggestedMatch.activityStart
          )
        : null;

    if (status.includes("approved"))
      return "Ready";

    if (
      !activityStart ||
      Number.isNaN(activityStart.getTime())
    ) {
      return "No Activity Date";
    }

    const leadTimeDays = Number(
      submittal.leadTimeDays || 30
    );

    const neededByDate = new Date(
      activityStart
    );

    neededByDate.setDate(
      neededByDate.getDate() - leadTimeDays
    );

    const today = new Date();

    const daysUntilNeeded = Math.ceil(
      (neededByDate - today) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilNeeded < 0)
      return "Late";

    if (daysUntilNeeded <= 14)
      return "Critical";

    if (daysUntilNeeded <= 30)
      return "At Risk";

    return "Tracking";
  }

  function createSubmittalIssue(
    submittal,
    suggestedMatch
  ) {
    const readiness =
      getReadinessStatus(
        submittal,
        suggestedMatch
      );

    if (
      readiness !== "Critical" &&
      readiness !== "Late"
    ) {
      alert(
        "Only Critical or Late submittals create issues."
      );

      return;
    }

    const newIssue = {
      id: Date.now(),

      title: `${submittal.title} submittal is ${readiness}`,

      source: "Submittal Readiness",

      scheduleDeltaType:
        "Procurement Risk",

      activityId:
        suggestedMatch?.activityId || "",

      start:
        suggestedMatch?.activityStart ||
        "",

      finish:
        suggestedMatch?.activityFinish ||
        "",

      totalFloat: "",

      milestone:
        suggestedMatch?.activityName ||
        "Unassigned",

      status: "Open",

      manuallyEscalated:
        readiness === "Late",

      createdAt:
        new Date().toISOString(),

      notes:
        "Submittal requires attention before activity start.",
    };

    updateCurrentProjectData({
            issues: [...safeIssues, newIssue],
    });

    alert(
      `${submittal.title} issue added to Issues Board.`
    );
  }
function updateSubmittalLeadTime(submittalId, leadTimeDays) {
  updateCurrentProjectData({
    submittals: safeSubmittals.map((submittal) =>
      submittal.id === submittalId
        ? {
            ...submittal,
            leadTimeDays: Number(leadTimeDays) || 0,
          }
        : submittal
    ),
  });
}
  function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function isApprovedStatus(status = "") {
    const normalized = String(status).toLowerCase();

    return (
      normalized.includes("approved") &&
      !normalized.includes("revise")
    );
  }

  function getStatusBucket(status = "") {
    const normalized = String(status)
      .toLowerCase()
      .trim();

    if (
      normalized.includes("revise") ||
      normalized.includes("resubmit") ||
      normalized.includes("re-submit")
    ) {
      return "Revise / Re-Submit";
    }

    if (normalized.includes("approved")) {
      return "Approved";
    }

    if (
      normalized.includes("review") ||
      normalized.includes("pending")
    ) {
      return "Under Review";
    }

    if (
      normalized.includes("submitted") ||
      normalized.includes("submit")
    ) {
      return "Submitted";
    }

    if (
      normalized.includes("preparation") ||
      normalized.includes("prepare") ||
      normalized.includes("draft")
    ) {
      return "In Preparation";
    }

    return "Not Started";
  }

  function getDashboardDueDate(
    submittal,
    suggestedMatch
  ) {
    const neededBy = getNeededByDate(
      submittal,
      suggestedMatch
    );

    if (neededBy && neededBy !== "-") {
      return parseDate(neededBy);
    }

    return (
      parseDate(submittal?.dueDate) ||
      parseDate(submittal?.submitBy)
    );
  }

  const dashboardRows = safeSubmittals.map(
    (submittal) => {
      const suggestedMatch =
        findSuggestedActivity(submittal);

      const readiness = getReadinessStatus(
        submittal,
        suggestedMatch
      );

      const dueDate = getDashboardDueDate(
        submittal,
        suggestedMatch
      );

      return {
        ...submittal,
        suggestedMatch,
        readiness,
        dashboardDueDate: dueDate,
        statusBucket: getStatusBucket(
          submittal.status
        ),
        approved: isApprovedStatus(
          submittal.status
        ),
      };
    }
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysFromToday = new Date(today);
  thirtyDaysFromToday.setDate(
    thirtyDaysFromToday.getDate() + 30
  );

  const totalSubmittals = dashboardRows.length;

  const dueNext30Days = dashboardRows.filter(
    (item) =>
      !item.approved &&
      item.dashboardDueDate &&
      item.dashboardDueDate >= today &&
      item.dashboardDueDate <=
        thirtyDaysFromToday
  ).length;

  const pastDueSubmittals = dashboardRows.filter(
    (item) =>
      !item.approved &&
      item.dashboardDueDate &&
      item.dashboardDueDate < today
  ).length;

  const criticalSubmittals = dashboardRows.filter(
    (item) =>
      item.readiness === "Critical" ||
      item.readiness === "Late"
  ).length;

  const statusCounts = {
    "Not Started": 0,
    "In Preparation": 0,
    Submitted: 0,
    "Under Review": 0,
    Approved: 0,
    "Revise / Re-Submit": 0,
  };

  dashboardRows.forEach((item) => {
    if (
      Object.prototype.hasOwnProperty.call(
        statusCounts,
        item.statusBucket
      )
    ) {
      statusCounts[item.statusBucket] += 1;
    }
  });

  const incompleteRows = dashboardRows.filter(
    (item) => !item.approved
  );

  const incompleteCounts = {
    "Past Due": 0,
    "Due in 7 Days": 0,
    "Due in 8–14 Days": 0,
    "Due in 15–30 Days": 0,
    "Due in 30+ Days": 0,
  };

  incompleteRows.forEach((item) => {
    if (!item.dashboardDueDate) return;

    const dueDate = new Date(
      item.dashboardDueDate
    );

    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.ceil(
      (dueDate - today) /
        (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue < 0) {
      incompleteCounts["Past Due"] += 1;
    } else if (daysUntilDue <= 7) {
      incompleteCounts["Due in 7 Days"] += 1;
    } else if (daysUntilDue <= 14) {
      incompleteCounts["Due in 8–14 Days"] += 1;
    } else if (daysUntilDue <= 30) {
      incompleteCounts["Due in 15–30 Days"] += 1;
    } else {
      incompleteCounts["Due in 30+ Days"] += 1;
    }
  });

  const keyUpcomingSubmittals = dashboardRows
    .filter(
      (item) =>
        !item.approved &&
        item.dashboardDueDate
    )
    .sort((a, b) => {
      const readinessPriority = {
        Late: 0,
        Critical: 1,
        "At Risk": 2,
        Tracking: 3,
        Unmapped: 4,
        "No Activity Date": 5,
        Ready: 6,
      };

      const priorityDifference =
        (readinessPriority[a.readiness] ?? 99) -
        (readinessPriority[b.readiness] ?? 99);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        a.dashboardDueDate -
        b.dashboardDueDate
      );
    })
    .slice(0, 5);

  function formatDashboardDate(value) {
    if (!value) return "-";

    return value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getScheduleImpact(readiness) {
    if (
      readiness === "Late" ||
      readiness === "Critical"
    ) {
      return "High";
    }

    if (readiness === "At Risk") {
      return "Medium";
    }

    if (readiness === "Tracking") {
      return "Low";
    }

    return "Unmapped";
  }

  function buildConicGradient(
    counts,
    colors
  ) {
    const total = Object.values(counts).reduce(
      (sum, value) => sum + value,
      0
    );

    if (!total) {
      return "#e5e7eb";
    }

    let current = 0;

    const segments = Object.keys(counts).map(
      (key, index) => {
        const start = current;
        const percent =
          (counts[key] / total) * 100;

        current += percent;

        return `${colors[index]} ${start}% ${current}%`;
      }
    );

    return `conic-gradient(${segments.join(
      ", "
    )})`;
  }

  const statusColors = [
    "#b8b8b8",
    "#17617a",
    "#0b2f6b",
    "#9fc5e8",
    "#00b050",
    "#ffc000",
  ];

  const incompleteColors = [
    "#d7191c",
    "#ffb000",
    "#9fc5e8",
    "#4f93d2",
    "#0b2f6b",
  ];

  const statusGradient = buildConicGradient(
    statusCounts,
    statusColors
  );

  const incompleteGradient =
    buildConicGradient(
      incompleteCounts,
      incompleteColors
    );
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Submittal Readiness</h1>
          <p>{project}</p>
        </div>
      </div>
      <div className="submittal-dashboard">
        <div className="submittal-dashboard-title">
          Submittal Dashboard
        </div>

        <div className="submittal-kpi-grid">
          <div className="submittal-kpi">
            <span>Total</span>
            <strong>{totalSubmittals}</strong>
          </div>

          <div className="submittal-kpi">
            <span>Due Next 30 Days</span>
            <strong>{dueNext30Days}</strong>
          </div>

          <div className="submittal-kpi">
            <span>Past Due</span>
            <strong>{pastDueSubmittals}</strong>
          </div>

          <div className="submittal-kpi">
            <span>Critical</span>
            <strong>{criticalSubmittals}</strong>
          </div>
        </div>

        <div className="submittal-chart-grid">
          <div className="submittal-chart-card">
            <h3>Submittal Status</h3>

            <div
              className="submittal-donut"
              style={{
                background: statusGradient,
              }}
            >
              <div className="submittal-donut-center">
                <strong>{totalSubmittals}</strong>
                <span>Total</span>
              </div>
            </div>

            <div className="submittal-chart-legend">
              {Object.entries(statusCounts).map(
                ([label, count], index) => (
                  <div
                    className="submittal-legend-item"
                    key={label}
                  >
                    <span
                      className="submittal-legend-color"
                      style={{
                        background:
                          statusColors[index],
                      }}
                    />

                    <span>{label}</span>

                    <strong>{count}</strong>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="submittal-chart-card">
            <h3>Incomplete Submittals</h3>

            <div
              className="submittal-donut"
              style={{
                background:
                  incompleteGradient,
              }}
            >
              <div className="submittal-donut-center">
                <strong>
                  {incompleteRows.length}
                </strong>
                <span>Open</span>
              </div>
            </div>

            <div className="submittal-chart-legend">
              {Object.entries(
                incompleteCounts
              ).map(
                ([label, count], index) => (
                  <div
                    className="submittal-legend-item"
                    key={label}
                  >
                    <span
                      className="submittal-legend-color"
                      style={{
                        background:
                          incompleteColors[index],
                      }}
                    />

                    <span>{label}</span>

                    <strong>{count}</strong>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        <div className="submittal-upcoming">
          <h3>Key Upcoming Submittals</h3>

          <table className="data-table">
            <thead>
              <tr>
                <th>Submittal</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Schedule Impact</th>
              </tr>
            </thead>

            <tbody>
              {keyUpcomingSubmittals.length ===
                0 && (
                <tr>
                  <td colSpan="4">
                    No upcoming submittals.
                  </td>
                </tr>
              )}

              {keyUpcomingSubmittals.map(
                (item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>

                    <td>
                      {formatDashboardDate(
                        item.dashboardDueDate
                      )}
                    </td>

                    <td>
                      {item.statusBucket}
                    </td>

                    <td>
                      <span
                        className={`submittal-impact ${getScheduleImpact(
                          item.readiness
                        )
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        {getScheduleImpact(
                          item.readiness
                        )}
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>Import Procore Submittal Log</h2>
        <div className="button-row">
  <button
    type="button"
    className="secondary-button"
    onClick={() => {
      const csvContent =
        "Title,Spec Section,Responsible Contractor,Status,Submit By,Due Date,Returned Date\n" +
        "Example Submittal,051200,Steel Subcontractor,Open,2026-06-15,2026-06-30,\n";

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "submittal-readiness-template.csv";
      link.click();

      URL.revokeObjectURL(url);
    }}
  >
    Download CSV Template
  </button>

  <button
    type="button"
    className="secondary-button"
    onClick={() => {
      const excelContent = `
        <table>
          <tr>
            <th>Title</th>
            <th>Spec Section</th>
            <th>Responsible Contractor</th>
            <th>Status</th>
            <th>Submit By</th>
            <th>Due Date</th>
            <th>Returned Date</th>
          </tr>
          <tr>
            <td>Example Submittal</td>
            <td>051200</td>
            <td>Steel Subcontractor</td>
            <td>Open</td>
            <td>2026-06-15</td>
            <td>2026-06-30</td>
            <td></td>
          </tr>
        </table>
      `;

      const blob = new Blob([excelContent], {
        type: "application/vnd.ms-excel",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "submittal-readiness-template.xls";
      link.click();

      URL.revokeObjectURL(url);
    }}
  >
    Download Excel Template
  </button>
</div>

        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileUpload}
        />
      </div>

      <div className="data-card">
        <h2>Imported Submittals</h2>

        <table className="data-table submittal-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Spec Section</th>
              <th>Responsible Contractor</th>
              <th>Status</th>
              <th>Suggested Activity</th>
              <th>Match Score</th>
              <th>Activity Start</th>
              <th>Activity Finish</th>
<th>Lead Time</th>
<th>Needed By</th>
<th>Readiness</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {safeSubmittals.length === 0 && (
              <tr>
                <td colSpan="13">
                  No submittals imported.
                </td>
              </tr>
            )}

            {safeSubmittals.map((submittal) => {
              const suggestedMatch =
                findSuggestedActivity(
                  submittal
                );

              return (
                <tr key={submittal.id}>
                  <td>{submittal.title}</td>

                  <td>
                    {submittal.specSection}
                  </td>

                  <td>
                    {
                      submittal.responsibleContractor
                    }
                  </td>

                  <td>
                    {submittal.status}
                  </td>

                   <td>
  <div>
    <strong>
      {suggestedMatch?.activityName ||
        "No suggested activity"}
    </strong>

    {suggestedMatch?.activityId && (
      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginTop: "2px",
        }}
      >
        {suggestedMatch.activityId}
      </div>
    )}
  </div>
</td>

                  <td>
                    {suggestedMatch?.score || 0}
                  </td>

                  <td>
                    {suggestedMatch?.activityStart ||
                      "-"}
                  </td>

                  <td>
                    {suggestedMatch?.activityFinish ||
                      "-"}
                  </td>

                  <td>
  <input
    type="number"
    min="0"
    value={submittal.leadTimeDays || 30}
    onChange={(event) =>
      updateSubmittalLeadTime(
        submittal.id,
        event.target.value
      )
    }
    style={{
      width: "72px",
      padding: "6px",
      border: "1px solid #cfd8e3",
      borderRadius: "6px",
      fontFamily: "inherit",
    }}
  />
</td>

<td>
  {getNeededByDate(
    submittal,
    suggestedMatch
  )}
</td>

                  <td>
                    <span
                      className={`readiness-pill ${getReadinessStatus(
                        submittal,
                        suggestedMatch
                      )
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {getReadinessStatus(
                        submittal,
                        suggestedMatch
                      )}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        createSubmittalIssue(
                          submittal,
                          suggestedMatch
                        )
                      }
                    >
                      Create Issue
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

export default SubmittalReadiness;