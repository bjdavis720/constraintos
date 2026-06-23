import ModuleHeader from "./ModuleHeader.jsx";
function RevenueForecast({
  project = "",
  scheduleSnapshots = [],
  revenueHistory = [],
  milestones = [],
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
  const originalSnapshot =
  scheduleSnapshots.length > 0 ? scheduleSnapshots[0] : null;

const originalForecast = buildMonthlyForecast(originalSnapshot);
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
  if (!scheduleSnapshots || scheduleSnapshots.length < 2) {
    alert("At least two imported pay applications are needed to calculate monthly billing.");
    return;
  }

  const newEntries = [];

  for (let i = 1; i < scheduleSnapshots.length; i++) {
    const previous = scheduleSnapshots[i - 1];
    const current = scheduleSnapshots[i];

    const currentMonth = getSnapshotRevenueMonth(current);
    if (!currentMonth) continue;

    const previousCumulative = getTotalActualCost(previous);
    const currentCumulative = getTotalActualCost(current);
    const monthlyAmount = currentCumulative - previousCumulative;

    const alreadySaved = revenueHistory.some(
      (entry) =>
        entry.month === currentMonth &&
        entry.source === "imported"
    );

    if (!alreadySaved && monthlyAmount !== 0) {
      newEntries.push({
        id: Date.now() + i,
        month: currentMonth,
        amount: monthlyAmount,
        source: "imported",
      });
    }
  }

  if (newEntries.length === 0) {
    alert("No new imported monthly billing amounts were found to save.");
    return;
  }

  updateCurrentProjectData({
    revenueHistory: [...revenueHistory, ...newEntries],
  });

  alert(`${newEntries.length} imported monthly billing amount(s) saved.`);
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
  originalPlannedBilling:
    originalForecast.monthlyTotals[monthKey] || 0,
  currentPlannedBilling,
  previousPlannedBilling,
  monthlyDelta:
  actualBilledByMonth[monthKey] !== undefined
    ? actualBilledByMonth[monthKey] - currentPlannedBilling
    : 0,
      originalCumulative:
  acc.rows.reduce(
    (total, row) => total + Number(row.originalPlannedBilling || 0),
    0
  ) + Number(originalForecast.monthlyTotals[monthKey] || 0),

actualCumulative:
  acc.rows.reduce(
    (total, row) => total + Number(row.actualBilled || 0),
    0
  ) + Number(actualBilledByMonth[monthKey] || 0),

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
const chartWidth = 1600;
const chartHeight = 500;
const chartPaddingX = 120;
const chartTop = 60;
const chartBottom = 420;

function getScurveMaxValue(rows) {
  return Math.max(
    ...rows.flatMap((row) => [
      row.originalCumulative || 0,
      row.actualCumulative || 0,
      row.currentCumulative || 0,
    ]),
    1
  );
}

function getYAxisTicks(maxValue, tickCount = 5) {
  const ticks = [];

  for (let i = 0; i <= tickCount; i++) {
    ticks.push((maxValue / tickCount) * i);
  }

  return ticks;
}

function getPointPosition(row, index, rows, valueKey) {
  const maxValue = getScurveMaxValue(rows);

  const x =
    chartPaddingX +
    (index / Math.max(rows.length - 1, 1)) *
      (chartWidth - chartPaddingX * 2);

  const y =
    chartBottom -
    ((row[valueKey] || 0) / maxValue) * (chartBottom - chartTop);

  return { x, y };
}
function getMilestoneStatusClass(status = "") {
  return String(status).replaceAll(" ", "-").toLowerCase();
}

function getNext90DayMilestones() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ninetyDaysOut = new Date(today);
  ninetyDaysOut.setDate(today.getDate() + 90);

  return (milestones || [])
    .filter((milestone) => !milestone.archived)
    .filter((milestone) => {
      const milestoneDateValue =
        milestone.due ||
        milestone.finish ||
        milestone.date ||
        milestone.targetDate;

      const milestoneDate = milestoneDateValue
        ? new Date(milestoneDateValue)
        : null;

      if (!milestoneDate || Number.isNaN(milestoneDate.getTime())) {
        return false;
      }

      return milestoneDate >= today && milestoneDate <= ninetyDaysOut;
    });
}

function getMilestoneMonthKey(milestone) {
  const milestoneDateValue =
    milestone.due ||
    milestone.finish ||
    milestone.date ||
    milestone.targetDate;

  const milestoneDate = new Date(milestoneDateValue);

  if (Number.isNaN(milestoneDate.getTime())) return null;

  return `${milestoneDate.getFullYear()}-${String(
    milestoneDate.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMilestoneChartPosition(milestone) {
  const monthKey = getMilestoneMonthKey(milestone);
  const rowIndex = forecastRows.findIndex((row) => row.monthKey === monthKey);

  if (rowIndex < 0) return null;

  const row = forecastRows[rowIndex];

  const { x, y } = getPointPosition(
    row,
    rowIndex,
    forecastRows,
    "currentCumulative"
  );

  return {
    x,
    y: y - 22,
    row,
  };
}

function buildLinePath(rows, valueKey) {
  if (!rows.length) return "";

  return rows
    .map((row, index) => {
      const { x, y } = getPointPosition(row, index, rows, valueKey);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}
function scrollToRevenueSection(sectionId) {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

  return (
    <div className="page">
  <ModuleHeader
  logo="revenue-logo.png"
  title="RevenueOS"
  subtitle="REVENUE FORECASTING & CASH FLOW INTELLIGENCE"
  project={project}
  description="Revenue forecasting, billing movement, BAC analysis, and financial risk."
/>
  <div className="revenue-executive-layout">
  <aside className="revenue-executive-sidebar">
    <button
      type="button"
      className="revenue-home-button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("sentinel:navigate-home"))
      }
    >
      🛡️ SentinelOS Home
    </button>

    <div className="revenue-sidebar-section">
      <div className="revenue-sidebar-heading">Revenue</div>

      <button
        type="button"
        className="revenue-nav-item"
        onClick={() => scrollToRevenueSection("revenue-dashboard")}
      >
        📊 Revenue Dashboard
      </button>

      <button
        type="button"
        className="revenue-nav-item"
        onClick={() => scrollToRevenueSection("revenue-history")}
      >
        💾 Revenue History
      </button>
    

      <button
        type="button"
        className="revenue-nav-item"
        onClick={() => scrollToRevenueSection("revenue-scurve")}
      >
        📈 Revenue S-Curve
      </button>
      </div>

      

    <div className="revenue-sidebar-section">
      <div className="revenue-sidebar-heading">Analytics</div>

      <button
        type="button"
        className="revenue-nav-item"
        onClick={() => scrollToRevenueSection("forecast-delta")}
      >
        📉 Forecast Delta
      </button>

      <button
        type="button"
        className="revenue-nav-item"
        onClick={() => scrollToRevenueSection("cost-loaded-activities")}
      >
        🧱 Cost-Loaded Activities
      </button>
    </div>
  </aside>

  <main className="revenue-executive-main">

<div id="revenue-dashboard" className="executive-kpi-grid revenue-kpi-grid">
  <div className="executive-kpi-card">
    <span className="kpi-icon">💵</span>
    <div>
      <h3>Forecast Revenue</h3>
      <strong>{formatCurrency(currentForecast.totalForecastRevenue)}</strong>
    </div>
  </div>

  <div className="executive-kpi-card high">
    <span className="kpi-icon">📉</span>
    <div>
      <h3>Largest Monthly Decrease</h3>
      <strong>{formatDelta(largestMonthlyDecrease)}</strong>
    </div>
  </div>

  <div className="executive-kpi-card">
    <span className="kpi-icon">📊</span>
    <div>
      <h3>Cost-Loaded Activities</h3>
      <strong>{currentForecast.costLoadedActivities.length}</strong>
    </div>
  </div>

  <div className="executive-kpi-card health">
    <span className="kpi-icon">✅</span>
    <div>
      <h3>Revenue History Entries</h3>
      <strong>{revenueHistory.length}</strong>
    </div>
  </div>
</div>

      
<div id="revenue-history" className="data-card">
  <h2>Revenue History</h2>

  <form className="entry-form" onSubmit={addManualRevenueHistory}>
    <input type="month" name="month" />
    <input type="number" name="amount" placeholder="Revenue amount" />
    <button type="submit">Add Revenue</button>
  </form>
  <div style={{ marginBottom: "16px" }}>
  <button
    type="button"
    className="secondary-button"
    onClick={saveImportedRevenueDelta}
  >
    Save Imported Monthly Revenue
  </button>

  <p
    style={{
      marginTop: "8px",
      fontSize: "0.9rem",
      color: "#666",
    }}
  >
    Uses imported pay application snapshots to calculate monthly
    revenue from cumulative billings. Requires at least two imported
    schedules.
  </p>
</div>

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


            
<div id="revenue-scurve" className="data-card">
  <h2>Revenue S-Curve</h2>
  <p>
    Cumulative comparison of original planned revenue, actual billed revenue,
    and current forecast revenue.
  </p>

  <svg
  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
  preserveAspectRatio="none"
  className="revenue-scurve"
>
  {getYAxisTicks(getScurveMaxValue(forecastRows)).map((tick) => {
    const y =
      chartBottom -
      ((tick || 0) / getScurveMaxValue(forecastRows)) *
        (chartBottom - chartTop);

    return (
      <g key={`y-${tick}`}>
        <line
          x1={chartPaddingX}
          x2={chartWidth - chartPaddingX}
          y1={y}
          y2={y}
          className="scurve-grid-line"
        />
        <text
          x={chartPaddingX - 16}
          y={y + 4}
          textAnchor="end"
          className="scurve-axis-label"
        >
          {formatCurrency(tick)}
        </text>
      </g>
    );
  })}

  {forecastRows.map((row, index) => {
    const { x } = getPointPosition(
      row,
      index,
      forecastRows,
      "currentCumulative"
    );

    return (
      <g key={`x-${row.monthKey}`}>
        <line
          x1={x}
          x2={x}
          y1={chartTop}
          y2={chartBottom}
          className="scurve-month-line"
        />

        {index % 2 === 0 && (
          <text
            x={x}
            y={chartBottom + 34}
            textAnchor="end"
            className="scurve-month-label"
            transform={`rotate(-35 ${x} ${chartBottom + 34})`}
          >
            {row.monthLabel}
          </text>
        )}
      </g>
    );
  })}

  <path
    d={buildLinePath(forecastRows, "originalCumulative")}
    className="scurve-line original"
  />

  <path
    d={buildLinePath(forecastRows, "actualCumulative")}
    className="scurve-line actual"
  />

  <path
    d={buildLinePath(forecastRows, "currentCumulative")}
    className="scurve-line forecast"
  />

  {["originalCumulative", "actualCumulative", "currentCumulative"].map((key) =>
    forecastRows.map((row, index) => {
      const { x, y } = getPointPosition(row, index, forecastRows, key);

      const className =
        key === "originalCumulative"
          ? "original"
          : key === "actualCumulative"
          ? "actual"
          : "forecast";

      return (
        <circle
          key={`${key}-${row.monthKey}`}
          cx={x}
          cy={y}
          r="3"
          className={`scurve-dot ${className}`}
        />
      );
    })
  )}
    {getNext90DayMilestones().map((milestone, milestoneIndex, milestoneArray) => {
  const position = getMilestoneChartPosition(milestone);

  if (!position) return null;

  const statusClass = getMilestoneStatusClass(milestone.status);
  const milestoneMonthKey = getMilestoneMonthKey(milestone);

  const sameMonthIndex = milestoneArray
    .filter((item) => getMilestoneMonthKey(item) === milestoneMonthKey)
    .findIndex((item) => item.id === milestone.id);

  const offsetX = sameMonthIndex * 22;
  const offsetY = sameMonthIndex * -12;

  return (
    <g
      key={`milestone-${milestone.id}`}
      className={`scurve-milestone ${statusClass}`}
    >
      <title>
        {`${milestone.name}
Date: ${milestone.due || milestone.finish || "-"}
Status: ${milestone.status || "Not Set"}
Source: Pull Plan / Next 90 Days`}
      </title>

      {["at-risk", "off-track"].includes(statusClass) && (
  <line
    x1={position.x + offsetX}
    x2={position.x + offsetX}
    y1={position.y + offsetY + 12}
    y2={chartBottom}
    className={`scurve-milestone-risk-line ${statusClass}`}
  />
)}

<rect
  x={position.x + offsetX - 7}
  y={position.y + offsetY - 7}
  width="14"
  height="14"
  transform={`rotate(45 ${position.x + offsetX} ${
    position.y + offsetY
  })`}
  className={`scurve-milestone-diamond ${statusClass}`}
/>
    </g>
  );
})}

  <line
    x1={chartPaddingX}
    x2={chartWidth - chartPaddingX}
    y1={chartBottom}
    y2={chartBottom}
    className="scurve-axis"
  />
  <line
    x1={chartPaddingX}
    x2={chartPaddingX}
    y1={chartTop}
    y2={chartBottom}
    className="scurve-axis"
  />
</svg>

  <div className="revenue-chart-legend">
    <span className="legend-item original">Original Plan</span>
    <span className="legend-item actual">Actual Billed</span>
    <span className="legend-item forecast">Current Forecast</span>
  </div>
</div>
      <div id="forecast-delta" className="data-card">
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

      <div id="cost-loaded-activities" className="data-card">
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

        </main>
  </div>
</div>
  );
}

export default RevenueForecast;