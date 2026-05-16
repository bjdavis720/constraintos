import { normalizeScheduleRow } from "./scheduleDeltaUtils.js";

function cleanDate(value) {
  if (!value) return "";

  return String(value).split(" ")[0].trim();
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
  const tasks = [];

  lines.forEach((line) => {
    if (!line.trim()) return;

    const parts = line.split("\t");
    const marker = parts[0];

    if (marker === "%T") {
      currentTable = parts[1] || "";
      fields = [];
      return;
    }

    if (marker === "%F" && currentTable === "TASK") {
      fields = parts.slice(1);
      return;
    }

    if (marker === "%R" && currentTable === "TASK") {
      const values = parts.slice(1);
      const row = {};

      fields.forEach((field, index) => {
        row[field] = values[index] || "";
      });

      const totalFloat =
        parseFloatDaysFromHours(row.total_float_hr_cnt) ||
        row.total_float_hr_cnt ||
        "";

      tasks.push(
        normalizeScheduleRow({
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
        })
      );
    }
  });

  return tasks.filter((task) => task.activityId && task.activityName);
}