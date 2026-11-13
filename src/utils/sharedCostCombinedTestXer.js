import { prepareInAppTestXer } from './costLoadingInAppXer.js';

// Budget-only combined TEST XER. Month labels are approval metadata, NOT P6 time-phased curves.
export function prepareCombinedSharedTestXer({audit, sourceBytes, directBridge, readiness, costX, sharedPlans, months}) {
  const findings=[...(readiness?.blockers||[])];
  if(readiness?.status!=='PREVIEW PASSED — EXPORT STILL DISABLED')findings.push('Combined readiness preview has not passed.');
  if(directBridge?.status==='BLOCKED'||!directBridge?.budgetConserved)findings.push('Direct-cost bridge has not passed budget reconciliation.');
  if(!sourceBytes?.length)findings.push('Original XER bytes are unavailable.');
  const byTask=new Map((audit?.activities||[]).map(a=>[String(a.taskId),a]));
  const combined=new Map((directBridge?.receivingRows||[]).map(r=>[String(r.activityId),{...r,pools:[...(r.pools||[])]}]));
  let approvedCents=0,approvedRecords=0;
  const monthDetails=[];
  for(const clin of costX?.clins||[])for(const category of [...new Set((clin.shared||[]).map(r=>r.category))]){
    const key=`${clin.id}::${category}`;
    const plan=sharedPlans?.[key]||{};
    for(const month of (months||[]).filter(m=>m>=(plan.startMonth||months[0]||'')&&m<=(plan.endMonth||months.at(-1)||''))){
      const allocation=plan.allocations?.[month];
      if(allocation?.status!=='approved')continue;
      const rows=allocation.rows||[];
      const total=rows.reduce((s,r)=>s+Number(r.cents||0),0);
      if(!rows.length||total!==Number(allocation.targetCents)||!Number.isSafeInteger(total)||total<=0){findings.push(`${key} ${month}: invalid approved monthly record.`);continue;}
      approvedRecords++;approvedCents+=total;
      monthDetails.push({key,month,cents:total,receiving:rows.length});
      for(const row of rows){
        const activity=byTask.get(String(row.taskId));
        if(!activity||!Number.isSafeInteger(row.cents)||row.cents<=0){findings.push(`${key} ${month}: invalid receiving activity or amount.`);continue;}
        const id=String(activity.activityId);
        const prior=combined.get(id)||{activityId:id,activityName:activity.name,additionCents:0,pools:[]};
        prior.additionCents+=row.cents;
        prior.pools.push(`SHARED:${key}:${month}`);
        combined.set(id,prior);
      }
    }
  }
  if(approvedCents!==readiness?.sharedCents)findings.push('Approved monthly dollars do not match the independent readiness calculation.');
  if(approvedRecords!==readiness?.approvedMonths)findings.push('Approved monthly record count differs from readiness calculation.');
  const transferCents=Number(directBridge?.transferCents||0)+approvedCents;
  // The low-level XER writer consumes `addition` in dollars for newly created
  // TASKRSRC records, while reconciliation uses `additionCents` as integers.
  // Normalize both fields for every receiver, including shared-only activities.
  const receivingRows=[...combined.values()].map(r=>({
    ...r,
    addition: Number(r.additionCents) / 100,
    proposedBudget: Number(r.existingBudget || 0) + Number(r.additionCents) / 100,
  })).sort((a,b)=>a.activityId.localeCompare(b.activityId,undefined,{numeric:true}));
  for(const row of receivingRows){
    if(!Number.isSafeInteger(row.additionCents)||row.additionCents<=0||!Number.isFinite(row.addition))
      findings.push(`Activity ${row.activityId}: invalid combined transfer amount.`);
  }
  if(receivingRows.reduce((s,r)=>s+r.additionCents,0)!==transferCents)findings.push('Combined receiving activity amounts do not reconcile.');
  if(transferCents!==readiness?.combinedCents)findings.push('Combined transfer differs from readiness calculation.');
  if(findings.length)return {status:'BLOCKED',findings,rows:[],bytes:null,approvedRecords,monthDetails};
  const bridge={...directBridge,status:'READY',transferCents,receivingRows,holdingBefore:directBridge.holdingBefore,budgetConserved:true};
  const result=prepareInAppTestXer(audit,bridge,sourceBytes);
  if(result.status!=='TEST XER READY')return {...result,approvedRecords,monthDetails};
  if(Math.round((result.assignmentBudgetAfter-result.assignmentBudgetBefore)*100)!==0)
    return {status:'BLOCKED',findings:['Total resource assignment budget changed unexpectedly.'],rows:result.rows,bytes:null,approvedRecords,monthDetails};
  return {...result,approvedRecords,monthDetails,directCents:directBridge.transferCents,sharedCents:approvedCents,combinedCents:transferCents,
    status:'COMBINED BUDGET-ONLY TEST XER READY',
    warning:'TEST ONLY: approved month labels do not create P6 time-phased resource curves. Verify the monthly cost curve in isolated P6.'};
}
