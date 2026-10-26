import { useMemo, useState } from "react";
import { auditCostLoadingXer } from "../utils/costLoadingXer.js";
import "./CostLoadingIntelligence.css";

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
    } catch (err) { setError(err.message || "Unable to parse XER."); }
  }
  const groupOptions = [{value:"none",label:"No grouping"},{value:"wbs",label:"WBS"},...(audit?.activityCodeTypes || []).map(t=>({value:t.id,label:t.name}))];
  const result = useMemo(() => {
    if (!audit) return {groups:[],count:0};
    const query=search.trim().toLowerCase();
    const filtered=audit.activities.filter(a => [a.activityId,a.name,a.wbs,...Object.values(a.codes || {}).flatMap(c=>[c.code,c.description])].join(" ").toLowerCase().includes(query));
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
  },[audit,search,primary,secondary,sort,descending]);
  function sortColumn(column) {if(sort===column) setDescending(v=>!v);else {setSort(column);setDescending(column==="budget");}}
  return <section className="cli-page">
    <h2>Cost Loading Intelligence</h2>
    <p>Phase 1 — Read-only XER cost audit. No schedule or resource assignments will be changed.</p>
    <div className="cli-panel"><strong>Project: {projectName || "Selected project"}</strong><p>Upload a Primavera P6 XER to inspect existing activity-level cost assignments.</p><input type="file" accept=".xer" onChange={loadFile}/>{filename && <p>File: {filename}</p>}{error && <p role="alert" className="cli-error">{error}</p>}</div>
    {audit && <>
      <div className="cli-metrics">{[["Activities",audit.activityCount],["Resource assignments",audit.assignmentCount],["Activities without assignments",audit.unassignedCount],["Budgeted cost",usd(audit.totals.budget)],["Actual cost (XER fields)",usd(audit.totals.actual)],["Remaining cost",usd(audit.totals.remaining)]].map(([k,v])=><div className="cli-metric" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
      <div className="cli-panel"><h3>Resource dictionary</h3><p>{audit.resources.length} resources found. {audit.resources.some(r=>r.code==="MCGSTANDCOSTONLY") ? "McGough standard cost resource detected." : "McGough standard cost resource not detected."}</p><div className="cli-resource-list">{audit.resources.map(r=><span key={r.id}>{r.code || r.id} ({r.type})</span>)}</div></div>
      <div className="cli-panel">
        <div className="cli-toolbar"><h3>Existing cost loading</h3><label>Primary group <select value={primary} onChange={e=>{setPrimary(e.target.value);if(e.target.value===secondary)setSecondary("none");}}>{groupOptions.filter(o=>o.value!==secondary || o.value==="none").map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label>Secondary group <select value={secondary} onChange={e=>setSecondary(e.target.value)}>{groupOptions.filter(o=>o.value!==primary || o.value==="none").map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><input aria-label="Filter cost audit" placeholder="Search activities, WBS, or activity codes" value={search} onChange={e=>setSearch(e.target.value)}/></div>
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
