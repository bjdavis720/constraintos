// Phase 4C-2: READ-ONLY preflight for a future combined TEST XER.
// Never authorizes a combined export or modifies the existing direct-only exporter.
export function assessSharedCostExportReadiness({audit, costX, sharedPlans, months, wbsNodes, directBridge, directPools}) {
  const blockers=[];
  const warnings=[];
  const activities=audit?.activities||[];
  const byTask=new Map(activities.map(a=>[String(a.taskId),a]));
  const nodes=wbsNodes||[];
  const nodeById=new Map(nodes.map(n=>[String(n.id),n]));
  const roots=String(sharedPlans?.__constructionWbsRoot||'');
  // Resolve the saved root first; otherwise accept only a unique auto-detected root.
  const candidates=nodes.filter(n=>/^construction$/i.test(String(n.name||'').trim())||/(?:^|\.)06CONS$/i.test(String(n.code||'')));
  const selectedRoot=nodeById.get(roots)||(candidates.length===1?candidates[0]:null);
  if(!selectedRoot)blockers.push('Select one Construction WBS root in Shared Costs.');
  const eligible=new Set();
  if(selectedRoot){
    const children=new Map();
    for(const n of nodes){const k=String(n.parentId||'');children.set(k,[...(children.get(k)||[]),String(n.id)]);}
    const pending=[String(selectedRoot.id)];
    while(pending.length){const id=pending.pop();if(eligible.has(id))continue;eligible.add(id);pending.push(...(children.get(id)||[]));}
  }
  if(!audit?.activities?.length)blockers.push('A P6 XER schedule is required.');
  if(!costX?.clins?.length)blockers.push('A CostX estimate with shared-cost categories is required.');
  if(directBridge?.findings?.length)blockers.push(`Direct-cost bridge has ${directBridge.findings.length} finding(s); resolve before combined export.`);
  const legacy=Object.values(directPools||{}).filter(p=>p.status==='approved'&&!p.separation?.completed&&p.costX&&Object.values(p.costX.additions||{}).some(v=>Number(v)!==0));
  if(legacy.length)blockers.push(`${legacy.length} approved direct-cost pool(s) still contain embedded shared costs.`);
  let sharedCents=0, approvedMonths=0, pendingMonths=0, budgetCents=0;
  const receiverTotals=new Map();
  const categories=[];
  for(const clin of costX?.clins||[]){
    for(const category of [...new Set((clin.shared||[]).map(r=>r.category))]){
      const key=`${clin.id}::${category}`;
      const plan=sharedPlans?.[key]||{};
      const budget=(clin.shared||[]).filter(r=>r.category===category).reduce((s,r)=>s+Number(r.amountCents||0),0);
      budgetCents+=budget;
      const eligibleMonths=(months||[]).filter(m=>m>=(plan.startMonth||months?.[0]||'')&&m<=(plan.endMonth||months?.at(-1)||''));
      if(!eligibleMonths.length){blockers.push(`${key}: no valid distribution months.`);continue;}
      let categoryApproved=0, count=0;
      for(const month of eligibleMonths){
        const allocation=plan.allocations?.[month];
        if(allocation?.status!=='approved'){pendingMonths++;continue;}
        const rows=allocation.rows||[];
        const total=rows.reduce((s,r)=>s+Number(r.cents||0),0);
        if(!rows.length||!Number.isSafeInteger(total)||total<=0||total!==allocation.targetCents){blockers.push(`${key} ${month}: approved record does not reconcile.`);continue;}
        let monthValid=true;
        for(const row of rows){
          const activity=byTask.get(String(row.taskId));
          if(!activity){blockers.push(`${key} ${month}: receiving activity ${row.taskId} missing from P6.`);monthValid=false;continue;}
          if(!eligible.has(String(activity.wbsId))){blockers.push(`${key} ${month}: ${activity.activityId} is outside the selected Construction WBS.`);monthValid=false;}
          if(!Number.isSafeInteger(row.cents)||row.cents<=0){blockers.push(`${key} ${month}: invalid amount on ${activity.activityId}.`);monthValid=false;}
          if((audit?.holdingAccounts||[]).some(h=>String(h.activityId)===String(activity.activityId))){blockers.push(`${key} ${month}: holding activity cannot receive costs.`);monthValid=false;}
          const start=new Date(activity.start),finish=new Date(activity.finish||activity.start);
          const first=new Date(`${month}-01T00:00:00`),last=new Date(first.getFullYear(),first.getMonth()+1,0,23,59,59);
          if(!Number.isFinite(start.getTime())||!Number.isFinite(finish.getTime())||start>last||finish<first){blockers.push(`${key} ${month}: ${activity.activityId} does not overlap the approved month.`);monthValid=false;}
        }
        if(!monthValid)continue;
        approvedMonths++;count++;sharedCents+=total;categoryApproved+=total;
        for(const row of rows){const id=String(row.taskId);receiverTotals.set(id,(receiverTotals.get(id)||0)+row.cents);}
      }
      if(categoryApproved>budget)blockers.push(`${key}: approved shared costs exceed category budget.`);
      categories.push({key,budgetCents:budget,approvedCents:categoryApproved,approvedMonths:count,months:eligibleMonths.length});
    }
  }
  const directCents=Number(directBridge?.transferCents||0);
  const holdingCents=Math.round(Number(audit?.holdingAccounts?.[0]?.budget||0)*100);
  const combinedCents=directCents+sharedCents;
  if((audit?.holdingAccounts||[]).length!==1)blockers.push('Exactly one construction holding account is required.');
  if(combinedCents>holdingCents)blockers.push('Combined transfer exceeds the construction holding-account budget.');
  if(sharedCents===0)blockers.push('No valid approved monthly shared-cost allocations.');
  if(pendingMonths)warnings.push(`${pendingMonths} month/category records remain unapproved and will not be included in a future partial export.`);
  warnings.push('P6 monthly resource time-phasing is NOT verified; budget allocations alone cannot guarantee the target month.');
  return {status:blockers.length?'BLOCKED':'PREVIEW PASSED — EXPORT STILL DISABLED',blockers,warnings,directCents,sharedCents,combinedCents,holdingCents,holdingAfterCents:holdingCents-combinedCents,approvedMonths,pendingMonths,budgetCents,receivingActivities:receiverTotals.size,categories};
}
