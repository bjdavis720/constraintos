// Patch 05I — read-only remaining-cost policy comparison. No XER writes.
const cents = n => Math.round((Number(n) + Number.EPSILON) * 100);
const money = c => c / 100;
export function compareRemainingCostPolicies(audit, preflight, assignmentAudit) {
  if (!audit || !preflight || !assignmentAudit) return null;
  const holding = preflight.source;
  const sourceRows = (holding?.assignments || []).filter(r => String(r.resourceCode).trim().toUpperCase() === 'MCGSTANDCOSTONLY');
  if (sourceRows.length !== 1 || (audit.holdingAccounts || []).length !== 1) return {error:'Exactly one holding activity and one standard holding assignment are required.'};
  const source = sourceRows[0];
  const transfer = cents(preflight.summary?.proposedTransfer);
  const budget = cents(source.budget), remaining = cents(source.remaining), actual = cents(source.actual);
  const receivers = assignmentAudit.activities.map(a => ({
    activityId:a.activityId, addition:cents(a.proposedBudgetAddition),
    standard:a.assignments.filter(r => String(r.resourceCode).trim().toUpperCase() === 'MCGSTANDCOSTONLY')
  }));
  if (transfer <= 0 || transfer > budget || receivers.some(a=>a.standard.length!==1) || receivers.reduce((s,a)=>s+a.addition,0)!==transfer)
    return {error:'Invalid transfer or ambiguous receiving assignments. No policy comparison can be calculated.'};
  const baseRemaining = remaining + receivers.reduce((s,a)=>s+cents(a.standard[0].remaining),0);
  const sourceAfterBudget = budget-transfer;
  const scenarios = [
    {key:'preserve',name:'Preserve existing remaining',description:'Leave remain_cost unchanged for holding and receivers.',holdingRemaining:remaining,receiverRemaining:receivers.map(a=>cents(a.standard[0].remaining))},
    {key:'proportional',name:'Proportional transfer',description:'Transfer remaining cost at the holding assignment’s current remaining-to-budget ratio; preserve combined remaining cost.',...(() => {
      // Allocate exact cents with largest-remainder method to avoid rounding drift.
      const transferRemaining = Math.round(transfer * remaining / budget);
      const fractions = receivers.map((a,i)=>({i,raw:transferRemaining*a.addition/transfer}));
      const distributed = fractions.map(x=>Math.floor(x.raw));
      let leftover = transferRemaining-distributed.reduce((s,n)=>s+n,0);
      for(const x of [...fractions].sort((a,b)=>(b.raw-Math.floor(b.raw))-(a.raw-Math.floor(a.raw)) || a.i-b.i)) {if(leftover<=0)break;distributed[x.i]++;leftover--;}
      return {holdingRemaining:remaining-transferRemaining,receiverRemaining:receivers.map((a,i)=>cents(a.standard[0].remaining)+distributed[i])};
    })()},
    {key:'reset',name:'Reset to budget less actual',description:'Set each affected assignment’s remaining cost to its proposed budget minus preserved actual cost.',holdingRemaining:sourceAfterBudget-actual,receiverRemaining:receivers.map(a=>cents(a.standard[0].budget)+a.addition-cents(a.standard[0].actual))}
  ];
  const formatted = scenarios.map(s=>({
    ...s,holdingRemaining:money(s.holdingRemaining),receivers:receivers.map((a,i)=>({activityId:a.activityId,assignmentId:a.standard[0].assignmentId,remainingBefore:money(cents(a.standard[0].remaining)),remainingAfter:money(s.receiverRemaining[i]),change:money(s.receiverRemaining[i]-cents(a.standard[0].remaining))})),
    receiverRemainingAdded:money(s.receiverRemaining.reduce((sum,n,i)=>sum+n-cents(receivers[i].standard[0].remaining),0)),
    combinedRemainingBefore:money(baseRemaining),
    combinedRemainingAfter:money(s.holdingRemaining+s.receiverRemaining.reduce((sum,n)=>sum+n,0)),
    combinedRemainingChange:money(s.holdingRemaining+s.receiverRemaining.reduce((sum,n)=>sum+n,0)-baseRemaining)
  }));
  return {sourceActivityId:holding.activityId,sourceAssignmentId:source.assignmentId,sourceRemainingBefore:money(remaining),sourceBudgetBefore:money(budget),sourceBudgetAfter:money(sourceAfterBudget),transfer:money(transfer),scenarios:formatted,exportEnabled:false};
}
