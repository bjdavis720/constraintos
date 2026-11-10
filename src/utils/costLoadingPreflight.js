// Patch 05F: diagnostic write-plan ONLY. Never changes or serializes an XER.
import * as XLSX from 'xlsx';
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function prepareCostLoadingPreflight(audit, report, simulation) {
  if (!audit || !report || !simulation) return null;
  const findings = [];
  const add = (severity, code, detail) => findings.push({severity,code,detail});
  const source = simulation.source;
  if (report.errorCount || simulation.errors) add('BLOCKER','VALIDATION',`${report.errorCount} workbook errors; ${simulation.errors} simulation errors.`);
  if (!source || (audit.holdingAccounts || []).length !== 1) add('BLOCKER','HOLDING_ID','Exactly one holding activity must be identified.');
  if (!source?.assignments?.length || source.assignments.length !== 1 || source.assignments[0].resourceCode !== 'MCGSTANDCOSTONLY') add('BLOCKER','HOLDING_RESOURCE','Exactly one standard cost resource assignment must exist on the holding activity.');
  if (source?.hasDiscrepancies || Math.abs(source?.difference || 0) > .01) add('BLOCKER','REMAINING_RECONCILIATION','Holding assignment budget does not equal actual plus remaining. Source remaining-cost treatment requires a documented, approved decision.');
  add('BLOCKER','REMAINING_POLICY','New-assignment remaining cost and holding remaining-cost adjustment policy have not been approved. No XER writing is permitted.');
  if (!simulation.transfer || simulation.transfer <= 0) add('BLOCKER','NO_ALLOCATIONS','No positive transfer was proposed.');
  if (source && simulation.transfer > source.budget + .005) add('BLOCKER','HOLDING_OVERDRAW','Proposed transfer exceeds the holding budget.');
  if (Math.abs(simulation.originalBudget - simulation.afterBudget) > .005) add('BLOCKER','BUDGET_CONSERVATION','The simulated total schedule budget is not conserved.');
  const targetById = new Map((audit.activities || []).map(a => [String(a.activityId).trim().toUpperCase(),a]));
  const changes = (simulation.rows || []).map(row => {
    const activity = targetById.get(String(row.id).trim().toUpperCase());
    if (!activity) add('BLOCKER','TARGET_NOT_FOUND',`Receiving activity ${row.id} not found in the XER.`);
    if (activity && source && activity.taskId === source.taskId) add('BLOCKER','SELF_TRANSFER',`Receiving activity ${row.id} is the holding account.`);
    const existingRows = audit.assignmentDetailsByTask?.[activity?.taskId] || [];
    const standardRows = existingRows.filter(r => String(r.resourceCode).trim().toUpperCase() === 'MCGSTANDCOSTONLY');
    const hasStandardResource = standardRows.length > 0;
    if (standardRows.length > 1) add('BLOCKER','DUPLICATE_STANDARD_RESOURCE',`Activity ${row.id} has ${standardRows.length} standard resource assignments; manual resolution required.`);
    if (standardRows.length === 1) add('BLOCKER','EXISTING_STANDARD_RESOURCE',`Activity ${row.id} has existing standard assignment ${standardRows[0].assignmentId}. Review the assignment before deciding whether it can be updated.`);
    if (!Number.isFinite(row.addition) || row.addition <= 0) add('BLOCKER','INVALID_AMOUNT',`Activity ${row.id} has invalid proposed addition.`);
    return {activityId:row.id,taskId:activity?.taskId || '',activityName:row.name,existingBudget:row.existingBudget,proposedBudgetAddition:row.addition,simulatedBudget:row.afterBudget,proposedResource:'MCGSTANDCOSTONLY',existingAssignmentCount:existingRows.length,standardAssignmentIds:standardRows.map(r=>r.assignmentId).join('; '),standardResourceAlreadyAssigned:hasStandardResource?'YES':'NO',sourcePools:row.sourcePools.join('; '),operation:standardRows.length===1?'REVIEW UPDATE EXISTING':standardRows.length>1?'MANUAL RESOLUTION':'PROPOSE NEW ASSIGNMENT',remainingCost:'UNDECIDED — NO WRITE'};
  });
  const receiving = money(changes.reduce((s,r)=>s+r.proposedBudgetAddition,0));
  if (Math.abs(receiving - simulation.transfer) > .005) add('BLOCKER','TRANSFER_MISMATCH','Proposed receiving additions do not match the holding budget reduction.');
  if (Math.abs((audit.totals?.budget || 0) - simulation.originalBudget) > .005) add('BLOCKER','SOURCE_TOTAL','Simulation source total differs from the XER audit total.');
  const projectBudget = money(audit.totals?.budget || 0);
  return {status:'BLOCKED — PREFLIGHT ONLY',exportEnabled:false,source,changes,findings,summary:{projectBudget,proposedTransfer:simulation.transfer,holdingBefore:source?.budget ?? null,holdingAfter:simulation.holdingAfter,receivingBudgetAdditions:receiving,projectBudgetAfter:simulation.afterBudget,receivingActivities:changes.length,blockers:findings.filter(f=>f.severity==='BLOCKER').length}};
}
export function downloadCostLoadingPreflight(preflight) {
  if (!preflight) throw new Error('Run the preflight first.');
  const wb = XLSX.utils.book_new();
  const overview = [
    ['Patch 05F — READ-ONLY XER EXPORT PREFLIGHT'],
    ['Status',preflight.status],['XER export permitted','NO'],
    ['Project budget before',preflight.summary.projectBudget],
    ['Proposed holding reduction',preflight.summary.proposedTransfer],
    ['Holding budget before',preflight.summary.holdingBefore],
    ['Holding budget after (simulation)',preflight.summary.holdingAfter],
    ['Receiving budget additions',preflight.summary.receivingBudgetAdditions],
    ['Project budget after (simulation)',preflight.summary.projectBudgetAfter],
    ['Receiving activities',preflight.summary.receivingActivities],
    ['Preflight blockers',preflight.summary.blockers],
    ['NOTE','This workbook is a diagnostic preview. It is NOT an XER and authorizes no schedule changes.'],
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(overview),'Overview');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(preflight.changes),'Proposed Assignments');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(preflight.findings),'Preflight Findings');
  XLSX.writeFile(wb,'Sentinel-CostLoading-05F-Preflight.xlsx');
}
