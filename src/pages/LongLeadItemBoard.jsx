import Metric from "../components/Metric.jsx";
const PROCUREMENT_TERMS = [
  "procurement",
  "procure",
  "long lead",
  "material",
  "equipment",
  "buyout",
  "release",
  "ordered",
  "order",
];

const FABRICATION_TERMS = [
  "fabrication",
  "fabricate",
  "fab",
  "manufacture",
  "manufacturing",
  "shop",
];

const LONG_LEAD_TERMS = [
  "switchgear",
  "transformer",
  "generator",
  "ahu",
  "rtu",
  "air handler",
  "precast",
  "steel",
  "elevator",
  "curtainwall",
  "window",
  "roofing",
  "fire pump",
  "chiller",
  "boiler",

  "parking control",
  "loading dock",
  "laboratory",
  "fume hood",
  "security",
  "access control",
  "detention",
  "metal panel",
  "canopy",
  "storefront",
  "glazing",
  "door hardware",
  "overhead door",
  "roll up door",
  "mechanical equipment",
  "electrical equipment",
  "controls",
  "bms",
  "bas",
  "fire alarm",
  "sprinkler",
  "pump",
  "tank",
  "gate",
  "fence",
  "bollard",
  "switchgear",
"switch gear",
"panelboard",
"panel board",
"distribution panel",
"electrical panel",
"motor control center",
"mcc",
"ups",
"ats",
"transformer",

"chiller",
"chillers",
"cooling tower",
"heat pump",
"air handler",
"ahu",
"rtu",

"metal panel",
"metal panels",
"insulated metal panel",
"imp",
"wall panel",
"roof panel",
"architectural panel",
"generator",
"fuel tank",
"elevator",
"precast",
"structural steel",
"curtainwall",
"glazing",
"laboratory equipment",
"loading dock",
"dock equipment",
"fire pump",
"fire alarm panel",
"bas",
"controls",
"access control",
"security",
];

function textIncludesAny(text, terms) {
  const value = String(text || "").toLowerCase();
  return terms.some((term) => value.includes(term));
}

function getActivityName(activity) {
  return (
    activity.activityName ||
    activity.name ||
    activity.ActivityName ||
    activity["Activity Name"] ||
    ""
  );
}

function getActivityId(activity) {
  return (
    activity.activityId ||
    activity.id ||
    activity.ActivityID ||
    activity["Activity ID"] ||
    ""
  );
}

function getActivityStart(activity) {
  return (
    activity.start ||
    activity.Start ||
    activity.startDate ||
    activity["Start"] ||
    activity["Start Date"] ||
    ""
  );
}

function getActivityDuration(activity) {
  return Number(
    activity.originalDuration ||
      activity.original_duration ||
      activity.OriginalDuration ||
      activity["Original Duration"] ||
      activity["Orig Dur"] ||
      activity["Original Duration (days)"] ||
      0
  );
}

function getReadiness(activity, matchingSubmittal) {
  const start = getActivityStart(activity);
  const duration = getActivityDuration(activity);
  if (String(getActivityName(activity)).toLowerCase().includes("generator")) {
  console.log("LONG LEAD DEBUG", activity);
}
  const today = new Date();
  const startDate = start ? new Date(start) : null;

  const daysUntilStart =
    startDate && !Number.isNaN(startDate.getTime())
      ? Math.ceil((startDate - today) / (1000 * 60 * 60 * 24))
      : null;

  const submittalStatus = String(matchingSubmittal?.status || "").toLowerCase();

  if (daysUntilStart !== null && daysUntilStart < 0) return "Late";
  if (
    daysUntilStart !== null &&
    daysUntilStart <= 30 &&
    !submittalStatus.includes("approved")
  ) {
    return "Critical";
  }
  if (daysUntilStart !== null && daysUntilStart <= 60) return "At Risk";
  if (duration >= 70) return "At Risk";

  return "Monitor";
}

function getPillClass(value) {
  const key = String(value || "")
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("/", "")
    .replaceAll("--", "-");

  return `status-pill ${key}`;
}

function LongLeadItemBoard({
  longLeadItems = [],
  updateLongLeadItems,
  scheduleActivities = [],
  submittals = [],
  issues = [],
  constraints = [],
  updateCurrentProjectData,
}) {
  const trackedActivityIds = longLeadItems
  .filter((item) => !item.archived)
  .map((item) => item.linkedScheduleActivityId);

  const suggestions = scheduleActivities
    .filter((activity) => {
      const name = getActivityName(activity);
      const id = getActivityId(activity);
      const duration = getActivityDuration(activity);

      const wbs =
        activity.wbs ||
        activity.WBS ||
        activity.wbsName ||
        activity["WBS"] ||
        activity["WBS Name"] ||
        "";

      const code =
        activity.activityCode ||
        activity.ActivityCode ||
        activity["Activity Code"] ||
        "";

      const isProcurement =
        textIncludesAny(name, PROCUREMENT_TERMS) ||
        textIncludesAny(wbs, PROCUREMENT_TERMS) ||
        textIncludesAny(code, PROCUREMENT_TERMS);

      const lowerName = String(name || "").toLowerCase().trim();
const lowerWbs = String(wbs || "").toLowerCase();

const isFabricationName =
  lowerName.includes("fab") ||
  lowerName.includes("fabrication") ||
  lowerName.includes("fabricate");

const isFabricationWbs =
  lowerWbs.includes("fabrication and delivery") ||
  lowerWbs.includes("fabrication") ||
  lowerWbs.includes("fabricate") ||
  lowerWbs.includes("fab");

const isExcludedProcStep =
  lowerName.startsWith("app ") ||
  lowerName.startsWith("sub ") ||
  lowerName.startsWith("del ") ||
  lowerName.startsWith("approval") ||
  lowerName.startsWith("submit") ||
  lowerName.startsWith("delivery");

const isKnownLongLead = textIncludesAny(name, LONG_LEAD_TERMS);
const hasLongDuration = duration >=70;

return (
  id &&
  !trackedActivityIds.includes(id) &&
  !isExcludedProcStep &&
  (
    (isKnownLongLead && (hasLongDuration || isFabricationName || isFabricationWbs)) ||
    ((isFabricationName || isFabricationWbs) && hasLongDuration)
  )
);
    })
    .map((activity) => {
      const activityId = getActivityId(activity);
      const activityName = getActivityName(activity);

      const matchingSubmittal = submittals.find((submittal) => {
        const title = String(submittal.title || submittal.name || "").toLowerCase();
        return (
          title &&
          activityName.toLowerCase().includes(title.slice(0, 12).toLowerCase())
        );
      });

      return {
        activity,
        activityId,
        activityName,
        activityStart: getActivityStart(activity),
        duration: getActivityDuration(activity),
        matchingSubmittal,
        readiness: getReadiness(activity, matchingSubmittal),
      };
    });

  function trackSuggestion(suggestion) {
    const newItem = {
      id: Date.now(),
      item: suggestion.activityName,
      vendor:
        suggestion.matchingSubmittal?.responsibleContractor ||
        suggestion.matchingSubmittal?.contractor ||
        "",
      requiredOnSiteDate: suggestion.activityStart || "",
      submittalStatus: suggestion.matchingSubmittal?.status || "Not Started",
      procurementStatus: "Not Started",
      fabricationStatus: suggestion.activityName.toLowerCase().includes("fab")
        ? "In Fabrication"
        : "Not Started",
      shippingStatus: "Not Started",
      riskLevel:
        suggestion.readiness === "Critical" || suggestion.readiness === "Late"
          ? "High"
          : "Medium",
      linkedScheduleActivityId: suggestion.activityId,
      linkedConstraintId: "",
      linkedSubmittalId: suggestion.matchingSubmittal?.id || "",
      notes: `Created from Long Lead Readiness. Source activity: ${suggestion.activityId}`,
      archived: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateLongLeadItems([...longLeadItems, newItem]);
  }

  function createIssueFromSuggestion(suggestion) {
  const newIssue = {
    id: Date.now(),
    title: `Long Lead Risk - ${suggestion.activityName}`,
    source: "Long Lead Readiness",
    activityId: suggestion.activityId,
    start: suggestion.activityStart || "",
    finish: suggestion.activityStart || "",
    totalFloat: suggestion.activity.totalFloat || "",
    owner:
      suggestion.matchingSubmittal?.responsibleContractor ||
      suggestion.matchingSubmittal?.contractor ||
      "Unassigned",
    milestone: "Unassigned",
    status: "Open",
    manuallyEscalated: suggestion.readiness === "Critical",
    createdAt: new Date().toISOString(),
    notes: `Readiness: ${suggestion.readiness}. Duration: ${suggestion.duration} days.`,
  };

  updateCurrentProjectData({
    issues: [...issues, newIssue],
  });

  alert("Long lead risk added to Issues Board.");
}
function calculateRisk(item) {
  const today = new Date();

  const requiredDate = item.requiredOnSiteDate
    ? new Date(item.requiredOnSiteDate)
    : null;

  const daysUntilRequired =
    requiredDate && !Number.isNaN(requiredDate.getTime())
      ? Math.ceil((requiredDate - today) / (1000 * 60 * 60 * 24))
      : null;

  const submittalApproved =
    String(item.submittalStatus || "").toLowerCase().includes("approved");

  const procurementOrdered =
    String(item.procurementStatus || "").toLowerCase() === "ordered";

  const fabricationComplete =
    String(item.fabricationStatus || "").toLowerCase() === "complete";

  const shippingDelivered =
    String(item.shippingStatus || "").toLowerCase() === "delivered";

  if (
    daysUntilRequired !== null &&
    daysUntilRequired <= 14 &&
    (!procurementOrdered || !fabricationComplete)
  ) {
    return "Critical";
  }

  if (
    daysUntilRequired !== null &&
    daysUntilRequired <= 30 &&
    (!submittalApproved || !procurementOrdered)
  ) {
    return "High";
  }

  if (
    !shippingDelivered &&
    (!fabricationComplete || !procurementOrdered)
  ) {
    return "Medium";
  }

  return "Low";
}
function createConstraintFromTrackedItem(item) {
    if (item.linkedConstraintId) {
  alert("Constraint already exists for this long lead item.");
  return;
}
  const newConstraint = {
    id: Date.now(),
    description: `Long Lead Constraint - ${item.item}`,
    owner: item.vendor || "Unassigned",
    requiredBy: item.requiredOnSiteDate || "",
    milestone: "Unassigned",
    status: "Open",
    source: "Long Lead Readiness",
    sourceLongLeadItemId: item.id,
    linkedScheduleActivityId: item.linkedScheduleActivityId || "",
    linkedSubmittalId: item.linkedSubmittalId || "",
    createdAt: new Date().toISOString(),
    notes: item.notes || "",
  };

  updateCurrentProjectData({
    constraints: [...constraints, newConstraint],
    longLeadItems: longLeadItems.map((leadItem) =>
      leadItem.id === item.id
        ? {
            ...leadItem,
            linkedConstraintId: newConstraint.id,
            updatedAt: new Date().toISOString(),
          }
        : leadItem
    ),
  });

  alert("Long lead item added to Constraint Board.");
}

  function archiveItem(id) {
    updateLongLeadItems(
      longLeadItems.map((item) =>
        item.id === id ? { ...item, archived: true } : item
      )
    );
  }
  function linkSubmittalToTrackedItem(itemId, submittalId) {
  const selectedSubmittal = submittals.find(
    (submittal) => String(submittal.id) === String(submittalId)
  );

  updateLongLeadItems(
    longLeadItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            linkedSubmittalId: submittalId,
            submittalStatus: selectedSubmittal?.status || "Open",
            vendor:
              item.vendor ||
              selectedSubmittal?.responsibleContractor ||
              selectedSubmittal?.contractor ||
              "",
            updatedAt: new Date().toISOString(),
          }
        : item
    )
  );
}
function updateTrackedItem(itemId, field, value) {
  updateLongLeadItems(
    longLeadItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            [field]: value,
            updatedAt: new Date().toISOString(),
          }
        : item
    )
  );
}

  const activeTrackedItems = longLeadItems.filter((item) => !item.archived);

  return (
    <div className="page long-lead-page">
      <div className="page-header">
        <div>
          <h1>Long Lead Readiness</h1>
          <p>
            Identify procurement and fabrication risks from the schedule and
            submittal data before they become constraints.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button no-print"
          onClick={() => window.print()}
        >
          Print / Export
        </button>
      </div>

      <div className="data-card">
        <h2>Long Lead Risk Summary</h2>

<div className="grid">
  <Metric
  title="Tracked Items"
  value={activeTrackedItems.length}
  note="Long lead items being monitored"
/>

<Metric
  title="Not Linked"
  value={activeTrackedItems.filter((item) => !item.linkedSubmittalId).length}
  note="No linked submittal"
/>

<Metric
  title="High / Critical"
  value={
    activeTrackedItems.filter(
      (item) =>
        calculateRisk(item) === "High" ||
        calculateRisk(item) === "Critical"
    ).length
  }
  note="Needs procurement review"
/>

<Metric
  title="Late"
  value={
    activeTrackedItems.filter((item) => {
      if (!item.requiredOnSiteDate) return false;
      return new Date(item.requiredOnSiteDate) < new Date();
    }).length
  }
  note="Required date has passed"
/>
</div>

<h2>Suggested Long Lead Items</h2>

        <table className="data-table long-lead-table">
          <thead>
            <tr>
              <th>Activity / Item</th>
              <th>Activity ID</th>
              <th>Activity Start</th>
              <th>Orig. Duration</th>
              <th>Submittal Status</th>
              <th>Readiness</th>
              <th className="no-print">Action</th>
            </tr>
          </thead>

          <tbody>
            {suggestions.length === 0 ? (
              <tr>
                <td colSpan="7">
                  No suggested long lead risks found from the current schedule.
                </td>
              </tr>
            ) : (
              suggestions.map((suggestion) => (
                <tr key={suggestion.activityId}>
                  <td>{suggestion.activityName}</td>
                  <td>{suggestion.activityId}</td>
                  <td>{suggestion.activityStart || "-"}</td>
                  <td>{suggestion.duration}</td>
                  <td>
  {suggestion.matchingSubmittal ? (
    suggestion.matchingSubmittal.status || "Open"
  ) : (
    <span className="status-pill high">Not Linked</span>
  )}
</td>
                  <td>
                    <span className={getPillClass(suggestion.readiness)}>
                      {suggestion.readiness}
                    </span>
                  </td>
                  <td className="no-print">
  <div className="button-row">
    <button
      type="button"
      className="secondary-button"
      onClick={() => trackSuggestion(suggestion)}
    >
      Track Item
    </button>

    <button
      type="button"
      className="primary-button"
      onClick={() => createIssueFromSuggestion(suggestion)}
    >
      Create Issue
    </button>
  </div>
</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="data-card">
        <h2>Tracked Long Lead Items</h2>

        <table className="data-table long-lead-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Vendor</th>
              <th>Required On Site</th>
              <th>Submittal</th>
              <th>Procurement</th>
              <th>Fabrication</th>
              <th>Shipping</th>
              <th>Risk</th>
              <th>Notes</th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>

          <tbody>
            {activeTrackedItems.length === 0 ? (
              <tr>
                <td colSpan="10">No long lead items are being tracked yet.</td>
              </tr>
            ) : (
              activeTrackedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.item}</td>
                  <td>{item.vendor || "-"}</td>
                  <td>{item.requiredOnSiteDate || "-"}</td>
                  <td>
  <select
    className="form-input"
    value={item.linkedSubmittalId || ""}
    onChange={(e) =>
      linkSubmittalToTrackedItem(item.id, e.target.value)
    }
  >
    <option value="">Not Linked</option>

    {submittals.map((submittal) => (
      <option key={submittal.id} value={submittal.id}>
        {(submittal.title || submittal.name || "Untitled Submittal") +
          " - " +
          (submittal.status || "Open")}
      </option>
    ))}
  </select>
</td>
                  <td>
  <select
    className="form-input"
    value={item.procurementStatus}
    onChange={(e) =>
      updateTrackedItem(
        item.id,
        "procurementStatus",
        e.target.value
      )
    }
  >
    <option>Not Started</option>
    <option>Pricing</option>
    <option>Released</option>
    <option>Ordered</option>
    <option>Delayed</option>
  </select>
</td>
                  <td>
  <select
    className="form-input"
    value={item.fabricationStatus}
    onChange={(e) =>
      updateTrackedItem(
        item.id,
        "fabricationStatus",
        e.target.value
      )
    }
  >
    <option>Not Started</option>
    <option>In Fabrication</option>
    <option>Complete</option>
    <option>Delayed</option>
  </select>
</td>
                  <td>
  <select
    className="form-input"
    value={item.shippingStatus}
    onChange={(e) =>
      updateTrackedItem(
        item.id,
        "shippingStatus",
        e.target.value
      )
    }
  >
    <option>Not Started</option>
    <option>Pending</option>
    <option>Shipped</option>
    <option>Delivered</option>
    <option>Delayed</option>
  </select>
</td>
                  <td>
                    <span className={getPillClass(calculateRisk(item))}>
  {calculateRisk(item)}
</span>
                  </td>
                  <td>{item.notes}</td>
                  <td className="no-print">
  <div className="button-row">
    <button
  type="button"
  className="secondary-button"
  disabled={!!item.linkedConstraintId}
  
  onClick={() => createConstraintFromTrackedItem(item)}
>
  {item.linkedConstraintId ? "Constraint Created" : "Create Constraint"}
</button>

    <button
      type="button"
      className="primary-button"
      onClick={() =>
        createIssueFromSuggestion({
          activityName: item.item,
          activityId: item.linkedScheduleActivityId,
          activityStart: item.requiredOnSiteDate,
          duration: "",
          readiness: item.riskLevel === "High" ? "Critical" : "At Risk",
          matchingSubmittal: null,
          activity: {},
        })
      }
    >
      Create Issue
    </button>

    <button
      type="button"
      className="secondary-button"
      onClick={() => archiveItem(item.id)}
    >
      Archive
    </button>
  </div>
</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LongLeadItemBoard;