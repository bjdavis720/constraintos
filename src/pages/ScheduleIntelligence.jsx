import { useEffect, useState } from "react";

import {
  normalizeScheduleRow,
  compareScheduleSnapshots,
  isCriticalActivity,
} from "../utils/scheduleDeltaUtils.js";

import { parseXER } from "../utils/xerParser.js";

function parseCSV(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || "";
    });

    return normalizeScheduleRow(row);
  });
}

function ScheduleIntelligence({
  project,
  scheduleSnapshots = [],
  updateCurrentProjectData,
  issues = [],
  milestones = [],
  importMilestones,
  importIssuesFromSchedule,
}) {
  const [comparisonResults, setComparisonResults] = useState(null);
  const [selectedMilestones, setSelectedMilestones] = useState({});
  const [activityFilter, setActivityFilter] = useState("critical");

  const [collapsedSections, setCollapsedSections] = useState({
    slippedActivities: true,
    recoveredActivities: true,
    floatErosion: true,
    floatRecovery: true,
    newCriticalActivities: true,
    newActivities: true,
    removedActivities: true,
  });

  function toggleSection(sectionKey) {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }

  const latestSnapshot =
    scheduleSnapshots.length > 0
      ? scheduleSnapshots[scheduleSnapshots.length - 1]
      : null;

  const latestActivities = Array.isArray(latestSnapshot?.rows)
    ? latestSnapshot.rows
    : [];

  useEffect(() => {
    if (scheduleSnapshots.length >= 2) {
      const previous = scheduleSnapshots[scheduleSnapshots.length - 2];
      const current = scheduleSnapshots[scheduleSnapshots.length - 1];

      const results = compareScheduleSnapshots(
        previous.rows || [],
        current.rows || []
      );

      setComparisonResults(results);
    } else {
      setComparisonResults(null);
    }
  }, [scheduleSnapshots]);

  const filteredLatestActivities = latestActivities
    .filter((activity) => {
      if (activityFilter === "critical") {
        return isCriticalActivity(activity);
      }

      if (activityFilter === "milestones") {
        return (
          String(activity.activityName || "")
            .toLowerCase()
            .includes("milestone") ||
          String(activity.activityId || "")
            .toLowerCase()
            .includes("mile")
        );
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = a.finish ? new Date(a.finish) : new Date(9999, 0, 1);
      const dateB = b.finish ? new Date(b.finish) : new Date(9999, 0, 1);

      return dateA - dateB;
    });

  function getRowKey(activity, issueType) {
    return `${issueType}-${activity.activityId}`;
  }

  function getLinkedMilestone(activity, issueType) {
    const rowKey = getRowKey(activity, issueType);
    return selectedMilestones[rowKey] || "Unassigned";
  }

  function createIssueFromDelta(activity, issueType) {
    const linkedMilestone = getLinkedMilestone(activity, issueType);

    const alreadyExists = issues.some(
      (issue) =>
        issue.source === "Schedule Intelligence" &&
        issue.activityId === activity.activityId &&
        issue.scheduleDeltaType === issueType &&
        issue.status !== "Closed"
    );

    if (alreadyExists) {
      alert("An open issue already exists for this schedule item.");
      return;
    }

    const newIssue = {
      id: Date.now(),
      title: `${issueType}: ${activity.activityName}`,
      source: "Schedule Intelligence",
      scheduleDeltaType: issueType,
      activityId: activity.activityId,
      milestone: linkedMilestone,
      start: activity.start || "",
      finish: activity.currentFinish || activity.finish || "",
      totalFloat: activity.currentFloat ?? activity.totalFloat ?? "",
      status: "Open",
      manuallyEscalated: issueType.includes("Slipped"),
      createdAt: new Date().toISOString(),
      notes: buildIssueNotes(activity, issueType, linkedMilestone),
    };

    updateCurrentProjectData({
      issues: [...issues, newIssue],
    });

    alert("Schedule issue created.");
  }

  function buildIssueNotes(activity, issueType, linkedMilestone) {
    const milestoneText =
      linkedMilestone && linkedMilestone !== "Unassigned"
        ? ` Linked milestone: ${linkedMilestone}.`
        : "";

    if (issueType === "Slipped Activity") {
      return `Schedule Intelligence identified a ${activity.deltaDays}-day slip. Previous finish: ${activity.previousFinish}. Current finish: ${activity.currentFinish}.${milestoneText}`;
    }

    if (issueType === "Float Erosion") {
      return `Schedule Intelligence identified float erosion. Previous float: ${activity.previousFloat}. Current float: ${activity.currentFloat}.${milestoneText}`;
    }

    if (issueType === "Float Recovery") {
      return `Schedule Intelligence identified float recovery. Previous float: ${activity.previousFloat}. Current float: ${activity.currentFloat}.${milestoneText}`;
    }

    if (issueType === "New Critical Activity") {
      return `Schedule Intelligence identified this activity as newly critical. Current float: ${
        activity.currentFloat ?? activity.totalFloat
      }.${milestoneText}`;
    }

    if (issueType === "Recovered Activity") {
      return `Schedule Intelligence identified a ${activity.deltaDays}-day recovery. Previous finish: ${activity.previousFinish}. Current finish: ${activity.currentFinish}.${milestoneText}`;
    }

    return `Schedule Intelligence generated this issue from schedule activity data.${milestoneText}`;
  }
function isMilestoneInNext90Days(activity) {
  const today = new Date();

  const ninetyDaysOut = new Date();
  ninetyDaysOut.setDate(today.getDate() + 90);

  const finishDate = activity.finish
    ? new Date(activity.finish)
    : null;

  if (!finishDate || isNaN(finishDate)) return false;

  return finishDate >= today && finishDate <= ninetyDaysOut;
}

  function addCurrentActivityToMilestones(activity) {
    importMilestones([activity]);
  }

  function createIssueFromCurrentActivity(activity) {
    importIssuesFromSchedule([
      {
        ...activity,
        scheduleDeltaType: "Current Schedule Activity",
      },
    ]);
  }

  async function handleScheduleUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const fileName = file.name.toLowerCase();

      let parsedRows = [];
      let parsedRelationships = [];

      if (fileName.endsWith(".xer")) {
        const parsedXER = parseXER(text);

        if (Array.isArray(parsedXER)) {
          parsedRows = parsedXER;
          parsedRelationships = [];
        } else {
          parsedRows = parsedXER?.activities || [];
          parsedRelationships = parsedXER?.relationships || [];
        }
      } else {
        parsedRows = parseCSV(text);
        parsedRelationships = [];
      }

      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        alert("No schedule activities were found in this file.");
        return;
      }

      if (!Array.isArray(parsedRelationships)) {
        parsedRelationships = [];
      }

      const newSnapshot = {
        id: Date.now(),
        fileName: file.name,
        uploadDate: new Date().toISOString(),
        rows: parsedRows,
        activities: parsedRows,
        relationships: parsedRelationships.slice(0, 5000),
      };

      const updatedSnapshots = [...scheduleSnapshots, newSnapshot].slice(-2);

      updateCurrentProjectData({
        scheduleSnapshots: updatedSnapshots,
        scheduleActivities: parsedRows,
        scheduleRelationships: parsedRelationships.slice(0, 5000),
      });

      if (updatedSnapshots.length >= 2) {
        const previous = updatedSnapshots[updatedSnapshots.length - 2];
        const current = updatedSnapshots[updatedSnapshots.length - 1];

        const results = compareScheduleSnapshots(
          previous.rows || [],
          current.rows || []
        );

        setComparisonResults(results);
      }

      event.target.value = "";
    } catch (error) {
      console.error("Schedule upload failed:", error);
      alert("Schedule upload failed. Check the browser console for details.");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Schedule Intelligence</h1>
        <p>Operational schedule delta analysis for {project}</p>
      </div>

      <div className="card">
        <h3>Upload Schedule Snapshot</h3>

        <input type="file" accept=".csv,.xer" onChange={handleScheduleUpload} />

        <p style={{ marginTop: "10px" }}>
          Upload CSV or XER schedule exports to compare milestone movement,
          float erosion, and critical path changes.
        </p>
      </div>

      <div className="card">
        <h3>Schedule Snapshots</h3>

        {scheduleSnapshots.length > 0 && (
          <p>
            <strong>Last Updated:</strong>{" "}
            {new Date(
              scheduleSnapshots[scheduleSnapshots.length - 1].uploadDate
            ).toLocaleString()}
          </p>
        )}

        {scheduleSnapshots.length === 0 ? (
          <p>No schedule snapshots uploaded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Activities</th>
                <th>Logic Links</th>
                <th>Uploaded</th>
              </tr>
            </thead>

            <tbody>
              {scheduleSnapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td>{snapshot.fileName}</td>
                  <td>{snapshot.rows?.length || 0}</td>
                  <td>{snapshot.relationships?.length || 0}</td>
                  <td>{new Date(snapshot.uploadDate).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {comparisonResults && (
        <>
          <div className="card">
            <h3>Schedule Delta Summary</h3>

            <div className="metric-grid">
              <div className="mini-metric">
                <strong>{comparisonResults.slippedActivities.length}</strong>
                <span>Slipped</span>
              </div>

              <div className="mini-metric">
                <strong>{comparisonResults.recoveredActivities.length}</strong>
                <span>Recovered</span>
              </div>

              <div className="mini-metric">
                <strong>{comparisonResults.floatErosion.length}</strong>
                <span>Float Erosion</span>
              </div>

              <div className="mini-metric">
                <strong>{comparisonResults.floatRecovery.length}</strong>
                <span>Float Recovery</span>
              </div>

              <div className="mini-metric">
                <strong>{comparisonResults.newCriticalActivities.length}</strong>
                <span>New Critical</span>
              </div>

              <div className="mini-metric">
                <strong>{comparisonResults.newActivities.length}</strong>
                <span>New Activities</span>
              </div>

              <div className="mini-metric">
                <strong>{comparisonResults.removedActivities.length}</strong>
                <span>Removed</span>
              </div>
            </div>
          </div>

          <DeltaTable
            sectionKey="slippedActivities"
            collapsed={collapsedSections.slippedActivities}
            toggleSection={toggleSection}
            title={`🔴 Slipped Activities (${comparisonResults.slippedActivities.length})`}
            emptyText="No slipped activities detected."
            rows={comparisonResults.slippedActivities}
            issueType="Slipped Activity"
            createIssueFromDelta={createIssueFromDelta}
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            setSelectedMilestones={setSelectedMilestones}
            getRowKey={getRowKey}
            columns={[
              ["activityId", "ID"],
              ["activityName", "Activity"],
              ["previousFinish", "Previous Finish"],
              ["currentFinish", "Current Finish"],
              ["deltaDays", "Slip"],
            ]}
            suffixByKey={{ deltaDays: " days" }}
          />

          <DeltaTable
            sectionKey="recoveredActivities"
            collapsed={collapsedSections.recoveredActivities}
            toggleSection={toggleSection}
            title={`🟢 Recovered Activities (${comparisonResults.recoveredActivities.length})`}
            emptyText="No recovered activities detected."
            rows={comparisonResults.recoveredActivities}
            issueType="Recovered Activity"
            createIssueFromDelta={createIssueFromDelta}
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            setSelectedMilestones={setSelectedMilestones}
            getRowKey={getRowKey}
            columns={[
              ["activityId", "ID"],
              ["activityName", "Activity"],
              ["previousFinish", "Previous Finish"],
              ["currentFinish", "Current Finish"],
              ["deltaDays", "Recovery"],
            ]}
            suffixByKey={{ deltaDays: " days" }}
          />

          <DeltaTable
            sectionKey="floatErosion"
            collapsed={collapsedSections.floatErosion}
            toggleSection={toggleSection}
            title={`🟠 Float Erosion (${comparisonResults.floatErosion.length})`}
            emptyText="No float erosion detected."
            rows={comparisonResults.floatErosion}
            issueType="Float Erosion"
            createIssueFromDelta={createIssueFromDelta}
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            setSelectedMilestones={setSelectedMilestones}
            getRowKey={getRowKey}
            columns={[
              ["activityId", "ID"],
              ["activityName", "Activity"],
              ["previousFloat", "Previous Float"],
              ["currentFloat", "Current Float"],
              ["deltaFloat", "Float Lost"],
            ]}
          />

          <DeltaTable
            sectionKey="floatRecovery"
            collapsed={collapsedSections.floatRecovery}
            toggleSection={toggleSection}
            title={`🟢 Float Recovery (${comparisonResults.floatRecovery.length})`}
            emptyText="No float recovery detected."
            rows={comparisonResults.floatRecovery}
            issueType="Float Recovery"
            createIssueFromDelta={createIssueFromDelta}
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            setSelectedMilestones={setSelectedMilestones}
            getRowKey={getRowKey}
            columns={[
              ["activityId", "ID"],
              ["activityName", "Activity"],
              ["previousFloat", "Previous Float"],
              ["currentFloat", "Current Float"],
              ["deltaFloat", "Float Gained"],
            ]}
          />

          <DeltaTable
            sectionKey="newCriticalActivities"
            collapsed={collapsedSections.newCriticalActivities}
            toggleSection={toggleSection}
            title={`🔴 New Critical Activities (${comparisonResults.newCriticalActivities.length})`}
            emptyText="No new critical activities detected."
            rows={comparisonResults.newCriticalActivities}
            issueType="New Critical Activity"
            createIssueFromDelta={createIssueFromDelta}
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            setSelectedMilestones={setSelectedMilestones}
            getRowKey={getRowKey}
            columns={[
              ["activityId", "ID"],
              ["activityName", "Activity"],
              ["currentFloat", "Float"],
              ["finish", "Finish"],
            ]}
          />

          <DeltaTable
            sectionKey="newActivities"
            collapsed={collapsedSections.newActivities}
            toggleSection={toggleSection}
            title={`🆕 New Activities (${comparisonResults.newActivities.length})`}
            emptyText="No new activities detected."
            rows={comparisonResults.newActivities}
            issueType="New Activity"
            createIssueFromDelta={createIssueFromDelta}
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            setSelectedMilestones={setSelectedMilestones}
            getRowKey={getRowKey}
            columns={[
              ["activityId", "ID"],
              ["activityName", "Activity"],
              ["start", "Start"],
              ["finish", "Finish"],
              ["totalFloat", "Total Float"],
            ]}
          />

          <DeltaTable
            sectionKey="removedActivities"
            collapsed={collapsedSections.removedActivities}
            toggleSection={toggleSection}
            title={`⚪ Removed Activities (${comparisonResults.removedActivities.length})`}
            emptyText="No removed activities detected."
            rows={comparisonResults.removedActivities}
            issueType="Removed Activity"
            createIssueFromDelta={createIssueFromDelta}
            milestones={milestones}
            selectedMilestones={selectedMilestones}
            setSelectedMilestones={setSelectedMilestones}
            getRowKey={getRowKey}
            columns={[
              ["activityId", "ID"],
              ["activityName", "Activity"],
              ["start", "Start"],
              ["finish", "Finish"],
              ["totalFloat", "Total Float"],
            ]}
          />
        </>
      )}

      {latestSnapshot && (
        <div className="card">
          <div className="section-header-row">
            <h3>Current Schedule Activities</h3>

            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
            >
              <option value="critical">Critical / Zero Float</option>
              <option value="milestones">Milestone-Like Activities</option>
              <option value="all">All Activities</option>
            </select>
          </div>

          <p>
            Latest snapshot: <strong>{latestSnapshot.fileName}</strong>
          </p>

          {filteredLatestActivities.length === 0 ? (
            <p>No activities match this filter.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Activity</th>
                  <th>Start</th>
                  <th>Finish</th>
                  <th>Total Float</th>
                  <th>Critical</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredLatestActivities.map((activity) => {
                  const alreadyMilestone = milestones.some(
                    (milestone) =>
                      milestone.sourceActivityId === activity.activityId ||
                      milestone.name === activity.activityName
                  );

                  return (
                    <tr
  key={`current-${activity.activityId}`}
  className={
    activityFilter === "milestones" &&
    isMilestoneInNext90Days(activity)
      ? "next-90-milestone"
      : ""
  }
>
                      <td>{activity.activityId}</td>
                      <td>
  {activity.activityName}

  {activityFilter === "milestones" &&
    isMilestoneInNext90Days(activity) && (
      <span className="next-90-badge">
        Next 90 Days
      </span>
    )}
</td>
                      <td>{activity.start || "-"}</td>
                      <td>{activity.finish || "-"}</td>
                      <td>{activity.totalFloat || "-"}</td>
                      <td>{isCriticalActivity(activity) ? "Yes" : "No"}</td>

                      <td>
                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() =>
                            addCurrentActivityToMilestones(activity)
                          }
                          disabled={alreadyMilestone}
                        >
                          {alreadyMilestone
                            ? "Already Added"
                            : "Add Milestone"}
                        </button>

                        <button
                          type="button"
                          className="secondary-button small-button"
                          onClick={() =>
                            createIssueFromCurrentActivity(activity)
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
          )}
        </div>
      )}
    </div>
  );
}

function DeltaTable({
  sectionKey,
  collapsed,
  toggleSection,
  title,
  emptyText,
  rows,
  columns,
  issueType,
  createIssueFromDelta,
  milestones,
  selectedMilestones,
  setSelectedMilestones,
  getRowKey,
  suffixByKey = {},
}) {
  return (
    <div className="card">
      <div className="section-header-row">
        <h3>{title}</h3>

        <button
          type="button"
          className="secondary-button small-button"
          onClick={() => toggleSection(sectionKey)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {!collapsed &&
        (rows.length === 0 ? (
          <p>{emptyText}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
                <th>Linked Milestone</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((activity, index) => {
                const rowKey =
                  activity.activityId && activity.activityId !== ""
                    ? getRowKey(activity, issueType)
                    : `${issueType}-${index}`;

                return (
                  <tr key={rowKey}>
                    {columns.map(([key]) => (
                      <td key={key}>
                        {activity[key] ?? "-"}
                        {activity[key] !== undefined && suffixByKey[key]
                          ? suffixByKey[key]
                          : ""}
                      </td>
                    ))}

                    <td>
                      <select
                        value={selectedMilestones[rowKey] || ""}
                        onChange={(e) =>
                          setSelectedMilestones({
                            ...selectedMilestones,
                            [rowKey]: e.target.value,
                          })
                        }
                      >
                        <option value="">Unassigned</option>

                        {milestones
                          .filter((milestone) => !milestone.archived)
                          .map((milestone) => (
                            <option key={milestone.id} value={milestone.name}>
                              {milestone.name}
                            </option>
                          ))}
                      </select>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => createIssueFromDelta(activity, issueType)}
                      >
                        Create Issue
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
    </div>
  );
}

export default ScheduleIntelligence;