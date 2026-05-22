function RevenueForecast({ scheduleSnapshots = [] }) {
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

  function buildMonthlyForecast(snapshot) {
    const activities = snapshot?.rows || [];
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

console.log(
  "Top BAC Activities",
  [...costLoadedActivities]
    .sort(
      (a, b) =>
        Number(b.budgetAtCompletion || 0) -
        Number(a.budgetAtCompletion || 0)
    )
    .slice(0, 25)
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

  const allMonthKeys = Array.from(
    new Set([
      ...Object.keys(previousForecast.monthlyTotals),
      ...Object.keys(currentForecast.monthlyTotals),
    ])
  ).sort();

  let currentCumulative = 0;
  let previousCumulative = 0;

  const forecastRows = allMonthKeys.map((monthKey) => {
    const currentPlannedBilling =
      currentForecast.monthlyTotals[monthKey] || 0;
    const previousPlannedBilling =
      previousForecast.monthlyTotals[monthKey] || 0;

    currentCumulative += currentPlannedBilling;
    previousCumulative += previousPlannedBilling;

    const date = new Date(`${monthKey}-01`);

    return {
      monthKey,
      monthLabel: date.toLocaleString("default", {
        month: "short",
        year: "numeric",
      }),
      currentPlannedBilling,
      previousPlannedBilling,
      monthlyDelta: currentPlannedBilling - previousPlannedBilling,
      currentCumulative,
      previousCumulative,
      cumulativeDelta: currentCumulative - previousCumulative,
    };
  });

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

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Current Forecast Revenue</h3>
          <div className="metric-value">
            {formatCurrency(currentForecast.totalForecastRevenue)}
          </div>
        </div>

        <div className="metric-card">
          <h3>Prior Forecast Revenue</h3>
          <div className="metric-value">
            {formatCurrency(previousForecast.totalForecastRevenue)}
          </div>
        </div>

        <div className="metric-card">
          <h3>Total Revenue Delta</h3>
          <div className="metric-value">{formatDelta(totalRevenueDelta)}</div>
        </div>

        <div className="metric-card">
          <h3>Largest Monthly Increase</h3>
          <div className="metric-value">
            {formatDelta(largestMonthlyIncrease)}
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
                <th>Prior Forecast</th>
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
                  <td>{formatCurrency(row.previousPlannedBilling)}</td>
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