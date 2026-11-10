// Patch 05H: budget-only TASKRSRC field-level change preview. No XER writes.
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const fieldValue = (record, name) => (record?.xerFields || []).find(f => f.field === name)?.value ?? null;
export function prepareFieldLevelPreview(audit, preflight, assignmentAudit) {
  if (!audit || !preflight || !assignmentAudit) return null;
  const findings = [];
  const rows = [];
  const holding = preflight.source;
  const holdingStandard = (holding?.assignments || []).filter(r => r.resourceCode === 'MCGSTANDCOSTONLY');
  if (holdingStandard.length !== 1) findings.push('Holding account must have exactly one standard resource assignment.');
  if ((audit.holdingAccounts || []).length !== 1) findings.push('Holding account identification is not unique.');
  const transfer = Number(preflight.summary?.proposedTransfer || 0);
  if (!Number.isFinite(transfer) || transfer <= 0) findings.push('No valid positive transfer amount.');
  if (holdingStandard.length === 1) {
    const r = holdingStandard[0];
    rows.push({activityId:holding.activityId, assignmentId:r.assignmentId, operation:'REVIEW UPDATE EXISTING — HOLDING', field:'target_cost', before:fieldValue(r,'target_cost'), after:round(r.budget-transfer).toFixed(4), delta:round(-transfer), status:'PROPOSED — NOT APPROVED'});
    rows.push({activityId:holding.activityId, assignmentId:r.assignmentId, operation:'HOLDING — REMAINING COST', field:'remain_cost', before:fieldValue(r,'remain_cost'), after:null, delta:null, status:'BLOCKED — POLICY UNDECIDED'});
  }
  for (const activity of assignmentAudit.activities) {
    const matches=activity.assignments.filter(r=>String(r.resourceCode).trim().toUpperCase()==='MCGSTANDCOSTONLY');
    if(matches.length !== 1) {
      findings.push(`${activity.activityId}: ${matches.length} existing standard assignments; cannot determine one update target.`);
      continue;
    }
    const r=matches[0];
    rows.push({activityId:activity.activityId, assignmentId:r.assignmentId, operation:'REVIEW UPDATE EXISTING — RECEIVER', field:'target_cost', before:fieldValue(r,'target_cost'), after:round(r.budget+activity.proposedBudgetAddition).toFixed(4), delta:round(activity.proposedBudgetAddition), status:'PROPOSED — NOT APPROVED'});
    rows.push({activityId:activity.activityId, assignmentId:r.assignmentId, operation:'RECEIVER — REMAINING COST', field:'remain_cost', before:fieldValue(r,'remain_cost'), after:null, delta:null, status:'BLOCKED — POLICY UNDECIDED'});
  }
  const net = round(rows.filter(r=>r.field==='target_cost').reduce((sum,r)=>sum+r.delta,0));
  if(Math.abs(net)>.005) findings.push(`Budget delta is not zero: ${net.toFixed(2)}.`);
  if(preflight.summary.blockers) findings.push(`${preflight.summary.blockers} unresolved preflight blocker(s) remain.`);
  return {rows,findings,netBudgetChange:net,sourceProjectBudget:preflight.summary.projectBudget,exportEnabled:false};
}
