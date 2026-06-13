import React, { useState } from "react";
import ModuleHeader from "./ModuleHeader";

const riskCategories = [
  "Schedule",
  "Cost",
  "Procurement",
  "Safety",
  "Quality",
  "Contract",
  "Compliance",
  "Legal",
  "Staffing",
  "Owner",
  "Revenue",
  "Executive",
  "Strategic",
];

const riskStatuses = ["Open", "Mitigating", "Escalated", "Retired", "Closed"];

const riskTrends = ["Stable", "Improving", "Worsening"];

const sourceTypes = [
  "Manual",
  "Pursuit",
  "Contract",
  "ConstraintOS",
  "ProjectHealthOS",
  "RevenueOS",
  "Schedule Intelligence",
  "Permit",
  "Specification",
  "Risk Assessment",
];

function RiskIntegratorOS({
  selectedProject,
  riskPlaybook = [],
  setRiskPlaybook,
  riskSources = [],
  setRiskSources,
  suggestedRisks = [],
  setSuggestedRisks,
  constraints = [],
projectHealthOS = {},
scheduleSnapshots = [],
revenueHistory = [],
teamMembers = [],
milestones = [],
}) {
  const [riskForm, setRiskForm] = useState({
    title: "",
    category: "Schedule",
    source: "Manual Entry",
    sourceType: "Manual",
    probability: 3,
    impact: 3,
    owner: "",
    mitigation: "",
    trigger: "",
    trend: "Stable",
    status: "Open",
    linkedMilestone: "",
  });
 
const [historyRiskFilter, setHistoryRiskFilter] = useState("All Risks");
const [expandedRiskId, setExpandedRiskId] = useState(null);
const [showAddRiskForm, setShowAddRiskForm] = useState(false);

  const activeRisks = riskPlaybook.filter(
    (risk) => risk.status !== "Closed" && risk.status !== "Retired"
  );

  const criticalRisks = activeRisks.filter((risk) => risk.score >= 20);
  const highRisks = activeRisks.filter(
    (risk) => risk.score >= 13 && risk.score < 20
  );
  const escalatedRisks = activeRisks.filter(
    (risk) => risk.status === "Escalated"
  );
  const risksWithoutOwners = activeRisks.filter((risk) => !risk.owner);
  const worseningRisks = activeRisks.filter((risk) => risk.trend === "Worsening");
  const executiveAlerts = getExecutiveAlerts();
  console.log("Executive Alerts:", executiveAlerts);
console.log("Active Risks:", activeRisks);
  const executiveHealthScore = Math.max(
    0,
    100 -
      criticalRisks.length * 10 -
      highRisks.length * 5 -
      worseningRisks.length * 3 -
      risksWithoutOwners.length * 2
  );
  
  const historyRows = riskPlaybook
  .filter(
    (risk) =>
      historyRiskFilter === "All Risks" || risk.title === historyRiskFilter
  )
  .flatMap((risk) =>
    (risk.history || []).map((entry) => ({
      risk: risk.title,
      date: entry.date,
      action: entry.action,
    }))
  );

historyRows.sort((a, b) => new Date(b.date) - new Date(a.date));

historyRows.sort(
  (a, b) => new Date(b.date) - new Date(a.date)
);

  const topExecutiveRisks = [...activeRisks]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  function getRiskLevel(score) {
    if (score >= 20) return "Critical";
    if (score >= 13) return "High";
    if (score >= 6) return "Moderate";
    return "Low";
  }

  function getRiskClass(score) {
  if (score >= 20) return "status-pill critical";
  if (score >= 13) return "status-pill high";
  if (score >= 6) return "status-pill moderate";
  return "status-pill low";
}

  function getRiskAgeDays(risk) {
    if (!risk.createdAt) return 0;

    return Math.ceil(
      (new Date() - new Date(risk.createdAt)) / (1000 * 60 * 60 * 24)
    );
  }
  

  function handleFormChange(e) {
    const { name, value } = e.target;

    setRiskForm({
      ...riskForm,
      [name]:
        name === "probability" || name === "impact" ? Number(value) : value,
    });
  }
  function generateConstraintSuggestedRisks() {
  const openConstraints = constraints.filter(
    (constraint) => constraint.status !== "Closed" && !constraint.archived
  );

  const escalatedConstraints = openConstraints.filter(
    (constraint) => constraint.status === "Escalated"
  );

  const today = new Date();

  const agedConstraints = openConstraints.filter((constraint) => {
    const createdAt = constraint.createdAt || constraint.requiredBy;
    if (!createdAt) return false;

    const ageInDays = Math.floor(
      (today - new Date(createdAt)) / (1000 * 60 * 60 * 24)
    );

    return ageInDays > 30;
  });

  const generatedRisks = [];

  if (agedConstraints.length > 0) {
    generatedRisks.push({
      id: crypto.randomUUID(),
      risk: `${agedConstraints.length} open constraint(s) older than 30 days`,
      category: "Schedule",
      source: "ConstraintOS",
      confidence: "High",
    });
  }

  escalatedConstraints.forEach((constraint) => {
  constraintRisks.push({
    id: crypto.randomUUID(),
    risk: constraint.title || constraint.constraint,
    category: "Executive",
    source: "ConstraintOS",
    confidence: "High",
    probability: 3,
    impact: 4,
    owner: constraint.owner || "Unassigned",
    trigger: `Constraint remains ${constraint.status}`,
    mitigation: `Review constraint ownership and resolution plan`,
  });
});

  if (openConstraints.length > 20) {
    generatedRisks.push({
      id: crypto.randomUUID(),
      risk: "High volume of open constraints may indicate execution bottleneck",
      category: "Schedule",
      source: "ConstraintOS",
      confidence: "Medium",
    });
  }

  const healthReviewItems =
  projectHealthOS?.reviewItems ||
  projectHealthOS?.items ||
  [];

const offTrackHealthItems = healthReviewItems.filter((item) => {
  const status = item.status || "";
  return status === "Off Track";
});

const projectHealthRisks = offTrackHealthItems.map((item) => {
  const heading =
    item.heading ||
    item.category ||
    "Project Health";

  const reviewItem =
    item.reviewItem ||
    item.item ||
    item.title ||
    item.name ||
    "Off Track item";

  return {
    id: crypto.randomUUID(),
    risk: `${heading}: ${reviewItem} is Off Track`,
    category: "Executive",
    source: "ProjectHealthOS",
    confidence: "High",
  };
});
}
function generateContractClauseRisks() {
  const contractSources = riskSources.filter(
    (source) => source.type === "Contract"
  );

  const rules = [
    {
      risk: "Contractual notice compliance risk",
      category: "Contract",
      confidence: "High",
      probability: 4,
      impact: 5,
      keywords: ["notice", "written notice", "days notice"],
    },
    {
      risk: "Liquidated damages exposure",
      category: "Financial",
      confidence: "High",
      probability: 4,
      impact: 5,
      keywords: ["liquidated damages", "ld", "per day"],
    },
    {
      risk: "Owner-furnished equipment dependency",
      category: "Schedule",
      confidence: "Medium",
      probability: 3,
      impact: 4,
      keywords: ["owner furnished", "government furnished", "ofe", "gfe"],
    },
    {
      risk: "Insurance compliance risk",
      category: "Compliance",
      confidence: "Medium",
      probability: 3,
      impact: 4,
      keywords: ["insurance", "builder's risk", "professional liability", "cyber liability"],
    },
    {
      risk: "Federal compliance exposure",
      category: "Compliance",
      confidence: "High",
      probability: 4,
      impact: 5,
      keywords: ["cui", "cmmc", "cybersecurity", "far", "dfars"],
    },
    {
      risk: "Labor compliance or availability risk",
      category: "Staffing",
      confidence: "High",
      probability: 4,
      impact: 4,
      keywords: ["pla", "project labor agreement", "tero", "davis bacon", "davis-bacon"],
    },
  ];

  const contractRisks = [];

  contractSources.forEach((source) => {
    const text = String(source.extractedText || "").toLowerCase();

    if (riskSources.some((source) => source.type === "Contract")) {
  contractRisks.push(
    {
      id: crypto.randomUUID(),
      risk: "Notice provision requirements detected",
      category: "Contract",
      source: "Contract Intelligence",
      confidence: "High",
      probability: 3,
      impact: 4,
      owner: "Project Executive",
    },
    {
      id: crypto.randomUUID(),
      risk: "Liquidated damages exposure detected",
      category: "Financial",
      source: "Contract Intelligence",
      confidence: "High",
      probability: 4,
      impact: 5,
      owner: "Project Executive",
    },
    {
      id: crypto.randomUUID(),
      risk: "Cyber/CUI compliance requirements detected",
      category: "Compliance",
      source: "Contract Intelligence",
      confidence: "High",
      probability: 4,
      impact: 5,
      owner: "IT / Compliance",
    },
    {
      id: crypto.randomUUID(),
      risk: "Davis-Bacon labor compliance requirements detected",
      category: "Labor",
      source: "Contract Intelligence",
      confidence: "High",
      probability: 3,
      impact: 4,
      owner: "Project Manager",
    }
  );
}

    rules.forEach((rule) => {
      const matched = rule.keywords.some((keyword) =>
        text.includes(keyword.toLowerCase())
      );

      if (matched) {
        contractRisks.push({
          id: crypto.randomUUID(),
          risk: rule.risk,
          category: rule.category,
          source: "Contract Intelligence",
          confidence: rule.confidence,
          probability: rule.probability,
          impact: rule.impact,
          owner: "Project Executive",
        });
      }
    });
  });

  return contractRisks;
}
function getSnapshotActivities(snapshot) {
  return (
    snapshot?.activities ||
    snapshot?.scheduleActivities ||
    snapshot?.rows ||
    snapshot?.data ||
    []
  );
}

function getForecastRevenue(snapshot) {
  const activities = getSnapshotActivities(snapshot);

  return activities.reduce((total, activity) => {
    return total + Number(activity.budgetAtCompletion || 0);
  }, 0);
}
function getMonthsBetween(startDate, finishDate) {
  const start = new Date(startDate);
  const finish = new Date(finishDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) {
    return [];
  }

  const months = [];
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(finish.getFullYear(), finish.getMonth(), 1);

  while (current <= last) {
    months.push(current.toISOString().slice(0, 7));
    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

function buildRiskMonthlyForecast(snapshot) {
  const activities = getSnapshotActivities(snapshot);
  const monthlyTotals = {};

  activities.forEach((activity) => {
    const budget = Number(activity.budgetAtCompletion || 0);
    const months = getMonthsBetween(activity.start, activity.finish);

    if (budget === 0 || months.length === 0) return;

    const monthlyValue = budget / months.length;

    months.forEach((monthKey) => {
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + monthlyValue;
    });
  });

  return { monthlyTotals };
}
function getDaysBetweenDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function getLinkedMilestoneSlipDays(risk) {
  if (!risk.linkedMilestone || !risk.baselineMilestoneDate) return 0;

  const currentMilestone = milestones.find(
    (milestone) => milestone.name === risk.linkedMilestone
  );

  if (!currentMilestone?.due) return 0;

  return getDaysBetweenDates(
    risk.baselineMilestoneDate,
    currentMilestone.due
  );
}

function getRiskRecommendation(risk) {
  const slipDays = getLinkedMilestoneSlipDays(risk);

  const isContractRisk =
  risk.source === "Contract Intelligence";

if (isContractRisk && slipDays > 0) {
  return "Contract Exposure Review";
}

if (slipDays >= 31) return "Escalate Risk";
if (slipDays >= 15) return "Increase Probability";
if (slipDays > 0) return "Monitor";
  return "No Action";
}
function getExecutiveAlerts() {
  const alerts = [];

  activeRisks.forEach((risk) => {
    const level = getRiskLevel(risk.score);
    const slipDays = getLinkedMilestoneSlipDays(risk);
    const ownerMissing = !risk.owner || risk.owner === "Unassigned";
    const trend = calculateRiskTrend(risk);
    if (level === "Critical" && risk.status === "Open") {
  alerts.push({
    id: `${risk.id}-critical-open`,
    type: "Critical Risk Open",
    risk: risk.title,
    owner: risk.owner || "Unassigned",
  status: risk.status || "Open",
  daysOpen: getRiskAgeDays(risk),
    message: "Critical risk is open and requires executive monitoring.",
    recommendation: "Confirm owner, mitigation plan, and next review date.",
  });
}

    if (level === "Critical" && ownerMissing) {
      alerts.push({
        id: `${risk.id}-owner`,
        type: "Critical Risk Without Owner",
        risk: risk.title,
        owner: risk.owner || "Unassigned",
  status: risk.status || "Open",
  daysOpen: getRiskAgeDays(risk),
        message: "Critical risk does not have an assigned owner.",
        recommendation: "Assign accountable owner immediately.",
      });
    }

    if (level === "Critical" && trend === "Worsening") {
      alerts.push({
        id: `${risk.id}-worsening`,
        type: "Critical Risk Worsening",
        risk: risk.title,
        owner: risk.owner || "Unassigned",
  status: risk.status || "Open",
  daysOpen: getRiskAgeDays(risk),
        message: "Critical risk trend is worsening.",
        recommendation: "Review mitigation plan and escalate if needed.",
      });
    }

    if (risk.status === "Escalated") {
      alerts.push({
        id: `${risk.id}-escalated`,
        type: "Escalated Risk",
        risk: risk.title,
        
        message: "Risk has been escalated for leadership attention.",
        recommendation: "Confirm executive decision or recovery action.",
      });
    }

    if (risk.linkedMilestone && slipDays > 0) {
      alerts.push({
        id: `${risk.id}-milestone`,
        type: "Linked Milestone Impact",
        risk: risk.title,
        message: `${risk.linkedMilestone} has slipped ${slipDays} days.`,
        recommendation: getRiskRecommendation(risk),
      });
    }
  });

  return alerts;
}
function loadDemoSuggestedRisks() {
  

  const openConstraints = constraints.filter(
    (constraint) => constraint.status !== "Closed" && !constraint.archived
  );

  const escalatedConstraints = openConstraints.filter(
    (constraint) => constraint.status === "Escalated"
  );

  const constraintRisks = [];

  escalatedConstraints.forEach((constraint) => {
  constraintRisks.push({
    id: crypto.randomUUID(),
    risk: constraint.description || "Escalated constraint requires executive attention",
    category: "Executive",
    source: "ConstraintOS",
    confidence: "High",
    probability: 3,
    impact: 4,
    owner: constraint.owner || "Project Executive",
    mitigation: "Review constraint ownership, confirm required-by date, define recovery path, and escalate unresolved blockers.",
    trigger: `Constraint status is ${constraint.status || "Escalated"}. Required by: ${
      constraint.requiredBy || "not assigned"
    }. Linked milestone: ${constraint.milestone || "Unassigned"}.`,
  });
});
const agingConstraintRisks = [];

constraints.forEach((constraint) => {
  const age = getConstraintAge(constraint);

  if (
    !constraint.archived &&
    constraint.status !== "Closed" &&
    age >= 30
  ) {
    agingConstraintRisks.push({
      id: crypto.randomUUID(),
      risk: `Aging Constraint: ${constraint.description}`,
      category: "Execution",
      source: "ConstraintOS",
      confidence: "High",
      probability: 4,
      impact: 4,
      owner: constraint.owner || "Project Executive",
      mitigation:
        "Review ownership, escalation path, and recovery plan.",
      trigger: `Constraint open for ${age} days.`,
    });
  }
  
});

  const healthReviewItems = Array.isArray(projectHealthOS?.reviewItems)
    ? projectHealthOS.reviewItems
    : [];

  const projectHealthRisks = healthReviewItems
  .filter((item) => item?.status === "Red" || item?.status === "Yellow")
  .map((item) => {
    const isOffTrack = item.status === "Red";

    return {
      id: crypto.randomUUID(),
      risk: `${item?.heading || "Project Health"}: ${
        item?.item || item?.reviewItem || item?.title || "Review item"
      } is ${isOffTrack ? "Off Track" : "At Risk"}`,
      category: isOffTrack ? "Executive" : "Management",
      source: "ProjectHealthOS",
      confidence: isOffTrack ? "High" : "Medium",
      probability: isOffTrack ? 4 : 3,
      impact: isOffTrack ? 4 : 3,
      owner: "Project Executive",
      mitigation: isOffTrack
        ? "Review during project health meeting, assign corrective action, and escalate until item improves."
        : "Monitor during project health meeting and assign preventive action before item becomes Off Track.",
      trigger: isOffTrack
        ? "ProjectHealthOS review item is Off Track."
        : "ProjectHealthOS review item is At Risk.",
    };
  });
  

  const contractRisks = generateContractClauseRisks();
  const revenueRisks = [];

if (scheduleSnapshots.length >= 2) {
  const previousSnapshot = scheduleSnapshots[scheduleSnapshots.length - 2];
  const latestSnapshot = scheduleSnapshots[scheduleSnapshots.length - 1];

  const previousForecast = buildRiskMonthlyForecast(previousSnapshot);
  const currentForecast = buildRiskMonthlyForecast(latestSnapshot);

  const allMonthKeys = Array.from(
    new Set([
      ...Object.keys(previousForecast.monthlyTotals),
      ...Object.keys(currentForecast.monthlyTotals),
    ])
  ).sort();

  let previousCumulative = 0;
  let currentCumulative = 0;
  let worstCumulativeDelta = 0;
  let worstMonth = "";

  allMonthKeys.forEach((monthKey) => {
    const previousMonthly =
      previousForecast.monthlyTotals[monthKey] ||
      currentForecast.monthlyTotals[monthKey] ||
      0;

    const currentMonthly =
      currentForecast.monthlyTotals[monthKey] ||
      previousForecast.monthlyTotals[monthKey] ||
      0;

    previousCumulative += previousMonthly;
    currentCumulative += currentMonthly;

    const cumulativeDelta = currentCumulative - previousCumulative;

    if (cumulativeDelta < worstCumulativeDelta) {
      worstCumulativeDelta = cumulativeDelta;
      worstMonth = monthKey;
    }
  });

  if (worstCumulativeDelta < 0) {
    revenueRisks.push({
      id: crypto.randomUUID(),
      risk: `Revenue forecast timing deterioration detected: ${Math.abs(
        worstCumulativeDelta
      ).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })} negative cumulative movement`,
      category: "Financial",
      source: "RevenueOS",
      confidence: "High",
      probability: 4,
      impact: 5,
      owner: "Project Executive",
      mitigation:
        "Review forecast timing shifts, billing assumptions, and recovery plan for delayed revenue recognition.",
      trigger: `RevenueOS detected negative cumulative movement in ${worstMonth || "the forecast period"}.`,
    });
  }
}

const generatedRisks = [
  ...constraintRisks,
  ...agingConstraintRisks,
  ...projectHealthRisks,
  ...revenueRisks,
  ...contractRisks,
];
const uniqueGeneratedRisks = generatedRisks.filter(
  (risk, index, self) =>
    index ===
    self.findIndex(
      (item) =>
        item.risk === risk.risk &&
        item.category === risk.category &&
        item.source === risk.source
    )
);

const acceptedRiskKeys = new Set(
  riskPlaybook.map(
    (risk) => `${risk.title}-${risk.category}-${risk.sourceType}`
  )
);

const newSuggestedRisks = uniqueGeneratedRisks.filter(
  (risk) =>
    !acceptedRiskKeys.has(`${risk.risk}-${risk.category}-${risk.source}`)
);

setSuggestedRisks(newSuggestedRisks);
}
  function addRisk(e) {
    e.preventDefault();
    if (!riskForm.title.trim() || !setRiskPlaybook) return;
    

    const score = riskForm.probability * riskForm.impact;

    const newRisk = {
      id: `risk-${Date.now()}`,
      ...riskForm,
      score,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setRiskPlaybook([...riskPlaybook, newRisk]);

    setRiskForm({
  title: "",
  category: "Schedule",
  source: "Manual Entry",
  sourceType: "Manual",
  probability: 3,
  impact: 3,
  owner: "",
  mitigation: "",
  trigger: "",
  trend: "Stable",
  status: "Open",
  linkedMilestone: "",
});
  }

  function updateRisk(id, field, value) {
    const nextRisks = riskPlaybook.map((risk) => {
      if (risk.id !== id) return risk;

      const updatedRisk = {
        ...risk,
        [field]:
          field === "probability" || field === "impact"
            ? Number(value)
            : value,
        updatedAt: new Date().toISOString(),
      };
      const history = [...(risk.history || [])];
      if (field === "linkedMilestone") {
  const linkedMilestone = milestones.find(
    (milestone) => milestone.name === value
  );

  updatedRisk.baselineMilestoneDate =
    linkedMilestone?.due || risk.baselineMilestoneDate || "";

  history.push({
    date: new Date().toISOString(),
    action: `Linked Milestone Changed: ${
      risk.linkedMilestone || "Not Linked"
    } → ${value || "Not Linked"}`,
  });
}

if (field === "status") {
  history.push({
    date: new Date().toISOString(),
    action: `Status Changed: ${risk.status} → ${value}`,
  });
}

if (field === "trend") {
  history.push({
    date: new Date().toISOString(),
    action: `Trend Changed: ${risk.trend} → ${value}`,
  });
}
if (field === "owner") {
  history.push({
    date: new Date().toISOString(),
    action: `Owner Changed: ${risk.owner || "Unassigned"} → ${value}`,
  });
}

updatedRisk.history = history;
updatedRisk.score = updatedRisk.probability * updatedRisk.impact;

return updatedRisk;
    });

    setRiskPlaybook(nextRisks);
  }

  function deleteRisk(id) {
    setRiskPlaybook(riskPlaybook.filter((risk) => risk.id !== id));
  }

  function handleRiskSourceUpload(e, sourceType) {
  const file = e.target.files?.[0];
  if (!file) return;

  const fileName = file.name || "";
  const lowerName = fileName.toLowerCase();
  const canReadAsText =
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".md");

  const baseSource = {
    id: `source-${Date.now()}`,
    name: fileName,
    type: sourceType,
    uploadedAt: new Date().toLocaleDateString(),
    risksGenerated: 0,
    extractedText: "",
    analysisStatus: canReadAsText
      ? "Text ready"
      : "Uploaded - text extraction pending",
  };

  if (!canReadAsText) {
    setRiskSources([...riskSources, baseSource]);
    e.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = (event) => {
    const extractedText = String(event.target.result || "");

    setRiskSources([
      ...riskSources,
      {
        ...baseSource,
        extractedText,
      },
    ]);
  };

  reader.readAsText(file);
  e.target.value = "";
}
function getDefaultMitigation(riskTitle, category, source) {
  const title = String(riskTitle || "").toLowerCase();

  if (title.includes("notice")) {
    return "Establish notice tracking log, assign responsibility for contractual notices, and review notice requirements during weekly project controls meeting.";
  }

  if (title.includes("liquidated damages")) {
    return "Validate substantial completion milestones, review schedule contingency, monitor critical path movement, and escalate recovery plan if float deteriorates.";
  }

  if (title.includes("cyber") || title.includes("cui")) {
    return "Confirm CUI handling requirements, validate cybersecurity controls, assign compliance owner, and verify project team access procedures.";
  }

  if (title.includes("davis-bacon") || title.includes("labor")) {
    return "Review certified payroll requirements, confirm subcontractor wage compliance, and establish recurring payroll compliance checks.";
  }

  if (title.includes("owner-furnished")) {
    return "Identify owner-furnished dependencies, confirm delivery dates, add required handoff dates to the schedule, and escalate missing commitments.";
  }

  if (source === "ProjectHealthOS") {
    return "Review during monthly project health meeting, assign accountable owner, document corrective action, and track status until item improves.";
  }

  if (source === "ConstraintOS") {
    return "Review constraint ownership, confirm required-by date, escalate blocker as needed, and convert to issue or action item if unresolved.";
  }
  if (
  field === "mitigation" &&
  value !== risk.mitigation
) {
  history.push({
    date: new Date().toISOString(),
    action: "Mitigation Plan Updated",
  });
}
if (
  field === "trigger" &&
  value !== risk.trigger
) {
  history.push({
    date: new Date().toISOString(),
    action: "Risk Trigger Updated",
  });
}
if (field === "probability") {
  history.push({
    date: new Date().toISOString(),
    action: `Probability Changed: ${risk.probability} → ${value}`,
  });
}
if (field === "impact") {
  history.push({
    date: new Date().toISOString(),
    action: `Impact Changed: ${risk.impact} → ${value}`,
  });
}

  return "Assign accountable owner, define mitigation actions, monitor trend, and escalate if risk worsens.";
}

function getDefaultTrigger(riskTitle, category, source) {
  const title = String(riskTitle || "").toLowerCase();

  if (title.includes("notice")) {
    return "Potential claim, change, delay, or event requiring contractual notice.";
  }

  if (title.includes("liquidated damages")) {
    return "Critical milestone or substantial completion date begins to slip.";
  }

  if (title.includes("cyber") || title.includes("cui")) {
    return "Project receives, stores, transmits, or controls CUI or cybersecurity-sensitive information.";
  }

  if (title.includes("davis-bacon") || title.includes("labor")) {
    return "Certified payroll, wage determination, or labor compliance requirement applies.";
  }

  if (title.includes("owner-furnished")) {
    return "Owner-furnished item is required to maintain project schedule or trade flow.";
  }

  if (source === "ProjectHealthOS") {
    return "Project health review item remains Off Track or worsens.";
  }

  if (source === "ConstraintOS") {
    return "Constraint remains open, escalated, or unresolved beyond required date.";
  }

  return "Risk condition emerges or begins affecting project performance.";
}
function calculateRiskTrend(risk) {
  const title = String(risk.title || "").toLowerCase();
  const milestoneSlipDays = getLinkedMilestoneSlipDays(risk);

if (milestoneSlipDays > 0) {
  return "Worsening";
}

  if (title.includes("constraint") || risk.sourceType === "ConstraintOS") {
    const escalatedCount = constraints.filter(
      (constraint) => constraint.status === "Escalated"
    ).length;

    return escalatedCount > 0 ? "Worsening" : risk.trend || "Stable";
  }

  if (risk.sourceType === "ProjectHealthOS") {
    const healthReviewItems = Array.isArray(projectHealthOS?.reviewItems)
      ? projectHealthOS.reviewItems
      : [];

    const offTrackItems = healthReviewItems.filter(
      (item) => item.status === "Red"
    );

    return offTrackItems.length > 0 ? "Worsening" : risk.trend || "Stable";
  }

  return risk.trend || "Stable";
}
function scrollToSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}
function getConstraintAge(constraint) {
  const createdDate = constraint.createdAt
    ? new Date(constraint.createdAt)
    : constraint.requiredBy
    ? new Date(constraint.requiredBy)
    : null;

  if (!createdDate || Number.isNaN(createdDate.getTime())) return 0;

  const today = new Date();

  return Math.max(
    0,
    Math.ceil((today - createdDate) / (1000 * 60 * 60 * 24))
  );
}
  return (
    <div className="page">
      <ModuleHeader
        logo="riskintegrator-logo.png"
        title="RiskIntegratorOS"
        subtitle="Executive risk intelligence from pursuit through project completion."
      />

      {!selectedProject ? (
        <div className="data-card">
          <h3>No Project Selected</h3>
          <p>
            Select or create a project to begin building the project risk
            playbook.
          </p>
        </div>
      ) : (
  <div className="risk-executive-layout">
    <aside className="risk-executive-sidebar">
      <button
  type="button"
  className="risk-home-button"
  onClick={() => window.dispatchEvent(new CustomEvent("sentinel:navigate-home"))}
>
  🛡️ SentinelOS Home
</button>
      <div className="risk-sidebar-section">
        <div className="risk-sidebar-heading">Executive</div>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("executive-dashboard")}
        >
          📊 Executive Dashboard
        </button>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("executive-brief")}
        >
          📋 Executive Brief
        </button>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("health-score")}
        >
          💚 Health Score
        </button>
      </div>

      <div className="risk-sidebar-section">
        <div className="risk-sidebar-heading">Risk Management</div>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("risk-playbook")}
        >
          🛡️ Risk Playbook
        </button>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("mitigation-tracking")}
        >
          📈 Mitigation Tracking
        </button>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("audit-log")}
        >
          🕘 Risk History
        </button>
      </div>

      <div className="risk-sidebar-section">
        <div className="risk-sidebar-heading">Intelligence</div>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("risk-sources")}
        >
          📁 Risk Sources
        </button>

        <button
          type="button"
          className="risk-nav-item"
          onClick={() => scrollToSection("contract-intelligence")}
        >
          📄 Contract Intelligence
        </button>
      </div>

     
    </aside>

    <main className="risk-executive-main">
      <div
  id="executive-dashboard"
  className="executive-kpi-grid"
>
        <div className="executive-kpi-card">
    <span className="kpi-icon">🛡️</span>
    <div>
      <h3>Active Risks</h3>
      <strong>{activeRisks.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card critical">
    <span className="kpi-icon">⚠️</span>
    <div>
      <h3>Critical Risks</h3>
      <strong>{criticalRisks.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card high">
    <span className="kpi-icon">📈</span>
    <div>
      <h3>High Risks</h3>
      <strong>{highRisks.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card">
    <span className="kpi-icon">📣</span>
    <div>
      <h3>Escalated</h3>
      <strong>{escalatedRisks.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card">
    <span className="kpi-icon">👤</span>
    <div>
      <h3>No Owner</h3>
      <strong>{risksWithoutOwners.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card high">
    <span className="kpi-icon">📉</span>
    <div>
      <h3>Worsening</h3>
      <strong>{worseningRisks.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card critical">
    <span className="kpi-icon">🔔</span>
    <div>
      <h3>Executive Alerts</h3>
      <strong>{executiveAlerts.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card health">
  <span className="kpi-icon">💚</span>

  <div>
    <h3>Health Score</h3>
    <strong>{executiveHealthScore}</strong>

    <div className="health-label">
      {executiveHealthScore >= 80
        ? "Good"
        : executiveHealthScore >= 60
        ? "Watch"
        : "Critical"}
        </div>
    </div>
  </div>
</div>

<div id="health-score" className="data-card health-score-section">
  <div className="section-header-row">
    <div>
      <h2>Health Score</h2>
      <p>Executive risk health based on critical risks, high risks, worsening trends, and owner gaps.</p>
    </div>
  </div>

  <div className="health-score-content">
    <div
      className="health-gauge"
      style={{
        background: `conic-gradient(#22c55e ${executiveHealthScore * 3.6}deg, #e5e7eb 0deg)`,
      }}
    >
      <div className="health-gauge-inner">
        <strong>{executiveHealthScore}</strong>
        <span>
          {executiveHealthScore >= 80
            ? "Good"
            : executiveHealthScore >= 60
            ? "Watch"
            : "Critical"}
        </span>
      </div>
    </div>

    <div className="health-score-details">
      <div>
        <span>Target</span>
        <strong>80+</strong>
      </div>

      <div>
        <span>Critical Risks</span>
        <strong>{criticalRisks.length}</strong>
      </div>

      <div>
        <span>High Risks</span>
        <strong>{highRisks.length}</strong>
      </div>

      <div>
        <span>Worsening Trends</span>
        <strong>{worseningRisks.length}</strong>
      </div>

      <div>
        <span>Risks Without Owner</span>
        <strong>{risksWithoutOwners.length}</strong>
      </div>
    </div>
  </div>
</div>


<div id="mitigation-tracking" className="data-card">
  <h2>Mitigation Tracking</h2>
  <div className="executive-kpi-grid">
  <div className="executive-kpi-card">
    <h4>Open Risks</h4>
    <strong>{activeRisks.length}</strong>
  </div>

  <div className="executive-kpi-card">
    <h4>Assigned Owners</h4>
    <strong>
      {activeRisks.filter((r) => r.owner).length}
    </strong>
  </div>

  <div className="executive-kpi-card">
    <h4>Unassigned</h4>
    <strong>
      {activeRisks.filter((r) => !r.owner).length}
    </strong>
  </div>
</div>

  <div className="risk-table-wrapper">
  <table className="risk-table">
    <thead>
  <tr>
    <th>Risk</th>
    <th>Owner</th>
    <th>Status</th>
    <th>Trend</th>
    <th>Mitigation Plan</th>
  </tr>
</thead>

    <tbody>
      {activeRisks.map((risk) => (
        <tr key={risk.id}>
          <td>{risk.title}</td>
          <td>{risk.owner || "Unassigned"}</td>
          <td>{risk.status}</td>
          <td>{risk.trend}</td>
          <td className="mitigation-column">
  {risk.mitigationPlan || risk.mitigation || "-"}
</td>
        </tr>
      ))}
    </tbody>
  </table>
  </div>
</div>

<div id="contract-intelligence" className="data-card">
  <h2>Contract Intelligence</h2>
  <p>
    Phase 5 will convert uploaded contracts into detected clauses, generated risks,
    notice requirements, and mitigation recommendations.
  </p>

  <div className="contract-roadmap-grid">
    <div>✅ Contract Upload Tracking</div>
    <div>✅ Contract-Generated Risk Framework</div>
    <div>⬜ PDF Text Extraction</div>
    <div>⬜ Clause Detection</div>
    <div>⬜ Notice Requirement Tracking</div>
    <div>⬜ Liquidated Damages Detection</div>
    <div>⬜ FAR / DFARS / CUI Detection</div>
    <div>⬜ AI Mitigation Recommendations</div>
  </div>
</div>

<div className="data-card">
            <div className="section-header-row">
              <div
  id="executive-brief"
  className="data-card"
>
  <h2>Executive Risk Brief</h2>
                <p>
                  The highest-priority risks requiring leadership awareness,
                  mitigation, or escalation.
                </p>
              </div>
            </div>
            <div className="data-card">
  <div className="section-header-row">
    <div>
      <h2>Executive Alerts</h2>
      <p>Schedule-linked risks requiring leadership attention.</p>
    </div>
  </div>

  {executiveAlerts.length === 0 ? (
    <p>No executive alerts at this time.</p>
  ) : (
    <div className="executive-alert-grid">
      {executiveAlerts.map((alert) => (
        <div className="executive-alert-card" key={alert.id}>
          <div className="executive-alert-topline">
            <span className="executive-alert-icon">⚠️</span>
            <span className="executive-alert-type">{alert.type}</span>
            <span className="executive-alert-priority">High Priority</span>
          </div>

          <h3>{alert.risk}</h3>

          <div className="executive-alert-meta">
            <div>
              <span>Owner</span>
              <strong>{alert.owner || "Unassigned"}</strong>
            </div>

            <div>
              <span>Status</span>
              <strong>{alert.status || "Open"}</strong>
            </div>

            <div>
              <span>Days Open</span>
              <strong>{alert.daysOpen ?? "-"}</strong>
            </div>
          </div>

          <div className="executive-alert-body">
            <p>
              <strong>Message:</strong> {alert.message}
            </p>
            <p>
              <strong>Recommended Action:</strong> {alert.recommendation}
            </p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>

            {topExecutiveRisks.length === 0 ? (
              <p>No active risks are currently in the executive brief.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Category</th>
                    <th>Score</th>
                    <th>Level</th>
                    <th>Trend</th>
                    <th>Status</th>
                    <th>Days Open</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {topExecutiveRisks.map((risk) => (
                    <tr key={risk.id}>
                      <td>{risk.title}</td>
                      <td>{risk.category}</td>
                      <td>{risk.score}</td>
                      <td>
                        <span className={getRiskClass(risk.score)}>
                          {getRiskLevel(risk.score)}
                        </span>
                      </td>
                      <td>{risk.trend || "Stable"}</td>
                      <td>{risk.status}</td>
                      <td>{getRiskAgeDays(risk)}</td>
                      <td>{risk.owner || "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div
  id="risk-sources"
  className="data-card"
>
  <h2>Risk Sources</h2>
                <p>
                  Upload or track the documents and Sentinel modules that create
                  risk: pursuit reviews, contracts, permits, specifications,
                  ProjectHealthOS, ConstraintOS, RevenueOS, and schedules.
                </p>
              </div>
            </div>

            <div className="button-row">
              <label className="secondary-button">
                + Upload Contract
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  hidden
                  onChange={(e) => handleRiskSourceUpload(e, "Contract")}
                />
              </label>

              <label className="secondary-button">
                + Upload Specification
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  hidden
                  onChange={(e) => handleRiskSourceUpload(e, "Specification")}
                />
              </label>

              <label className="secondary-button">
                + Upload Permit
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  hidden
                  onChange={(e) => handleRiskSourceUpload(e, "Permit")}
                />
              </label>

              <label className="secondary-button">
                + Upload Risk Assessment
                <input
                  type="file"
                  accept=".xls,.xlsx,.xlsm,.csv,.pdf"
                  hidden
                  onChange={(e) =>
                    handleRiskSourceUpload(e, "Risk Assessment")
                  }
                />
              </label>

              <label className="secondary-button">
                Import Go / No-Go Profile
                <input
                  type="file"
                  accept=".xls,.xlsx,.xlsm,.csv"
                  hidden
                  onChange={(e) => handleRiskSourceUpload(e, "Pursuit")}
                />
              </label>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
<th>Type</th>
<th>Uploaded</th>
<th>Analysis Status</th>
<th>Risks Generated</th>
                </tr>
              </thead>
              <tbody>
  {riskSources.length === 0 ? (
    <tr>
      <td colSpan="5">No risk sources uploaded yet.</td>
    </tr>
  ) : (
    riskSources.map((source) => (
      <tr key={source.id}>
        <td>{source.name}</td>
<td>{source.type}</td>
<td>{source.uploadedAt}</td>
<td>{source.analysisStatus || "Uploaded"}</td>
<td>{source.risksGenerated}</td>
      </tr>
    ))
  )}
</tbody>
            </table>
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div>
                <h2>Risk Intelligence Engine</h2>
                <p>
                  Analyze risk sources and Sentinel module signals to identify
                  contractual, compliance, financial, schedule, staffing, and
                  execution risks.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={loadDemoSuggestedRisks}
              >
                Analyze Risk Sources
              </button>
            </div>

            <div className="insight-card">
              <h3>Future Detection Targets</h3>
              <p>
                Notice windows, liquidated damages, compliance requirements,
                owner-provided dependencies, approval constraints, labor
                requirements, cyber/CUI exposure, entitlement risk, executive
                escalation triggers, ProjectHealthOS concerns, ConstraintOS
                aging, RevenueOS forecast movement, and schedule deterioration.
              </p>
            </div>
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div>
                <div className="data-card">
  <h2>Suggested Risks</h2>

  <p>
    Risks identified from contracts, schedules,
    constraints, project health reviews,
    and other SentinelOS sources.
  </p>

  <table className="data-table">
    <thead>
      <tr>
        <th>Risk</th>
        <th>Category</th>
        <th>Source</th>
        <th>Confidence</th>
        <th>Actions</th>
      </tr>
    </thead>

    <tbody>
      {suggestedRisks.map((risk) => (
        <tr key={risk.id}>
          <td>{risk.risk}</td>
          <td>{risk.category}</td>
          <td>{risk.source}</td>
          <td>{risk.confidence}</td>

          <td>
            <button
              className="primary-button"
              onClick={() => {
                setRiskPlaybook([
  ...riskPlaybook,
                  {
  id: crypto.randomUUID(),
  title: risk.risk,
  category: risk.category,
  sourceType: risk.source,
  source: risk.source,
  linkedMilestone: "",
  probability: risk.probability || 3,
  impact: risk.impact || 3,
  score: (risk.probability || 3) * (risk.impact || 3),
  owner: risk.owner || "Project Executive",
  status: "Open",
  trend: "Stable",
  mitigation:
    risk.mitigation ||
    getDefaultMitigation(risk.risk, risk.category, risk.source),
  trigger:
    risk.trigger ||
    getDefaultTrigger(risk.risk, risk.category, risk.source),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  history: [
  {
    date: new Date().toISOString(),
    action: "Risk Created",
  },
],
},
                ]);

                setSuggestedRisks(
                  suggestedRisks.filter(
                    (item) => item.id !== risk.id
                  )
                );
              }}
            >
              Accept
            </button>

            <button
              className="danger-button"
              onClick={() =>
                setSuggestedRisks(
                  suggestedRisks.filter(
                    (item) => item.id !== risk.id
                  )
                )
              }
            >
              Reject
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
                <div
  className="collapsible-header"
  onClick={() => setShowAddRiskForm(!showAddRiskForm)}
>
  {showAddRiskForm ? "▼" : "▶"} Add Risk
</div>

                <p>
                  Manually add a risk when it has not yet been generated by a
                  source document or Sentinel module.
                </p>
              </div>
            </div>

            <form className="risk-add-form" onSubmit={addRisk}>
              <label>
                Risk Title
                <input
                  name="title"
                  value={riskForm.title}
                  onChange={handleFormChange}
                  placeholder="Example: Failure to preserve contractual notice rights"
                />
              </label>

              <label>
                Category
                <select
                  name="category"
                  value={riskForm.category}
                  onChange={handleFormChange}
                >
                  {riskCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Source Type
                <select
                  name="sourceType"
                  value={riskForm.sourceType}
                  onChange={handleFormChange}
                >
                  {sourceTypes.map((sourceType) => (
                    <option key={sourceType} value={sourceType}>
                      {sourceType}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Source
                <input
                  name="source"
                  value={riskForm.source}
                  onChange={handleFormChange}
                  placeholder="Contract, Go/No-Go, ConstraintOS, etc."
                />
              </label>

              <label>
                Probability
                <select
                  name="probability"
                  value={riskForm.probability}
                  onChange={handleFormChange}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Impact
                <select
                  name="impact"
                  value={riskForm.impact}
                  onChange={handleFormChange}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Owner
                <input
                  name="owner"
                  value={riskForm.owner}
                  onChange={handleFormChange}
                  placeholder="Risk owner"
                />
              </label>

              <label>
                Trend
                <select
                  name="trend"
                  value={riskForm.trend}
                  onChange={handleFormChange}
                >
                  {riskTrends.map((trend) => (
                    <option key={trend} value={trend}>
                      {trend}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Status
                <select
                  name="status"
                  value={riskForm.status}
                  onChange={handleFormChange}
                >
                  {riskStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Trigger
                <input
                  name="trigger"
                  value={riskForm.trigger}
                  onChange={handleFormChange}
                  placeholder="What would activate this risk?"
                />
              </label>

              <label className="full-width">
                Mitigation Plan
                <textarea
                  name="mitigation"
                  value={riskForm.mitigation}
                  onChange={handleFormChange}
                  placeholder="What controls, actions, or decisions reduce this risk?"
                />
              </label>

              <div className="full-width">
                <button className="primary-button" type="submit">
                  Add Risk to Playbook
                </button>
              </div>
            </form>
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div
  id="risk-playbook"
  className="data-card"
>
  <h2>Project Risk Playbook</h2>
                <p>
                  A living executive risk playbook from pursuit through
                  completion.
                </p>
              </div>
            </div>

            <table className="data-table risk-playbook-table">
              <thead>
  <tr>
    <th>Risk</th>
    <th>Category</th>
    <th>Score</th>
    <th>Level</th>
    <th>Trend</th>
    <th>Status</th>
    <th>Owner</th>
    <th>Linked Milestone</th>
    <th>Baseline Date</th>
    <th>Slip Days</th>
    <th></th>
  </tr>
</thead>

              <tbody>
                {riskPlaybook.length === 0 ? (
                  <tr>
                    <td colSpan="13">No risks added yet.</td>
                  </tr>
                ) : (
                  riskPlaybook.map((risk) => (
                    <React.Fragment key={risk.id}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="risk-expand-button"
                            onClick={() =>
                              setExpandedRiskId(
                                expandedRiskId === risk.id ? null : risk.id
                              )
                            }
                          >
                            {expandedRiskId === risk.id ? "▼" : "▶"} {risk.title}
                          </button>
                        </td>

                        <td>
                          <select
                            value={risk.category}
                            onChange={(e) =>
                              updateRisk(risk.id, "category", e.target.value)
                            }
                          >
                            {riskCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>

                        

                        <td>{risk.score}</td>

                        <td>
                          <span className={getRiskClass(risk.score)}>
                            {getRiskLevel(risk.score)}
                          </span>
                        </td>

                        <td>
                          <select
                            value={calculateRiskTrend(risk)}
                            onChange={(e) =>
                              updateRisk(risk.id, "trend", e.target.value)
                            }
                          >
                            {riskTrends.map((trend) => (
                              <option key={trend} value={trend}>
                                {trend}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <select
                            value={risk.status}
                            onChange={(e) =>
                              updateRisk(risk.id, "status", e.target.value)
                            }
                          >
                            {riskStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <select
                            value={risk.owner || ""}
                            onChange={(e) =>
                              updateRisk(risk.id, "owner", e.target.value)
                            }
                          >
                            <option value="">Unassigned</option>

                            {teamMembers.map((member) => {
                              const memberName =
                                member.name ||
                                member.fullName ||
                                member.email ||
                                "Unnamed";

                              return (
                                <option
                                  key={member.id || member.email || memberName}
                                  value={memberName}
                                >
                                  {memberName}
                                </option>
                              );
                            })}
                          </select>
                        </td>

                        

                        <td>
                          <select
                            value={risk.linkedMilestone || ""}
                            onChange={(e) =>
                              updateRisk(risk.id, "linkedMilestone", e.target.value)
                            }
                          >
                            <option value="">Not Linked</option>

                            {milestones.map((milestone) => (
                              <option key={milestone.id} value={milestone.name}>
                                {milestone.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>{risk.baselineMilestoneDate || "-"}</td>

                        <td>
                          {getLinkedMilestoneSlipDays(risk) > 0
                            ? `${getLinkedMilestoneSlipDays(risk)} days`
                            : "-"}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => deleteRisk(risk.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>

                      {expandedRiskId === risk.id && (
                        <tr className="risk-detail-row">
                          <td colSpan="11">
                            <div className="risk-detail-panel">
                              <div className="risk-detail-section">
                                <h4>Risk Analysis</h4>

                                <div className="risk-detail-grid risk-analysis-grid">
                                  <label>
                                    Probability
                                    <select
                                      value={risk.probability}
                                      onChange={(e) =>
                                        updateRisk(risk.id, "probability", e.target.value)
                                      }
                                    >
                                      {[1, 2, 3, 4, 5].map((value) => (
                                        <option key={value} value={value}>
                                          {value}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>
                                    Impact
                                    <select
                                      value={risk.impact}
                                      onChange={(e) =>
                                        updateRisk(risk.id, "impact", e.target.value)
                                      }
                                    >
                                      {[1, 2, 3, 4, 5].map((value) => (
                                        <option key={value} value={value}>
                                          {value}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                                                   
                                </div>
                              </div>

                              <div className="risk-detail-section">
                                <h4>Risk Source</h4>

                                <div className="risk-detail-grid risk-source-grid">
                                  <label>
                                    Source Type
                                    <select
                                      value={risk.sourceType || "Manual"}
                                      onChange={(e) =>
                                        updateRisk(risk.id, "sourceType", e.target.value)
                                      }
                                    >
                                      {sourceTypes.map((sourceType) => (
                                        <option key={sourceType} value={sourceType}>
                                          {sourceType}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label>
                                    Source
                                    <input
                                      value={risk.source || ""}
                                      onChange={(e) =>
                                        updateRisk(risk.id, "source", e.target.value)
                                      }
                                    />
                                  </label>
                                </div>
                              </div>

                              <div className="risk-detail-section">
                                <h4>Mitigation Plan</h4>

                                <textarea
                                  className="risk-detail-textarea"
                                  value={risk.mitigation || ""}
                                  onChange={(e) =>
                                    updateRisk(risk.id, "mitigation", e.target.value)
                                  }
                                />
                              </div>

                              <div className="risk-detail-section">
                                <h4>Trigger / Context</h4>

                                <textarea
                                  className="risk-detail-textarea"
                                  value={risk.trigger || ""}
                                  onChange={(e) =>
                                    updateRisk(risk.id, "trigger", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="data-card">
  <div className="section-header-row">
    <div
  id="audit-log"
  className="data-card"
>
  <h2>Risk History</h2>
      <p>Timeline of key risk events, status changes, and trend changes.</p>
    </div>
  </div>

  <div className="risk-history-filter">
    <label>
      Filter by Risk
      <select
        value={historyRiskFilter}
        onChange={(e) => setHistoryRiskFilter(e.target.value)}
      >
        <option>All Risks</option>
        {riskPlaybook.map((risk) => (
          <option key={risk.id} value={risk.title}>
            {risk.title}
          </option>
        ))}
      </select>
    </label>
  </div>

  {historyRows.length === 0 ? (
    <p>No risk history has been created yet.</p>
  ) : (
    <div className="risk-history-timeline">
      {historyRows.slice(0, 10).map((entry, index) => (
        <div key={index} className="timeline-item">
          <div className="timeline-left">
            <div className="timeline-date">
              {new Date(entry.date).toLocaleDateString()}
            </div>
            <strong>{entry.risk}</strong>
          </div>

          <div className="timeline-event">
            {entry.action}
          </div>
        </div>
      ))}
    </div>
  )}
</div>

</main>
  </div>
)}
    </div>
  );
}

export default RiskIntegratorOS;