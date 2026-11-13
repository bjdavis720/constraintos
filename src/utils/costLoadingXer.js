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
  // Patch 05C: assignment-level holding-account diagnostics, read-only.
  // Do not infer transferable funds solely from a TASK budget.
  const holdingTasks = tasks.filter(t => {
    const activityId = String(t.task_code || "").trim();
    const activityName = String(t.task_name || "").trim();
    // P6 uses the letter O in LOE10000, not the numeral zero.
    // Retain the old spelling as a fallback for schedules using that ID.
    return /^(?:LOE10000|L0E10000)$/i.test(activityId)
      || /^construction cost$/i.test(activityName)
      || /construction (?:cost )?(?:holding|lump.sum)/i.test(activityName);
  });
  const holdingAccounts = holdingTasks.map(task => {
    const rows = assignments.filter(r => r.task_id === task.task_id).map(r => {
      const resource = resourceById.get(r.rsrc_id);
      const budget = amount(r.target_cost);
      const actual = amount(r.act_reg_cost) + amount(r.act_ot_cost);
      const remaining = amount(r.remain_cost);
      return {
        assignmentId: r.taskrsrc_id || "", resourceId: r.rsrc_id || "",
        resourceCode: resource?.rsrc_short_name || "",
        resourceName: resource?.rsrc_name || "",
        budget, actual, remaining,
        difference: budget - actual - remaining,
        resourceType: resource?.rsrc_type || "",
        // Patch 05D: preserve original XER assignment fields as text.  Do not
        // infer rates or convert units: Primavera exports vary by version.
        xerFields: Object.entries(r)
          .filter(([key]) => /(?:cost|qty|unit|rate|price|curv|target|remain|act_|ot_|rsrc)/i.test(key))
          .map(([field, value]) => ({ field, value: String(value ?? "") })),

      };
    });
    const budget = rows.reduce((v,r)=>v+r.budget,0);
    const actual = rows.reduce((v,r)=>v+r.actual,0);
    const remaining = rows.reduce((v,r)=>v+r.remaining,0);
    return {
      taskId: task.task_id, activityId: task.task_code || "", name: task.task_name || "",
      budget, actual, remaining, difference: budget - actual - remaining,
      assignments: rows,
      hasDiscrepancies: rows.some(r=>Math.abs(r.difference)>0.01 || r.remaining<0),
    };
  });
  // Patch 05G: read-only receiving-activity resource assignment inventory.
  // Preserve raw fields for auditing; never mutate the source XER.
  const assignmentDetailsByTask = {};
  for (const r of assignments) {
    const resource = resourceById.get(r.rsrc_id);
    const record = {
      assignmentId: r.taskrsrc_id || "",
      taskId: r.task_id || "",
      resourceId: r.rsrc_id || "",
      resourceCode: resource?.rsrc_short_name || "",
      resourceName: resource?.rsrc_name || "",
      resourceType: r.rsrc_type || resource?.rsrc_type || "",
      budget: amount(r.target_cost),
      actual: amount(r.act_reg_cost) + amount(r.act_ot_cost),
      remaining: amount(r.remain_cost),
      targetQty: r.target_qty ?? "",
      remainQty: r.remain_qty ?? "",
      actualQty: r.act_reg_qty ?? "",
      costPerQty: r.cost_per_qty ?? "",
      rateType: r.rate_type ?? "",
      costQtyLinkFlag: r.cost_qty_link_flag ?? "",
      xerFields: Object.entries(r).map(([field,value]) => ({field,value:String(value ?? "")})),
    };
    (assignmentDetailsByTask[r.task_id] ||= []).push(record);
  }
  const activityCodeDiagnostics = activityCodeTypes.map(type => {
    const matching = tasks.filter(task => codesByTask.get(task.task_id)?.[type.id]);
    const values = new Map();
    for (const task of matching) {
      const code = codesByTask.get(task.task_id)[type.id];
      const key = `${code.code} — ${code.description}`;
      values.set(key, (values.get(key) || 0) + 1);
    }
    return { ...type, assignedActivities: matching.length, distinctValues: values.size,
      values: [...values].sort((a,b) => b[1]-a[1]).map(([label,count]) => ({label,count})) };
  });
  const assignmentDiagnostics = assignments.reduce((out,r) => {
    const budget=amount(r.target_cost), actual=amount(r.act_reg_cost)+amount(r.act_ot_cost), remaining=amount(r.remain_cost);
    if (Math.abs(budget-actual-remaining)>0.01) {out.count++;out.difference+=budget-actual-remaining;}
    if (remaining<0) out.negativeRemaining++;
    return out;
  },{count:0,difference:0,negativeRemaining:0});
  const activities = tasks.map(t => {
    const a = byTask.get(t.task_id);
    const w = wbsById.get(t.wbs_id);
    return {taskId:t.task_id, activityId:t.task_code || "", name:t.task_name || "", wbs:w?.wbs_name || w?.wbs_short_name || "Unassigned", wbsId:t.wbs_id || "", codes:codesByTask.get(t.task_id) || {}, start:t.target_start_date || t.act_start_date || "", finish:t.target_end_date || t.act_end_date || t.early_end_date || "", budget:a?.budget || 0, actual:a?.actual || 0, remaining:a?.remaining || 0, assignments:a?.count || 0, resources:[...(a?.resources || [])].join(", ")};
  });
  const totals = activities.reduce((v,a)=>({budget:v.budget+a.budget,actual:v.actual+a.actual,remaining:v.remaining+a.remaining}),{budget:0,actual:0,remaining:0});
  const group = new Map();
  for (const a of activities) { const g = group.get(a.wbsId) || {wbs:a.wbs, count:0, budget:0}; g.count++; g.budget+=a.budget; group.set(a.wbsId,g); }
  return {activities, wbsNodes:wbs.map(r=>({id:String(r.wbs_id||""),parentId:String(r.parent_wbs_id||""),name:r.wbs_name||r.wbs_short_name||"Unnamed WBS",code:r.wbs_short_name||""})), totals, holdingAccounts, assignmentDetailsByTask, wbs:[...group.values()].sort((a,b)=>b.budget-a.budget), activityCodeTypes, activityCodeDiagnostics, assignmentDiagnostics, resources:resources.map(r=>({id:r.rsrc_id, code:r.rsrc_short_name, name:r.rsrc_name, type:r.rsrc_type})), activityCount:tasks.length, assignmentCount:assignments.length, unassignedCount:activities.filter(a=>!a.assignments).length, tables:Object.keys(tables).length};
}
