// Read-only XER audit. No XER mutations are performed in Patch 01.
const amount = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export function auditCostLoadingXer(text) {
  const tables = {};
  let table = "", columns = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split("\t");
    if (cells[0] === "%T") { table = cells[1]; columns = []; if (!tables[table]) tables[table] = []; }
    else if (cells[0] === "%F") columns = cells.slice(1);
    else if (cells[0] === "%R" && table) {
      const record = {};
      columns.forEach((key, i) => { record[key] = cells[i + 1] ?? ""; });
      tables[table].push(record);
    }
  }
  const tasks = tables.TASK || [], assignments = tables.TASKRSRC || [];
  const codeTypes = tables.ACTVTYPE || [];
  const codeValues = new Map((tables.ACTVCODE || []).map(r => [r.actv_code_id, r]));
  const codesByTask = new Map();
  for (const assignment of tables.TASKACTV || []) {
    const existing = codesByTask.get(assignment.task_id) || {};
    const value = codeValues.get(assignment.actv_code_id);
    if (value) existing[assignment.actv_code_type_id] = { code: value.short_name || "", description: value.actv_code_name || "" };
    codesByTask.set(assignment.task_id, existing);
  }
  const activityCodeTypes = codeTypes.map(r => ({ id: r.actv_code_type_id, name: r.actv_code_type || r.actv_code_type_id, scope: r.actv_code_type_scope || "" }));
  const resources = tables.RSRC || [], wbs = tables.PROJWBS || [];
  const resourceById = new Map(resources.map(r => [r.rsrc_id, r]));
  const wbsById = new Map(wbs.map(r => [r.wbs_id, r]));
  const byTask = new Map();
  for (const r of assignments) {
    const old = byTask.get(r.task_id) || {budget:0, actual:0, remaining:0, count:0, resources:new Set()};
    old.budget += amount(r.target_cost);
    old.actual += amount(r.act_reg_cost) + amount(r.act_ot_cost);
    old.remaining += amount(r.remain_cost);
    old.count++;
    const resource = resourceById.get(r.rsrc_id);
    if (resource) old.resources.add(resource.rsrc_short_name || resource.rsrc_name || r.rsrc_id);
    byTask.set(r.task_id, old);
  }
  const activities = tasks.map(t => {
    const a = byTask.get(t.task_id);
    const w = wbsById.get(t.wbs_id);
    return {taskId:t.task_id, activityId:t.task_code || "", name:t.task_name || "", wbs:w?.wbs_name || w?.wbs_short_name || "Unassigned", wbsId:t.wbs_id || "", codes:codesByTask.get(t.task_id) || {}, start:t.target_start_date || t.act_start_date || "", budget:a?.budget || 0, actual:a?.actual || 0, remaining:a?.remaining || 0, assignments:a?.count || 0, resources:[...(a?.resources || [])].join(", ")};
  });
  const totals = activities.reduce((v,a)=>({budget:v.budget+a.budget,actual:v.actual+a.actual,remaining:v.remaining+a.remaining}),{budget:0,actual:0,remaining:0});
  const group = new Map();
  for (const a of activities) { const g = group.get(a.wbsId) || {wbs:a.wbs, count:0, budget:0}; g.count++; g.budget+=a.budget; group.set(a.wbsId,g); }
  return {activities, totals, wbs:[...group.values()].sort((a,b)=>b.budget-a.budget), activityCodeTypes, resources:resources.map(r=>({id:r.rsrc_id, code:r.rsrc_short_name, name:r.rsrc_name, type:r.rsrc_type})), activityCount:tasks.length, assignmentCount:assignments.length, unassignedCount:activities.filter(a=>!a.assignments).length, tables:Object.keys(tables).length};
}
