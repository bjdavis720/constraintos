import { useState } from "react";

function RevenueForecast() {
  const [contractValue, setContractValue] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");

  const value = Number(contractValue || 0);

  function getMonthsBetween(start, end) {
    if (!start || !end) return [];

    const months = [];
    const current = new Date(`${start}-01`);
    const last = new Date(`${end}-01`);

    while (current <= last) {
      months.push({
        key: current.toISOString().slice(0, 7),
        label: current.toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
      });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  const months = getMonthsBetween(startMonth, endMonth);
  const monthlyBilling = months.length > 0 ? value / months.length : 0;

  let cumulative = 0;

  const forecastRows = months.map((month) => {
    cumulative += monthlyBilling;

    return {
      ...month,
      plannedBilling: monthlyBilling,
      cumulativeBilling: cumulative,
      percentComplete: value > 0 ? (cumulative / value) * 100 : 0,
    };
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Revenue Forecast</h1>
        <p>Projected monthly billings across the life of the project</p>
      </div>

      <div className="card">
        <h3>Forecast Inputs</h3>

        <div className="form-grid">
          <label>
            Contract Value
            <input
              type="number"
              value={contractValue}
              onChange={(e) => setContractValue(e.target.value)}
              placeholder="Example: 25000000"
            />
          </label>

          <label>
            Start Month
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
            />
          </label>

          <label>
            End Month
            <input
              type="month"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Contract Value</h3>
          <div className="metric-value">
            {value.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </div>
        </div>

        <div className="metric-card">
          <h3>Forecast Months</h3>
          <div className="metric-value">{months.length}</div>
        </div>

        <div className="metric-card">
          <h3>Avg Monthly Billing</h3>
          <div className="metric-value">
            {monthlyBilling.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      <div className="data-card">
        <h2>Monthly Billing Forecast</h2>

        {forecastRows.length === 0 ? (
          <p>Enter contract value, start month, and end month to generate a forecast.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Planned Billing</th>
                <th>Cumulative Billing</th>
                <th>Percent Complete</th>
              </tr>
            </thead>

            <tbody>
              {forecastRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>
                    {row.plannedBilling.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td>
                    {row.cumulativeBilling.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td>{row.percentComplete.toFixed(1)}%</td>
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