import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { auditCostLoadingXer } from "../utils/costLoadingXer.js";
import "./CostLoadingIntelligence.css";

const AWARDED_CLINS = [
  ["0001","Design Phase",10898548],
  ["0002","Construction Phase",91057001],
  ["0003","Tenant FFE",1158286],
  ["0004","NI Building Matching Exterior Envelope",1210632],
  ["0006","Below Grade Unforeseen",877450],
  ["0007","Contamination / Remediation",45000],
  ["0008","Cultural Artifacts",500000],
  ["0009","CBP Unidentified Equipment Infrastructure",100000],
  ["0010","Septic Field",316000],
];
const makeClins = () => AWARDED_CLINS.map(([id,name,amount])=>({id,name,amount,accepted:true}));
const usd = n => new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(n);
const codeLabel = (activity, key) => {
  if (key === "wbs") return activity.wbs || "Unassigned";
  if (key === "none") return "All activities";
  const code = activity.codes?.[key];
  return code ? [code.code, code.description].filter(Boolean).join(" — ") : "Unassigned";
};
const compare = (a, b, key, descending) => {
  const av = key === "budget" ? a.budget : key === "start" ? a.start : a.activityId;
  const bv = key === "budget" ? b.budget : key === "start" ? b.start : b.activityId;
  const result = typeof av === "number" ? av - bv : String(av || "").localeCompare(String(bv || ""), undefined, {numeric:true});
  return descending ? -result : result;
};
export default function CostLoadingIntelligence({projectName}) {
  const [audit,setAudit] = useState(null);
  const [estimate,setEstimate] = useState(null);
  const [estimateError,setEstimateError] = useState("");
  const [clins,setClins] = useState(makeClins);
  const [clinCodeType,setClinCodeType] = useState("");
  const [clinFilter,setClinFilter] = useState("all");
  async function loadEstimate(e) {
    const file=e.target.files?.[0]; if(!file) return;
    setEstimateError(""); setEstimate(null);
    try {
      if(!/\.xlsx?$/i.test(file.name)) throw new Error("Choose an Excel estimate (.xlsx or .xls).");
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
      const sheets=workbook.SheetNames.map(name=>{
        const ws=workbook.Sheets[name];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
        return {name,rowCount:rows.filter(row=>row.some(value=>String(value).trim())).length,preview:rows.filter(row=>row.some(value=>String(value).trim())).slice(0,8).map(row=>row.slice(0,7))};
      });
      setEstimate({filename:file.name,sheets});
    } catch(err){setEstimateError(err.message||"Unable to read estimate.");}
  }
  function changeClin(id,field,value) {setClins(old=>old.map(c=>c.id===id?{...c,[field]:value}:c));}
  const selectedTotal=clins.reduce((sum,c)=>sum+(c.accepted?(Number(c.amount)||0):0),0);
  const selectedClinDiagnostic = audit?.activityCodeDiagnostics?.find(t=>t.id===clinCodeType);
  const clinSummary=useMemo(()=>{
    if(!audit || !clinCodeType) return [];
    return clins.filter(c=>c.accepted).map(c=>{
      const matched=audit.activities.filter(a=>String(a.codes?.[clinCodeType]?.code||"").replace(/^0+/,"")===c.id.replace(/^0+/,""));
      const loaded=matched.reduce((sum,a)=>sum+a.budget,0);
      return {...c,loaded,count:matched.length,difference:Number(c.amount)-loaded};
    });
  },[audit,clinCodeType,clins]);
  const [filename,setFilename] = useState("");
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [primary,setPrimary] = useState("none");
  const [secondary,setSecondary] = useState("none");
  const [sort,setSort] = useState("activityId");
  const [descending,setDescending] = useState(false);
  const [collapsed,setCollapsed] = useState({});
  async function loadFile(e) {
    const file=e.target.files?.[0]; if (!file) return;
    setError(""); setAudit(null); setFilename(file.name);
    try {
      if (!file.name.toLowerCase().endsWith(".xer")) throw new Error("Choose a P6 .xer file.");
      const parsed=auditCostLoadingXer(await file.text());
      if (!parsed.activityCount) throw new Error("No TASK activities were found in this XER.");
      setAudit(parsed); setPrimary("none"); setSecondary("none"); setCollapsed({});
      setClinCodeType(parsed.activityCodeTypes.find(t=>/\bclin\b/i.test(t.name))?.id||""); setClinFilter("all");
    } catch (err) { setError(err.message || "Unable to parse XER."); }
  }
  const groupOptions = [{value:"none",label:"No grouping"},{value:"wbs",label:"WBS"},...(audit?.activityCodeTypes || []).map(t=>({value:t.id,label:t.name}))];
  const result = useMemo(() => {
    if (!audit) return {groups:[],count:0};
    const query=search.trim().toLowerCase();
    const filtered=audit.activities.filter(a => (clinFilter==="all" || (clinCodeType && (clinFilter==="unassigned" ? !a.codes?.[clinCodeType] : String(a.codes?.[clinCodeType]?.code||"").replace(/^0+/,"")===clinFilter.replace(/^0+/,"")))) && [a.activityId,a.name,a.wbs,...Object.values(a.codes || {}).flatMap(c=>[c.code,c.description])].join(" ").toLowerCase().includes(query));
    const sorted=[...filtered].sort((a,b)=>compare(a,b,sort,descending));
    const groups=new Map();
    for (const activity of sorted) {
      const first=codeLabel(activity,primary);
      const second=secondary === "none" ? "" : codeLabel(activity,secondary);
      const key=JSON.stringify([first,second]);
      if (!groups.has(key)) groups.set(key,{key,first,second,rows:[],budget:0,actual:0,remaining:0});
      const g=groups.get(key);g.rows.push(activity);g.budget+=activity.budget;g.actual+=activity.actual;g.remaining+=activity.remaining;
    }
    return {groups:[...groups.values()].sort((a,b)=>a.first.localeCompare(b.first,undefined,{numeric:true}) || a.second.localeCompare(b.second,undefined,{numeric:true})),count:filtered.length};
  },[audit,search,primary,secondary,sort,descending,clinFilter,clinCodeType]);
  function sortColumn(column) {if(sort===column) setDescending(v=>!v);else {setSort(column);setDescending(column==="budget");}}
  return <section className="cli-page">
    <h2>Cost Loading Intelligence</h2>
    <p>Phase 1 — Read-only XER cost audit. No schedule or resource assignments will be changed.</p>
    <div className="cli-panel"><strong>Project: {projectName || "Selected project"}</strong><p>Upload a Primavera P6 XER to inspect existing activity-level cost assignments.</p><input type="file" accept=".xer" onChange={loadFile}/>{filename && <p>File: {filename}</p>}{error && <p role="alert" className="cli-error">{error}</p>}</div>
    <div className="cli-panel">
      <h3>Estimate import & awarded CLINs</h3>
      <p>Upload the estimate for a read-only sheet inventory.  CLIN values below are prefilled from the Grand Portage award and can be edited for other projects.  No automatic estimate-to-activity mapping is performed in this patch.</p>
      <label>Estimate workbook <input type="file" accept=".xlsx,.xls" onChange={loadEstimate}/></label>
      {estimateError && <p role="alert" className="cli-error">{estimateError}</p>}
      {estimate && <><strong>{estimate.filename} — {estimate.sheets.length} worksheets</strong><div className="cli-sheet-list">{estimate.sheets.map(sh=><details key={sh.name}><summary>{sh.name} — {sh.rowCount} populated rows</summary><div className="cli-table-wrap"><table><tbody>{sh.preview.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div></details>)}</div></>}
      <div className="cli-table-wrap"><table><thead><tr><th>Accepted</th><th>CLIN</th><th>Description</th><th>Awarded value (editable)</th></tr></thead><tbody>{clins.map(c=><tr key={c.id}><td><input aria-label={`Accepted CLIN ${c.id}`} type="checkbox" checked={c.accepted} onChange={e=>changeClin(c.id,"accepted",e.target.checked)}/></td><td>{c.id}</td><td>{c.name}</td><td><input aria-label={`Awarded value CLIN ${c.id}`} type="number" min="0" step="0.01" value={c.amount} onChange={e=>changeClin(c.id,"amount",e.target.value)}/></td></tr>)}</tbody></table></div>
      <strong>Selected awarded CLIN total: {usd(selectedTotal)}</strong>
      <p className="cli-footnote">Award values are contract values, not estimated direct costs.  Changes are local to this page and are not yet saved to project data.</p>
    </div>
    {audit && <div className="cli-panel"><h3>CLIN reconciliation — preliminary</h3>
      <label>P6 CLIN activity-code type <select value={clinCodeType} onChange={e=>{setClinCodeType(e.target.value);setClinFilter("all");}}><option value="">Select a CLIN activity code</option>{audit.activityCodeTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {selectedClinDiagnostic && <p className="cli-footnote">Code assignments found: <strong>{selectedClinDiagnostic.assignedActivities}</strong> activities; <strong>{selectedClinDiagnostic.distinctValues}</strong> distinct values. {selectedClinDiagnostic.assignedActivities===0 ? "No activities carry this code type in the uploaded XER." : "If CLIN reconciliation is empty, inspect the actual values below."}</p>}
      {!clinCodeType ? <p>Choose the activity code that identifies CLINs to compare assigned activity costs.</p> : <><p className="cli-footnote">Only directly coded activities are counted.  Lump-sum holding activities, uncoded activities, and shared scope are not automatically allocated to CLINs.</p><div className="cli-table-wrap"><table><thead><tr><th>CLIN</th><th>Accepted award</th><th>Coded activities</th><th>Existing coded loading</th><th>Reconciliation status / difference</th></tr></thead><tbody>{clinSummary.map(c=><tr key={c.id}><td>{c.id} — {c.name}</td><td>{usd(Number(c.amount)||0)}</td><td>{c.count}</td><td>{usd(c.loaded)}</td><td>{c.count===0 ? "Not mapped" : usd(c.difference)}</td></tr>)}</tbody></table></div></>}
      <details><summary>Activity-code diagnostics — assignments and actual XER values</summary>
        <div className="cli-table-wrap"><table><thead><tr><th>Activity code type</th><th>Assigned activities</th><th>Distinct values</th><th>Values (activity count)</th></tr></thead><tbody>
          {audit.activityCodeDiagnostics.map(type=><tr key={type.id}><td>{type.name}</td><td>{type.assignedActivities}</td><td>{type.distinctValues}</td><td>{type.values.length ? type.values.map(v=>`${v.label} (${v.count})`).join("; ") : "None"}</td></tr>)}
        </tbody></table></div>
      </details>
      <details><summary>Resource-assignment cost diagnostics</summary>
        <p>Budgeted cost: {usd(audit.totals.budget)} · Actual cost: {usd(audit.totals.actual)} · Remaining cost: {usd(audit.totals.remaining)}</p>
        <p>Budget − actual − remaining: <strong>{usd(audit.totals.budget-audit.totals.actual-audit.totals.remaining)}</strong>.</p>
        <p>{audit.assignmentDiagnostics.count} resource assignments do not satisfy budget = actual + remaining (tolerance $0.01). {audit.assignmentDiagnostics.negativeRemaining} assignments have negative remaining cost. These are diagnostic observations, not corrections or earned-cost calculations.</p>
      </details>
      <p>Whole-schedule budget: <strong>{usd(audit.totals.budget)}</strong> · Selected award: <strong>{usd(selectedTotal)}</strong> · Difference: <strong>{usd(selectedTotal-audit.totals.budget)}</strong></p>
    </div>}
    {audit && <>
      <div className="cli-metrics">{[["Activities",audit.activityCount],["Resource assignments",audit.assignmentCount],["Activities without assignments",audit.unassignedCount],["Budgeted cost",usd(audit.totals.budget)],["Actual cost (XER fields)",usd(audit.totals.actual)],["Remaining cost",usd(audit.totals.remaining)]].map(([k,v])=><div className="cli-metric" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
      <div className="cli-panel"><h3>Resource dictionary</h3><p>{audit.resources.length} resources found. {audit.resources.some(r=>r.code==="MCGSTANDCOSTONLY") ? "McGough standard cost resource detected." : "McGough standard cost resource not detected."}</p><div className="cli-resource-list">{audit.resources.map(r=><span key={r.id}>{r.code || r.id} ({r.type})</span>)}</div></div>
      <div className="cli-panel">
        <div className="cli-toolbar"><h3>Existing cost loading</h3>{clinCodeType && <label>CLIN filter <select value={clinFilter} onChange={e=>setClinFilter(e.target.value)}><option value="all">All CLINs</option><option value="unassigned">Unassigned</option>{clins.map(c=><option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}</select></label>}<label>Primary group <select value={primary} onChange={e=>{setPrimary(e.target.value);if(e.target.value===secondary)setSecondary("none");}}>{groupOptions.filter(o=>o.value!==secondary || o.value==="none").map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label>Secondary group <select value={secondary} onChange={e=>setSecondary(e.target.value)}>{groupOptions.filter(o=>o.value!==primary || o.value==="none").map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><input aria-label="Filter cost audit" placeholder="Search activities, WBS, or activity codes" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <p className="cli-footnote">{audit.activityCodeTypes.length} P6 activity-code types detected. Click a column heading to sort. Group headings can be expanded or collapsed.</p>
        <div className="cli-table-wrap"><table><thead><tr><th><button className="cli-sort" onClick={()=>sortColumn("activityId")}>Activity ID {sort==="activityId"?(descending?"▼":"▲"):""}</button></th><th>Activity</th><th>WBS</th>{audit.activityCodeTypes.map(t=><th key={t.id}>{t.name}</th>)}<th>Assignments</th><th><button className="cli-sort" onClick={()=>sortColumn("budget")}>Budgeted cost {sort==="budget"?(descending?"▼":"▲"):""}</button></th><th>Actual cost</th><th>Remaining cost</th></tr></thead><tbody>
          {result.groups.map(g=><FragmentGroup key={g.key} group={g} types={audit.activityCodeTypes} grouped={primary!=="none" || secondary!=="none"} collapsed={Boolean(collapsed[g.key])} toggle={()=>setCollapsed(v=>({...v,[g.key]:!v[g.key]}))}/>)}
        </tbody></table></div><p className="cli-footnote">Showing {result.count} matching activities. Cost figures are read-only. Estimate matching and XER writing follow in later patches.</p>
      </div>
    </>}
  </section>;
}
function FragmentGroup({group,types,grouped,collapsed,toggle}) {
  const cols=7+types.length;
  return <>
    {grouped && <tr className="cli-group-row"><td colSpan={cols}><button onClick={toggle}>{collapsed?"▸":"▾"} {group.first}{group.second?` / ${group.second}`:""} — {group.rows.length} activities — {usd(group.budget)}</button></td></tr>}
    {!collapsed && group.rows.map(r=><tr key={r.taskId}><td>{r.activityId}</td><td>{r.name}</td><td>{r.wbs}</td>{types.map(t=><td key={t.id}>{codeLabel(r,t.id)}</td>)}<td>{r.assignments}</td><td>{usd(r.budget)}</td><td>{usd(r.actual)}</td><td>{usd(r.remaining)}</td></tr>)}
  </>;
}
