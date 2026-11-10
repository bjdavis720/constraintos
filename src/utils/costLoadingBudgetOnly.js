// Patch 05L: budgeted-total-cost transfer preview. No XER serialization.
import * as XLSX from "xlsx";
const money = n => Math.round((Number(n)+Number.EPSILON)*100)/100;
export function prepareBudgetOnlyPreview(audit, preflight, receivingAudit) {
  if (!audit || !preflight || !receivingAudit) return null;
  const findings=[];
  const block=(code,message)=>findings.push({severity:"BLOCKER",code,message});
  const note=(code,message)=>findings.push({severity:"SOURCE CONDITION",code,message});
  const source=preflight.source;
  const holding=(source?.assignments||[]).filter(a=>String(a.resourceCode).trim().toUpperCase()==="MCGSTANDCOSTONLY");
  if(holding.length!==1) block("HOLDING_RESOURCE","Expected exactly one standard-cost holding assignment.");
  if((audit.holdingAccounts||[]).length!==1) block("HOLDING_ACTIVITY","Expected one unambiguous construction holding activity.");
  const transfer=money(preflight.summary?.proposedTransfer||0);
  if(!(transfer>0)) block("NO_TRANSFER","No positive approved allocation to preview.");
  if(transfer>Number(source?.budget||0)+.005) block("OVERDRAW","Transfer exceeds holding budget.");
  const rows=[];
  if(holding.length===1) {
    const h=holding[0];
    rows.push({activityId:source.activityId,assignmentId:h.assignmentId,resource:"MCGSTANDCOSTONLY",operation:"REVIEW UPDATE EXISTING — HOLDING",field:"target_cost",before:money(h.budget),after:money(h.budget-transfer),delta:-transfer,actualUnchanged:money(h.actual),remainingUnchanged:money(h.remaining)});
    if(Math.abs(money(h.budget-h.actual-h.remaining))>.01) note("SOURCE_BUDGET_REMAINING","Original holding budget differs from actual plus remaining. Budget-only preview does not change remaining cost.");
  }
  for(const a of receivingAudit.activities) {
    const standards=a.assignments.filter(r=>String(r.resourceCode).trim().toUpperCase()==="MCGSTANDCOSTONLY");
    if(standards.length!==1){block("RECEIVER_ASSIGNMENT",`Activity ${a.activityId} has ${standards.length} standard-cost assignments; requires a separate create/duplicate-resolution procedure.`);continue;}
    const r=standards[0];
    const addition=money(a.proposedBudgetAddition);
    if(!(addition>0))block("INVALID_ADDITION",`Activity ${a.activityId} has an invalid budget addition.`);
    rows.push({activityId:a.activityId,assignmentId:r.assignmentId,resource:r.resourceCode,operation:"REVIEW UPDATE EXISTING — RECEIVER",field:"target_cost",before:money(r.budget),after:money(r.budget+addition),delta:addition,actualUnchanged:money(r.actual),remainingUnchanged:money(r.remaining)});
  }
  if(new Set(rows.map(r=>String(r.assignmentId))).size!==rows.length) block("DUPLICATE_ASSIGNMENT","One assignment ID appears more than once.");
  const delta=money(rows.reduce((s,r)=>s+r.delta,0));
  if(Math.abs(delta)>.005)block("BUDGET_CONSERVATION","Budgeted Total Cost changes do not net to zero.");
  const projectBefore=money(audit.totals?.budget||0);
  const projectAfter=money(projectBefore+delta);
  const oldPreflight=(preflight.findings||[]).filter(f=>f.severity==="BLOCKER");
  return {rows,findings,oldPreflight,transfer,delta,projectBefore,projectAfter,
    remainingCostPolicy:"UNCHANGED IN PROPOSED XER FIELDS — P6 import/recalculation behavior unverified",
    status:findings.some(f=>f.severity==="BLOCKER")?"PREVIEW INVALID — NO XER EXPORT":"BUDGET-ONLY PREVIEW — NO XER EXPORT",
    exportEnabled:false};
}
export function downloadBudgetOnlyPreview(p) {
  if(!p) return;
  const wb=XLSX.utils.book_new();
  const add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
  add("Summary",[["SENTINELOS 05L — BUDGETED TOTAL COST ONLY"],["Status",p.status],["XER generated","NO"],["Budget transfer",p.transfer],["Whole schedule before",p.projectBefore],["Whole schedule after (preview)",p.projectAfter],["Net budget change",p.delta],["Remaining cost",p.remainingCostPolicy],["WARNING","Changing target_cost in an XER may cause P6 to recalculate other fields on import. Must test independently."]]);
  add("Proposed Budget Fields",[["Activity ID","Assignment ID","Resource","Operation","XER field","Original","Proposed","Delta","Actual (untouched)","Remaining (untouched)"],...p.rows.map(r=>[r.activityId,r.assignmentId,r.resource,r.operation,r.field,r.before,r.after,r.delta,r.actualUnchanged,r.remainingUnchanged])]);
  add("05L Findings",[["Severity","Code","Finding"],...p.findings.map(f=>[f.severity,f.code,f.message])]);
  add("Legacy Preflight",[["Severity","Code","Finding"],...p.oldPreflight.map(f=>[f.severity,f.code,f.detail])]);
  XLSX.writeFile(wb,"Sentinel-05L-Budget-Only-Preview.xlsx");
}
