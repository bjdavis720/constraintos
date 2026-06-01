function RevenueForecast({
  scheduleSnapshots = [],
  revenueHistory = [],
  updateCurrentProjectData,
}) {
  const previousSnapshot =
    scheduleSnapshots.length >= 2
      ? scheduleSnapshots[scheduleSnapshots.length - 2]
      : null;

  const latestSnapshot =
    scheduleSnapshots.length > 0
      ? scheduleSnapshots[scheduleSnapshots.length - 1]
      : null;

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  }

  function formatDelta(value) {
    const number = Number(value || 0);
    const formatted = formatCurrency(Math.abs(number));

    if (number > 0) return `+${formatted}`;
    if (number < 0) return `-${formatted}`;

    return formatCurrency(0);
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
function getSnapshotActivities(snapshot) {
  return (
    snapshot?.activities ||
    snapshot?.scheduleActivities ||
    snapshot?.rows ||
    snapshot?.data ||
    []
  );
}
function formatMonthLabel(monthKey) {
  const date = new Date(`${monthKey}-01T00:00:00`);

  return date.toLocaleString("default", {
    month: "short",
    year: "numeric",
  });
}
function shiftMonthKeyForward(monthKey) {
  const date = new Date(`${monthKey}-01T00:00:00`);

  date.setMonth(date.getMonth() + 1);

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}
function getActivityActualCost(activity) {
  return (
    Number(activity.actualCost || 0) ||
    Number(activity.actualTotalCost || 0) ||
    Number(activity.actual_total_cost || 0) ||
    Number(activity.actCost || 0) ||
    Number(activity.act_cost || 0) ||
    0
  );
}

function getTotalActualCost(snapshot) {
  const activities = getSnapshotActivities(snapshot);

  return activities.reduce((total, activity) => {
    return total + getActivityActualCost(activity);
  }, 0);
}

  function buildMonthlyForecast(snapshot) {
    const activities = getSnapshotActivities(snapshot);
    const costLoadedActivities = activities.filter(
  (activity) => Number(activity.budgetAtCompletion || 0) !== 0
);

    const monthlyTotals = {};

    costLoadedActivities.forEach((activity) => {
      const months = getMonthsBetween(activity.start, activity.finish);
      const budget = Number(activity.budgetAtCompletion || 0);

      if (months.length === 0 || budget === 0) return;

      const monthlyValue = budget / months.length;

      months.forEach((monthKey) => {
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = 0;
        }

        monthlyTotals[monthKey] += monthlyValue;
      });
    });

    const totalForecastRevenue = costLoadedActivities.reduce(
  (total, activity) => total + Number(activity.budgetAtCompletion || 0),
  0
);

return {
  activities,
  costLoadedActivities,
  monthlyTotals,
  totalForecastRevenue,
};
  }

  const currentForecast = buildMonthlyForecast(latestSnapshot);
  const previousForecast = buildMonthlyForecast(previousSnapshot);
const previousActualCost = getTotalActualCost(previousSnapshot);
const currentActualCost = getTotalActualCost(latestSnapshot);

const actualRevenueDelta =
  currentActualCost - previousActualCost;
  console.log("Previous Actual Cost", previousActualCost);
console.log("Current Actual Cost", currentActualCost);
console.log("Actual Revenue Delta", actualRevenueDelta);

console.log(
  "Previous Snapshot Sample",
  getSnapshotActivities(previousSnapshot)?.[0]
);

console.log(
  "Current Snapshot Sample",
  getSnapshotActivities(latestSnapshot)?.[0]
);

const manualActualBilledByMonth = revenueHistory.reduce((totals, entry) => {
  totals[entry.month] = (totals[entry.month] || 0) + Number(entry.amount || 0);
  return totals;
}, {});

function getSnapshotRevenueMonth(snapshot) {
  const fileName = snapshot?.fileName || "";

  const match = fileName.match(/_(\d{2})(\d{2})/);

  if (!match) return null;

  const month = match[1];
  const year = `20${match[2]}`;

  return `${year}-${month}`;
}

const importedRevenueMonth = getSnapshotRevenueMonth(latestSnapshot);

const actualBilledByMonth = {
  ...manualActualBilledByMonth,
};

if (importedRevenueMonth && actualRevenueDelta !== 0) {
  actualBilledByMonth[importedRevenueMonth] =
    (actualBilledByMonth[importedRevenueMonth] || 0) + actualRevenueDelta;
}
function saveImportedRevenueDelta() {
  if (!importedRevenueMonth || actualRevenueDelta === 0) {
    alert("No imported revenue delta is available to save.");
    return;
  }

  const existingImportedEntry = revenueHistory.find(
    (entry) => entry.month === importedRevenueMonth && entry.source === "imported"
  );

  if (existingImportedEntry) {
    alert("Imported revenue has already been saved for this month.");
    return;
  }

  const newEntry = {
    id: Date.now(),
    month: importedRevenueMonth,
    amount: actualRevenueDelta,
    source: "imported",
  };

  updateCurrentProjectData({
    revenueHistory: [...revenueHistory, newEntry],
  });

  alert("Imported revenue delta saved to Revenue History.");
}
  const allMonthKeys = Array.from(
  new Set([
    ...Object.keys(previousForecast.monthlyTotals),
    ...Object.keys(currentForecast.monthlyTotals),
    ...Object.keys(actualBilledByMonth),
  ])
).sort();

  const forecastRows = allMonthKeys.reduce(
  (acc, monthKey) => {
    const currentPlannedBilling =
  currentForecast.monthlyTotals[monthKey] ||
  previousForecast.monthlyTotals[monthKey] ||
  actualBilledByMonth[monthKey] ||
  0;

    const previousPlannedBilling =
  previousForecast.monthlyTotals[monthKey] ||
  currentForecast.monthlyTotals[monthKey] ||
  actualBilledByMonth[monthKey] ||
  0;

    const currentCumulative =
  acc.currentCumulative +
  (actualBilledByMonth[monthKey] !== undefined
    ? actualBilledByMonth[monthKey]
    : currentPlannedBilling);

    const previousCumulative =
      acc.previousCumulative + previousPlannedBilling;

    const date = new Date(`${monthKey}-01`);

    acc.rows.push({
      monthKey,
monthLabel: formatMonthLabel(monthKey),
actualBilled: actualBilledByMonth[monthKey] || 0,
      currentPlannedBilling,
      previousPlannedBilling,
      monthlyDelta:
  actualBilledByMonth[monthKey] !== undefined
    ? actualBilledByMonth[monthKey] - currentPlannedBilling
    : 0,
      currentCumulative,
      previousCumulative,
      cumulativeDelta:
        currentCumulative - previousCumulative,
    });

    return {
      rows: acc.rows,
      currentCumulative,
      previousCumulative,
      cumulativeDelta:
        currentCumulative - previousCumulative,
    };
  },
  {
    rows: [],
    currentCumulative: 0,
    previousCumulative: 0,
    cumulativeDelta: 0,
  }
).rows;

  const totalRevenueDelta =
    currentForecast.totalForecastRevenue -
    previousForecast.totalForecastRevenue;

  const largestMonthlyIncrease = forecastRows.reduce(
    (max, row) => Math.max(max, row.monthlyDelta),
    0
  );

  const largestMonthlyDecrease = forecastRows.reduce(
    (min, row) => Math.min(min, row.monthlyDelta),
    0
  );
function addManualRevenueHistory(e) {
  e.preventDefault();

  const formData = new FormData(e.currentTarget);
  const month = formData.get("month");
  const amount = Number(formData.get("amount") || 0);

  if (!month || amount === 0) {
    alert("Please enter a month and revenue amount.");
    return;
  }

  const newEntry = {
    id: Date.now(),
    month,
    amount,
    source: "manual",
  };

  updateCurrentProjectData({
    revenueHistory: [...revenueHistory, newEntry],
  });

  e.currentTarget.reset();
}

function deleteRevenueHistoryEntry(id) {
  updateCurrentProjectData({
    revenueHistory: revenueHistory.filter((entry) => entry.id !== id),
  });
}
  return (
    <div className="page">
      <div className="page-header">
        <h1>Revenue Forecast</h1>
        <p>Projected monthly billings from imported XER cost-loaded activities</p>
      </div>

      <div className="data-card">
        <h2>Forecast Source</h2>
        <p>
          Current snapshot:{" "}
          <strong>{latestSnapshot?.fileName || "No schedule uploaded"}</strong>
        </p>
        <p>
          Prior snapshot:{" "}
          <strong>{previousSnapshot?.fileName || "No prior snapshot"}</strong>
        </p>
        <p>Current activities: {currentForecast.activities.length}</p>
        <p>
          Current cost-loaded activities:{" "}
          {currentForecast.costLoadedActivities.length}
        </p>
      </div>
      <div className="data-card">
  <h2>Forecast Source</h2>
  ...
</div>

{/* INSERT REVENUE HISTORY CARD HERE */}

<div className="data-card">
  <h2>Revenue History</h2>

  <form className="entry-form" onSubmit={addManualRevenueHistory}>
    <input type="month" name="month" />
    <input type="number" name="amount" placeholder="Revenue amount" />
    <button type="submit">Add Revenue</button>
  </form>

  {revenueHistory.length === 0 ? (
    <p>No revenue history has been saved yet.</p>
  ) : (
    <table className="data-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Revenue</th>
          <th>Source</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {[...revenueHistory]
          .sort((a, b) => a.month.localeCompare(b.month))
          .map((entry) => (
            <tr key={entry.id}>
              <td>{formatMonthLabel(entry.month)}</td>
              <td>{formatCurrency(entry.amount)}</td>
              <td>{entry.source}</td>
              <td>
                {entry.source === "manual" ? (
                  <button
                    type="button"
                    className="small-button"
                    onClick={() => deleteRevenueHistoryEntry(entry.id)}
                  >
                    Delete
                  </button>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  )}
</div>

<div className="metrics-grid"></div>

            <div className="metrics-grid">
              <div className="metric-card">
  <h3>Actual Revenue Delta</h3>
  <button
  type="button"
  className="secondary-button"
  onClick={saveImportedRevenueDelta}
>
  Save Imported Revenue
</button>

  <div className="metric-value">
    {formatCurrency(actualRevenueDelta)}
  </div>
</div>


  <div className="metric-card">
    <h3>Current Forecast Revenue</h3>

    <div className="metric-value">
      {formatCurrency(currentForecast.totalForecastRevenue)}
    </div>
  </div>

        <div className="metric-card">
          <h3>Largest Monthly Decrease</h3>
          <div className="metric-value">
            {formatDelta(largestMonthlyDecrease)}
          </div>
        </div>
      </div>

      <div className="data-card">
        <h2>Monthly Revenue Forecast Delta</h2>

        {forecastRows.length === 0 ? (
          <p>
            No revenue forecast is available yet.  Re-import a cost-loaded XER
            after updating the parser so activities include budget at completion
            values.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Actual Billed</th>
                <th>Current Forecast</th>
                <th>Monthly Delta</th>
                <th>Prior Cumulative</th>
                <th>Current Cumulative</th>
                <th>Cumulative Delta</th>
              </tr>
            </thead>

            <tbody>
              {forecastRows.map((row) => (
                <tr key={row.monthKey}>
                  <td>{row.monthLabel}</td>
                  <td>{formatCurrency(row.actualBilled)}</td>
                  <td>{formatCurrency(row.currentPlannedBilling)}</td>
                  <td>{formatDelta(row.monthlyDelta)}</td>
                  <td>{formatCurrency(row.previousCumulative)}</td>
                  <td>{formatCurrency(row.currentCumulative)}</td>
                  <td>{formatDelta(row.cumulativeDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="data-card">
        <h2>Top Current Cost-Loaded Activities</h2>

        {currentForecast.costLoadedActivities.length === 0 ? (
          <p>No cost-loaded activities found in the current snapshot.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Activity ID</th>
                <th>Activity Name</th>
                <th>Start</th>
                <th>Finish</th>
                <th>Budget at Completion</th>
              </tr>
            </thead>

            <tbody>
              {[...currentForecast.costLoadedActivities]
                .sort(
                  (a, b) =>
                    Number(b.budgetAtCompletion || 0) -
                    Number(a.budgetAtCompletion || 0)
                )
                .slice(0, 15)
                .map((activity) => (
                  <tr key={activity.activityId}>
                    <td>{activity.activityId}</td>
                    <td>{activity.activityName}</td>
                    <td>{activity.start || "-"}</td>
                    <td>{activity.finish || "-"}</td>
                    <td>{formatCurrency(activity.budgetAtCompletion)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default RevenueForecast;