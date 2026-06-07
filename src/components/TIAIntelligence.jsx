function TIAIntelligence({
  scheduleSnapshots = [],
  projectData,
  issues = [],
  updateCurrentProjectData,
}) {
  const snapshots =
    scheduleSnapshots?.length > 0
      ? scheduleSnapshots
      : projectData?.scheduleHistory || [];

  const priorSnapshot = snapshots[snapshots.length - 2];
  const currentSnapshot = snapshots[snapshots.length - 1];

  const getActivities = (snapshot) =>
    snapshot?.rows ||
    snapshot?.activities ||
    snapshot?.importedActivities ||
    snapshot?.scheduleActivities ||
    [];

  const getId = (activity) =>
    activity.activityId || activity.id || activity.ActivityID || "";

  const getName = (activity) =>
    activity.activityName || activity.name || activity.ActivityName || "";

  const getFinish = (activity) =>
    activity.finish || activity.finishDate || activity.Finish || "";

  const getStart = (activity) =>
    activity.start || activity.startDate || activity.Start || "";

  const getFloat = (activity) =>
    Number(
      activity.totalFloat ??
        activity.float ??
        activity.TotalFloat ??
        activity.remainingFloat ??
        0
    );

  function daysBetween(startDate, finishDate) {
    if (!startDate || !finishDate) return 0;

    const start = new Date(startDate);
    const finish = new Date(finishDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) {
      return 0;
    }

    return Math.round((finish - start) / (1000 * 60 * 60 * 24));
  }

  function isCompletionActivity(activity) {
    const id = activity.id?.toUpperCase() || "";
    const name = activity.name?.toUpperCase() || "";

    return (
      id.includes("PMILE") ||
      id.includes("PCLO") ||
      name.includes("PROJECT SUBSTANTIAL COMPLETION") ||
      name.includes("SUBSTANTIAL COMPLETION") ||
      name.includes("CONTRACT COMPLETION") ||
      name.includes("FINAL PROJECT COMPLETION")
    );
  }

  function isRootCauseCandidate(activity) {
    const id = activity.id?.toUpperCase() || "";
    const name = activity.name?.toUpperCase() || "";

    const rootCauseKeywords = [
      "PERM",
      "PROC",
      "SUBM",
      "RFI",
      "DES",
      "LAND",
      "ENV",
      "HAZ",
      "GSA",
      "ACQUISITION",
      "REVIEW",
      "APPROVAL",
      "REMEDIATION",
      "DEMOLITION",
      "DEMO",
      "NTP",
      "PERMIT",
      "EASEMENT",
      "UTILITY",
      "TRANSFORMER",
      "SWITCHGEAR",
      "PRECAST",
      "LONG LEAD",
    ];

    return rootCauseKeywords.some(
      (keyword) => id.includes(keyword) || name.includes(keyword)
    );
  }

  if (!priorSnapshot || !currentSnapshot) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>TIA Intelligence</h1>
          <p>Monthly schedule impact comparison</p>
        </div>

        <div className="card">
          <h3>Two Schedule Imports Required</h3>
          <p>
            Import at least two schedules for this project before running the
            TIA comparison.
          </p>
          <p>Current schedule snapshots found: {snapshots.length}</p>
        </div>
      </div>
    );
  }

  const priorActivities = getActivities(priorSnapshot);
  const currentActivities = getActivities(currentSnapshot);

  const priorMap = new Map(
    priorActivities.map((activity) => [getId(activity), activity])
  );

  const comparison = currentActivities
    .map((current) => {
      const id = getId(current);
      const prior = priorMap.get(id);

      if (!prior) return null;

      const priorStart = getStart(prior);
      const currentStart = getStart(current);
      const priorFinish = getFinish(prior);
      const currentFinish = getFinish(current);

      if (!priorFinish || !currentFinish) return null;

      const startVarianceDays = daysBetween(priorStart, currentStart);
      const varianceDays = daysBetween(priorFinish, currentFinish);

      const priorFloat = getFloat(prior);
      const currentFloat = getFloat(current);
      const floatVariance = Math.round((currentFloat - priorFloat) * 10) / 10;
      const floatLoss =
        Math.round(Math.max(0, priorFloat - currentFloat) * 10) / 10;

      const netImpact =
        Math.round(Math.max(0, varianceDays - priorFloat) * 10) / 10;

      return {
        id,
        name: getName(current),
        priorStart,
        currentStart,
        priorFinish,
        currentFinish,
        startVarianceDays,
        varianceDays,
        priorFloat,
        currentFloat,
        floatVariance,
        floatLoss,
        netImpact,
        becameCritical: priorFloat > 0 && currentFloat <= 0,
        isCompletion: false,
      };
    })
    .filter(Boolean);

  const slippedActivities = comparison.filter((item) => item.varianceDays > 0);
  const recoveredActivities = comparison.filter((item) => item.varianceDays < 0);
  const newCriticalActivities = comparison.filter((item) => item.becameCritical);

  const largestSlip = slippedActivities.length
    ? Math.max(...slippedActivities.map((item) => item.varianceDays))
    : 0;

  const largestNetImpact = slippedActivities.length
    ? Math.max(...slippedActivities.map((item) => item.netImpact))
    : 0;

  const completionImpacts = comparison
    .filter(isCompletionActivity)
    .filter((item) => item.varianceDays > 0)
    .sort(
      (a, b) =>
        b.varianceDays - a.varianceDays ||
        b.netImpact - a.netImpact ||
        a.currentFloat - b.currentFloat
    );

  const primaryCompletionImpact =
    completionImpacts.find((item) =>
      item.name?.toUpperCase().includes("PROJECT SUBSTANTIAL COMPLETION")
    ) ||
    completionImpacts.find((item) =>
      item.name?.toUpperCase().includes("CONTRACT COMPLETION")
    ) ||
    completionImpacts.find((item) =>
      item.name?.toUpperCase().includes("FINAL PROJECT COMPLETION")
    ) ||
    completionImpacts[0] ||
    null;

  const symptomActivities = slippedActivities
    .filter(
      (item) =>
        item.varianceDays > 0 &&
        (item.currentFloat <= 10 || item.netImpact > 0 || item.becameCritical)
    )
    .sort(
      (a, b) =>
        b.netImpact - a.netImpact ||
        a.currentFloat - b.currentFloat ||
        b.varianceDays - a.varianceDays
    )
    .slice(0, 10);

    const rootCausePriority = (activity) => {
    const id = activity.id?.toUpperCase() || "";
    const name = activity.name?.toUpperCase() || "";

    let score = 0;

    if (name.includes("LAND ACQUISITION") || name.includes("ACQUISITION")) {
      score += 10000;
    }

    if (id.includes("PERM")) score += 8000;
    if (name.includes("GSA")) score += 7000;
    if (name.includes("HAZMAT")) score += 6000;
    if (name.includes("REMEDIATION")) score += 5000;
    if (name.includes("DEMO") || name.includes("DEMOLITION")) score += 3000;
    if (id.includes("PROC")) score += 2000;
    if (name.includes("APPROVAL") || name.includes("REVIEW")) score += 1500;

    score += Math.max(0, activity.varianceDays || 0);
    score += Math.max(0, activity.floatLoss || 0);

    return score;
  };

  const isDownstreamSymptom = (activity) => {
    const id = activity.id?.toUpperCase() || "";
    const name = activity.name?.toUpperCase() || "";

    return (
      id.includes("PCLO") ||
      id.includes("PMILE1200") ||
      id.includes("PMILE1210") ||
      name.includes("FINAL SITE CLEANUP") ||
      name.includes("DEMOBILIZATION") ||
      name.includes("SUBSTANTIAL COMPLETION") ||
      name.includes("CONTRACT COMPLETION") ||
      name.includes("FINAL PROJECT COMPLETION") ||
      name.includes("PHASED OPENING")
    );
  };

  const rootCauseDrivers = slippedActivities
    .filter((item) => {
      if (isDownstreamSymptom(item)) return false;
      if (!isRootCauseCandidate(item)) return false;

      return (
        item.varianceDays > 14 ||
        item.startVarianceDays > 14 ||
        item.floatLoss > 10 ||
        item.becameCritical
      );
    })
    .sort((a, b) => rootCausePriority(b) - rootCausePriority(a))
    .slice(0, 10);

  const primaryRootCause =
    rootCauseDrivers.find((item) => {
      const name = item.name?.toUpperCase() || "";
      return name.includes("LAND ACQUISITION") || name.includes("ACQUISITION");
    }) ||
    rootCauseDrivers[0] ||
    null;
  function createIssuesFromTiaDrivers() {
    if (!updateCurrentProjectData) {
      alert("Unable to create issues from this page.");
      return;
    }

    const issueSourceActivities =
      rootCauseDrivers.length > 0 ? rootCauseDrivers : symptomActivities;

    if (issueSourceActivities.length === 0) {
      alert("No TIA drivers are available to create issues.");
      return;
    }

    const existingIssueKeys = new Set(
      issues.map(
        (issue) =>
          `${issue.source}-${issue.scheduleDeltaType}-${issue.activityId}`
      )
    );

    const newIssues = issueSourceActivities
      .filter(
        (activity) =>
          !existingIssueKeys.has(
            `TIA Intelligence-Potential TIA Driver-${activity.id}`
          )
      )
      .map((activity, index) => ({
        id: Date.now() + index,
        title: `Potential TIA Driver: ${activity.name}`,
        source: "TIA Intelligence",
        scheduleDeltaType: "Potential TIA Driver",
        activityId: activity.id,
        start: activity.currentStart || "",
        finish: activity.currentFinish || "",
        totalFloat: activity.currentFloat ?? "",
        milestone: "Unassigned",
        status: "Open",
        manuallyEscalated: false,
        createdAt: new Date().toISOString(),
        notes: `TIA Intelligence identified this activity as a potential time impact driver. Previous start: ${activity.priorStart}. Current start: ${activity.currentStart}. Previous finish: ${activity.priorFinish}. Current finish: ${activity.currentFinish}. Start variance: ${activity.startVarianceDays} calendar days. Finish variance: ${activity.varianceDays} calendar days. Prior float: ${activity.priorFloat}. Current float: ${activity.currentFloat}. Float variance: ${activity.floatVariance} days. Estimated net impact: ${activity.netImpact} calendar days.`,
      }));

    if (newIssues.length === 0) {
      alert("Open TIA driver issues already exist for these activities.");
      return;
    }

    updateCurrentProjectData({
      issues: [...issues, ...newIssues],
    });

    alert(`${newIssues.length} TIA driver issue(s) created.`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>TIA Intelligence</h1>
        <p>Monthly schedule impact comparison</p>
      </div>

      <div className="data-card">
        <h2>Schedule Comparison Status</h2>
        <p>Total snapshots found: {snapshots.length}</p>
        <p>Prior activities: {priorActivities.length}</p>
        <p>Current activities: {currentActivities.length}</p>
        <p>Matched activities compared: {comparison.length}</p>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Completion Impact</h3>
          <div className="metric-value">
            {primaryCompletionImpact
              ? `${primaryCompletionImpact.varianceDays} days`
              : "0 days"}
          </div>
        </div>

        <div className="metric-card">
          <h3>Slipped Activities</h3>
          <div className="metric-value">{slippedActivities.length}</div>
        </div>

        <div className="metric-card">
          <h3>Recovered Activities</h3>
          <div className="metric-value">{recoveredActivities.length}</div>
        </div>

        <div className="metric-card">
          <h3>New Critical Activities</h3>
          <div className="metric-value">{newCriticalActivities.length}</div>
        </div>

        <div className="metric-card">
          <h3>Largest Slip</h3>
          <div className="metric-value">{largestSlip} days</div>
        </div>

        <div className="metric-card">
          <h3>Largest Net Impact</h3>
          <div className="metric-value">{largestNetImpact} days</div>
        </div>
      </div>

      <div className="data-card">
        <h2>Layer 1 – Schedule Delta / Symptom Activities</h2>

        <button
          type="button"
          className="secondary-button small-button"
          onClick={createIssuesFromTiaDrivers}
          disabled={
            rootCauseDrivers.length === 0 && symptomActivities.length === 0
          }
        >
          Create Issues from TIA Drivers
        </button>

        <table className="data-table">
          <thead>
            <tr>
              <th>Activity ID</th>
              <th>Name</th>
              <th>Prior Finish</th>
              <th>Current Finish</th>
              <th>Finish Variance</th>
              <th>Prior Float</th>
              <th>Current Float</th>
              <th>Float Variance</th>
              <th>Net Impact</th>
            </tr>
          </thead>

          <tbody>
            {symptomActivities.length === 0 ? (
              <tr>
                <td colSpan="9">No symptom activities found.</td>
              </tr>
            ) : (
              symptomActivities.map((activity) => (
                <tr key={activity.id}>
                  <td>{activity.id}</td>
                  <td>{activity.name}</td>
                  <td>{activity.priorFinish}</td>
                  <td>{activity.currentFinish}</td>
                  <td>{activity.varianceDays} days</td>
                  <td>{activity.priorFloat}</td>
                  <td>{activity.currentFloat}</td>
                  <td>{activity.floatVariance} days</td>
                  <td>{activity.netImpact} days</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="data-card">
        <h2>Layer 2 – Root Cause Delay Drivers</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Activity ID</th>
              <th>Name</th>
              <th>Prior Start</th>
              <th>Current Start</th>
              <th>Start Variance</th>
              <th>Prior Finish</th>
              <th>Current Finish</th>
              <th>Finish Variance</th>
              <th>Float Loss</th>
            </tr>
          </thead>

          <tbody>
            {rootCauseDrivers.length === 0 ? (
              <tr>
                <td colSpan="9">
                  No root cause delay drivers identified. This version uses
                  rule-based screening until predecessor/successor tracing is
                  added from the XER relationship data.
                </td>
              </tr>
            ) : (
              rootCauseDrivers.map((activity) => (
                <tr key={activity.id}>
                  <td>{activity.id}</td>
                  <td>{activity.name}</td>
                  <td>{activity.priorStart || "N/A"}</td>
                  <td>{activity.currentStart || "N/A"}</td>
                  <td>{activity.startVarianceDays} days</td>
                  <td>{activity.priorFinish || "N/A"}</td>
                  <td>{activity.currentFinish || "N/A"}</td>
                  <td>{activity.varianceDays} days</td>
                  <td>{activity.floatLoss} days</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="data-card">
        <h2>Layer 3 – Draft TIA Narrative</h2>

        {primaryCompletionImpact && (
          <div className="info-box">
            <strong>Primary Completion Impact:</strong>{" "}
            {primaryCompletionImpact.id} – {primaryCompletionImpact.name} moved
            from {primaryCompletionImpact.priorFinish} to{" "}
            {primaryCompletionImpact.currentFinish}, indicating a completion
            movement of {primaryCompletionImpact.varianceDays} calendar days.
          </div>
        )}

        {primaryRootCause && (
          <div className="info-box">
            <strong>Potential Root Cause Delay Event:</strong>{" "}
            {primaryRootCause.id} – {primaryRootCause.name}
          </div>
        )}

        <p>
          Compared to the prior schedule update, ConstraintOS identified{" "}
          <strong>{slippedActivities.length}</strong> activities with forecast
          finish slippage, <strong>{recoveredActivities.length}</strong>{" "}
          activities with forecast recovery, and{" "}
          <strong>{newCriticalActivities.length}</strong> activities that appear
          to have moved onto or near the critical path.
        </p>

        {primaryCompletionImpact ? (
          <p>
            The primary completion activity identified in this comparison is{" "}
            <strong>{primaryCompletionImpact.id}</strong> –{" "}
            <strong>{primaryCompletionImpact.name}</strong>. This activity moved
            from <strong>{primaryCompletionImpact.priorFinish}</strong> to{" "}
            <strong>{primaryCompletionImpact.currentFinish}</strong>, reflecting
            a projected completion impact of{" "}
            <strong>{primaryCompletionImpact.varianceDays}</strong> calendar
            days.
          </p>
        ) : (
          <p>
            No clear project completion milestone movement was identified from
            the available schedule comparison data.
          </p>
        )}

        {primaryRootCause ? (
          <p>
            The likely root cause delay chain appears to originate with{" "}
            <strong>{primaryRootCause.id}</strong> –{" "}
            <strong>{primaryRootCause.name}</strong>. This activity moved from a
            prior finish of <strong>{primaryRootCause.priorFinish}</strong> to a
            current finish of <strong>{primaryRootCause.currentFinish}</strong>.
            The delay appears to affect downstream work and should be reviewed
            against project records, owner decisions, design releases,
            procurement impacts, site access constraints, and other
            contemporaneous documentation.
          </p>
        ) : (
          <p>
            ConstraintOS did not identify a clear root cause delay driver using
            the current rule-based screening. The schedule should be reviewed
            for changed logic, added fragnet activities, owner-caused
            constraints, procurement impacts, and delayed predecessor activities.
          </p>
        )}

        {rootCauseDrivers.length > 0 && (
          <>
            <p>
              The following activities appear to be potential root cause or
              upstream delay drivers:
            </p>

            <ul>
              {rootCauseDrivers.slice(0, 5).map((activity) => (
                <li key={activity.id}>
                  <strong>{activity.id}</strong> — {activity.name} moved from{" "}
                  <strong>{activity.priorFinish || "N/A"}</strong> to{" "}
                  <strong>{activity.currentFinish || "N/A"}</strong>, with a
                  finish variance of{" "}
                  <strong>{activity.varianceDays}</strong> calendar days and a
                  float loss of <strong>{activity.floatLoss}</strong> days.
                </li>
              ))}
            </ul>
          </>
        )}

        {symptomActivities.length > 0 && (
          <>
            <p>
              The following downstream activities appear to be major schedule
              symptoms or completion-path effects:
            </p>

            <ul>
              {symptomActivities.slice(0, 5).map((activity) => (
                <li key={activity.id}>
                  <strong>{activity.id}</strong> — {activity.name} moved from{" "}
                  <strong>{activity.priorFinish || "N/A"}</strong> to{" "}
                  <strong>{activity.currentFinish || "N/A"}</strong>,
                  reflecting a finish variance of{" "}
                  <strong>{activity.varianceDays}</strong> calendar days. The
                  activity moved from <strong>{activity.priorFloat}</strong>{" "}
                  days of float to <strong>{activity.currentFloat}</strong> days
                  of float, with an estimated net impact of{" "}
                  <strong>{activity.netImpact}</strong> calendar days after
                  consideration of prior available float.
                </li>
              ))}
            </ul>
          </>
        )}

        <p>
          This analysis is preliminary. The Layer 1 table identifies schedule
          movement and likely downstream symptoms. The Layer 2 table identifies
          possible upstream root cause drivers. The next review should validate
          the actual predecessor/successor logic, changed constraints, added TIA
          fragnet activities, and contemporaneous project records before using
          this narrative in formal correspondence.
        </p>

        <p className="small-muted-text">
          This narrative is rule-based and preliminary. It is not yet
          AI-generated and should be reviewed before use in formal
          correspondence.
        </p>
      </div>
    </div>
  );
}

export default TIAIntelligence;