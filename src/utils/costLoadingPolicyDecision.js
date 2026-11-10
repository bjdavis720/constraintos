// Patch 05J — read-only policy decision preview. This module cannot write an XER.
const round = n => Math.round(Number(n) * 100) / 100;
export function prepareRemainingPolicyDecision(audit, preflight, assignmentAudit, comparison, key, acknowledged) {
  if (!audit || !preflight || !assignmentAudit || !comparison || comparison.error || !key) return null;
  const scenario = comparison.scenarios?.find(s => s.key === key);
  if (!scenario) return null;
  const holding = preflight.source;
  const source = holding?.assignments?.find(r=>String(r.assignmentId)===String(comparison.sourceAssignmentId));
  if (!source) return {error:"Holding assignment could not be uniquely identified."};
  const rows = [];
  const add = (activityId, assignmentId, field, before, after) => rows.push({
    activityId, assignmentId, field, before:round(before), after:round(after), delta:round(after-before)
  });
  add(holding.activityId, source.assignmentId, "target_cost", source.budget, comparison.sourceBudgetAfter);
  add(holding.activityId, source.assignmentId, "remain_cost", source.remaining, scenario.holdingRemaining);
  for (const receiver of assignmentAudit.activities) {
    const standard = receiver.assignments.filter(r=>String(r.resourceCode).trim().toUpperCase()==="MCGSTANDCOSTONLY");
    const remaining = scenario.receivers.find(r=>r.activityId===receiver.activityId);
    if (standard.length !== 1 || !remaining || String(remaining.assignmentId)!==String(standard[0].assignmentId)) return {error:`Assignment mismatch for ${receiver.activityId}.`};
    add(receiver.activityId, standard[0].assignmentId, "target_cost", standard[0].budget, standard[0].budget+receiver.proposedBudgetAddition);
    add(receiver.activityId, standard[0].assignmentId, "remain_cost", standard[0].remaining, remaining.remainingAfter);
  }
  const budgetDelta=round(rows.filter(r=>r.field==="target_cost").reduce((s,r)=>s+r.delta,0));
  const remainingDelta=round(rows.filter(r=>r.field==="remain_cost").reduce((s,r)=>s+r.delta,0));
  const remainingConserved=Math.abs(remainingDelta)<.01;
  const budgetConserved=Math.abs(budgetDelta)<.01;
  const issues=[];
  if (!budgetConserved) issues.push("Budget conservation failed.");
  if (key==="reset" && !remainingConserved) issues.push("Reset scenario changes total remaining cost; requires separate forecast authorization.");
  if (key==="preserve") issues.push("Preserve scenario increases budget/remaining discrepancy; P6 import behavior unverified.");
  if (key==="proportional") issues.push("Proportional treatment preserves remaining cost but the source 50% discrepancy remains unexplained.");
  if ((preflight.summary?.blockers||0)>0) issues.push(`${preflight.summary.blockers} preflight blockers remain unresolved.`);
  return {
    scenario:scenario.name, key, acknowledged:Boolean(acknowledged), rows,
    budgetDelta, remainingDelta, budgetConserved, remainingConserved, issues,
    reviewStatus:acknowledged?"DOCUMENTED FOR TEST REVIEW — NOT APPROVED FOR EXPORT":"AWAITING EXPLICIT TEST-POLICY ACKNOWLEDGMENT",
    exportEnabled:false
  };
}
