import * as XLSX from "xlsx";
// 05N: Compare source XER with a re-export from isolated P6 testing.
// Keys use Activity ID + resource short name rather than internal database IDs, which may change on import.
function tables(text) {
  const result={}; let name="",cols=[];
  for(const line of text.split(/\r\n|\n|\r/)) {
    if(line.startsWith("%T\t")){name=line.slice(3);cols=[];if(!result[name])result[name]=[];}
    else if(line.startsWith("%F\t"))cols=line.slice(3).split("\t");
    else if(line.startsWith("%R\t")&&name&&cols.length){const values=line.slice(3).split("\t");const row={};cols.forEach((c,i)=>row[c]=values[i]??"");result[name].push(row);}
  }
  return result;
}
const num=v=>Number(v||0);
const cents=v=>Math.round(num(v)*100);
const total=(rows,key)=>rows.reduce((s,r)=>s+cents(r[key]),0)/100;
function indexData(t){
  const tasks=new Map((t.TASK||[]).map(r=>[r.task_id,r]));
  const resources=new Map((t.RSRC||[]).map(r=>[r.rsrc_id,r]));
  const activities=new Map((t.TASK||[]).map(r=>[r.task_code,r]));
  const assignments=new Map();
  const duplicates=[];
  for(const r of t.TASKRSRC||[]){
    const task=tasks.get(r.task_id),res=resources.get(r.rsrc_id);
    const key=[task?.task_code||`UNKNOWN_TASK:${r.task_id}`,res?.rsrc_short_name||`UNKNOWN_RESOURCE:${r.rsrc_id}`,r.role_id||""].join(" | ");
    if(assignments.has(key))duplicates.push(key);
    else assignments.set(key,r);
  }
  return {tasks,resources,activities,assignments,duplicates};
}
function diffFields(a,b,fields){return fields.filter(k=>String(a?.[k]??"")!==String(b?.[k]??"")).map(k=>({field:k,before:a?.[k]??"",after:b?.[k]??""}));}
const actualFields=["act_reg_cost","act_ot_cost","act_this_per_cost","act_ot_qty","act_reg_qty"];
const remainingFields=["remain_cost","remain_qty"];
const unitRateFields=["target_qty","cost_per_qty","rate_type","cost_qty_link_flag"];
const dateFields=["target_start_date","target_end_date","act_start_date","act_end_date","early_start_date","early_end_date","late_start_date","late_end_date","remain_drtn_hr_cnt","target_drtn_hr_cnt"];
export function reconcileP6Reexport(originalText,reexportText,preview){
  if(!originalText||!reexportText)return null;
  const src=tables(originalText),dst=tables(reexportText),a=indexData(src),b=indexData(dst);
  const findings=[],changes=[];
  const flag=(severity,code,message)=>findings.push({severity,code,message});
  if(a.duplicates.length||b.duplicates.length)flag("REVIEW","AMBIGUOUS_ASSIGNMENTS",`Duplicate activity/resource keys: source ${a.duplicates.length}, re-export ${b.duplicates.length}. Comparison cannot uniquely pair these.`);
  const planned=new Map((preview?.rows||[]).map(r=>[r.activityId,{before:cents(r.before),after:cents(r.after)}]));
  const expected=new Map((preview?.rows||[]).map(r=>[r.activityId,r]));
  const observed=new Map();
  for(const [key,old] of a.assignments){
    const next=b.assignments.get(key);
    if(!next){flag("FAIL","MISSING_ASSIGNMENT",`Assignment missing after import: ${key}`);continue;}
    const activity=key.split(" | ")[0];
    const budgetBefore=cents(old.target_cost),budgetAfter=cents(next.target_cost);
    if(budgetBefore!==budgetAfter){changes.push({activity,key,field:"target_cost",before:budgetBefore/100,after:budgetAfter/100});}
    if(expected.has(activity)){
      const exp=expected.get(activity);
      if(budgetBefore!==cents(exp.before)||budgetAfter!==cents(exp.after))flag("FAIL","EXPECTED_BUDGET",`${activity}: expected ${exp.before} → ${exp.after}; observed ${budgetBefore/100} → ${budgetAfter/100}.`);
      observed.set(activity,(observed.get(activity)||0)+1);
    }else if(budgetBefore!==budgetAfter)flag("FAIL","UNEXPECTED_BUDGET",`Budget changed outside approved four activities: ${key}.`);
    for(const f of [...actualFields,...remainingFields,...unitRateFields]){
      if(cents(old[f])!==cents(next[f]) && !["rate_type","cost_qty_link_flag"].includes(f) || (["rate_type","cost_qty_link_flag"].includes(f)&&old[f]!==next[f])){
        const severity=actualFields.includes(f)?"FAIL":"REVIEW";
        flag(severity,"ASSIGNMENT_FIELD_CHANGED",`${activity}: ${f} changed ${old[f]} → ${next[f]}.`);
      }
    }
  }
  for(const key of b.assignments.keys())if(!a.assignments.has(key))flag("FAIL","NEW_ASSIGNMENT",`New assignment after import: ${key}`);
  for(const id of expected.keys())if(observed.get(id)!==1)flag("FAIL","EXPECTED_ASSIGNMENT_MISSING",`${id}: expected exactly one paired standard-cost assignment; found ${observed.get(id)||0}.`);
  for(const [id,old] of a.activities){
    const next=b.activities.get(id);
    if(!next){flag("FAIL","MISSING_ACTIVITY",`Activity ${id} missing from re-export.`);continue;}
    for(const d of diffFields(old,next,dateFields))flag("REVIEW","SCHEDULE_FIELD_CHANGED",`${id}: ${d.field} ${d.before} → ${d.after}.`);
  }
  for(const id of b.activities.keys())if(!a.activities.has(id))flag("FAIL","NEW_ACTIVITY",`New activity ${id} found in re-export.`);
  const countBefore=(src.TASKPRED||[]).length,countAfter=(dst.TASKPRED||[]).length;
  if(countBefore!==countAfter)flag("FAIL","RELATIONSHIP_COUNT",`TASKPRED count changed ${countBefore} → ${countAfter}.`);
  const relationshipKeys=(t,idx)=>{const keys=new Map();for(const r of t.TASKPRED||[]){const successor=idx.tasks.get(r.task_id)?.task_code||`UNKNOWN:${r.task_id}`;const predecessor=idx.tasks.get(r.pred_task_id)?.task_code||`UNKNOWN:${r.pred_task_id}`;const key=[successor,predecessor,r.pred_type||"",r.lag_hr_cnt||""].join(" | ");keys.set(key,(keys.get(key)||0)+1);}return keys;};
  const relA=relationshipKeys(src,a),relB=relationshipKeys(dst,b);
  let relDiff=0;for(const [k,n] of relA)if(relB.get(k)!==n)relDiff++;for(const k of relB.keys())if(!relA.has(k))relDiff++;
  if(relDiff)flag("REVIEW","RELATIONSHIP_DETAILS",`${relDiff} relationship signatures differ (activity IDs, type, or lag).`);
  const before=total(src.TASKRSRC||[],"target_cost"),after=total(dst.TASKRSRC||[],"target_cost");
  if(cents(before)!==cents(after))flag("FAIL","TOTAL_BUDGET",`Total assignment budget changed ${before} → ${after}.`);
  if(!preview?.rows?.length)flag("REVIEW","NO_APPROVED_BASELINE","Upload the original allocation workbook to verify the exact intended four budget changes.");
  if(!findings.length)flag("INFO","NO_VARIANCES","All compared fields matched the expected budget-only transfer. Other P6-calculated fields are not comprehensively verified.");
  return {findings,changes,summary:{before,after,activityBefore:a.activities.size,activityAfter:b.activities.size,assignmentBefore:a.assignments.size,assignmentAfter:b.assignments.size,relationshipBefore:countBefore,relationshipAfter:countAfter,expectedChanges:expected.size,observedChanges:changes.length},status:findings.some(f=>f.severity==="FAIL")?"FAIL — INVESTIGATE":findings.some(f=>f.severity==="REVIEW")?"REVIEW REQUIRED":"PRELIMINARY PASS — CHECK P6 CALCULATED FIELDS"};
}
export function downloadP6Reconciliation(report){
  if(!report)return;
  const wb=XLSX.utils.book_new();
  const add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);
  add("Summary",[["05N — P6 RE-EXPORT RECONCILIATION"],["Status",report.status],...[...Object.entries(report.summary)].map(x=>x),["CAUTION","Preliminary XER data comparison; verify P6 calculated earned value and project totals manually."]]);
  add("Findings",[["Severity","Code","Details"],...report.findings.map(f=>[f.severity,f.code,f.message])]);
  add("Budget Changes",[["Activity","Assignment key","Field","Before","After"],...report.changes.map(c=>[c.activity,c.key,c.field,c.before,c.after])]);
  XLSX.writeFile(wb,"Sentinel-05N-P6-Reexport-Reconciliation.xlsx");
}
