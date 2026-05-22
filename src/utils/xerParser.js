import { normalizeScheduleRow } from "./scheduleDeltaUtils.js";

function cleanDate(value) {
  if (!value) return "";
  return String(value).split(" ")[0].trim();
}

function parseNumber(value) {
  if (!value) return 0;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isNaN(number) ? 0 : number;
}

function parseFloatDaysFromHours(value) {
  if (!value) return "";
  const hours = Number(String(value).replace(/[^\d.-]/g, ""));
  if (Number.isNaN(hours)) return "";
  return Math.round((hours / 8) * 10) / 10;
}

export function parseXER(text) {
  const lines = text.split(/\r?\n/);

  let currentTable = "";
  let fields = [];

  const taskRows = [];
const taskResourceRows = [];
const activityTypeRows = [];
const activityCodeRows = [];
const taskActivityCodeRows = [];
const taskPredRows = [];

  lines.forEach((line) => {
    if (!line.trim()) return;

    const parts = line.split("\t");
    const marker = parts[0];

    if (marker === "%T") {
      currentTable = parts[1] || "";
      fields = [];
      return;
    }

    if (marker === "%F") {
      fields = parts.slice(1);
      return;
    }

    if (marker !== "%R") return;

    const values = parts.slice(1);
    const row = {};

    fields.forEach((field, index) => {
      row[field] = values[index] || "";
    });

    if (currentTable === "TASK") taskRows.push(row);
if (currentTable === "TASKRSRC") taskResourceRows.push(row);
if (currentTable === "ACTVTYPE") activityTypeRows.push(row);
if (currentTable === "ACTVCODE") activityCodeRows.push(row);
if (currentTable === "TASKACTV") taskActivityCodeRows.push(row);
if (currentTable === "TASKPRED") taskPredRows.push(row);
  });

  const activityTypeById = {};
  activityTypeRows.forEach((row) => {
    activityTypeById[row.actv_code_type_id] =
      row.actv_code_type || row.actv_code_type_name || "";
  });

  const activityCodeById = {};
  activityCodeRows.forEach((row) => {
    const typeName = activityTypeById[row.actv_code_type_id] || "";
    const codeValue = row.short_name || row.actv_code_name || "";
    const description = row.actv_code_name || row.short_name || "";

    activityCodeById[row.actv_code_id] = {
      typeId: row.actv_code_type_id,
      typeName,
      value: codeValue,
      description,
    };
  });

  const activityCodesByTaskId = {};
  taskActivityCodeRows.forEach((row) => {
    const taskId = row.task_id;
    const code = activityCodeById[row.actv_code_id];

    if (!taskId || !code) return;

    const key = code.typeName || code.typeId || "Activity Code";

    if (!activityCodesByTaskId[taskId]) {
      activityCodesByTaskId[taskId] = {};
    }

    activityCodesByTaskId[taskId][key] = {
      value: code.value,
      description: code.description,
      typeId: code.typeId,
    };
  });

  const costByTaskId = {};

  taskResourceRows.forEach((resourceRow) => {
    const taskId = resourceRow.task_id;
    if (!taskId) return;

    const targetCost = parseNumber(resourceRow.target_cost);
    const remainingCost = parseNumber(resourceRow.remain_cost);
    const actualCost =
      parseNumber(resourceRow.act_reg_cost) +
      parseNumber(resourceRow.act_ot_cost);

    if (!costByTaskId[taskId]) {
      costByTaskId[taskId] = {
        budgetAtCompletion: 0,
        remainingCost: 0,
        actualCost: 0,
      };
    }

    costByTaskId[taskId].budgetAtCompletion += targetCost;
    costByTaskId[taskId].remainingCost += remainingCost;
    costByTaskId[taskId].actualCost += actualCost;
  });
const activityIdByTaskId = {};

taskRows.forEach((row) => {
  activityIdByTaskId[row.task_id] = row.task_code;
});

const relationships = taskPredRows
  .map((row) => ({
    predTaskId: activityIdByTaskId[row.pred_task_id],
    succTaskId: activityIdByTaskId[row.task_id],
    type: row.pred_type || "",
    lag: parseFloatDaysFromHours(row.lag_hr_cnt),
  }))
  .filter((rel) => rel.predTaskId && rel.succTaskId);
  const tasks = taskRows.map((row) => {
    const totalFloat =
      parseFloatDaysFromHours(row.total_float_hr_cnt) ||
      row.total_float_hr_cnt ||
      "";

    const costs = costByTaskId[row.task_id] || {
      budgetAtCompletion: 0,
      remainingCost: 0,
      actualCost: 0,
    };

    const activityCodes = activityCodesByTaskId[row.task_id] || {};

    return {
      ...normalizeScheduleRow({
        "Activity ID": row.task_code,
        "Activity Name": row.task_name,
        Start:
          cleanDate(row.act_start_date) ||
          cleanDate(row.early_start_date) ||
          cleanDate(row.target_start_date) ||
          cleanDate(row.restart_date),
        Finish:
          cleanDate(row.act_end_date) ||
          cleanDate(row.early_end_date) ||
          cleanDate(row.target_end_date) ||
          cleanDate(row.reend_date),
        "Total Float": totalFloat,
        Critical: Number(totalFloat) <= 0 ? "Yes" : "No",
      }),
      taskId: row.task_id,
      taskType: row.task_type || row.task_type_code || "",
      activityCodes,
      ...activityCodes,
      budgetAtCompletion: Math.round(costs.budgetAtCompletion * 100) / 100,
      remainingCost: Math.round(costs.remainingCost * 100) / 100,
      actualCost: Math.round(costs.actualCost * 100) / 100,
    };
  });

  const filteredTasks = tasks.filter((task) => task.activityId && task.activityName);

return {
  activities: filteredTasks,
  relationships,
};
}