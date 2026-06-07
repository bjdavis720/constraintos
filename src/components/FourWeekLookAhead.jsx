import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import Metric from "./Metric.jsx";

function FourWeekLookAhead({
  activities = [],
  scheduleRelationships = [],
  project,
  milestones = [],
  constraints = [],
  issues = [],
  submittals = [],
  workZones = [],
  pullPlans = {},
  ppcHistory = [],
  setPpcHistory,
  updateCurrentProjectData,
  setConstraintForm,
  setActivePage,
}) {
  const [activeView, setActiveView] = useState(() => {
  const savedPath = sessionStorage.getItem("sentinel_return_path");

  if (savedPath) {
    const returnPath = JSON.parse(savedPath);

    if (returnPath.view === "pullplan") {
      return "pullplan";
    }
  }

  return "lookahead";
});
  const [primarySort, setPrimarySort] = useState("wbs");
  const [secondarySort, setSecondarySort] = useState("activityCode");
  const [selectedActivityCode, setSelectedActivityCode] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [draggedCardId, setDraggedCardId] = useState(null);
const [draggedReferenceActivityId, setDraggedReferenceActivityId] = useState(null);
const [referenceSearch, setReferenceSearch] = useState("");
const [referenceMode, setReferenceMode] = useState("lookahead");
  const [newZoneName, setNewZoneName] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(
    milestones?.[0]?.id ? String(milestones[0].id) : ""
  );
  useEffect(() => {
  const savedPath = sessionStorage.getItem("sentinel_return_path");

  if (!savedPath) return;

  const returnPath = JSON.parse(savedPath);

  if (returnPath.view === "pullplan") {
    setActiveView("pullplan");
  }

  if (returnPath.milestoneId) {
    setSelectedMilestoneId(String(returnPath.milestoneId));
  }
}, []);
  const [pullCardForm, setPullCardForm] = useState({
    title: "",
    trade: "",
    zone: "",
    weekOffset: "-1",
    duration: "",
    needs: "",
    constraints: "",
    handoff: "",
    owner: "",
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

  function formatFullDate(value) {
    const date = normalizeDate(value);
    if (!date) return "No date";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function getDurationDays(start, finish) {
    if (!start || !finish) return "";
    const ms = finish - start;
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
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
        if (looksLikeActivityCodeKey(key)) codeSet.add(key);
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

  function getSortValue(activity, sortType) {
    if (sortType === "wbs") return activity.wbs || "Unassigned WBS";
    if (sortType === "activityCode") return activity.activityCodeGroup || "Unassigned";
    if (sortType === "start") return activity.parsedStart;
    return "";
  }

  function compareSortValues(a, b) {
    if (a instanceof Date && b instanceof Date) return a - b;
    return String(a || "").localeCompare(String(b || ""));
  }

  const lookAheadEnd = addWorkDays(today, 20);
  const workDays = getWorkDaysBetween(today, lookAheadEnd);

  const availableActivityCodes = useMemo(
    () => getActivityCodeOptions(activities),
    [activities]
  );

  const lookAheadActivities = useMemo(() => {
    return activities
      .map((activity, index) => {
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
          `activity-${index}`;

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
          id: String(activityId),
          activityId: String(activityId),
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
  }, [activities, primarySort, secondarySort, selectedActivityCode]);

  const groupedActivities = lookAheadActivities.reduce((groups, activity) => {
    const rawPrimaryKey = getSortValue(activity, primarySort) || "Unassigned";
    const rawSecondaryKey = getSortValue(activity, secondarySort) || "Unassigned";

    const primaryKey = rawPrimaryKey instanceof Date ? rawPrimaryKey.toISOString() : String(rawPrimaryKey);
    const secondaryKey = rawSecondaryKey instanceof Date ? rawSecondaryKey.toISOString() : String(rawSecondaryKey);

    if (!groups[primaryKey]) {
      groups[primaryKey] = { items: [], subgroups: {} };
    }

    groups[primaryKey].items.push(activity);

    if (!groups[primaryKey].subgroups[secondaryKey]) {
      groups[primaryKey].subgroups[secondaryKey] = [];
    }

    groups[primaryKey].subgroups[secondaryKey].push(activity);
    return groups;
  }, {});

  const selectedMilestone = milestones.find(
    (milestone) => String(milestone.id) === String(selectedMilestoneId)
  );

  const currentPullPlan = pullPlans?.[selectedMilestoneId] || {
    milestoneId: selectedMilestoneId,
    cards: [],
  };

  const pullCards = currentPullPlan.cards || [];
  const readinessCounts = pullCards.reduce((counts, card) => {
  const readiness = getReadiness(card);
  const key = readiness.className || "needs-defined";

  counts[key] = (counts[key] || 0) + 1;

  return counts;
}, {});
  const zoneList = workZones && workZones.length > 0 ? workZones : ["Unassigned Zone"];
  const tradeList = Array.from(
    new Set(
      [
        ...lookAheadActivities.map((activity) => activity.activityCodeGroup),
        ...pullCards.map((card) => card.trade),
      ].filter((value) => value && value !== "Unassigned")
    )
  ).sort();

  const pullWeekColumns = [
    { label: "Week -6", value: "-6" },
    { label: "Week -5", value: "-5" },
    { label: "Week -4", value: "-4" },
    { label: "Week -3", value: "-3" },
    { label: "Week -2", value: "-2" },
    { label: "Week -1", value: "-1" },
    { label: "Milestone", value: "0" },
  ];

  function updatePullPlan(cards) {
    if (!updateCurrentProjectData || !selectedMilestoneId) return;

    updateCurrentProjectData({
      pullPlans: {
        ...(pullPlans || {}),
        [selectedMilestoneId]: {
          ...currentPullPlan,
          milestoneId: selectedMilestoneId,
          milestoneName: selectedMilestone?.name || "",
          targetDate: selectedMilestone?.due || "",
          cards,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  function updateWorkZones(nextZones) {
    if (!updateCurrentProjectData) return;
    updateCurrentProjectData({ workZones: nextZones });
  }

  function addWorkZone(e) {
    e.preventDefault();
    const zoneName = newZoneName.trim();
    if (!zoneName) return;

    const nextZones = Array.from(new Set([...(workZones || []), zoneName]));
    updateWorkZones(nextZones);
    setNewZoneName("");
  }

  function removeWorkZone(zoneName) {
    const confirmed = window.confirm(
      `Remove ${zoneName} from work zones? Existing sprint plan cards will remain but show as unassigned until moved.`
    );
    if (!confirmed) return;
    updateWorkZones((workZones || []).filter((zone) => zone !== zoneName));
  }

  function addPullCard(e) {
    e.preventDefault();

    if (!selectedMilestoneId) {
      alert("Please select a milestone first.");
      return;
    }

    if (!pullCardForm.title.trim()) {
      alert("Please enter a sprint plan activity.");
      return;
    }

    const newCard = {
      id: `pull-${Date.now()}`,
      ...pullCardForm,
      weekOffset: pullCardForm.weekOffset || "-1",
      zone: pullCardForm.zone || zoneList[0] || "Unassigned Zone",
      trade: pullCardForm.trade || "Unassigned Trade",
      readinessOverride: "",
      source: "Manual Sprint Plan",
      createdAt: new Date().toISOString(),
      completed: false,
completedAt: null,
status: "Open",
missedReason: "",
missedAt: null,
    };

    updatePullPlan([...pullCards, newCard]);

    setPullCardForm({
      title: "",
      trade: "",
      zone: "",
      weekOffset: "-1",
      duration: "",
      needs: "",
      constraints: "",
      handoff: "",
      owner: "",
    });
  }

   function addScheduleActivityToPullPlan(activity, targetZone = "", targetWeekOffset = "-1") {
    if (!selectedMilestoneId) {
      alert("Please select a milestone first.");
      return;
    }

    const alreadyAdded = pullCards.some(
      (card) => card.linkedActivityId === activity.id
    );

    if (alreadyAdded) {
      alert("This schedule activity is already on the sprint plan.");
      return;
    }

    const newCard = {
      id: `pull-${Date.now()}`,
      title: activity.name,
      trade: activity.activityCodeGroup || "Unassigned Trade",
      zone: targetZone || zoneList[0] || "Unassigned Zone",
      weekOffset: String(targetWeekOffset || "-1"),
      duration: getDurationDays(activity.parsedStart, activity.parsedFinish),
      needs: activity.predecessors
        ? `Predecessors complete: ${activity.predecessors}`
        : "",
      constraints: "",
      handoff: activity.successors
        ? `Feeds successors: ${activity.successors}`
        : "",
      owner: activity.responsible || "",
      source: "CPM Reference",
      linkedActivityId: activity.id,
      activityId: activity.id,
      start: activity.start || activity.startDate || "",
      finish: activity.finish || activity.finishDate || "",
      totalFloat: activity.float,
      createdAt: new Date().toISOString(),
      completed: false,
completedAt: null,
status: "Open",
missedReason: "",
missedAt: null,
    };

    updatePullPlan([...pullCards, newCard]);
  }

  function updatePullCard(cardId, field, value) {
    updatePullPlan(
      pullCards.map((card) =>
        card.id === cardId ? { ...card, [field]: value } : card
      )
    );
  }
function completePullCard(cardId) {
  updatePullPlan(
    pullCards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            completed: true,
            completedAt: new Date().toISOString(),
            status: "Complete",
            missedReason: "",
            missedAt: null,
          }
        : card
    )
  );
}
function markPullCardMissed(cardId, missedReason) {
  updatePullPlan(
    pullCards.map((card) =>
      card.id === cardId
        ? {
            ...card,
            status: "Missed",
            missedReason,
            missedAt: new Date().toISOString(),
            completed: false,
            completedAt: null,
          }
        : card
    )
  );
}

function deletePullCard(cardId) {
    updatePullPlan(pullCards.filter((card) => card.id !== cardId));
  }

    function handlePullDrop(zone, weekOffset) {
    if (draggedReferenceActivityId) {
      const activity = lookAheadActivities.find(
        (item) => String(item.id) === String(draggedReferenceActivityId)
      );

      if (activity) {
        addScheduleActivityToPullPlan(activity, zone, weekOffset);
      }

      setDraggedReferenceActivityId(null);
      return;
    }

    if (!draggedCardId) return;

    updatePullPlan(
      pullCards.map((card) =>
        card.id === draggedCardId
          ? { ...card, zone, weekOffset: String(weekOffset) }
          : card
      )
    );

    setDraggedCardId(null);
  }

  function getLinkedConstraints(card) {
    const openStatuses = ["Open", "Waiting", "Escalated"];
    return constraints.filter((constraint) => {
      const linked =
        constraint.activityId === card.linkedActivityId ||
        constraint.linkedActivityId === card.linkedActivityId ||
        constraint.sourceActivityId === card.linkedActivityId ||
        constraint.activityId === card.id ||
        constraint.linkedActivityId === card.id ||
        constraint.milestone === card.title ||
        constraint.description?.toLowerCase().includes(card.title?.toLowerCase());

      return linked && openStatuses.includes(constraint.status || "Open");
    });
  }

  function getLinkedIssues(card) {
    return issues.filter((issue) => {
      const linked =
        issue.activityId === card.linkedActivityId ||
        issue.sourceActivityId === card.linkedActivityId ||
        issue.activityId === card.id ||
        issue.title?.toLowerCase().includes(card.title?.toLowerCase());

      return linked && issue.status !== "Closed" && !issue.archived;
    });
  }

  function getLinkedSubmittals(card) {
    return submittals.filter((submittal) => {
      const text = `${submittal.title || ""} ${submittal.specSection || ""} ${submittal.responsibleContractor || ""}`.toLowerCase();
      return (
        card.trade &&
        card.trade !== "Unassigned Trade" &&
        text.includes(String(card.trade).toLowerCase()) &&
        !["Approved", "Closed", "Complete"].includes(submittal.status)
      );
    });
  }

  function getReadiness(card) {
    const linkedConstraints = getLinkedConstraints(card);
    const linkedIssues = getLinkedIssues(card);
    const linkedSubmittals = getLinkedSubmittals(card);
    const hasTypedConstraints = Boolean(card.constraints?.trim());
    const hasNeeds = Boolean(card.needs?.trim());

    if (
      linkedConstraints.some((constraint) => constraint.status === "Escalated") ||
      linkedIssues.some((issue) => issue.manuallyEscalated) ||
      card.readinessOverride === "not-ready"
    ) {
      return { label: "Not Ready", className: "not-ready" };
    }

    if (
      linkedConstraints.length > 0 ||
      linkedIssues.length > 0 ||
      linkedSubmittals.length > 0 ||
      hasTypedConstraints ||
      card.readinessOverride === "at-risk"
    ) {
      return { label: "At Risk", className: "at-risk" };
    }

    if (!hasNeeds) return { label: "Needs Defined", className: "needs-defined" };

    return { label: "Ready", className: "ready" };
  }

  function openConstraintForCard(card) {
    sessionStorage.setItem(
  "sentinel_return_path",
  JSON.stringify({
    page: "4-Week Look Ahead and Sprint Plan",
    view: "pullplan",
    milestoneId: selectedMilestoneId,
  })
);
    if (setConstraintForm) {
      setConstraintForm((prev) => ({
        ...prev,
        description: `Sprint plan constraint for ${card.title}`,
        owner: card.owner || card.trade || "",
        requiredBy: selectedMilestone?.due || "",
        milestone: selectedMilestone?.name || card.title,
        status: "Open",
        activityId: card.linkedActivityId || card.id,
        linkedActivityId: card.linkedActivityId || card.id,
      }));
    }

    if (setActivePage) setActivePage("Constraint Board");
  }

  function activityTouchesDay(activity, day) {
    return activity.parsedStart <= day && activity.parsedFinish >= day;
  }

  function getActivityClass(activity) {
    const floatValue = Number(activity.float);
    if (!Number.isNaN(floatValue) && floatValue <= 0) return "gantt-cell active critical";
    if (!Number.isNaN(floatValue) && floatValue <= 5) return "gantt-cell active near-critical";
    return "gantt-cell active";
  }

  function toggleGroup(groupName) {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  }
function exportLookAheadToExcel() {
  const timelineDays = workDays;

  function getBarColor(activity) {
    const floatValue = Number(activity.float);

    if (!Number.isNaN(floatValue) && floatValue <= 0) {
      return "C00000"; // red - critical
    }

    if (!Number.isNaN(floatValue) && floatValue <= 5) {
      return "F4B183"; // orange - near critical
    }

    return "70AD47"; // green - normal
  }

  function isFriday(day) {
    return day.getDay() === 5;
  }

  const rows = [];

  rows.push([
    "Activity ID",
    "Activity",
    "Start",
    "Finish",
    "Float",
    "Responsible Party",
    ...timelineDays.map((day) => formatDate(day)),
  ]);

  Object.entries(groupedActivities).forEach(([primaryName, group]) => {
    rows.push([]);
    rows.push([`WBS: ${primaryName}`]);

    Object.entries(group.subgroups).forEach(([secondaryName, items]) => {
      rows.push([secondaryName]);

      items.forEach((activity) => {
        rows.push([
          activity.id,
          activity.name,
          formatFullDate(activity.parsedStart),
          formatFullDate(activity.parsedFinish),
          activity.float !== null &&
          activity.float !== undefined &&
          activity.float !== ""
            ? Math.round(Number(activity.float))
            : "",
          activity.activityCodeGroup || "Unassigned",
          ...timelineDays.map((day) =>
            activityTouchesDay(activity, day) ? "■" : ""
          ),
        ]);
      });
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 55 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 30 },
    ...timelineDays.map(() => ({ wch: 5 })),
  ];

  worksheet["!freeze"] = { xSplit: 6, ySplit: 1 };

  worksheet["!pageSetup"] = {
    orientation: "landscape",
    fitToWidth: 1,
    fitToHeight: 0,
  };

  worksheet["!margins"] = {
    left: 0.25,
    right: 0.25,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let R = range.s.r; R <= range.e.r; R++) {
    const firstCellAddress = XLSX.utils.encode_cell({ r: R, c: 0 });
    const firstCellValue = String(worksheet[firstCellAddress]?.v || "");

    const isWbsRow = firstCellValue.startsWith("WBS:");
    const isSubgroupRow =
      !isWbsRow &&
      firstCellValue &&
      !worksheet[XLSX.utils.encode_cell({ r: R, c: 1 })]?.v &&
      R !== 0;

    const activityId = firstCellValue;
    const matchingActivity = lookAheadActivities.find(
      (activity) => String(activity.id) === String(activityId)
    );

    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });

      if (!worksheet[cellAddress]) {
        worksheet[cellAddress] = { v: "" };
      }

      const cell = worksheet[cellAddress];
      const value = String(cell.v || "");

      const border = {
        top: { style: "thin", color: { rgb: "D9D9D9" } },
        bottom: { style: "thin", color: { rgb: "D9D9D9" } },
        left: { style: "thin", color: { rgb: "D9D9D9" } },
        right: { style: "thin", color: { rgb: "D9D9D9" } },
      };

      if (C >= 6 && isFriday(timelineDays[C - 6])) {
        border.right = { style: "medium", color: { rgb: "808080" } };
      }

      cell.s = {
        font: { name: "Calibri", sz: 11 },
        alignment: {
          vertical: "center",
          wrapText: true,
        },
        border,
      };

      if (R === 0) {
        cell.s = {
          ...cell.s,
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "1F4E78" } },
          alignment: {
            horizontal: "center",
            vertical: "center",
            wrapText: true,
          },
        };
      }

      if (isWbsRow) {
        cell.s = {
          ...cell.s,
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "404040" } },
        };
      }

      if (isSubgroupRow) {
        cell.s = {
          ...cell.s,
          font: { bold: true },
          fill: { fgColor: { rgb: "D9EAF7" } },
        };
      }

      if (C >= 6 && value === "■" && matchingActivity) {
        const color = getBarColor(matchingActivity);

        cell.s = {
          ...cell.s,
          font: { color: { rgb: color } },
          fill: { fgColor: { rgb: color } },
          alignment: {
            horizontal: "center",
            vertical: "center",
          },
        };
      }
    }
  }

  const responsibleCounts = lookAheadActivities.reduce((totals, activity) => {
    const responsible = activity.activityCodeGroup || "Unassigned";
    totals[responsible] = (totals[responsible] || 0) + 1;
    return totals;
  }, {});

  const summaryRows = [
    ["Responsible Party", "Activity Count"],
    ...Object.entries(responsibleCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([responsible, count]) => [responsible, count]),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

  summarySheet["!cols"] = [{ wch: 35 }, { wch: 18 }];

  const summaryRange = XLSX.utils.decode_range(summarySheet["!ref"]);

  for (let R = summaryRange.s.r; R <= summaryRange.e.r; R++) {
    for (let C = summaryRange.s.c; C <= summaryRange.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!summarySheet[cellAddress]) continue;

      summarySheet[cellAddress].s = {
        font: {
          name: "Calibri",
          sz: 11,
          bold: R === 0,
          color: R === 0 ? { rgb: "FFFFFF" } : undefined,
        },
        fill: R === 0 ? { fgColor: { rgb: "1F4E78" } } : undefined,
        alignment: {
          vertical: "center",
          wrapText: true,
        },
        border: {
          top: { style: "thin", color: { rgb: "D9D9D9" } },
          bottom: { style: "thin", color: { rgb: "D9D9D9" } },
          left: { style: "thin", color: { rgb: "D9D9D9" } },
          right: { style: "thin", color: { rgb: "D9D9D9" } },
        },
      };
    }
  }

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "4 Week Look Ahead");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "By Responsible Party");

  XLSX.writeFile(
    workbook,
    `${project || "Project"} - 4 Week Look Ahead.xlsx`
  );
}
function getRelationshipPredId(relationship) {
  return String(
    relationship.predTaskId ||
      relationship.predecessorActivityId ||
      relationship.predecessorId ||
      relationship.predActivityId ||
      ""
  );
}

function getRelationshipSuccId(relationship) {
  return String(
    relationship.succTaskId ||
      relationship.successorActivityId ||
      relationship.successorId ||
      relationship.succActivityId ||
      ""
  );
}

function getMilestoneDrivenActivities() {
  if (!selectedMilestone) return lookAheadActivities;

  const milestoneName = String(selectedMilestone.name || "").toLowerCase();

  const milestoneActivity = activities.find((activity) => {
    const activityId = String(
      activity.activityId || activity.id || activity.taskCode || ""
    );

    const activityName = String(
      activity.activityName || activity.name || activity.description || ""
    ).toLowerCase();

    return (
      activityId === String(selectedMilestone.activityId || "") ||
      activityName.includes(milestoneName) ||
      milestoneName.includes(activityName)
    );
  });

  if (!milestoneActivity) return lookAheadActivities;

  const milestoneActivityId = String(
    milestoneActivity.activityId ||
      milestoneActivity.id ||
      milestoneActivity.taskCode ||
      ""
  );

  const drivingIds = new Set([milestoneActivityId]);
  const queue = [milestoneActivityId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    scheduleRelationships.forEach((relationship) => {
      const predId = getRelationshipPredId(relationship);
      const succId = getRelationshipSuccId(relationship);

      if (succId === currentId && predId && !drivingIds.has(predId)) {
        drivingIds.add(predId);
        queue.push(predId);
      }
    });
  }

  return lookAheadActivities.filter((activity) =>
    drivingIds.has(String(activity.id))
  );
}

const referenceBaseActivities =
  referenceMode === "milestone"
    ? getMilestoneDrivenActivities()
    : lookAheadActivities;

const filteredReferenceActivities = referenceBaseActivities.filter(
  (activity) =>
    activity.id.toLowerCase().includes(referenceSearch.toLowerCase()) ||
    activity.name.toLowerCase().includes(referenceSearch.toLowerCase()) ||
    activity.wbs.toLowerCase().includes(referenceSearch.toLowerCase()) ||
    activity.activityCodeGroup.toLowerCase().includes(referenceSearch.toLowerCase())
);
  return (
    <div className="page pull-planning-page">
      <div className="page-header">
        <div>
          <h1>Look Ahead Planning</h1>
          <p>{project}</p>
        </div>
      </div>

      <div className="lookahead-tabs">
        <button
          type="button"
          className={activeView === "lookahead" ? "active" : ""}
          onClick={() => setActiveView("lookahead")}
        >
          4-Week Look Ahead
        </button>
        <button
          type="button"
          className={activeView === "pullplan" ? "active" : ""}
          onClick={() => setActiveView("pullplan")}
        >
          Sprint Plan Builder
        </button>
      </div>

      {activeView === "lookahead" && (
        <>
          <div className="lookahead-controls">
            <select value={primarySort} onChange={(e) => setPrimarySort(e.target.value)}>
              <option value="wbs">Primary: WBS / Area</option>
              <option value="activityCode">Primary: Activity Code</option>
              <option value="start">Primary: Start Date</option>
            </select>

            <select value={secondarySort} onChange={(e) => setSecondarySort(e.target.value)}>
              <option value="wbs">Secondary: WBS / Area</option>
              <option value="activityCode">Secondary: Activity Code</option>
              <option value="start">Secondary: Start Date</option>
            </select>

            <select value={selectedActivityCode} onChange={(e) => setSelectedActivityCode(e.target.value)}>
              <option value="">Select Activity Code</option>
              {availableActivityCodes.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>

            <button
  type="button"
  onClick={exportLookAheadToExcel}
>
  Export Excel
</button>

<button
  type="button"
  onClick={() => window.print()}
>
  Print Current View
</button>
          </div>

          <div className="card">
            <h2>Next 20 Work Days</h2>
            <p>
              This remains the CPM-driven look ahead. Use the Sprint Plan Builder tab for milestone-first reverse planning by work zone, trade, needs, and constraints.
            </p>
          </div>

          {lookAheadActivities.length === 0 ? (
            <div className="card"><p>No activities were found in the next 20 work days.</p></div>
          ) : (
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
                      <span>{primaryCollapsed ? "▶" : "▼"} {primaryName} — {group.items.length} activities</span>
                    </button>

                    {!primaryCollapsed && Object.entries(group.subgroups).map(([secondaryName, items]) => {
                      const secondaryKey = `secondary-${primaryName}-${secondaryName}`;
                      const secondaryCollapsed = collapsedGroups[secondaryKey];

                      return (
                        <div className="lookahead-wbs-group" key={secondaryKey}>
                          <button
                            type="button"
                            className="lookahead-wbs-heading secondary-heading"
                            onClick={() => toggleGroup(secondaryKey)}
                          >
                            <span>{secondaryCollapsed ? "▶" : "▼"} {secondaryName} — {items.length} activities</span>
                          </button>

                          {!secondaryCollapsed && (
                            <>
                              <div className="lookahead-grid lookahead-grid-header">
                                <div>Activity</div>
                                <div>Start</div>
                                <div>Finish</div>
                                <div>Float</div>
                                {workDays.map((day) => (
                                  <div key={day.toISOString()} className={isSameDay(day, today) ? "lookahead-day today" : "lookahead-day"}>
                                    {formatDate(day)}
                                  </div>
                                ))}
                              </div>

                              {items.map((activity) => (
                                <div className="lookahead-grid" key={activity.id}>
                                  <div className="activity-name">
                                    <strong>{activity.id}</strong>
                                    <span>{activity.name}</span>
                                    <small>{activity.activityCodeGroup}</small>
                                  </div>
                                  <div>{formatDate(activity.parsedStart)}</div>
                                  <div>{formatDate(activity.parsedFinish)}</div>
                                  <div>
                                    {activity.float !== null && activity.float !== undefined && activity.float !== ""
                                      ? `${Math.round(Number(activity.float))}d`
                                      : "-"}
                                  </div>
                                  {workDays.map((day) => (
                                    <div
                                      key={`${activity.id}-${day.toISOString()}`}
                                      className={activityTouchesDay(activity, day)
                                        ? getActivityClass(activity)
                                        : isSameDay(day, today)
                                        ? "gantt-cell today"
                                        : "gantt-cell"}
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
          )}
        </>
      )}

      {activeView === "pullplan" && (
        <>
          <div className="pull-plan-hero card">
            <div>
              <h2>Sprint Plan Builder</h2>
              <p>
                Start with the milestone, establish work zones, then work backward by trade. Notes are now structured as needs, handoff conditions, and constraints.
              </p>
            </div>

            <div className="pull-plan-milestone-selector">
              <label>Milestone</label>
              <select
                value={selectedMilestoneId}
                onChange={(e) => setSelectedMilestoneId(e.target.value)}
              >
                <option value="">Select milestone</option>
                {milestones.filter((m) => !m.archived).map((milestone) => (
                  <option key={milestone.id} value={String(milestone.id)}>
                    {milestone.name} — {formatFullDate(milestone.due)}
                  </option>
                ))}
              </select>
              <span>{selectedMilestone ? `Target: ${formatFullDate(selectedMilestone.due)}` : "Select a milestone to begin."}</span>
            </div>
          </div>

          <div className="pull-plan-metrics">
            <div className="mini-metric"><strong>{pullCards.length}</strong><span>Sprint Plan Cards</span></div>
            <div className="mini-metric"><strong>{readinessCounts.ready || 0}</strong><span>Ready</span></div>
            <div className="mini-metric"><strong>{readinessCounts["at-risk"] || 0}</strong><span>At Risk</span></div>
            <div className="mini-metric"><strong>{readinessCounts["not-ready"] || 0}</strong><span>Not Ready</span></div>
          </div>

          <div className="pull-plan-setup-grid">
            <div className="card">
              <h2>Work Zones</h2>
              <p>Use areas, floors, wings, buildings, or site zones. This is how the sprint plan organizes flow.</p>
              <form className="pull-zone-form" onSubmit={addWorkZone}>
                <input
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Area A, Level 2, East Wing, Site, etc."
                />
                <button type="submit">Add Zone</button>
              </form>
              <div className="work-zone-pill-list">
                {(workZones || []).length === 0 ? (
                  <span className="muted-text">No zones established yet.</span>
                ) : (
                  workZones.map((zone) => (
                    <button key={zone} type="button" onClick={() => removeWorkZone(zone)}>
                      {zone} ×
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <h2>Add Sprint Plan Card</h2>
              <form className="pull-card-form" onSubmit={addPullCard}>
                <input
                  value={pullCardForm.title}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Work activity"
                />
                <select
                  value={pullCardForm.zone}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, zone: e.target.value }))}
                >
                  <option value="">Select Zone</option>
                  {zoneList.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                </select>
                <input
                  value={pullCardForm.trade}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, trade: e.target.value }))}
                  placeholder="Trade / responsible party"
                  list="trade-options"
                />
                <datalist id="trade-options">
                  {tradeList.map((trade) => <option key={trade} value={trade} />)}
                </datalist>
                <select
                  value={pullCardForm.weekOffset}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, weekOffset: e.target.value }))}
                >
                  {pullWeekColumns.map((column) => (
                    <option key={column.value} value={column.value}>{column.label}</option>
                  ))}
                </select>
                <input
                  value={pullCardForm.duration}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder="Duration"
                />
                <input
                  value={pullCardForm.owner}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, owner: e.target.value }))}
                  placeholder="Commitment owner"
                />
                <textarea
                  value={pullCardForm.needs}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, needs: e.target.value }))}
                  placeholder="Needs to start"
                />
                <textarea
                  value={pullCardForm.handoff}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, handoff: e.target.value }))}
                  placeholder="Handoff condition"
                />
                <textarea
                  value={pullCardForm.constraints}
                  onChange={(e) => setPullCardForm((prev) => ({ ...prev, constraints: e.target.value }))}
                  placeholder="Known constraints"
                />
                <button type="submit">Add Card</button>
              </form>
            </div>
          </div>

          <div className="pull-plan-layout">
  <div className="pull-plan-main-column">
    <div className="pull-plan-wall-card card">
              <div className="pull-plan-wall-header">
                <div>
                  <h2>{selectedMilestone ? selectedMilestone.name : "Select a Milestone"}</h2>
                  <p>Digital sticky-note wall: work zones vertically, time pulled backward horizontally.</p>
                </div>
                <button type="button" className="secondary-button" onClick={() => window.print()}>Print Sprint Plan</button>
              </div>

              <div className="pull-plan-wall">
                <div className="pull-plan-wall-grid pull-plan-wall-grid-header">
                  <div className="pull-plan-zone-heading">Zone / Trade</div>
                  {pullWeekColumns.map((column) => (
                    <div key={column.value}>{column.label}</div>
                  ))}
                </div>

                {zoneList.map((zone) => {
                  const zoneCards = pullCards.filter((card) => card.zone === zone || (!card.zone && zone === "Unassigned Zone"));
                  const zoneTrades = Array.from(new Set(zoneCards.map((card) => card.trade || "Unassigned Trade"))).sort();
                  const tradesToShow = zoneTrades.length > 0 ? zoneTrades : ["Unassigned Trade"];

                  return (
                    <div className="pull-zone-section" key={zone}>
                      <div className="pull-zone-title">{zone}</div>

                      {tradesToShow.map((trade) => (
                        <div className="pull-plan-wall-grid" key={`${zone}-${trade}`}>
                          <div className="pull-trade-heading">{trade}</div>

                          {pullWeekColumns.map((column) => {
                            const cards = pullCards.filter(
  (card) =>
    !card.completed &&
    card.status !== "Missed" &&
    (card.zone || "Unassigned Zone") === zone &&
    (card.trade || "Unassigned Trade") === trade &&
    String(card.weekOffset || "-1") === String(column.value)
);

                            return (
                              <div
                                key={`${zone}-${trade}-${column.value}`}
                                className="pull-plan-drop-cell"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handlePullDrop(zone, column.value)}
                              >
                                {cards.map((card) => {
                                  const readiness = getReadiness(card);
                                  const linkedConstraints = getLinkedConstraints(card);
                                  const linkedIssues = getLinkedIssues(card);
                                  const linkedSubmittals = getLinkedSubmittals(card);

                                  return (
                                    <div
                                      key={card.id}
                                      draggable
                                      onDragStart={() => {
  setDraggedCardId(card.id);
  setDraggedReferenceActivityId(null);
}}
                                      className={`pull-sticky-note ${readiness.className}`}
                                    >
                                      <div className="pull-sticky-note-top">
                                        <strong>{card.title}</strong>
                                        <span className={`readiness-chip ${readiness.className}`}>{readiness.label}</span>
                                      </div>

                                      <div className="pull-sticky-note-meta">
  <span>{card.duration ? `Duration: ${card.duration}d` : "Duration TBD"}</span>

  {card.totalFloat !== undefined &&
   card.totalFloat !== null &&
   card.totalFloat !== "" && (
    <span>Float: {Math.round(Number(card.totalFloat))}d</span>
  )}

  <span>{card.owner ? `Owner: ${card.owner}` : "Owner TBD"}</span>

  <span>{card.source}</span>
</div>

                                      <label>Needs</label>
                                      <textarea
                                        value={card.needs || ""}
                                        onChange={(e) => updatePullCard(card.id, "needs", e.target.value)}
                                        placeholder="What must be complete before this starts?"
                                      />

                                      <label>Handoff</label>
                                      <textarea
                                        value={card.handoff || ""}
                                        onChange={(e) => updatePullCard(card.id, "handoff", e.target.value)}
                                        placeholder="What does complete / ready mean?"
                                      />

                                      <label>Constraints</label>
                                      <textarea
                                        value={card.constraints || ""}
                                        onChange={(e) => updatePullCard(card.id, "constraints", e.target.value)}
                                        placeholder="What could prevent this commitment?"
                                      />

                                      <div className="pull-card-linked-items">
                                        {linkedConstraints.length > 0 && <span>{linkedConstraints.length} constraint(s)</span>}
                                        {linkedIssues.length > 0 && <span>{linkedIssues.length} issue(s)</span>}
                                        {linkedSubmittals.length > 0 && <span>{linkedSubmittals.length} submittal(s)</span>}
                                      </div>

                                      <div className="pull-card-actions">
                                        <button
  type="button"
  onClick={() => openConstraintForCard(card)}
>
  Add Constraint
</button>

<button
  type="button"
  className="secondary-button"
  onClick={() => completePullCard(card.id)}
>
  Complete
</button>

<select
  className="missed-reason-select"
  value=""
  onChange={(e) => {
    if (!e.target.value) return;
    markPullCardMissed(card.id, e.target.value);
  }}
>
  <option value="">Missed</option>
  <option value="Constraint">Constraint</option>
  <option value="Weather">Weather</option>
  <option value="Manpower">Manpower</option>
  <option value="Material">Material</option>
  <option value="Design">Design</option>
  <option value="Owner">Owner</option>
  <option value="Other">Other</option>
</select>

<button
  type="button"
  className="delete-button"
  onClick={() => deletePullCard(card.id)}
>
  Delete
</button>
                                      </div>
                                    </div>
                                    
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  );
                })}
                            </div>
                          <div className="card">
  <h2>Percent Plan Complete</h2>

  {(() => {
    const plannedCommitments = pullCards.filter((card) => !card.archived);
    const completedCommitments = plannedCommitments.filter(
      (card) => card.completed
    );
    const missedCommitments = plannedCommitments.filter(
      (card) => card.status === "Missed"
    );

    const evaluatedCommitments =
  completedCommitments.length + missedCommitments.length;

const ppc =
  evaluatedCommitments > 0
    ? Math.round(
        (completedCommitments.length / evaluatedCommitments) * 100
      )
    : 0;

    return (
      <div className="grid">
        <Metric
          title="Planned Commitments"
          value={plannedCommitments.length}
          note="Total commitments this sprint"
        />
        <Metric
          title="Completed"
          value={completedCommitments.length}
          note="Moved to completed commitments"
        />
        <Metric
          title="Missed"
          value={missedCommitments.length}
          note="Commitments not completed"
        />
        <Metric
          title="PPC"
          value={`${ppc}%`}
          note="Completed ÷ evaluated"
        />
      </div>
    );
  })()}
</div>
<div className="card">
  <h2>Missed Commitments</h2>

  {pullCards.filter((card) => card.status === "Missed").length === 0 ? (
    <p>No missed commitments.</p>
  ) : (
    <div className="pull-reference-list">
      {pullCards
        .filter((card) => card.status === "Missed")
        .sort((a, b) => new Date(b.missedAt || 0) - new Date(a.missedAt || 0))
        .map((card) => (
          <div key={card.id} className="pull-reference-card">
            <strong>{card.title}</strong>

            <small>
              Missed {card.missedAt ? formatFullDate(card.missedAt) : ""}
            </small>

            <small>Reason: {card.missedReason || "Other"}</small>
            <small>{card.owner || "No Owner"}</small>

<button
  type="button"
  className="secondary-button"
  onClick={() => {
    updatePullPlan(
      pullCards.map((item) =>
        item.id === card.id
          ? {
              ...item,
              status: "Open",
              missedReason: "",
              missedAt: null,
              completed: false,
              completedAt: null,
              weekOffset: item.weekOffset || "-1",
              zone: item.zone || zoneList[0] || "Unassigned Zone",
              trade: item.trade || "Unassigned Trade",
            }
          : item
      )
    );
  }}
>
  Reopen
</button>
          </div>
                  ))}
                  <div className="missed-reason-summary">
  <h3>Missed Reasons</h3>

  <div className="missed-reason-grid">
    {["Constraint", "Weather", "Manpower", "Material", "Design", "Owner", "Other"].map(
      (reason) => (
        <div key={reason} className="mini-metric">
          <strong>
            {
              pullCards.filter(
  (card) => card.status === "Missed" && card.missedReason === reason
).length
            }
          </strong>
          <span>{reason}</span>
        </div>
      )
    )}
  </div>
</div>
    </div>
  )}
</div>

<div className="card">
  <h2>Completed Commitments</h2>

              {pullCards.filter((card) => card.completed).length === 0 ? (
                <p>No completed commitments.</p>
              ) : (
                <div className="pull-reference-list">
                  {pullCards
                    .filter((card) => card.completed)
                    .sort(
                      (a, b) =>
                        new Date(b.completedAt || 0) -
                        new Date(a.completedAt || 0)
                    )
                    .map((card) => (
                      <div key={card.id} className="pull-reference-card">
                        <strong>{card.title}</strong>

                        <small>
                          Completed{" "}
                          {card.completedAt
                            ? formatFullDate(card.completedAt)
                            : ""}
                        </small>

                        <small>{card.owner || "No Owner"}</small>
                      </div>
                    ))}
                </div>
              )}
            </div>
</div>
</div>
            <div className="pull-plan-reference card">
<h2>CPM Reference Activities</h2>

<select
  className="reference-filter-select"
  value={referenceMode}
  onChange={(e) => setReferenceMode(e.target.value)}
>
  <option value="lookahead">Next 20 Work Days</option>
  <option value="milestone">Selected Milestone Path</option>
</select>

<input
  className="reference-search-input"
  type="text"
  placeholder="Search activities..."
  value={referenceSearch}
  onChange={(e) => setReferenceSearch(e.target.value)}
/>
              <p>Use the schedule as a reference source. Add only the activities the team wants represented in the sprint plan.</p>
              <div className="pull-reference-list">
                {filteredReferenceActivities.slice(0, 200).map((activity) => (
                                    <div
                    className="pull-reference-card"
                    key={activity.id}
                    draggable
                    onDragStart={() => {
                      setDraggedReferenceActivityId(activity.id);
                      setDraggedCardId(null);
                    }}
                  >
                    <strong>{activity.id}</strong>
                    <span>{activity.name}</span>
                    <small>{activity.wbs} • {activity.activityCodeGroup}</small>
                    <button type="button" onClick={() => addScheduleActivityToPullPlan(activity)}>Add to Sprint Plan</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
   );
}

export default FourWeekLookAhead;


