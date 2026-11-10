import * as XLSX from "xlsx";
// Review-only validation. No schedule mutations, resource creation or XER writing.
const clean = v => String(v ?? "").trim();
const number = v => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = clean(v).replace(/[$,\s]/g, "");
  if (!s) return NaN;
  return Number(s);
};
const normClin = v => clean(v).replace(/^0+/, "") || "0";
const cents = v => Math.round((v + Number.EPSILON) * 100) / 100;
const headers = sheet => {
  if (!sheet) throw new Error("Required worksheet is missing.");
  const data = sheet.rows || [];
  const keys = (data[0] || []).map(clean);
  return {keys, data: data.slice(1).map((row, i) => ({row, excelRow: i + 2})), at: key => {
    const index = keys.indexOf(key);
    if (index < 0) throw new Error(`Worksheet ${sheet.name}: missing column '${key}'.`);
    return index;
  }};
};
export function validateCostLoadingAllocations(workbook, audit, awardedClins, sourceSheet) {
  if (!audit?.activities?.length) throw new Error("Upload the matching P6 XER before importing allocations.");
  const sheet = name => workbook.SheetNames.includes(name)
    ? {name, rows: workbook.Sheets[name] ? XLSX.utils.sheet_to_json(workbook.Sheets[name], {header:1,defval:"",raw:true}) : []} : null;
  const poolsSheet = headers(sheet("Cost Pools"));
  const allocSheet = headers(sheet("Activity Allocations"));
  const p = Object.fromEntries(["Pool Key", "Estimate Scope", "Approved CLIN (USER)", "Approved Pool $ (USER)"].map(k => [k,poolsSheet.at(k)]));
  const a = Object.fromEntries(["Pool Key", "Activity ID (USER)", "Selected? (YES)", "Allocation Weight % (USER)"].map(k => [k,allocSheet.at(k)]));
  const activities = new Map(audit.activities.map(x => [clean(x.activityId).toUpperCase(), x]));
  const clins = new Map(awardedClins.filter(c => c.accepted).map(c => [normClin(c.id), c]));
  const poolMap = new Map();
  const issues = [];
  const issue = (severity, location, message) => issues.push({severity, location, message});
  for (const {row,excelRow} of poolsSheet.data) {
    const key = clean(row[p["Pool Key"]]);
    if (!key) continue;
    if (poolMap.has(key)) {issue("Error",`Cost Pools row ${excelRow}`,`Duplicate pool key ${key}.`);continue;}
    const clin = clean(row[p["Approved CLIN (USER)"]]);
    const rawAmount = row[p["Approved Pool $ (USER)"]];
    const approved = Boolean(clin || clean(rawAmount));
    const pool = {key,scope:clean(row[p["Estimate Scope"]]),clin,approvedAmount:number(rawAmount),approved,excelRow,allocations:[],status:"Not approved",allocated:0,weight:0};
    poolMap.set(key,pool);
    if (!approved) continue;
    if (!clin || !clins.has(normClin(clin))) issue("Error",`Cost Pools row ${excelRow}`,`CLIN '${clin || "blank"}' is not an accepted awarded CLIN.`);
    if (!Number.isFinite(pool.approvedAmount) || pool.approvedAmount <= 0) issue("Error",`Cost Pools row ${excelRow}`,"Approved pool amount must be greater than zero.");
  }
  const used = new Set();
  let selectedRows = 0;
  for (const {row,excelRow} of allocSheet.data) {
    const key = clean(row[a["Pool Key"]]);
    const selected = clean(row[a["Selected? (YES)"]]).toUpperCase();
    if (!key && !selected) continue;
    if (selected !== "YES") {
      if (selected && selected !== "NO") issue("Error",`Activity Allocations row ${excelRow}`,"Selected? must be YES, NO or blank.");
      continue;
    }
    selectedRows++;
    const pool = poolMap.get(key);
    if (!pool) {issue("Error",`Activity Allocations row ${excelRow}`,`Unknown cost pool '${key}'.`);continue;}
    const id = clean(row[a["Activity ID (USER)"]]).toUpperCase();
    const activity = activities.get(id);
    const weight = number(row[a["Allocation Weight % (USER)"]]);
    if (!pool.approved) issue("Error",`Activity Allocations row ${excelRow}`,`Pool ${key} is not approved.`);
    if (!activity) issue("Error",`Activity Allocations row ${excelRow}`,`Activity '${id || "blank"}' was not found in the uploaded XER.`);
    if (id === "L0E10000" || /construction cost|holding account/i.test(activity?.name || "")) issue("Error",`Activity Allocations row ${excelRow}`,"Cannot allocate back to the construction holding activity.");
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) issue("Error",`Activity Allocations row ${excelRow}`,"Allocation weight must be greater than 0 and at most 100.");
    const pair = `${key}::${id}`;
    if (used.has(pair)) issue("Error",`Activity Allocations row ${excelRow}`,`Duplicate activity ${id} within pool ${key}.`);
    used.add(pair);
    pool.allocations.push({id,weight,excelRow,activityName:activity?.name || ""});
  }
  let approvedTotal = 0, allocatedTotal = 0;
  for (const pool of poolMap.values()) {
    if (!pool.approved) continue;
    const priorErrors = issues.filter(x => x.severity === "Error" && (x.location === `Cost Pools row ${pool.excelRow}` || pool.allocations.some(y => x.location === `Activity Allocations row ${y.excelRow}`))).length;
    if (!pool.allocations.length) issue("Error",`Cost Pools row ${pool.excelRow}`,"Approved pool has no selected activities.");
    pool.weight = pool.allocations.reduce((sum,x) => sum + (Number.isFinite(x.weight) ? x.weight : 0),0);
    if (Math.abs(pool.weight - 100) > 0.0001) issue("Error",`Cost Pools row ${pool.excelRow}`,`Weights total ${pool.weight.toFixed(4)}%, not 100%.`);
    if (Number.isFinite(pool.approvedAmount) && pool.approvedAmount > 0) {
      approvedTotal += pool.approvedAmount;
      pool.allocated = cents(pool.allocations.reduce((sum,x) => sum + (Number.isFinite(x.weight) ? pool.approvedAmount*x.weight/100 : 0),0));
      allocatedTotal += pool.allocated;
      if (Math.abs(pool.allocated - pool.approvedAmount) > 0.01) issue("Error",`Cost Pools row ${pool.excelRow}`,"Calculated allocations do not reconcile to approved amount.");
    }
    pool.status = priorErrors || issues.some(x => x.severity === "Error" && (x.location === `Cost Pools row ${pool.excelRow}` || pool.allocations.some(y => x.location === `Activity Allocations row ${y.excelRow}`))) ? "Needs correction" : "Review required";
  }
  const clinTotals = new Map();
  for (const pool of poolMap.values()) if (pool.approved && clins.has(normClin(pool.clin)) && Number.isFinite(pool.approvedAmount)) {
    const id = normClin(pool.clin);
    clinTotals.set(id,(clinTotals.get(id)||0)+pool.approvedAmount);
  }
  for (const [id,total] of clinTotals) {
    const awarded = Number(clins.get(id).amount);
    if (total > awarded + 0.01) issue("Error","CLIN reconciliation",`Approved pools for CLIN ${clins.get(id).id} total $${cents(total).toLocaleString()}, exceeding its $${cents(awarded).toLocaleString()} award.`);
  }
  // The audit's activity-level totals do not establish a reliable editable holding-resource balance.
  // Flag this as a separate required reconciliation, never claim that an XER is ready.
  issue("Warning","Holding account","Construction holding resource assignment balance must be independently verified before any XER modification.");
  const pools = [...poolMap.values()];
  if (!pools.some(x => x.approved)) issue("Warning","Approval","No approved cost pools entered; this is still an unapproved template.");
  if (sourceSheet && pools.some(x => !x.key.startsWith(`${sourceSheet}::`))) issue("Warning","Source","Workbook includes cost pools from a different estimate source worksheet; verify against the uploaded estimate.");
  return {pools,issues,selectedRows,approvedPools:pools.filter(x=>x.approved).length,approvedTotal:cents(approvedTotal),allocatedTotal:cents(allocatedTotal),errorCount:issues.filter(x=>x.severity==="Error").length,readyForXer:false};
}
