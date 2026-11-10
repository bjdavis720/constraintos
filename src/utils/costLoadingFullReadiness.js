// 06A: project-wide allocation readiness. Read-only; never authorizes XER writes.
import * as XLSX from "xlsx";
const cents = n => Math.round((Number(n)||0)*100);
const norm = s => String(s??"").trim().replace(/^0+/,"")||"0";
export function reviewFullConstructionAllocation(report,audit,clins){
  if(!report||!audit)return null;
  const issues=[];const add=(level,code,message)=>issues.push({level,code,message});
  const approved=(report.pools||[]).filter(p=>p.approved);
  const unapproved=(report.pools||[]).filter(p=>!p.approved);
  const activityMap=new Map((audit.activities||[]).map(a=>[String(a.activityId).toUpperCase(),a]));
  const byActivity=new Map();const clinTotals=new Map();let selected=0;
  for(const p of approved){
    if(p.status!=="Review required")add("BLOCKER","POOL_VALIDATION",`${p.key}: ${p.status}.`);
    if(!p.allocations.length)add("BLOCKER","EMPTY_POOL",`${p.key} has no selected activities.`);
    if(Math.abs(Number(p.weight)-100)>0.0001)add("BLOCKER","WEIGHTS",`${p.key} allocation weights do not total 100%.`);
    const k=norm(p.clin);clinTotals.set(k,(clinTotals.get(k)||0)+cents(p.approvedAmount));
    for(const a of p.allocations){selected++;const id=String(a.id).toUpperCase();
      if(!activityMap.has(id))add("BLOCKER","UNKNOWN_ACTIVITY",`${p.key}: ${id} not found in schedule.`);
      if(!byActivity.has(id))byActivity.set(id,[]);
      byActivity.get(id).push({pool:p.key,clin:p.clin,amount:cents(p.approvedAmount)*Number(a.weight)/100});
    }
  }
  for(const i of report.issues||[])if(i.severity==="Error")add("BLOCKER","WORKBOOK",`${i.location}: ${i.message}`);
  const clinsRows=(clins||[]).filter(c=>c.accepted).map(c=>{const amount=Number(c.amount)||0,assigned=(clinTotals.get(norm(c.id))||0)/100;return {id:c.id,name:c.name,award:amount,assigned,unallocated:amount-assigned};});
  for(const row of clinsRows)if(cents(row.assigned)>cents(row.award))add("BLOCKER","CLIN_EXCEEDED",`CLIN ${row.id} exceeds accepted award.`);
  const holding=audit.holdingAccounts||[];
  if(holding.length!==1)add("BLOCKER","HOLDING_COUNT",`Expected one holding activity, found ${holding.length}.`);
  const transfer=approved.reduce((s,p)=>s+cents(p.approvedAmount),0)/100;
  const holdingBudget=holding.length===1?Number(holding[0].budget):null;
  if(holdingBudget!==null&&cents(transfer)>cents(holdingBudget))add("BLOCKER","HOLDING_OVERDRAW","Approved pools exceed available holding budget.");
  if(unapproved.length)add("INFO","UNAPPROVED_POOLS",`${unapproved.length} pools have not been approved. They are excluded from transfer.`);
  const shared=[...byActivity].filter(([,p])=>p.length>1).map(([id,p])=>({id,count:p.length,pools:p.map(x=>x.pool).join(" | "),clins:[...new Set(p.map(x=>x.clin))].join(", ")}));
  if(shared.length)add("REVIEW","SHARED_ACTIVITY",`${shared.length} activities receive cost from multiple pools. Confirm no scope double counting.`);
  const receivers=[...byActivity].map(([id,pools])=>{const activity=activityMap.get(id);// audit.activities[].assignments is a NUMBER, not an array of assignments.
    // 06A only checks resource presence; assignment-level uniqueness requires the 05G audit.
    const resourceNames=String(activity?.resources||"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
    const hasStandard=resourceNames.includes("MCGSTANDCOSTONLY");
    const totalAssignments=Number(activity?.assignments||0);
    return {id,name:activity?.name||"",pools:pools.length,
      assignmentCount:hasStandard ? (totalAssignments===1 ? 1 : totalAssignments) : 0,
      addition:pools.reduce((s,p)=>s+p.amount,0)/100};});
  const noStandard=receivers.filter(r=>r.assignmentCount!==1);
  if(noStandard.length)add("REVIEW","RESOURCE_ASSIGNMENTS",`${noStandard.length} receiving activities need assignment-level verification; resource presence and total assignment counts are preliminary.`);
  return {approvedPools:approved.length,unapprovedPools:unapproved.length,selected,receivers,shared,clinsRows,issues,transfer,holdingBudget,blockers:issues.filter(x=>x.level==="BLOCKER").length,readyForExport:false};
}
export function downloadFullConstructionReview(r){if(!r)return;const wb=XLSX.utils.book_new();const add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
 add("06A Summary",[["FULL CONSTRUCTION ALLOCATION — REVIEW ONLY"],["Approved pools",r.approvedPools],["Unapproved pools",r.unapprovedPools],["Selected allocation rows",r.selected],["Unique receiving activities",r.receivers.length],["Approved transfer",r.transfer],["Holding budget",r.holdingBudget],["Validation blockers",r.blockers],["XER export authorized","NO"]]);
 add("CLIN Reconciliation",[["CLIN","Description","Accepted award","Approved pool allocation","Unallocated / remaining"],...r.clinsRows.map(x=>[x.id,x.name,x.award,x.assigned,x.unallocated])]);
 add("Receiving Activities",[["Activity ID","Activity","Number of pools","Standard resource assignments","Approved budget addition"],...r.receivers.map(x=>[x.id,x.name,x.pools,x.assignmentCount,x.addition])]);
 add("Shared Activities",[["Activity ID","Pool count","Cost pools","CLINs"],...r.shared.map(x=>[x.id,x.count,x.pools,x.clins])]);
 add("Findings",[["Severity","Code","Finding"],...r.issues.map(x=>[x.level,x.code,x.message])]);
 XLSX.writeFile(wb,"Sentinel-06A-Full-Construction-Readiness.xlsx");}
