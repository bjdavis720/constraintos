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
  });

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

  if (escalatedConstraints.length > 0) {
    generatedRisks.push({
      id: crypto.randomUUID(),
      risk: `${escalatedConstraints.length} escalated constraint(s) require executive attention`,
      category: "Executive",
      source: "ConstraintOS",
      confidence: "High",
    });
  }

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
function loadDemoSuggestedRisks() {
  const demoRisks = [
    {
      id: crypto.randomUUID(),
      risk: "Owner-furnished equipment delivery delay",
      category: "Schedule",
      source: "Contract",
      confidence: "High",
      probability: 3,
      impact: 4,
      owner: "Project Executive",
    },
    {
      id: crypto.randomUUID(),
      risk: "CUI compliance requirements not fully defined",
      category: "Compliance",
      source: "Contract",
      confidence: "High",
      probability: 4,
      impact: 5,
      owner: "Project Executive",
    },
  ];

  const openConstraints = constraints.filter(
    (constraint) => constraint.status !== "Closed" && !constraint.archived
  );

  const escalatedConstraints = openConstraints.filter(
    (constraint) => constraint.status === "Escalated"
  );

  const constraintRisks = [];

  if (escalatedConstraints.length > 0) {
    constraintRisks.push({
      id: crypto.randomUUID(),
      risk: `${escalatedConstraints.length} escalated constraint(s) require executive attention`,
      category: "Executive",
      source: "ConstraintOS",
      confidence: "High",
      probability: 3,
      impact: 4,
      owner: "Project Executive",
    });
  }

  const healthReviewItems = Array.isArray(projectHealthOS?.reviewItems)
    ? projectHealthOS.reviewItems
    : [];

  const projectHealthRisks = healthReviewItems
    .filter((item) => item?.status === "Red")
    .map((item) => ({
      id: crypto.randomUUID(),
      risk: `${item?.heading || "Project Health"}: ${
        item?.item || item?.reviewItem || item?.title || "Off Track item"
      } is Off Track`,
      category: "Executive",
      source: "ProjectHealthOS",
      confidence: "High",
      probability: 3,
      impact: 4,
      owner: "Project Executive",
    }));

  const generatedRisks = [
    ...demoRisks,
    ...constraintRisks,
    ...projectHealthRisks,
  ];

  const existingKeys = new Set(
    [
      ...suggestedRisks.map(
        (risk) => `${risk.risk}-${risk.category}-${risk.source}`
      ),
      ...riskPlaybook.map(
        (risk) => `${risk.title}-${risk.category}-${risk.sourceType}`
      ),
    ]
  );

  const newUniqueRisks = generatedRisks.filter(
    (risk) => !existingKeys.has(`${risk.risk}-${risk.category}-${risk.source}`)
  );

  setSuggestedRisks([...suggestedRisks, ...newUniqueRisks]);
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
      probability: risk.probability || 3,
impact: risk.impact || 3,
score: (risk.probability || 3) * (risk.impact || 3),
owner: risk.owner || "Project Executive",
      mitigation: "",
      trigger: "",
      trend: "Stable",
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
        updatedAt: new Date().toISOString(),
      };

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

  const newSource = {
    id: `source-${Date.now()}`,
    name: file.name,
    type: sourceType,
    uploadedAt: new Date().toLocaleDateString(),
    risksGenerated: 0,
  };

  setRiskSources([...riskSources, newSource]);

  e.target.value = "";
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
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <h3>Active Risks</h3>
              <div className="metric-value">{activeRisks.length}</div>
            </div>

            <div className="metric-card">
              <h3>Critical Risks</h3>
              <div className="metric-value">{criticalRisks.length}</div>
            </div>

            <div className="metric-card">
              <h3>No Owner</h3>
              <div className="metric-value">{risksWithoutOwners.length}</div>
            </div>

            <div className="metric-card">
              <h3>Worsening</h3>
              <div className="metric-value">{worseningRisks.length}</div>
            </div>
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div>
                <h2>Executive Risk Brief</h2>
                <p>
                  The highest-priority risks requiring leadership awareness,
                  mitigation, or escalation.
                </p>
              </div>
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
                      <td>{risk.owner || "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="data-card">
            <div className="section-header-row">
              <div>
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
                  <th>Risks Generated</th>
                </tr>
              </thead>
              <tbody>
  {riskSources.length === 0 ? (
    <tr>
      <td colSpan="4">No risk sources uploaded yet.</td>
    </tr>
  ) : (
    riskSources.map((source) => (
      <tr key={source.id}>
        <td>{source.name}</td>
        <td>{source.type}</td>
        <td>{source.uploadedAt}</td>
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
                    probability: 3,
                    impact: 3,
                    score: 9,
                    owner: "",
                    status: "Open",
                    trend: "Stable",
                    mitigation: "",
                    trigger: "",
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
                <h2>Add Risk</h2>
                <p>
                  Manually add a risk when it has not yet been generated by a
                  source document or Sentinel module.
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
              <div>
                <h2>Project Risk Playbook</h2>
                <p>
                  A living executive risk playbook from pursuit through
                  completion.
                </p>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Category</th>
                  <th>Source Type</th>
                  <th>Source</th>
                  <th>Probability</th>
                  <th>Impact</th>
                  <th>Score</th>
                  <th>Level</th>
                  <th>Trend</th>
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
                    <td colSpan="14">No risks added yet.</td>
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
                          value={risk.trend || "Stable"}
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