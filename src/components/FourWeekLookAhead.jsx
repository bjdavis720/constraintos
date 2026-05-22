import { useMemo, useState } from "react";
import { traceActivityToMilestone } from "../utils/logicTrace";

function FourWeekLookAhead({
  activities = [],
  project,
  constraints = [],
  setConstraintForm,
  setActivePage,
  scheduleActivities = [],
  scheduleRelationships = [],
}) {
  
  const [activeView, setActiveView] = useState("gantt");
  const [primarySort, setPrimarySort] = useState("wbs");
  const [secondarySort, setSecondarySort] = useState("activityCode");
  const [selectedActivityCode, setSelectedActivityCode] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [manualActivities, setManualActivities] = useState([]);
  const [cardComments, setCardComments] = useState({});
  const [pullPlanColumns, setPullPlanColumns] = useState({});
  const [draggedCardId, setDraggedCardId] = useState(null);

  const [manualForm, setManualForm] = useState({
    activityId: "",
    activityName: "",
    wbs: "",
    start: "",
    finish: "",
    responsible: "",
    totalFloat: "",
    predecessors: [],
    successors: [],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function normalizeDate(value) {
    if (!value) return null;

    const text = String(value).trim();
    if (!text) return null;

    const mmddMatch = text.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (mmddMatch) {
      const date = new Date(
        today.getFullYear(),
        Number(mmddMatch[1]) - 1,
        Number(mmddMatch[2])
      );
      date.setHours(0, 0, 0, 0);
      return date;
    }

    const date = new Date(text);
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addWorkDays(startDate, workDays) {
    const date = new Date(startDate);
    let added = 0;

    while (added < workDays - 1) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) added++;
    }

    return date;
  }

  function getWorkDaysBetween(start, end) {
    const days = [];
    const current = new Date(start);

    while (current <= end) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  function formatDate(date) {
    if (!date) return "-";
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
    });
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function getBestWbs(activity) {
    const directWbs =
      activity.wbs ||
      activity.wbsName ||
      activity.wbsPath ||
      activity.wbsCode ||
      activity.parentWbs ||
      activity.phase ||
      activity.area;

    if (directWbs) return directWbs;

    const id = String(
      activity.activityId ||
        activity.id ||
        activity.taskCode ||
        activity.activity_id ||
        ""
    ).toUpperCase();

    if (id.includes("PROC")) return "Procurement";
    if (id.startsWith("PERM")) return "Permits / Approvals";
    if (id.startsWith("PMILE")) return "Project Milestones";
    if (id.startsWith("SES")) return "Sitework / Southeast Site";
    if (id.startsWith("NE")) return "Northeast Site / Utilities";
    if (id.startsWith("NCIB")) return "North Commercial Inspection Building";
    if (id.startsWith("MB")) return "Main Building";
    if (id.startsWith("APHIS")) return "APHIS Building";
    if (id.startsWith("WS")) return "Wetlands / Sitework";

    return "Unassigned WBS";
  }

  function looksLikeActivityCodeKey(key) {
    const normalized = String(key).toUpperCase();

    const excluded = [
      "ACTIVITYID",
      "ACTIVITY ID",
      "ACTIVITYNAME",
      "ACTIVITY NAME",
      "NAME",
      "DESCRIPTION",
      "START",
      "FINISH",
      "STARTDATE",
      "FINISHDATE",
      "EARLYSTART",
      "EARLYFINISH",
      "PLANNEDSTART",
      "PLANNEDFINISH",
      "TOTALFLOAT",
      "FLOAT",
      "REMAININGFLOAT",
      "PREDECESSORS",
      "SUCCESSORS",
      "STATUS",
      "PERCENTCOMPLETE",
      "WBS",
      "WBSNAME",
      "WBSPATH",
      "WBSCODE",
    ];

    if (excluded.includes(normalized)) return false;

    return (
      normalized.includes(" - ") ||
      normalized.includes("101") ||
      normalized.includes("SUBC") ||
      normalized.includes("CLIN") ||
      normalized.includes("AREA") ||
      normalized.includes("TOWPH") ||
      normalized.includes("CODE")
    );
  }

  function getActivityCodeOptions(activityList) {
  const codeSet = new Set();

  activityList.forEach((activity) => {
    Object.keys(activity?.activityCodes || {}).forEach((key) => {
      codeSet.add(key);
    });

    Object.keys(activity || {}).forEach((key) => {
      if (looksLikeActivityCodeKey(key)) {
        codeSet.add(key);
      }
    });
  });

  return Array.from(codeSet).sort();
}

function getActivityCodeDisplay(activity, codeName) {
  if (!activity || !codeName) return "Unassigned";

  const nestedValue = activity.activityCodes?.[codeName];

  if (nestedValue) {
    return (
      nestedValue.description ||
      nestedValue.codeDescription ||
      nestedValue.desc ||
      nestedValue.name ||
      nestedValue.value ||
      "Unassigned"
    );
  }

  const exactValue = activity[codeName];

  if (exactValue) {
    if (typeof exactValue === "object") {
      return (
        exactValue.description ||
        exactValue.codeDescription ||
        exactValue.desc ||
        exactValue.name ||
        exactValue.value ||
        "Unassigned"
      );
    }

    return String(exactValue);
  }

  return "Unassigned";
}
  
    function getWeekNumber(date) {
    const diffTime = date - today;
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    if (diffDays <= 6) return "Week 1";
    if (diffDays <= 13) return "Week 2";
    if (diffDays <= 20) return "Week 3";
    return "Week 4";
  }

  function getSortValue(activity, sortType) {
    if (sortType === "wbs") return activity.wbs || "Unassigned WBS";
    if (sortType === "activityCode") {
      return activity.activityCodeGroup || "Unassigned";
    }
    if (sortType === "start") return activity.parsedStart;
    return "";
  }

  function compareSortValues(a, b) {
    if (a instanceof Date && b instanceof Date) return a - b;
    return String(a || "").localeCompare(String(b || ""));
  }

  const lookAheadEnd = addWorkDays(today, 20);
  const workDays = getWorkDaysBetween(today, lookAheadEnd);
  const allActivities = [...activities, ...manualActivities];
const milestoneIds = (scheduleActivities || [])
  .filter((activity) => {
    const taskType = activity.taskType || activity.type || "";

    return (
      taskType.includes("Milestone") ||
      taskType.includes("Start Milestone") ||
      taskType.includes("Finish Milestone")
    );
  })
  .map((activity) => activity.id);
  const availableActivityCodes = useMemo(
    () => getActivityCodeOptions(allActivities),
    [activities, manualActivities]
  );

  const lookAheadActivities = useMemo(() => {
    return allActivities
      .map((activity) => {
        const start =
          normalizeDate(activity.start) ||
          normalizeDate(activity.startDate) ||
          normalizeDate(activity.earlyStart) ||
          normalizeDate(activity.plannedStart);

        const finish =
          normalizeDate(activity.finish) ||
          normalizeDate(activity.finishDate) ||
          normalizeDate(activity.earlyFinish) ||
          normalizeDate(activity.plannedFinish);

        const activityId =
          activity.activityId ||
          activity.id ||
          activity.taskCode ||
          activity.activity_id ||
          crypto.randomUUID();

        const activityName =
          activity.activityName ||
          activity.name ||
          activity.description ||
          activity.activityDescription ||
          activity.taskName ||
          "Unnamed Activity";

        const activityCodeGroup = getActivityCodeDisplay(
          activity,
          selectedActivityCode
        );

        return {
          ...activity,
          id: activityId,
          activityId,
          name: activityName,
          parsedStart: start,
          parsedFinish: finish,
          wbs: getBestWbs(activity),
          activityCodeGroup,
          responsible: activityCodeGroup,
          float:
            activity.totalFloat ??
            activity.float ??
            activity.remainingFloat ??
            null,
          predecessors: activity.predecessors || "",
          successors: activity.successors || "",
          isManual: activity.isManual || false,
        };
      })
      .filter((activity) => {
        if (!activity.parsedStart || !activity.parsedFinish) return false;
        if (activity.parsedFinish < activity.parsedStart) return false;

        const overlapsWindow =
          activity.parsedStart <= lookAheadEnd && activity.parsedFinish >= today;

        const incomplete =
          activity.status !== "Complete" &&
          activity.status !== "Completed" &&
          activity.percentComplete !== 100;

        return overlapsWindow && incomplete;
      })
      .sort((a, b) => {
        const primaryCompare = compareSortValues(
          getSortValue(a, primarySort),
          getSortValue(b, primarySort)
        );

        if (primaryCompare !== 0) return primaryCompare;

        const secondaryCompare = compareSortValues(
          getSortValue(a, secondarySort),
          getSortValue(b, secondarySort)
        );

        if (secondaryCompare !== 0) return secondaryCompare;

        return a.parsedStart - b.parsedStart;
      });
  }, [
    activities,
    manualActivities,
    primarySort,
    secondarySort,
    selectedActivityCode,
  ]);

  const availableWbsOptions = [
    ...new Set(lookAheadActivities.map((activity) => activity.wbs)),
  ].sort();

  const availableResponsibleOptions = [
  ...new Set(
    lookAheadActivities
      .map((activity) => activity.activityCodeGroup || activity.responsible)
      .filter((value) => value && value !== "Unassigned")
  ),
].sort();

const availableActivityOptions = lookAheadActivities
  .map((activity) => ({
    id: activity.id,
    name: activity.name,
    finish: activity.parsedFinish,
    start: activity.parsedStart,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

  const groupedActivities = lookAheadActivities.reduce((groups, activity) => {
  const rawPrimaryKey = getSortValue(activity, primarySort) || "Unassigned";
const rawSecondaryKey = getSortValue(activity, secondarySort) || "Unassigned";

const primaryKey =
  rawPrimaryKey instanceof Date
    ? rawPrimaryKey.toISOString()
    : String(rawPrimaryKey);

const secondaryKey =
  rawSecondaryKey instanceof Date
    ? rawSecondaryKey.toISOString()
    : String(rawSecondaryKey);

  if (!groups[primaryKey]) {
    groups[primaryKey] = {
      items: [],
      subgroups: {},
    };
  }

  groups[primaryKey].items.push(activity);

  if (!groups[primaryKey].subgroups[secondaryKey]) {
    groups[primaryKey].subgroups[secondaryKey] = [];
  }

  groups[primaryKey].subgroups[secondaryKey].push(activity);

  return groups;
}, {});

  const pullPlanBuckets = {
    "Week 1": [],
    "Week 2": [],
    "Week 3": [],
    "Week 4": [],
    "Constraints / Not Ready": [],
    "Ready / Committed": [],
  };

  lookAheadActivities.forEach((activity) => {
    const column =
      pullPlanColumns[activity.id] || getWeekNumber(activity.parsedStart);

    if (!pullPlanBuckets[column]) {
      pullPlanBuckets[column] = [];
    }

    pullPlanBuckets[column].push(activity);
  });

  Object.keys(pullPlanBuckets).forEach((column) => {
    pullPlanBuckets[column].sort((a, b) => {
      const primaryCompare = compareSortValues(
        getSortValue(a, primarySort),
        getSortValue(b, primarySort)
      );

      if (primaryCompare !== 0) return primaryCompare;

      const secondaryCompare = compareSortValues(
        getSortValue(a, secondarySort),
        getSortValue(b, secondarySort)
      );

      if (secondaryCompare !== 0) return secondaryCompare;

      return a.parsedStart - b.parsedStart;
    });
  });

  function activityTouchesDay(activity, day) {
    return activity.parsedStart <= day && activity.parsedFinish >= day;
  }

  function getActivityClass(activity) {
    const floatValue = Number(activity.float);

    if (!Number.isNaN(floatValue) && floatValue <= 0) {
      return "gantt-cell active critical";
    }

    if (!Number.isNaN(floatValue) && floatValue <= 5) {
      return "gantt-cell active near-critical";
    }

    return "gantt-cell active";
  }

  function toggleGroup(groupName) {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  }

  function activityHasConstraint(activity) {
    return constraints.some(
      (constraint) =>
        constraint.activityId === activity.id ||
        constraint.linkedActivityId === activity.id ||
        constraint.sourceActivityId === activity.id
    );
  }

  function openConstraintForActivity(activity) {
    if (setConstraintForm) {
      setConstraintForm((prev) => ({
        ...prev,
        description: `Look ahead activity ${activity.id} needs constraint review: ${activity.name}`,
        owner: activity.responsible,
        requiredBy: activity.parsedStart
          ? activity.parsedStart.toISOString().slice(0, 10)
          : "",
        milestone: activity.name,
        status: "Open",
        activityId: activity.id,
        linkedActivityId: activity.id,
      }));
    }

    if (setActivePage) {
      setActivePage("Constraint Board");
    }
  }

  function handleManualChange(e) {
    const { name, value } = e.target;

    const updatedForm = {
      ...manualForm,
      [name]: value,
    };

    const calculatedFloat = calculateManualFloat(updatedForm);

    setManualForm({
      ...updatedForm,
      totalFloat: calculatedFloat,
    });
  }

  function handleMultiSelectChange(e, fieldName) {
    const selectedValues = Array.from(e.target.selectedOptions).map(
      (option) => option.value
    );

    const updatedForm = {
      ...manualForm,
      [fieldName]: selectedValues,
    };

    const calculatedFloat = calculateManualFloat(updatedForm);

    setManualForm({
      ...updatedForm,
      totalFloat: calculatedFloat,
    });
  }

  function calculateManualFloat(form) {
    const start = normalizeDate(form.start);
    const finish = normalizeDate(form.finish);

    if (!start || !finish) return "";

    const selectedSuccessors = availableActivityOptions.filter((activity) =>
      form.successors.includes(activity.id)
    );

    if (selectedSuccessors.length === 0) return "";

    const earliestSuccessorStart = selectedSuccessors
      .map((activity) => activity.start)
      .filter(Boolean)
      .sort((a, b) => a - b)[0];

    if (!earliestSuccessorStart) return "";

    const diffMs = earliestSuccessorStart - finish;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  function addManualActivity(e) {
    e.preventDefault();

    if (
      !manualForm.activityId ||
      !manualForm.activityName ||
      !manualForm.start ||
      !manualForm.finish
    ) {
      alert("Please enter activity ID, activity name, start, and finish.");
      return;
    }

    const newActivity = {
      id: manualForm.activityId,
      activityId: manualForm.activityId,
      activityName: manualForm.activityName,
      start: manualForm.start,
      finish: manualForm.finish,
      wbs: manualForm.wbs || "Manual Activities",
      responsible: manualForm.responsible || "Unassigned",
activityCodeGroup: manualForm.responsible || "Unassigned",
      totalFloat: manualForm.totalFloat || "",
      predecessors: manualForm.predecessors.join(", "),
      successors: manualForm.successors.join(", "),
      isManual: true,
    };

    setManualActivities((prev) => [...prev, newActivity]);

    setManualForm({
      activityId: "",
      activityName: "",
      wbs: "",
      start: "",
      finish: "",
      responsible: "",
      totalFloat: "",
      predecessors: [],
      successors: [],
    });
  }

  function handleDrop(column) {
    if (!draggedCardId) return;

    setPullPlanColumns((prev) => ({
      ...prev,
      [draggedCardId]: column,
    }));

    setDraggedCardId(null);
  }

  function updateComment(activityId, value) {
    setCardComments((prev) => ({
      ...prev,
      [activityId]: value,
    }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>4-Week Look Ahead and Pull Plan</h1>
        <p>{project}</p>
      </div>

      <div className="lookahead-tabs">
        <button
          type="button"
          className={activeView === "gantt" ? "active" : ""}
          onClick={() => setActiveView("gantt")}
        >
          Gantt View
        </button>

        <button
          type="button"
          className={activeView === "pullplan" ? "active" : ""}
          onClick={() => setActiveView("pullplan")}
        >
          Pull Plan Board
        </button>
      </div>

      <div className="lookahead-controls">
        <select
          value={primarySort}
          onChange={(e) => setPrimarySort(e.target.value)}
        >
          <option value="wbs">Primary: WBS</option>
          <option value="activityCode">Primary: Activity Code</option>
          <option value="start">Primary: Start Date</option>
        </select>

        <select
          value={secondarySort}
          onChange={(e) => setSecondarySort(e.target.value)}
        >
          <option value="wbs">Secondary: WBS</option>
          <option value="activityCode">Secondary: Activity Code</option>
          <option value="start">Secondary: Start Date</option>
        </select>

        <select
          value={selectedActivityCode}
          onChange={(e) => setSelectedActivityCode(e.target.value)}
        >
          <option value="">Select Activity Code</option>
          {availableActivityCodes.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => window.print()}>
          Print Current View
        </button>
      </div>

      <div className="card">
        <h2>Manual Look Ahead Activity</h2>

        <form className="manual-activity-form" onSubmit={addManualActivity}>
          <input
            name="activityId"
            value={manualForm.activityId}
            onChange={handleManualChange}
            placeholder="Activity ID"
          />

          <input
            name="activityName"
            value={manualForm.activityName}
            onChange={handleManualChange}
            placeholder="Activity Name"
          />

          <select name="wbs" value={manualForm.wbs} onChange={handleManualChange}>
            <option value="">Select WBS / Area</option>
            {availableWbsOptions.map((wbs) => (
              <option key={wbs} value={wbs}>
                {wbs}
              </option>
            ))}
            <option value="Manual Activities">Manual Activities</option>
          </select>

          <input
            name="start"
            type="date"
            value={manualForm.start}
            onChange={handleManualChange}
          />

          <input
            name="finish"
            type="date"
            value={manualForm.finish}
            onChange={handleManualChange}
          />

          <select
  name="responsible"
  value={manualForm.responsible}
  onChange={handleManualChange}
>
  <option value="">Select Responsible / Trade</option>

  {availableResponsibleOptions.map((responsible) => (
    <option key={responsible} value={responsible}>
      {responsible}
    </option>
  ))}

  <option value="Unassigned">Unassigned</option>
</select>

          <input
            name="totalFloat"
            value={manualForm.totalFloat}
            readOnly
            placeholder="Auto Float"
          />

          <select
            name="predecessors"
            value={manualForm.predecessors[0] || ""}
            onChange={(e) =>
              handleMultiSelectChange(
                { target: { selectedOptions: [{ value: e.target.value }] } },
                "predecessors"
              )
            }
          >
            <option value="">Select Predecessor</option>
            {availableActivityOptions.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.id} - {activity.name}
              </option>
            ))}
          </select>

          <select
            name="successors"
            value={manualForm.successors[0] || ""}
            onChange={(e) =>
              handleMultiSelectChange(
                { target: { selectedOptions: [{ value: e.target.value }] } },
                "successors"
              )
            }
          >
            <option value="">Select Successor</option>
            {availableActivityOptions.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.id} - {activity.name}
              </option>
            ))}
          </select>

          <button type="submit">Add Activity</button>
        </form>
      </div>

      <div className="card">
        <h2>Next 20 Work Days</h2>
        <p>
          This view includes incomplete activities active today or scheduled
          within the next 20 work days.
        </p>
      </div>

      {lookAheadActivities.length === 0 ? (
        <div className="card">
          <p>No activities were found in the next 20 work days.</p>
        </div>
      ) : activeView === "gantt" ? (
        <div className="lookahead-wrapper">
          {Object.entries(groupedActivities).map(([primaryName, group]) => {
  const primaryCollapsed = collapsedGroups[`primary-${primaryName}`];

  return (
    <div className="lookahead-wbs-group" key={primaryName}>
      <button
        type="button"
        className="lookahead-wbs-heading"
        onClick={() => toggleGroup(`primary-${primaryName}`)}
      >
        <span>
          {primaryCollapsed ? "▶" : "▼"} {primaryName} —{" "}
          {group.items.length} activities
        </span>
      </button>

      {!primaryCollapsed &&
        Object.entries(group.subgroups).map(([secondaryName, items]) => {
          const secondaryKey = `secondary-${primaryName}-${secondaryName}`;
          const secondaryCollapsed = collapsedGroups[secondaryKey];

          return (
            <div className="lookahead-wbs-group" key={secondaryKey}>
              <button
                type="button"
                className="lookahead-wbs-heading secondary-heading"
                onClick={() => toggleGroup(secondaryKey)}
              >
                <span>
                  {secondaryCollapsed ? "▶" : "▼"} {secondaryName} —{" "}
                  {items.length} activities
                </span>
              </button>

              {!secondaryCollapsed && (
                <>
                  <div className="lookahead-grid lookahead-grid-header">
                    <div>Activity</div>
                    <div>Start</div>
                    <div>Finish</div>
                    <div>Float</div>

                    {workDays.map((day) => (
                      <div
                        key={day.toISOString()}
                        className={
                          isSameDay(day, today)
                            ? "lookahead-day today"
                            : "lookahead-day"
                        }
                      >
                        {formatDate(day)}
                      </div>
                    ))}
                  </div>

                  {items.map((activity) => (
                    <div className="lookahead-grid" key={activity.id}>
                      <div className="activity-name">
                        <strong>
                          {activity.id}
                          {activity.isManual ? " *" : ""}
                        </strong>
                        <span>{activity.name}</span>
                        <small>{activity.activityCodeGroup}</small>
                      </div>

                      <div>{formatDate(activity.parsedStart)}</div>
                      <div>{formatDate(activity.parsedFinish)}</div>
                      <div>
                        {activity.float !== null &&
                        activity.float !== undefined &&
                        activity.float !== ""
                          ? `${Math.round(Number(activity.float))}d`
                          : "-"}
                      </div>

                      {workDays.map((day) => (
                        <div
                          key={`${activity.id}-${day.toISOString()}`}
                          className={
                            activityTouchesDay(activity, day)
                              ? activity.isManual
                                ? "gantt-cell active manual"
                                : getActivityClass(activity)
                              : isSameDay(day, today)
                              ? "gantt-cell today"
                              : "gantt-cell"
                          }
                        />
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}
    </div>
  );
})}
        </div>
      ) : (
        <div className="pull-plan-board pull-plan-board-expanded">
          {Object.entries(pullPlanBuckets).map(([column, items]) => (
            <div
              className="pull-plan-column"
              key={column}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(column)}
            >
              <div className="pull-plan-column-header">
                <h3>{column}</h3>
                <span>{items.length} activities</span>
              </div>

              {items.length === 0 ? (
                <div className="pull-plan-empty">Drop activities here</div>
              ) : (
                items.map((activity) => {
                  const logicTrace = traceActivityToMilestone(
  activity.id,
  scheduleRelationships,
  scheduleActivities,
  milestoneIds
);
                  const hasConstraint = activityHasConstraint(activity);
                  const floatValue = Number(activity.float);
                  const isCritical =
                    !Number.isNaN(floatValue) && floatValue <= 0;
                  const isNearCritical =
                    !Number.isNaN(floatValue) &&
                    floatValue > 0 &&
                    floatValue <= 5;

                  return (
                    <div
                      draggable
                      onDragStart={() => setDraggedCardId(activity.id)}
                      className={
                        activity.isManual
                          ? "sticky-note manual"
                          : isCritical
                          ? "sticky-note critical"
                          : isNearCritical
                          ? "sticky-note near-critical"
                          : "sticky-note"
                      }
                      key={activity.id}
                    >
                      <div className="sticky-note-top">
                        <strong>{activity.id}</strong>
                        <span>{activity.activityCodeGroup}</span>
                      </div>

                      <h4>{activity.name}</h4>
                      <p>{activity.wbs}</p>

                      <div className="sticky-note-meta">
                        <span>
                          {formatDate(activity.parsedStart)} -{" "}
                          {formatDate(activity.parsedFinish)}
                        </span>

                        <span>
                          Float:{" "}
                          {activity.float !== null &&
                          activity.float !== undefined &&
                          activity.float !== ""
                            ? `${Math.round(Number(activity.float))}d`
                            : "-"}
                        </span>
                      </div>
                      {logicTrace ? (
  <div className="milestone-trace trace-hit">
    <strong>Feeds Milestone</strong>

    <div>{logicTrace.milestoneName}</div>

    <div>
      {logicTrace.stepsAway} logic step
      {logicTrace.stepsAway !== 1 ? "s" : ""} away
    </div>
  </div>
) : (
  <div className="milestone-trace trace-none">
    No milestone path found
  </div>
)}

                      {(activity.predecessors || activity.successors) && (
                        <div className="sticky-note-logic">
                          {activity.predecessors && (
                            <span>Pred: {activity.predecessors}</span>
                          )}
                          {activity.successors && (
                            <span>Succ: {activity.successors}</span>
                          )}
                        </div>
                        
                      )}

                      <textarea
                        className="sticky-note-comments"
                        value={cardComments[activity.id] || ""}
                        onChange={(e) =>
                          updateComment(activity.id, e.target.value)
                        }
                        placeholder="Add planning comments, constraints, crew notes..."
                      />

                      <div className="sticky-note-status">
                        {hasConstraint ? (
                          <span className="constraint-pill has-constraint">
                            Constraint Linked
                          </span>
                        ) : (
                          <span className="constraint-pill ready-review">
                            Needs Review
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="small-action-button"
                        onClick={() => openConstraintForActivity(activity)}
                      >
                        Add / Review Constraint
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

}
export default FourWeekLookAhead;