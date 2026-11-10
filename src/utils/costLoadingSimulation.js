// Patch 05E: budget-only, read-only simulation. No XER writing or remaining-cost assumptions.
const cents = n => Math.round((n + Number.EPSILON) * 100) / 100;
export function simulateCostLoadingTransfer(audit, report) {
  if (!audit || !report) return null;
  const issues = [];
  const error = message => issues.push({severity:'Error',message});
  const warning = message => issues.push({severity:'Warning',message});
  if (report.errorCount) error(`Allocation validation contains ${report.errorCount} error(s). Correct the workbook before relying on this simulation.`);
  const holding = audit.holdingAccounts || [];
  if (holding.length !== 1) error(`Expected exactly one construction holding activity; found ${holding.length}.`);
  const source = holding.length === 1 ? holding[0] : null;
  if (source && (source.assignments.length !== 1 || source.assignments[0].resourceCode !== 'MCGSTANDCOSTONLY')) error('Holding account must contain exactly one MCGSTANDCOSTONLY assignment for this simulation.');
  if (source?.hasDiscrepancies) warning('Source holding assignment has a budget/actual/remaining discrepancy. Remaining costs are NOT simulated.');
  const activities = new Map((audit.activities || []).map(a=>[String(a.activityId).trim().toUpperCase(),a]));
  const targets = new Map();
  let transferCents = 0;
  for (const pool of report.pools || []) {
    if (!pool.approved) continue;
    if (!Number.isFinite(pool.approvedAmount) || pool.approvedAmount <= 0) {error(`Pool ${pool.key} has invalid approved amount.`);continue;}
    const rows = pool.allocations || [];
    if (!rows.length) {error(`Pool ${pool.key} has no receiving activities.`);continue;}
    const totalCents = Math.round(pool.approvedAmount * 100);
    let allocated = 0;
    rows.forEach((entry,index)=>{
      const id = String(entry.id || '').trim().toUpperCase();
      const activity = activities.get(id);
      if (!activity) error(`Pool ${pool.key}: activity ${id} not found.`);
      if (source && activity?.taskId === source.taskId) error(`Pool ${pool.key}: cannot transfer to holding activity ${id}.`);
      if (!Number.isFinite(entry.weight) || entry.weight <= 0) error(`Pool ${pool.key}: invalid allocation weight for ${id}.`);
      const rowCents = index === rows.length - 1 ? totalCents - allocated : Math.round(totalCents * entry.weight / 100);
      allocated += rowCents;
      if (activity) {
        const existing = targets.get(id) || {id,name:activity.name,wbs:activity.wbs,existingBudget:cents(activity.budget),addedCents:0,sourcePools:[]};
        existing.addedCents += rowCents;
        existing.sourcePools.push(pool.key);
        targets.set(id,existing);
      }
    });
    if (Math.abs(rows.reduce((s,r)=>s+Number(r.weight||0),0)-100)>0.0001) error(`Pool ${pool.key}: weights do not total 100%.`);
    transferCents += totalCents;
  }
  const transfer = transferCents / 100;
  if (!transferCents) warning('No approved allocations are loaded. Import the completed allocation workbook.');
  if (source && transfer > source.budget + 0.005) error('Proposed transfer exceeds the holding account budget.');
  if (source && source.budget - transfer < -0.005) error('Proposed transfer would make the holding budget negative.');
  const rows = [...targets.values()].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true})).map(t=>({...t,addition:t.addedCents/100,afterBudget:cents(t.existingBudget+t.addedCents/100)}));
  const assignedCents = [...targets.values()].reduce((s,t)=>s+t.addedCents,0);
  if (assignedCents !== transferCents) error('Proposed receiving activity totals do not equal the holding reduction.');
  const originalBudget = cents(audit.totals.budget);
  const afterBudget = cents(originalBudget - transfer + assignedCents/100);
  if (Math.abs(afterBudget-originalBudget)>0.005) error('Whole-schedule budget would change.');
  return {source,rows,issues,transfer,originalBudget,afterBudget,holdingAfter:source?cents(source.budget-transfer):null,errors:issues.filter(i=>i.severity==='Error').length,readyForExport:false};
}
