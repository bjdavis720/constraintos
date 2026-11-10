import { calculatePool, summarizePools, dollars } from './costLoadingInApp.js';

// Read-only bridge: no XER fields are changed here.
export function prepareInAppBridge(pools, clins, audit) {
  const findings=[];
  const approved=Object.entries(pools||{}).filter(([,p])=>p.status==='approved');
  if (!audit?.activities?.length) findings.push('A source P6 XER must be loaded.');
  if (!approved.length) findings.push('No approved in-app pools.');
  const holding=audit?.holdingAccounts||[];
  if(holding.length!==1) findings.push(`Expected exactly one construction holding activity; found ${holding.length}.`);
  const summary=summarizePools(pools||{},clins||[],(audit?.activities||[]).map(a=>a.activityId),holding[0]?.budget);
  findings.push(...summary.errors);
  const activities=new Map((audit?.activities||[]).map(a=>[String(a.activityId),a]));
  const poolRows=[];
  const receiving=new Map();
  for(const [key,pool] of approved){
    const result=calculatePool(pool);
    for(const [id,amountCents] of Object.entries(result.allocated)){
      if(!Number.isSafeInteger(amountCents)||amountCents<=0){findings.push(`${key}: invalid allocation for ${id}.`);continue;}
      const activity=activities.get(String(id));
      if(!activity){findings.push(`${key}: activity ${id} missing from XER.`);continue;}
      if(holding.some(h=>String(h.activityId)===String(id))) {findings.push(`${key}: holding account cannot receive costs.`);continue;}
      const row={poolKey:key,clin:String(pool.clin),type:pool.type||'Direct Cost',activityId:String(id),activityName:activity.name,amountCents,amount:dollars(amountCents)};
      poolRows.push(row);
      const prior=receiving.get(String(id))||{activityId:String(id),activityName:activity.name,existingBudget:activity.budget||0,additionCents:0,pools:[]};
      prior.additionCents+=amountCents;prior.pools.push(key);receiving.set(String(id),prior);
    }
  }
  const receivingRows=[...receiving.values()].sort((a,b)=>a.activityId.localeCompare(b.activityId,undefined,{numeric:true})).map(r=>({...r,addition:dollars(r.additionCents),proposedBudget:Number(r.existingBudget)+dollars(r.additionCents)}));
  const transferCents=poolRows.reduce((s,r)=>s+r.amountCents,0);
  if(transferCents!==summary.approved) findings.push('Receiving allocation sum does not equal approved pool total.');
  if(holding.length===1&&transferCents>Math.round(Number(holding[0].budget)*100)) findings.push('Proposed transfer exceeds holding budget.');
  const holdingBeforeCents=holding.length===1?Math.round(Number(holding[0].budget)*100):null;
  const holdingAfterCents=holdingBeforeCents===null?null:holdingBeforeCents-transferCents;
  const receivingCents=receivingRows.reduce((sum,row)=>sum+row.additionCents,0);
  const originalBudgetCents=Math.round(Number(audit?.totalBudget ?? audit?.totalResourceBudget ?? 0)*100);
  if(holdingBeforeCents!==null && (!Number.isSafeInteger(holdingBeforeCents)||holdingBeforeCents<0))
    findings.push('Invalid construction holding-account budget.');
  if(holdingAfterCents!==null && holdingAfterCents<0)
    findings.push('Construction holding-account balance would become negative.');
  if(receivingCents!==transferCents)
    findings.push('Receiving activity total does not reconcile to the holding-account deduction.');
  if(holdingBeforeCents!==null && holdingAfterCents+receivingCents!==holdingBeforeCents)
    findings.push('Budget conservation check failed.');
  return {status:findings.length?'BLOCKED':'READY FOR LEGACY EXPORT INTEGRATION REVIEW',findings,approvedPools:approved.length,transferCents,transfer:dollars(transferCents),holdingActivity:holding[0]?.activityId||null,holdingBefore:holdingBeforeCents===null?null:dollars(holdingBeforeCents),holdingAfter:holdingAfterCents===null?null:dollars(holdingAfterCents),receivingRows,poolRows,budgetConserved:holdingBeforeCents!==null&&holdingAfterCents+receivingCents===holdingBeforeCents};
}
export function downloadInAppBridge(report,projectName){
  if(report.status==='BLOCKED') throw new Error('Bridge has blocking validation findings.');
  const payload={format:'sentinel-in-app-cost-loading-bridge',version:1,projectName,generatedAt:new Date().toISOString(),notice:'Review-only export. Not a P6 XER and not an authorization to modify production data.',report};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='Sentinel-InApp-Cost-Bridge-REVIEW.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
