import * as XLSX from "xlsx";

// Adds approved USER rows to the original workbook without changing any existing rows.
// The 05B validator remains the source of truth for approval and CLIN reconciliation.
const clean = v => String(v ?? "").trim();
const key = v => clean(v).toUpperCase();
const toNum = v => Number(v) || 0;
export function buildBulkAllocationWorkbook(workbook, poolKey, activityIds, weights, audit) {
  if (!workbook) throw new Error("Upload the existing allocation workbook first.");
  if (!poolKey) throw new Error("Select a cost pool.");
  if (!activityIds?.length) throw new Error("Select one or more P6 activities.");
  const selected = [...new Set(activityIds.map(key))];
  if (selected.length !== activityIds.length) throw new Error("Duplicate activity IDs selected.");
  const known = new Set((audit?.activities || []).map(a => key(a.activityId)));
  for (const id of selected) {
    if (!known.has(id)) throw new Error(`Unknown P6 activity: ${id}`);
    if (id === "LOE10000" || id === "L0E10000") throw new Error("Cannot allocate to the holding activity.");
  }
  const values = selected.map(id => toNum(weights?.[id]));
  if (values.some(n => !Number.isFinite(n) || n <= 0 || n > 100))
    throw new Error("Every selected activity must have a positive weight at most 100%.");
  if (Math.abs(values.reduce((s,n)=>s+n,0)-100) > 0.0001)
    throw new Error("Allocation weights must total exactly 100%.");

  const output = XLSX.utils.book_new();
  for (const name of workbook.SheetNames) {
    const original = workbook.Sheets[name];
    // Preserve worksheet cells, formatting and column widths where supported by SheetJS.
    const clone = JSON.parse(JSON.stringify(original));
    XLSX.utils.book_append_sheet(output, clone, name);
  }
  const sheet = output.Sheets["Activity Allocations"];
  if (!sheet) throw new Error("Workbook is missing the Activity Allocations tab.");
  const rows = XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:true});
  const header = rows[0] || [];
  const col = name => {
    const i=header.findIndex(v=>clean(v)===name);
    if(i<0)throw new Error(`Missing Activity Allocations column: ${name}`);
    return i;
  };
  const poolCol=col("Pool Key"), idCol=col("Activity ID (USER)");
  const yesCol=col("Selected? (YES)"), weightCol=col("Allocation Weight % (USER)");
  const selectedSet=new Set(selected);
  // Replace the selection for this pool, retaining unrelated pools untouched.
  // Clear old approvals on existing candidate rows for this pool.
  const existing=new Set();
  for(let i=1;i<rows.length;i++){
    const row=rows[i];
    if(clean(row[poolCol])!==poolKey)continue;
    const id=key(row[idCol]);
    row[yesCol]="NO";row[weightCol]="";
    if(selectedSet.has(id)){
      if(existing.has(id))throw new Error(`Duplicate candidate row for ${id}; resolve in Excel first.`);
      row[yesCol]="YES";row[weightCol]=values[selected.indexOf(id)];existing.add(id);
    }
  }
  for(const id of selected)if(!existing.has(id)){
    const row=Array(header.length).fill("");
    row[poolCol]=poolKey;row[idCol]=id;row[yesCol]="YES";row[weightCol]=values[selected.indexOf(id)];
    rows.push(row);
  }
  // Rebuild only the Activity Allocations worksheet. Other tabs remain as originally exported.
  const replaced=XLSX.utils.aoa_to_sheet(rows);
  replaced["!cols"]=sheet["!cols"];
  output.Sheets["Activity Allocations"]=replaced;
  return {workbook:output,rowsAdded:selected.length-existing.size,selected:selected.length};
}
export function downloadBulkAllocationWorkbook(result){
  XLSX.writeFile(result.workbook,"Sentinel-06B-Bulk-Allocation-Review.xlsx");
}
