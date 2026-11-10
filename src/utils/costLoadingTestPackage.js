// Patch 05K — review package only. Never modifies an XER.
import * as XLSX from "xlsx";
const cents = x => Math.round(Number(x)*100);
const asMoney = c => c/100;
export function prepareXerTestPackage(decision, preflight, comparison) {
  if (!decision || decision.error || !decision.acknowledged) return null;
  const rows = decision.rows || [];
  const issues = [];
  if (rows.length !== 8) issues.push("Expected eight field changes across four assignments.");
  const ids = new Set();
  for (const row of rows) {
    const id = `${row.assignmentId}:${row.field}`;
    if (ids.has(id)) issues.push(`Duplicate field update ${id}`);
    ids.add(id);
    if (!["target_cost","remain_cost"].includes(row.field)) issues.push(`Unexpected field ${row.field}`);
    if (![row.before,row.after,row.delta].every(Number.isFinite)) issues.push(`Invalid number for ${id}`);
    if (cents(row.after)-cents(row.before)!==cents(row.delta)) issues.push(`Change mismatch for ${id}`);
  }
  if (new Set(rows.map(r=>String(r.assignmentId))).size!==4) issues.push("Expected four unique existing assignments.");
  if (cents(decision.budgetDelta)!==0) issues.push("Budget change does not reconcile to zero.");
  if (decision.key==="proportional" && cents(decision.remainingDelta)!==0) issues.push("Proportional remaining-cost change does not reconcile to zero.");
  if (!preflight?.source?.assignments?.length) issues.push("Holding assignment source records unavailable.");
  const sourceIssues = (preflight?.findings || []).map(f=>({severity:f.severity||"REVIEW",code:f.code||"",detail:f.detail||""}));
  const status = issues.length ? "INVALID — DO NOT USE" : "REVIEW PACKAGE ONLY — NO XER EXPORT";
  return {status,issues,sourceIssues,rows,scenario:decision.scenario,policyKey:decision.key,
    projectBudget:preflight?.summary?.projectBudget,transfer:comparison?.transfer,
    budgetDelta:decision.budgetDelta,remainingDelta:decision.remainingDelta,exportEnabled:false};
}
export function downloadXerTestPackage(pkg) {
  if (!pkg || pkg.issues.length) return;
  const wb=XLSX.utils.book_new();
  const append=(name,data)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),name);
  append("Review Summary",[
    ["SENTINELOS PATCH 05K — READ-ONLY TEST PREPARATION"],
    ["Status",pkg.status],["Policy",pkg.scenario],["Acknowledgment","For test planning only"],
    ["Project budget",pkg.projectBudget],["Budget transfer",pkg.transfer],
    ["Net budget change",pkg.budgetDelta],["Net remaining change",pkg.remainingDelta],
    ["XER created","NO"],["Authorization to modify P6","NO"],
    ["IMPORTANT","Unresolved source remaining-cost discrepancy; confirm P6 cost semantics before any XER write."],
    ["IMPORTANT","Do not import this workbook into P6 as a schedule or resource update."]
  ]);
  append("Proposed TASKRSRC Fields",[
    ["Activity ID","Assignment ID","XER field","Original XER value","Proposed value","Change","Operation","Approval"],
    ...pkg.rows.map(r=>[r.activityId,String(r.assignmentId),r.field,r.before,r.after,r.delta,"REVIEW EXISTING","NOT AUTHORIZED"])
  ]);
  append("Preflight Findings",[
    ["Severity","Code","Finding"],...pkg.sourceIssues.map(f=>[f.severity,f.code,f.detail])
  ]);
  append("Validation Checklist",[
    ["Step","Check","Result / notes"],
    [1,"Save an untouched copy of the original XER","PENDING"],
    [2,"Confirm all four assignment IDs and resource codes in source P6","PENDING"],
    [3,"Investigate holding budget/remaining discrepancy of $47,632,184.50","PENDING"],
    [4,"Obtain written approval for remaining-cost treatment","PENDING"],
    [5,"Verify cost and quantity/rate semantics for P6 version","PENDING"],
    [6,"Confirm no existing actual costs will be modified","PENDING"],
    [7,"In isolated P6 copy, compare budget/remaining and resource totals before and after","PENDING"],
    [8,"Confirm schedule activity relationships and dates unchanged","PENDING"],
    [9,"Re-export test P6 XER and independently reconcile all cost fields","PENDING"],
    [10,"Do not update production schedule without independent approval","PENDING"]
  ]);
  XLSX.writeFile(wb,"Sentinel-05K-XER-Test-Preparation.xlsx");
}
