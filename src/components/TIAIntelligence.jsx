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

  const getFloat = (activity) =>
    Number(
      activity.totalFloat ??
        activity.float ??
        activity.TotalFloat ??
        activity.remainingFloat ??
        0
    );

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

      const priorFinish = getFinish(prior);
      const currentFinish = getFinish(current);

      if (!priorFinish || !currentFinish) return null;

      const varianceDays = Math.round(
        (new Date(currentFinish) - new Date(priorFinish)) /
          (1000 * 60 * 60 * 24)
      );

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
        priorFinish,
        currentFinish,
        varianceDays,
        priorFloat,
        currentFloat,
        floatVariance,
        floatLoss,
        netImpact,
        becameCritical: priorFloat > 0 && currentFloat <= 0,
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

  const likelyTiaDrivers = slippedActivities
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

  function createIssuesFromTiaDrivers() {
    if (!updateCurrentProjectData) {
      alert("Unable to create issues from this page.");
      return;
    }

    if (likelyTiaDrivers.length === 0) {
      alert("No likely TIA drivers are available to create issues.");
      return;
    }

    const existingIssueKeys = new Set(
      issues.map(
        (issue) =>
          `${issue.source}-${issue.scheduleDeltaType}-${issue.activityId}`
      )
    );

    const newIssues = likelyTiaDrivers
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
        start: "",
        finish: activity.currentFinish || "",
        totalFloat: activity.currentFloat ?? "",
        milestone: "Unassigned",
        status: "Open",
        manuallyEscalated: false,
        createdAt: new Date().toISOString(),
        notes: `TIA Intelligence identified this activity as a potential time impact driver. Previous finish: ${activity.priorFinish}. Current finish: ${activity.currentFinish}. Finish variance: ${activity.varianceDays} calendar days. Prior float: ${activity.priorFloat}. Current float: ${activity.currentFloat}. Float variance: ${activity.floatVariance} days. Estimated net impact: ${activity.netImpact} calendar days.`,
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
        <h2>Likely TIA Drivers</h2>

        <button
          type="button"
          className="secondary-button small-button"
          onClick={createIssuesFromTiaDrivers}
          disabled={likelyTiaDrivers.length === 0}
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
            {likelyTiaDrivers.length === 0 ? (
              <tr>
                <td colSpan="9">No likely TIA drivers found.</td>
              </tr>
            ) : (
              likelyTiaDrivers.map((activity) => (
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
        <h2>Preliminary Draft TIA Narrative</h2>

        <p>
          Compared to the prior schedule update, ConstraintOS identified{" "}
          <strong>{slippedActivities.length}</strong> activities with forecast
          finish slippage, <strong>{recoveredActivities.length}</strong>{" "}
          activities with forecast recovery, and{" "}
          <strong>{newCriticalActivities.length}</strong> activities that appear
          to have moved onto or near the critical path.
        </p>

        <p>
          The largest activity-level finish movement identified was{" "}
          <strong>{largestSlip} calendar days</strong>.  The largest estimated
          net time impact after consideration of prior available float was{" "}
          <strong>{largestNetImpact} calendar days</strong>.  Activities with
          forecast finish slippage, float erosion, low remaining float, or new
          critical / near-critical status should be reviewed as potential time
          impact drivers.
        </p>

        {likelyTiaDrivers.length > 0 ? (
          <>
            <p>
              Based on the current comparison, the following activities appear
              to be the most likely schedule impact drivers:
            </p>

            <ul>
              {likelyTiaDrivers.slice(0, 5).map((activity) => (
                <li key={activity.id}>
                  <strong>{activity.id}</strong> — {activity.name} moved from{" "}
                  <strong>{activity.priorFinish || "N/A"}</strong> to{" "}
                  <strong>{activity.currentFinish || "N/A"}</strong>,
                  reflecting a finish variance of{" "}
                  <strong>{activity.varianceDays}</strong> calendar days.  The
                  activity moved from <strong>{activity.priorFloat}</strong>{" "}
                  days of float to <strong>{activity.currentFloat}</strong> days
                  of float, with an estimated net impact of{" "}
                  <strong>{activity.netImpact}</strong> calendar days after
                  consideration of prior available float.
                </li>
              ))}
            </ul>

            <p>
              These activities should be reviewed against project records, delay
              event documentation, owner decisions, design releases, procurement
              impacts, site access constraints, and any other contemporaneous
              records before determining whether a formal Time Impact Analysis
              is warranted.
            </p>
          </>
        ) : (
          <p>
            No likely TIA drivers were identified from the current schedule
            comparison.  This may mean there were no measurable forecast finish
            changes, or that the prior and current schedule snapshots are not
            yet being compared correctly.
          </p>
        )}

        <p className="small-muted-text">
          This narrative is rule-based and preliminary.  It is not yet
          AI-generated and should be reviewed before use in formal
          correspondence.
        </p>
      </div>
    </div>
  );
}

export default TIAIntelligence;