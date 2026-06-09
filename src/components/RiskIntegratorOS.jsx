import { useState } from "react";
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

const riskStatuses = ["Open", "Mitigating", "Escalated", "Closed"];

function RiskIntegratorOS({
  selectedProject,
  riskPlaybook = [],
  setRiskPlaybook,
}) {
  const [riskForm, setRiskForm] = useState({
    title: "",
    category: "Schedule",
    source: "Manual Entry",
    probability: 3,
    impact: 3,
    owner: "",
    mitigation: "",
    trigger: "",
    status: "Open",
  });

  const activeRisks = riskPlaybook.filter((risk) => risk.status !== "Closed");
  const criticalRisks = activeRisks.filter((risk) => risk.score >= 20);
  const highRisks = activeRisks.filter(
    (risk) => risk.score >= 13 && risk.score < 20
  );
  const escalatedRisks = activeRisks.filter(
    (risk) => risk.status === "Escalated"
  );

  function getRiskLevel(score) {
    if (score >= 20) return "Critical";
    if (score >= 13) return "High";
    if (score >= 6) return "Moderate";
    return "Low";
  }

  function getRiskClass(score) {
    if (score >= 20) return "status-pill off-track";
    if (score >= 13) return "status-pill at-risk";
    if (score >= 6) return "status-pill warning";
    return "status-pill on-track";
  }

  function handleFormChange(e) {
    const { name, value } = e.target;

    setRiskForm({
      ...riskForm,
      [name]:
        name === "probability" || name === "impact" ? Number(value) : value,
    });
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
    };

    setRiskPlaybook([...riskPlaybook, newRisk]);

    setRiskForm({
      title: "",
      category: "Schedule",
      source: "Manual Entry",
      probability: 3,
      impact: 3,
      owner: "",
      mitigation: "",
      trigger: "",
      status: "Open",
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
      };

      updatedRisk.score = updatedRisk.probability * updatedRisk.impact;

      return updatedRisk;
    });

    setRiskPlaybook(nextRisks);
  }

  function deleteRisk(id) {
    setRiskPlaybook(riskPlaybook.filter((risk) => risk.id !== id));
  }

  return (
    <div className="page">
      <ModuleHeader
        logo="riskintegrator-logo.png"
        title="RiskIntegratorOS"
        subtitle="Integrated project risk visibility, ownership, mitigation, and escalation."
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
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <h3>Total Active Risks</h3>
              <div className="metric-value">{activeRisks.length}</div>
            </div>

            <div className="metric-card">
              <h3>Critical Risks</h3>
              <div className="metric-value">{criticalRisks.length}</div>
            </div>

            <div className="metric-card">
              <h3>High Risks</h3>
              <div className="metric-value">{highRisks.length}</div>
            </div>

            <div className="metric-card">
              <h3>Escalated Risks</h3>
              <div className="metric-value">{escalatedRisks.length}</div>
            </div>
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div>
                <h2>Risk Sources</h2>
                <p>
                  Store the contracts, permits, pursuit evaluations,
                  specifications, and project data sources that may generate
                  project risk.
                </p>
              </div>
            </div>

            <div className="button-row">
              <button type="button" className="secondary-button">
                + Upload Contract
              </button>
              <button type="button" className="secondary-button">
                + Upload Specification
              </button>
              <button type="button" className="secondary-button">
                + Upload Permit
              </button>
              <button type="button" className="secondary-button">
                + Upload Risk Assessment
              </button>
              <button type="button" className="secondary-button">
                Import Go / No-Go Profile
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Uploaded</th>
                  <th>Risks Generated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="4">No risk sources added yet.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div>
                <h2>Risk Intelligence Engine</h2>
                <p>
                  Analyze contracts, specifications, permits, risk assessments,
                  and pursuit evaluations to identify potential project risks.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={() => alert("AI Risk Analysis coming soon.")}
              >
                Analyze Risk Sources
              </button>
            </div>

            <div className="insight-card">
              <h3>Future Detection Targets</h3>
              <p>
                Notice windows, liquidated damages, compliance requirements,
                owner-provided dependencies, approval constraints, labor
                requirements, cyber/CUI exposure, entitlement risk, and executive
                escalation triggers.
              </p>
            </div>
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div>
                <h2>Add Risk</h2>
                <p>
                  Capture pursuit, contract, compliance, schedule, financial,
                  and execution risks.
                </p>
              </div>
            </div>

            <form className="form-grid" onSubmit={addRisk}>
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
                Source
                <input
                  name="source"
                  value={riskForm.source}
                  onChange={handleFormChange}
                  placeholder="Manual Entry, Contract, Schedule, ProjectHealthOS"
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
                Trigger
                <input
                  name="trigger"
                  value={riskForm.trigger}
                  onChange={handleFormChange}
                  placeholder="What would cause this risk to become active?"
                />
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
              <div>
                <h2>Project Risk Playbook</h2>
                <p>
                  Living risk register connected to pursuit risk, execution
                  risk, compliance risk, and executive escalation.
                </p>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Probability</th>
                  <th>Impact</th>
                  <th>Score</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Mitigation</th>
                  <th>Trigger</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {riskPlaybook.length === 0 ? (
                  <tr>
                    <td colSpan="12">No risks added yet.</td>
                  </tr>
                ) : (
                  riskPlaybook.map((risk) => (
                    <tr key={risk.id}>
                      <td>
                        <input
                          value={risk.title}
                          onChange={(e) =>
                            updateRisk(risk.id, "title", e.target.value)
                          }
                        />
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

                      <td>
                        <input
                          value={risk.source}
                          onChange={(e) =>
                            updateRisk(risk.id, "source", e.target.value)
                          }
                        />
                      </td>

                      <td>
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
                      </td>

                      <td>
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
                      </td>

                      <td>{risk.score}</td>

                      <td>
                        <span className={getRiskClass(risk.score)}>
                          {getRiskLevel(risk.score)}
                        </span>
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
                        <input
                          value={risk.owner}
                          onChange={(e) =>
                            updateRisk(risk.id, "owner", e.target.value)
                          }
                          placeholder="Unassigned"
                        />
                      </td>

                      <td>
                        <textarea
                          value={risk.mitigation}
                          onChange={(e) =>
                            updateRisk(risk.id, "mitigation", e.target.value)
                          }
                        />
                      </td>

                      <td>
                        <textarea
                          value={risk.trigger}
                          onChange={(e) =>
                            updateRisk(risk.id, "trigger", e.target.value)
                          }
                        />
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default RiskIntegratorOS;