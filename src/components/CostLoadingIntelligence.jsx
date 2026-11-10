import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { auditCostLoadingXer } from "../utils/costLoadingXer.js";
import { createMatchingReview, exportMatchingReview, getPoolActivityCandidates } from "../utils/costLoadingMatching.js";
import "./CostLoadingIntelligence.css";
import { validateCostLoadingAllocations } from "../utils/costLoadingAllocationValidation.js";
import { simulateCostLoadingTransfer } from "../utils/costLoadingSimulation.js";
import { prepareCostLoadingPreflight, downloadCostLoadingPreflight } from "../utils/costLoadingPreflight.js";
import { inspectReceivingAssignments } from "../utils/costLoadingAssignmentAudit.js";
import { prepareFieldLevelPreview } from "../utils/costLoadingFieldPreview.js";
import { compareRemainingCostPolicies } from "../utils/costLoadingRemainingPolicies.js";
import { prepareRemainingPolicyDecision } from "../utils/costLoadingPolicyDecision.js";
import { prepareXerTestPackage, downloadXerTestPackage } from "../utils/costLoadingTestPackage.js";
import { prepareBudgetOnlyPreview, downloadBudgetOnlyPreview } from "../utils/costLoadingBudgetOnly.js";
import { createBudgetOnlyTestXer, downloadBudgetOnlyTestXer } from "../utils/costLoadingXerTestExport.js";
import { reconcileP6Reexport, downloadP6Reconciliation } from "../utils/costLoadingP6Reconciliation.js";
import { reviewFullConstructionAllocation, downloadFullConstructionReview } from "../utils/costLoadingFullReadiness.js";
import { buildBulkAllocationWorkbook, downloadBulkAllocationWorkbook } from "../utils/costLoadingBulkAllocation.js";
import { calculatePool, summarizePools, dollars } from "../utils/costLoadingInApp.js";
import { readWorkspace, writeWorkspace, workspaceKey } from "../utils/costLoadingPersistence.js";
import { prepareInAppBridge, downloadInAppBridge } from "../utils/costLoadingInAppBridge.js";

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
  const [activeCostTab,setActiveCostTab] = useState("dashboard");
  const [showLegacyTools,setShowLegacyTools] = useState(false);
  const [audit,setAudit] = useState(null);
  const [xerSourceBytes,setXerSourceBytes] = useState(null);
  const [xerTestAcknowledged,setXerTestAcknowledged] = useState(false);
  const [p6ReexportText,setP6ReexportText] = useState("");
  const [p6ReexportName,setP6ReexportName] = useState("");
  const [p6ReexportError,setP6ReexportError] = useState("");
  const [filename,setFilename] = useState("");
  const [estimate,setEstimate] = useState(null);
  const [estimateError,setEstimateError] = useState("");
  const [matchingError,setMatchingError] = useState("");
  const [sourceSheet,setSourceSheet] = useState("Subcontractor Summary");
  const [clins,setClins] = useState(makeClins);
  const [clinCodeType,setClinCodeType] = useState("");
  const [clinFilter,setClinFilter] = useState("all");
  const [allocationWorkbook,setAllocationWorkbook] = useState(null);
  const [allocationWorkbookBytes,setAllocationWorkbookBytes] = useState(null);
  const [allocationFilename,setAllocationFilename] = useState("");
  const [allocationError,setAllocationError] = useState("");
  const [showAllAllocationIssues,setShowAllAllocationIssues] = useState(false);
  async function loadAllocationWorkbook(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAllocationError(""); setAllocationWorkbook(null); setAllocationFilename(file.name);
    try {
      if (!/\.xlsx?$/i.test(file.name)) throw new Error("Choose the completed allocation Excel workbook.");
      const raw = await file.arrayBuffer();
      const workbook = XLSX.read(raw, {type:"array"});
      if (!workbook.SheetNames.includes("Cost Pools") || !workbook.SheetNames.includes("Activity Allocations"))
        throw new Error("Workbook must include Cost Pools and Activity Allocations worksheets from Patch 05A.");
      setAllocationWorkbookBytes(new Uint8Array(raw)); setAllocationWorkbook(workbook);
    } catch (err) { setAllocationError(err.message || "Unable to read allocation workbook."); }
  }
  const allocationValidation = useMemo(() => {
    if (!allocationWorkbook || !audit) return null;
    try { return {report:validateCostLoadingAllocations(allocationWorkbook,audit,clins,sourceSheet),error:""}; }
    catch(err) { return {report:null,error:err.message || "Allocation validation failed."}; }
  },[allocationWorkbook,audit,clins,sourceSheet]);
  const [bulkPool,setBulkPool]=useState("");
  const [bulkShowAll,setBulkShowAll]=useState(false);
  const [bulkSearch,setBulkSearch]=useState("");
  const [bulkWbs,setBulkWbs]=useState("all");
  const [bulkTrade,setBulkTrade]=useState("all");
  const [bulkSelected,setBulkSelected]=useState([]);
  const [bulkWeights,setBulkWeights]=useState({});
  const [bulkMode,setBulkMode]=useState("equal");
  const [bulkError,setBulkError]=useState("");
  const bulkPools=allocationValidation?.report?.pools||[];
  const bulkWbsOptions=useMemo(()=>[...new Set((audit?.activities||[]).map(a=>a.wbs||"Unassigned"))].sort(),[audit]);
  const bulkTradeOptions=useMemo(()=>[...new Set((audit?.activities||[]).map(a=>codeLabel(a,"101301 - SUBC")).filter(x=>x!=="Unassigned"))].sort(),[audit]);
  const activeBulkPool = bulkPools.find(p => p.key === bulkPool);
  const bulkRecommendations = useMemo(() =>
    getPoolActivityCandidates(activeBulkPool?.scope, audit?.activities || []),
    [activeBulkPool?.scope, audit]
  );
  const bulkCandidateMap = useMemo(() => new Map(bulkRecommendations.map(c => [c.activityId, c])), [bulkRecommendations]);
  const bulkActivities=useMemo(()=> (audit?.activities||[]).filter(a=>{
    const q=bulkSearch.trim().toLowerCase();
    return (bulkShowAll || bulkCandidateMap.has(String(a.activityId))) &&
      (!q||[a.activityId,a.name,a.wbs,JSON.stringify(a.codes||{})].some(x=>String(x||"").toLowerCase().includes(q))) &&
      (bulkWbs==="all"||(a.wbs||"Unassigned")===bulkWbs) &&
      (bulkTrade==="all"||codeLabel(a,"101301 - SUBC")===bulkTrade) &&
      !/construction cost|holding account/i.test(a.name||"") &&
      !["LOE10000","L0E10000"].includes(String(a.activityId).toUpperCase());
  }).sort((a,b) => {
    const sa=bulkCandidateMap.get(String(a.activityId))?.score||0;
    const sb=bulkCandidateMap.get(String(b.activityId))?.score||0;
    return sb-sa || String(a.activityId).localeCompare(String(b.activityId),undefined,{numeric:true});
  }),[audit,bulkSearch,bulkWbs,bulkTrade,bulkShowAll,bulkCandidateMap]);
  const bulkEqualWeights=useMemo(()=>{
    const out={};const n=bulkSelected.length;if(!n)return out;
    const units=Math.round(1000000/n);
    bulkSelected.forEach((id,i)=>{out[id]=(i===n-1?(1000000-units*(n-1)):units)/10000;});
    return out;
  },[bulkSelected]);
  const bulkEffectiveWeights=bulkMode==="equal"?bulkEqualWeights:bulkWeights;
  const bulkTotal=bulkSelected.reduce((s,id)=>s+(Number(bulkEffectiveWeights[id])||0),0);
  const toggleBulkActivity=(id)=>setBulkSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const exportBulk=()=>{
    try{
      setBulkError("");
      const result=buildBulkAllocationWorkbook(allocationWorkbook,bulkPool,bulkSelected,bulkEffectiveWeights,audit);
      downloadBulkAllocationWorkbook(result);
    }catch(e){setBulkError(e.message||"Unable to export bulk allocations.");}
  };
  const fullConstructionReview = useMemo(() => reviewFullConstructionAllocation(allocationValidation?.report, audit, clins), [allocationValidation, audit, clins]);
  const transferSimulation = useMemo(() => simulateCostLoadingTransfer(audit, allocationValidation?.report), [audit, allocationValidation]);
  const exportPreflight = useMemo(() => prepareCostLoadingPreflight(audit, allocationValidation?.report, transferSimulation), [audit, allocationValidation, transferSimulation]);
  const assignmentAudit = useMemo(() => inspectReceivingAssignments(audit, exportPreflight), [audit, exportPreflight]);
  const fieldPreview = useMemo(() => prepareFieldLevelPreview(audit, exportPreflight, assignmentAudit), [audit, exportPreflight, assignmentAudit]);
  const remainingPolicyComparison = useMemo(() => compareRemainingCostPolicies(audit, exportPreflight, assignmentAudit), [audit, exportPreflight, assignmentAudit]);
  const [testPolicy,setTestPolicy] = useState("");
  const [policyAcknowledged,setPolicyAcknowledged] = useState(false);
  const policyDecision = useMemo(() => prepareRemainingPolicyDecision(audit, exportPreflight, assignmentAudit, remainingPolicyComparison, testPolicy, policyAcknowledged), [audit, exportPreflight, assignmentAudit, remainingPolicyComparison, testPolicy, policyAcknowledged]);
  const testPackage = useMemo(() => prepareXerTestPackage(policyDecision, exportPreflight, remainingPolicyComparison), [policyDecision, exportPreflight, remainingPolicyComparison]);
  const budgetOnlyPreview = useMemo(() => prepareBudgetOnlyPreview(audit, exportPreflight, assignmentAudit), [audit, exportPreflight, assignmentAudit]);
  const p6Reconciliation = useMemo(() => {
    if(!xerSourceBytes || !p6ReexportText) return null;
    try { const decoder = new TextDecoder("windows-1252"); return reconcileP6Reexport(decoder.decode(xerSourceBytes),p6ReexportText,budgetOnlyPreview); }
    catch(err) { return {status:"ERROR",findings:[{severity:"FAIL",code:"PARSE_ERROR",message:err.message}],changes:[],summary:{}}; }
  },[xerSourceBytes,p6ReexportText,budgetOnlyPreview]);
  const xerTestExport = useMemo(() => xerSourceBytes && budgetOnlyPreview ? createBudgetOnlyTestXer(xerSourceBytes, budgetOnlyPreview) : null, [xerSourceBytes,budgetOnlyPreview]);

  async function loadEstimate(e) {
    const file=e.target.files?.[0]; if(!file) return;
    setEstimateError(""); setEstimate(null);
    try {
      if(!/\.xlsx?$/i.test(file.name)) throw new Error("Choose an Excel estimate (.xlsx or .xls).");
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
      const sheets=workbook.SheetNames.map(name=>{
        const ws=workbook.Sheets[name];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
        return {name,rowCount:rows.filter(row=>row.some(value=>String(value).trim())).length,preview:rows.filter(row=>row.some(value=>String(value).trim())).slice(0,8).map(row=>row.slice(0,7)),rows};
      });
      setEstimate({filename:file.name,sheets});
    } catch(err){setEstimateError(err.message||"Unable to read estimate.");}
  }
  function changeClin(id,field,value) {setClins(old=>old.map(c=>c.id===id?{...c,[field]:value}:c));}
  const matching=useMemo(()=> audit && estimate ? createMatchingReview(audit,estimate,sourceSheet,clins) : null,[audit,estimate,sourceSheet,clins]);
  // 06C in-app draft register; saved locally and separately from the proven 05M XER workflow.
  const [inAppPools,setInAppPools]=useState({});
  const [inAppPoolKey,setInAppPoolKey]=useState("");
  const [inAppSearch,setInAppSearch]=useState("");
  const [inAppShowAll,setInAppShowAll]=useState(false);
  const [inAppError,setInAppError]=useState("");
  const [inAppView,setInAppView]=useState("recommended");
  const [inAppTradeCode,setInAppTradeCode]=useState("");
  const [inAppTradeFilter,setInAppTradeFilter]=useState("all");
  const [inAppWbsFilter,setInAppWbsFilter]=useState("all");
  const [inAppDashboardOpen,setInAppDashboardOpen]=useState(true);
  const [persistenceStatus,setPersistenceStatus]=useState("Checking saved project...");
  const [persistenceReady,setPersistenceReady]=useState(false);
  const hydrationRef=useRef(false);
  const currentProjectKey=workspaceKey(projectName);
  // 06C.1: use the source estimate when present, otherwise recover scope rows
  // from the validated 05B Cost Pools workbook already loaded on this page.
  const inAppFallbackItems=(allocationValidation?.report?.pools||[]).map(p=>({
    key:String(p.key), description:p.scope||String(p.key),
    referenceAmount:null, row:String(p.key).split("::").pop(),
  }));
  const inAppItems=matching?.items?.length
    ? matching.items.map(i=>({...i,key:`${sourceSheet}::${i.row}`}))
    : inAppFallbackItems;
  const inAppSourceFilename=estimate?.filename||allocationFilename;
  const inAppStorageKey=projectName&&inAppSourceFilename&&audit
    ? `sentinel-06c-v1:${projectName}:${inAppSourceFilename}:${filename}` : "";
  const inAppCurrentItem=inAppItems.find(i=>i.key===inAppPoolKey);
  const inAppCurrent=inAppPools[inAppPoolKey]||{amount:"",clin:"",type:"Direct Cost",status:"draft",rows:{}};
  const inAppResult=useMemo(()=>calculatePool(inAppCurrent),[inAppCurrent]);
  const inAppHolding= audit?.holdingAccounts?.[0]?.budget;
  const inAppSummary=useMemo(()=>summarizePools(inAppPools,clins,audit?.activities?.map(a=>a.activityId)||[],inAppHolding),[inAppPools,clins,audit,inAppHolding]);
  const inAppRecommendations=useMemo(()=>getPoolActivityCandidates(inAppCurrentItem?.description,audit?.activities||[]),[inAppCurrentItem?.description,audit]);
  // 06D: suggestions are advisory, not approval. Exclude clear trade false positives.
  const inAppRecommendedIds=useMemo(()=>new Set(inAppRecommendations
    .filter(a=> !(/electrical|power distribution/i.test(inAppCurrentItem?.description||"") &&
      /hoist cable\/?belts|hoisting cable|elevator cable/i.test(a.name||"")))
    .map(a=>String(a.activityId))),[inAppRecommendations,inAppCurrentItem?.description]);
  const inAppTradeTypes=useMemo(()=>(audit?.activityCodeTypes||[]).filter(t=>/subc|subcontract|responsible|trade/i.test(t.name||"")),[audit]);
  const inAppEffectiveTradeCode=inAppTradeCode||inAppTradeTypes[0]?.id||"";
  const inAppTradeOptions=useMemo(()=>[...new Set((audit?.activities||[])
    .map(a=>codeLabel(a,inAppEffectiveTradeCode)).filter(x=>x!=="Unassigned"))].sort(),[audit,inAppEffectiveTradeCode]);
  const inAppWbsOptions=useMemo(()=>[...new Set((audit?.activities||[]).map(a=>a.wbs||"Unassigned"))].sort(),[audit]);
  const inAppVisible=useMemo(()=> (audit?.activities||[]).filter(a=>{
    const id=String(a.activityId);
    if(/^L[O0]E10000$/i.test(id)||/construction cost|holding account/i.test(a.name||""))return false;
    if(inAppView==="allocated"&&!inAppCurrent.rows[id])return false;
    if(inAppView==="recommended"&&!inAppShowAll&&!inAppRecommendedIds.has(id)&&!inAppCurrent.rows[id])return false;
    if(inAppWbsFilter!=="all"&&(a.wbs||"Unassigned")!==inAppWbsFilter)return false;
    if(inAppTradeFilter!=="all"&&codeLabel(a,inAppEffectiveTradeCode)!==inAppTradeFilter)return false;
    const q=inAppSearch.toLowerCase().trim();return !q||`${id} ${a.name} ${a.wbs} ${JSON.stringify(a.codes||{})}`.toLowerCase().includes(q);
  }),[audit,inAppShowAll,inAppView,inAppRecommendedIds,inAppCurrent.rows,inAppSearch,inAppWbsFilter,inAppTradeFilter,inAppEffectiveTradeCode]);
  const inAppBridge=useMemo(()=>prepareInAppBridge(inAppPools,clins,audit),[inAppPools,clins,audit]);
  const inAppDashboardRows=useMemo(()=>inAppItems.map(item=>{
    const pool=inAppPools[item.key];
    const result=pool?calculatePool(pool):null;
    return {key:item.key,name:item.description,type:pool?.type||"Not classified",clin:pool?.clin||"",amount:dollars(result?.amount||0),
      allocated:dollars(result?.total||0),remaining:dollars(result?.remaining||0),status:pool?.status||"not started",errors:result?.errors?.length||0};
  }),[inAppItems,inAppPools]);
  const inAppTypeRows=useMemo(()=>["Direct Cost","General Conditions","Contingency","Insurance","Profit","Other"].map(type=>{
    const rows=inAppDashboardRows.filter(r=>r.type===type);
    return {type,pools:rows.length,amount:rows.reduce((n,r)=>n+r.amount,0),
      approved:rows.filter(r=>r.status==="approved").reduce((n,r)=>n+r.amount,0),
      remaining:rows.reduce((n,r)=>n+r.remaining,0)};
  }),[inAppDashboardRows]);
  const inAppLocked=inAppCurrent.status==="approved";
  const updateInAppPool=(patch)=>setInAppPools(prev=>{
    const pool=prev[inAppPoolKey]||inAppCurrent;
    if(pool.status==="approved")return prev;
    return {...prev,[inAppPoolKey]:{...pool,...patch,status:"draft"}};
  });
  const updateInAppRow=(id,patch)=>setInAppPools(prev=>{
    const pool=prev[inAppPoolKey]||inAppCurrent;
    if(pool.status==="approved")return prev;
    const old=pool.rows[id]||{method:"none",value:""};
    const next={...old,...patch};
    const rows={...pool.rows};
    if(next.method==="none")delete rows[id];else rows[id]=next;
    return {...prev,[inAppPoolKey]:{...pool,rows,status:"draft"}};
  });
  const saveInApp=()=>{
    try{
      if(!inAppStorageKey)throw Error("Upload a source estimate or approved allocation workbook and the XER first.");
      window.localStorage.setItem(inAppStorageKey,JSON.stringify({version:1,pools:inAppPools}));
      setInAppError("Saved to this browser for the current project and source filenames. Export a backup for portability.");
    }catch(e){setInAppError(`Save failed: ${e.message}`);}
  };
  const restoreInApp=()=>{
    try{
      const raw=window.localStorage.getItem(inAppStorageKey);
      if(!raw)throw Error("No saved draft exists for these source filenames in this browser.");
      const data=JSON.parse(raw);
      if(data.version!==1||!data.pools||typeof data.pools!=="object")throw Error("Invalid draft version.");
      setInAppPools(data.pools);setInAppError("Saved draft restored. Review source amounts and CLINs before approval.");
    }catch(e){setInAppError(`Restore failed: ${e.message}`);}
  };
  const exportInApp=()=>{
    const payload={version:1,projectName,estimateFilename:inAppSourceFilename,xerFilename:filename,sourceSheet,pools:inAppPools};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="Sentinel-06C-Allocation-Draft.json";link.click();URL.revokeObjectURL(url);
  };
  const importInApp=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      if(payload.version!==1||!payload.pools||payload.estimateFilename!==inAppSourceFilename||payload.xerFilename!==filename||payload.sourceSheet!==sourceSheet)throw Error("Backup version or source filenames do not match the loaded project.");
      setInAppPools(payload.pools);setInAppError("Backup imported. Review all allocations before approval.");
    }catch(err){setInAppError(`Import failed: ${err.message}`);}finally{e.target.value="";}
  };
  const approveInApp=()=>{
    const validClin=clins.some(c=>c.accepted&&String(c.id)===String(inAppCurrent.clin));
    if(!inAppResult.ready||!validClin){setInAppError("Approval blocked: fix pool reconciliation and select an accepted CLIN.");return;}
    const candidate={...inAppPools,[inAppPoolKey]:{...inAppCurrent,status:"approved"}};
    const summary=summarizePools(candidate,clins,audit?.activities?.map(a=>a.activityId)||[],inAppHolding);
    if(summary.errors.length){setInAppError(`Approval blocked: ${summary.errors.join("; ")}`);return;}
    setInAppPools(candidate);setInAppError("Pool approved in the in-app register. This does NOT authorize XER export. Save your work.");
  };
  const reopenInApp=()=>{
    setInAppPools(prev=>({...prev,[inAppPoolKey]:{...(prev[inAppPoolKey]||inAppCurrent),status:"draft"}}));
    setInAppError("Pool reopened for editing. Reconcile and approve it again after changes.");
  };

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

  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [primary,setPrimary] = useState("none");
  const [secondary,setSecondary] = useState("none");
  const [sort,setSort] = useState("activityId");
  const [descending,setDescending] = useState(false);
  const [collapsed,setCollapsed] = useState({});
  const exportProjectBackup=()=>{
    const data={audit,xerSourceBytes: xerSourceBytes?Array.from(xerSourceBytes):null,filename,
      estimate,sourceSheet,clins,inAppPools,inAppPoolKey,allocationFilename,
      allocationWorkbookBytes:allocationWorkbookBytes?Array.from(allocationWorkbookBytes):null};
    const payload={format:"sentinel-cost-loading-project",version:1,projectName,createdAt:new Date().toISOString(),data};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;
    a.download=`Sentinel-Project-Backup-${String(projectName||"project").replace(/[^a-z0-9_-]+/gi,"-")}.json`;
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importProjectBackup=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      if(payload.format!=="sentinel-cost-loading-project"||payload.version!==1||!payload.data)
        throw Error("Not a supported Sentinel project backup.");
      if(String(payload.projectName||"")!==String(projectName||""))
        throw Error("This backup belongs to a different project. Select that project before importing.");
      const d=payload.data;
      const xer=d.xerSourceBytes?new Uint8Array(d.xerSourceBytes):null;
      const legacy=d.allocationWorkbookBytes?new Uint8Array(d.allocationWorkbookBytes):null;
      const stored={...d,xerSourceBytes:xer,allocationWorkbookBytes:legacy};
      // Commit to durable storage BEFORE updating the screen.
      await writeWorkspace(currentProjectKey,stored);
      setAudit(d.audit||null);setXerSourceBytes(xer);setFilename(d.filename||"");
      setEstimate(d.estimate||null);setSourceSheet(d.sourceSheet||"Subcontractor Summary");
      setClins(Array.isArray(d.clins)?d.clins:makeClins());
      setInAppPools(d.inAppPools||{});setInAppPoolKey(d.inAppPoolKey||"");
      setAllocationFilename(d.allocationFilename||"");setAllocationWorkbookBytes(legacy);
      setAllocationWorkbook(legacy?XLSX.read(legacy,{type:"array"}):null);
      setPersistenceStatus("Project backup imported and saved automatically");
    }catch(err){setPersistenceStatus(`IMPORT FAILED: ${err.message}`);}
    finally{e.target.value="";}
  };

  // Restore on mount or project change. Do not overwrite stored data while hydrating.
  useEffect(() => {
    let cancelled=false;
    hydrationRef.current=true;
    setPersistenceReady(false);
    setPersistenceStatus("Checking saved project...");
    // Avoid carrying one project's data into another project.
    setAudit(null);setXerSourceBytes(null);setFilename("");setEstimate(null);
    setAllocationWorkbook(null);setAllocationWorkbookBytes(null);setAllocationFilename("");
    setInAppPools({});setInAppPoolKey("");setClins(makeClins());
    readWorkspace(currentProjectKey).then(record=>{
      if(cancelled)return;
      if(record?.version===1 && record.data){
        const d=record.data;
        setAudit(d.audit||null);
        setXerSourceBytes(d.xerSourceBytes||null);
        setFilename(d.filename||"");
        setEstimate(d.estimate||null);
        setSourceSheet(d.sourceSheet||"Subcontractor Summary");
        setClins(Array.isArray(d.clins)?d.clins:makeClins());
        setInAppPools(d.inAppPools||{});
        setInAppPoolKey(d.inAppPoolKey||"");
        setAllocationFilename(d.allocationFilename||"");
        if(d.allocationWorkbookBytes){
          try {setAllocationWorkbook(XLSX.read(d.allocationWorkbookBytes,{type:"array"}));setAllocationWorkbookBytes(d.allocationWorkbookBytes);}
          catch(e){setAllocationError(`Stored legacy workbook could not be restored: ${e.message}`);}
        }
        setPersistenceStatus(`Restored automatically · ${new Date(record.savedAt).toLocaleString()}`);
      } else {
        setPersistenceStatus("No saved project yet · changes will save automatically");
      }
      hydrationRef.current=false;
      setPersistenceReady(true);
    }).catch(err=>{
      if(cancelled)return;
      hydrationRef.current=false;
      setPersistenceReady(true);
      setPersistenceStatus(`Automatic restore unavailable: ${err.message}`);
    });
    return ()=>{cancelled=true;hydrationRef.current=true;};
  },[currentProjectKey]);

  useEffect(()=>{
    if(!persistenceReady || hydrationRef.current)return;
    setPersistenceStatus("Unsaved changes · saving...");
    const timer=setTimeout(()=>{
      const data={audit,xerSourceBytes,filename,estimate,sourceSheet,clins,
        inAppPools,inAppPoolKey,allocationFilename,allocationWorkbookBytes};
      writeWorkspace(currentProjectKey,data).then(()=>{
        setPersistenceStatus(`Saved automatically · ${new Date().toLocaleTimeString()}`);
      }).catch(err=>setPersistenceStatus(`SAVE FAILED: ${err.message} · export a JSON backup`));
    },900);
    return ()=>clearTimeout(timer);
  },[persistenceReady,currentProjectKey,audit,xerSourceBytes,filename,estimate,sourceSheet,clins,inAppPools,inAppPoolKey,allocationFilename,allocationWorkbookBytes]);

  async function loadFile(e) {
    const file=e.target.files?.[0]; if (!file) return;
    setError(""); setAudit(null); setXerSourceBytes(null); setXerTestAcknowledged(false); setP6ReexportText(""); setP6ReexportName(""); setP6ReexportError(""); setAllocationWorkbook(null); setAllocationWorkbookBytes(null); setAllocationFilename(""); setFilename(file.name);
    try {
      if (!file.name.toLowerCase().endsWith(".xer")) throw new Error("Choose a P6 .xer file.");
      const originalBytes=new Uint8Array(await file.arrayBuffer());
      const parsed=auditCostLoadingXer(await file.text());
      if (!parsed.activityCount) throw new Error("No TASK activities were found in this XER.");
      setXerSourceBytes(originalBytes); setAudit(parsed); setPrimary("none"); setSecondary("none"); setCollapsed({});
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
    <p>Allocate approved costs to P6 activities, review project totals, and validate controlled test exports. In-app allocations are not yet connected to XER export.</p>
    <div className="cli-panel" style={{padding:"12px 16px"}}>
      <strong>Project: {projectName || "Selected project"}</strong>
      <div role="tablist" aria-label="Cost loading sections" style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
        {[["dashboard","Dashboard"],["allocation","Cost Allocation"],["export","P6 Export & Reconciliation"],["setup","Setup & Diagnostics"]].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={activeCostTab===id} onClick={()=>setActiveCostTab(id)} style={{padding:"10px 14px",borderRadius:7,border:"1px solid #b8c6d4",background:activeCostTab===id?"#174b86":"#f3f6f9",color:activeCostTab===id?"white":"#172a3a",fontWeight:activeCostTab===id?700:500}}>{label}</button>)}
      </div>
      <div role="status" aria-live="polite" style={{padding:"9px 12px",margin:"8px 0",border:"1px solid #d0d7e2",borderRadius:6,background:"#f6f8fb",fontSize:13}}><strong>Project storage:</strong> {persistenceStatus} <span style={{color:"#667085"}}>· Browser/device only; keep JSON backups for portability.</span> <button type="button" onClick={exportProjectBackup} disabled={!persistenceReady}>Export full project backup</button> <label>Import full project backup <input type="file" accept=".json" onChange={importProjectBackup} disabled={!persistenceReady}/></label></div>
      {!audit&&activeCostTab!=="setup"&&<p>Start in <button type="button" onClick={()=>setActiveCostTab("setup")}>Setup & Diagnostics</button> to upload the source P6 XER and estimate workbook.</p>}
    </div>
    {activeCostTab==="dashboard"&&<div className="cli-panel">
      <h3>Project Cost Loading Dashboard</h3>
      {!audit?<p>Upload the source P6 XER in Setup & Diagnostics to begin.</p>:<>
        <p><strong>Existing P6 budget:</strong> {usd(audit.totals.budget)} · <strong>Resource assignments:</strong> {audit.assignmentCount} · <strong>Activities:</strong> {audit.activityCount}</p>
        <p><strong>Approved in-app pools:</strong> {Object.values(inAppPools).filter(p=>p.status==="approved").length} · <strong>Approved dollars:</strong> {usd(dollars(inAppSummary.approved))} · <strong>Receiving activities:</strong> {inAppSummary.activityCount} · <strong>Validation findings:</strong> {inAppSummary.errors.length}</p>
        {inAppSummary.errors.length>0&&<ul>{inAppSummary.errors.map((x,i)=><li key={i}>{x}</li>)}</ul>}
        <h4>06G — In-app allocation to P6 bridge (review only)</h4>
        <p><strong>Bridge status:</strong> {inAppBridge.status} · <strong>Approved pools:</strong> {inAppBridge.approvedPools} · <strong>Transfer:</strong> {usd(inAppBridge.transfer)} · <strong>Receiving activities:</strong> {inAppBridge.receivingRows.length}</p>
        <p>Construction holding {inAppBridge.holdingActivity||"not identified"}: {inAppBridge.holdingBefore==null?"—":usd(inAppBridge.holdingBefore)} → {inAppBridge.holdingAfter==null?"—":usd(inAppBridge.holdingAfter)} · <strong>Budget conservation:</strong> {inAppBridge.budgetConserved?"PASSED":"NOT VERIFIED"}</p>
        {inAppBridge.findings.length>0&&<div role="alert"><strong>Bridge validation findings</strong><ul>{inAppBridge.findings.map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
        <button type="button" disabled={inAppBridge.status==="BLOCKED"} onClick={()=>downloadInAppBridge(inAppBridge,projectName)}>Download validated bridge JSON (review only)</button>
        <details><summary>Receiving activity transfer preview</summary><div className="cli-table-wrap"><table><thead><tr><th>Activity ID</th><th>Activity</th><th>Existing P6 budget</th><th>Proposed addition</th><th>Illustrative new budget</th><th>Source pools</th></tr></thead><tbody>{inAppBridge.receivingRows.map(r=><tr key={r.activityId}><td>{r.activityId}</td><td>{r.activityName}</td><td>{usd(r.existingBudget)}</td><td>{usd(r.addition)}</td><td>{usd(r.proposedBudget)}</td><td>{r.pools.join(", ")}</td></tr>)}</tbody></table></div></details>
        <p className="cli-footnote">06G does not feed the legacy 05M XER writer yet. It verifies and exports the approved in-app allocations for the next controlled integration step. The original XER, Excel workflow, and IndexedDB persistence remain unchanged.</p>
        <h4>Distribution by cost type</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>Cost type</th><th>Pools</th><th>Entered $</th><th>Approved $</th><th>Unallocated $</th></tr></thead><tbody>{inAppTypeRows.map(r=><tr key={r.type}><td>{r.type}</td><td>{r.pools}</td><td>{usd(r.amount)}</td><td>{usd(r.approved)}</td><td>{usd(r.remaining)}</td></tr>)}</tbody></table></div>
        <h4>Cost pool register</h4>
        {!inAppItems.length?<p>Upload the Subcontractor Summary in Setup & Diagnostics, or import a validated legacy workbook.</p>:<div className="cli-table-wrap" style={{maxHeight:440,overflowY:"auto"}}><table><thead><tr><th>Scope</th><th>Type</th><th>CLIN</th><th>Pool $</th><th>Allocated $</th><th>Unallocated $</th><th>Status</th></tr></thead><tbody>{inAppDashboardRows.map(r=><tr key={r.key}><td><button type="button" onClick={()=>{setInAppPoolKey(r.key);setInAppSearch("");setActiveCostTab("allocation");}}>{r.name}</button></td><td>{r.type}</td><td>{r.clin||"—"}</td><td>{usd(r.amount)}</td><td>{usd(r.allocated)}</td><td>{usd(r.remaining)}</td><td>{r.status}{r.errors?` (${r.errors} errors)`:""}</td></tr>)}</tbody></table></div>}
        <h4>CLIN overview</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>CLIN</th><th>Award</th><th>Approved in-app pools</th><th>Difference</th></tr></thead><tbody>{clins.filter(c=>c.accepted).map(c=>{const approved=inAppDashboardRows.filter(r=>r.status==="approved"&&r.clin===c.id).reduce((n,r)=>n+r.amount,0);return <tr key={c.id}><td>{c.id} — {c.name}</td><td>{usd(Number(c.amount)||0)}</td><td>{usd(approved)}</td><td>{usd((Number(c.amount)||0)-approved)}</td></tr>;})}</tbody></table></div>
        <p className="cli-footnote">Award amounts are contract values, not necessarily cost-pool budgets. The dashboard reflects in-app allocations only. No production XER modifications are authorized.</p>
      </>}
    </div>}
    {activeCostTab==="setup"&&<>
    <div className="cli-panel"><strong>Project: {projectName || "Selected project"}</strong><p>Upload a Primavera P6 XER to inspect existing activity-level cost assignments.</p><input type="file" accept=".xer" onChange={loadFile}/>{filename && <p>File: {filename}</p>}{error && <p role="alert" className="cli-error">{error}</p>}</div>
    <div className="cli-panel">
      <h3>Estimate import & awarded CLINs</h3>
      <p>Upload the estimate for a read-only sheet inventory.  CLIN values below are prefilled from the Grand Portage award and can be edited for other projects.  No automatic estimate-to-activity mapping is performed in this patch.</p>
      <label>Estimate workbook <input type="file" accept=".xlsx,.xls" onChange={loadEstimate}/></label>
      {estimateError && <p role="alert" className="cli-error">{estimateError}</p>}
      {estimate && <><strong>{estimate.filename} — {estimate.sheets.length} worksheets</strong><div className="cli-sheet-list">{estimate.sheets.map(sh=><details key={sh.name}><summary>{sh.name} — {sh.rowCount} populated rows</summary><div className="cli-table-wrap"><table><tbody>{sh.preview.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div></details>)}</div></>}
      <div className="cli-table-wrap"><table><thead><tr><th>Accepted</th><th>CLIN</th><th>Description</th><th>Awarded value (editable)</th></tr></thead><tbody>{clins.map(c=><tr key={c.id}><td><input aria-label={`Accepted CLIN ${c.id}`} type="checkbox" checked={c.accepted} onChange={e=>changeClin(c.id,"accepted",e.target.checked)}/></td><td>{c.id}</td><td>{c.name}</td><td><input aria-label={`Awarded value CLIN ${c.id}`} type="number" min="0" step="0.01" value={c.amount} onChange={e=>changeClin(c.id,"amount",e.target.value)}/></td></tr>)}</tbody></table></div>
      <strong>Selected awarded CLIN total: {usd(selectedTotal)}</strong>
      {audit && estimate && <div className="cli-matching">
        <h3>Estimate-to-activity candidate matching — review only</h3>
        <p className="cli-footnote">The selected estimate sheet is used to propose activity relationships. Amounts from the estimate are reference values only; excluded options, duplicated summaries, and CLIN allocations are NOT automatically approved. No XER changes are made.</p>
        <label>Estimate source worksheet <select value={sourceSheet} onChange={e=>setSourceSheet(e.target.value)}>{estimate.sheets.map(sh=><option key={sh.name} value={sh.name}>{sh.name}</option>)}</select></label>
        <p>{matching?.items.length || 0} source rows · {matching?.matched || 0} with candidate activities · {matching?.unmatched || 0} requiring manual mapping.</p>
        {matchingError && <p role="alert" className="cli-error">{matchingError}</p>}
        <button type="button" onClick={()=>{try{setMatchingError("");exportMatchingReview(matching, audit, clins, estimate.filename);}catch(e){setMatchingError(e.message||"Unable to generate workbook.");}}}>Download Excel matching review</button>
        <div className="cli-table-wrap"><table><thead><tr><th>Estimate source row</th><th>Scope description</th><th>Reference amount</th><th>Suggested activity</th><th>Confidence</th><th>Review status</th></tr></thead><tbody>
        {matching?.items.slice(0,60).map(item=><tr key={item.key}><td>{item.row}</td><td>{item.description}</td><td>{item.referenceAmount == null ? "—" : usd(item.referenceAmount)}</td><td>{item.candidate?.activityId || "Unmatched"} {item.candidate?.name || ""}</td><td>{item.confidence}</td><td>Needs review</td></tr>)}
        </tbody></table></div>
        <p className="cli-footnote">Showing first 60 rows; the Excel export includes all candidate rows and the full activity inventory. The approved allocation columns start blank.</p>
      </div>}

      <div className="cli-matching">
        <h3>Patch 05B — Import approved activity allocations</h3>
        <p className="cli-footnote">Import the Excel workbook exported by Sentinel (Cost Pools and Activity Allocations tabs).  A single estimate cost pool may map to any number of P6 activities.  Sentinel recalculates percentages and dollars from user-entered cells; it does not rely on Excel formula caches.</p>
        <label>Completed allocation workbook <input type="file" accept=".xlsx,.xls" onChange={loadAllocationWorkbook}/></label>
        {allocationFilename && <p>Selected file: {allocationFilename}</p>}
        {allocationError && <p role="alert" className="cli-error">{allocationError}</p>}
        {!audit && <p className="cli-footnote">Upload the matching P6 XER before validating allocations.</p>}
        {allocationValidation?.error && <p role="alert" className="cli-error">{allocationValidation.error}</p>}
        {allocationValidation?.report && (() => {
          const report = allocationValidation.report;
          const visible = showAllAllocationIssues ? report.issues : report.issues.slice(0,20);
          return <>
            <p><strong>{report.pools.length}</strong> cost pools · <strong>{report.approvedPools}</strong> approved · <strong>{report.selectedRows}</strong> selected activity rows · <strong>{report.errorCount}</strong> validation errors</p>
            <p>Approved pool total: <strong>{usd(report.approvedTotal)}</strong> · Calculated allocation total: <strong>{usd(report.allocatedTotal)}</strong></p>
            <p><strong>Review only — XER export disabled.</strong>  The construction holding-resource balance must be independently reconciled before any cost transfers.</p>
            <div className="cli-table-wrap"><table><thead><tr><th>Pool key</th><th>Estimate scope</th><th>CLIN</th><th>Approved $</th><th>Selected activities</th><th>Weights</th><th>Calculated $</th><th>Status</th></tr></thead><tbody>
              {report.pools.map(pool=><tr key={pool.key}><td>{pool.key}</td><td>{pool.scope}</td><td>{pool.clin||"—"}</td><td>{pool.approved&&Number.isFinite(pool.approvedAmount)?usd(pool.approvedAmount):"—"}</td><td>{pool.allocations.length}</td><td>{pool.approved?`${pool.weight.toFixed(2)}%`:"—"}</td><td>{pool.approved?usd(pool.allocated):"—"}</td><td>{pool.status}</td></tr>)}
            </tbody></table></div>
            <h4>Validation findings</h4>
            <div className="cli-table-wrap"><table><thead><tr><th>Severity</th><th>Location</th><th>Finding</th></tr></thead><tbody>
              {visible.map((finding,index)=><tr key={index}><td>{finding.severity}</td><td>{finding.location}</td><td>{finding.message}</td></tr>)}
            </tbody></table></div>
            {report.issues.length>20 && <button type="button" onClick={()=>setShowAllAllocationIssues(v=>!v)}>{showAllAllocationIssues?"Show first 20 findings":`Show all ${report.issues.length} findings`}</button>}
          </>;
        })()}
      </div>

      <p className="cli-footnote">Award values are contract values, not estimated direct costs.  Changes are local to this page and are not yet saved to project data.</p>
    </div>
    </>}
    {activeCostTab==="allocation"&&audit && <div className="cli-panel">
      <h3>Cost Allocation Workspace</h3>
      <p className="cli-footnote">Cost pools load from the estimate or a validated legacy workbook. Previously approved Excel allocations are not automatically approved in the in-app workspace. Enter fixed dollars first; percentages apply to the balance after fixed dollars; Spread Remainder divides the rest equally. One method per activity per pool. Excel is optional. This register is separate from the existing 05M XER export; no 06C costs are sent to P6 yet.</p>
      {!inAppItems.length ? <p>Upload the Subcontractor Summary estimate workbook in Setup & Diagnostics to begin. Validated legacy cost pools can also be used.</p> : <>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <label>Cost pool <select value={inAppPoolKey} onChange={e=>{setInAppPoolKey(e.target.value);setInAppSearch("");setInAppShowAll(false);setInAppError("");}}><option value="">Choose estimate scope</option>{inAppItems.map(i=><option key={i.key} value={i.key}>{i.description} — {i.key}{inAppPools[i.key]?.status==="approved"?" ✓ Approved":""}</option>)}</select></label>
          <button type="button" onClick={saveInApp}>Save draft in browser</button>
          <button type="button" onClick={restoreInApp}>Restore saved draft</button>
          <button type="button" onClick={exportInApp}>Export JSON backup</button>
          <label>Import backup <input type="file" accept=".json" onChange={importInApp}/></label>
        </div>
        <p><strong>Approved pools:</strong> {Object.values(inAppPools).filter(p=>p.status==="approved").length} · <strong>Approved dollars:</strong> {usd(dollars(inAppSummary.approved))} · <strong>Receiving activities:</strong> {inAppSummary.activityCount} · <strong>Project validation findings:</strong> {inAppSummary.errors.length}</p>
        {inAppSummary.errors.length>0&&<ul>{inAppSummary.errors.map((x,i)=><li key={i}>{x}</li>)}</ul>}
        {inAppPoolKey && inAppCurrentItem && <>
          <p><strong>{inAppCurrentItem.description}</strong> · {inAppCurrentItem.referenceAmount == null ? "Source: imported cost pool (amount must be entered and reviewed)" : `Estimate reference only: ${usd(inAppCurrentItem.referenceAmount)}`} · Status: <strong>{inAppCurrent.status}</strong></p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <label>Approved pool $ <input disabled={inAppLocked} type="number" min="0" step="0.01" value={inAppCurrent.amount} onChange={e=>updateInAppPool({amount:e.target.value})}/></label>
            <label>Awarded CLIN <select disabled={inAppLocked} value={inAppCurrent.clin} onChange={e=>updateInAppPool({clin:e.target.value})}><option value="">Select CLIN</option>{clins.filter(c=>c.accepted).map(c=><option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}</select></label>
            <label>Pool type <select disabled={inAppLocked} value={inAppCurrent.type} onChange={e=>updateInAppPool({type:e.target.value})}>{["Direct Cost","General Conditions","Contingency","Insurance","Profit","Other"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          <p><strong>Fixed dollars:</strong> {usd(dollars(inAppResult.fixedTotal))} · <strong>Percentage basis:</strong> {usd(dollars(inAppResult.basis))} · <strong>Entered percentages:</strong> {inAppResult.pctTotal.toFixed(4)}% · <strong>Percentage dollars:</strong> {usd(dollars(inAppResult.pctAllocated))} · <strong>Remainder spread:</strong> {usd(dollars(inAppResult.spreadTotal))}</p>
          <p><strong>Allocated:</strong> {usd(dollars(inAppResult.total))} / {usd(dollars(inAppResult.amount))} · <strong>Unallocated:</strong> {usd(dollars(inAppResult.remaining))} · <strong>{inAppLocked?(inAppResult.ready?"APPROVED — BALANCED":"APPROVED — REVALIDATION REQUIRED"):(inAppResult.ready?"BALANCED — READY FOR APPROVAL":"NOT BALANCED / INCOMPLETE")}</strong></p>
          {inAppResult.errors.length>0&&<ul>{inAppResult.errors.map((x,i)=><li key={i}>{x}</li>)}</ul>}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <label>Find activity <input value={inAppSearch} onChange={e=>setInAppSearch(e.target.value)} placeholder="ID, name, WBS"/></label>
            <label>View <select value={inAppView} onChange={e=>setInAppView(e.target.value)}><option value="recommended">Recommended + allocated</option><option value="allocated">Allocated only</option><option value="all">All eligible</option></select></label>
            <label>WBS <select value={inAppWbsFilter} onChange={e=>setInAppWbsFilter(e.target.value)}><option value="all">All WBS</option>{inAppWbsOptions.map(w=><option key={w} value={w}>{w}</option>)}</select></label>
            {inAppTradeTypes.length>0&&<label>Responsible-party code <select value={inAppEffectiveTradeCode} onChange={e=>{setInAppTradeCode(e.target.value);setInAppTradeFilter("all");}}>{inAppTradeTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
            {inAppTradeOptions.length>0&&<label>Subcontractor <select value={inAppTradeFilter} onChange={e=>setInAppTradeFilter(e.target.value)}><option value="all">All subcontractors</option>{inAppTradeOptions.map(t=><option key={t} value={t}>{t}</option>)}</select></label>}
            <label><input type="checkbox" checked={inAppShowAll} onChange={e=>setInAppShowAll(e.target.checked)}/> Show all P6 activities</label>
            <span>{inAppVisible.length} shown · {Object.keys(inAppCurrent.rows).length} allocated methods · {inAppLocked?"Locked — reopen to edit":"Draft — editable"}</span>
          </div>
          <div className="cli-table-wrap" style={{maxHeight:470,overflowY:"auto"}}><table style={{width:"100%"}}><thead><tr><th>Activity</th><th>Description</th><th>Method (exclusive)</th><th>Input $ / %</th><th>Calculated $</th><th>Recommended</th></tr></thead><tbody>
            {inAppVisible.map(a=>{const id=String(a.activityId);const row=inAppCurrent.rows[id]||{method:"none",value:""};return <tr key={id}>
              <td>{id}</td><td>{a.name}</td><td><select disabled={inAppLocked} value={row.method} onChange={e=>updateInAppRow(id,{method:e.target.value,value:""})}><option value="none">Not allocated</option><option value="dollars">Fixed dollars</option><option value="percent">% of available balance</option><option value="spread">Spread remainder</option></select></td>
              <td>{row.method==="dollars"||row.method==="percent"?<input disabled={inAppLocked} type="number" min="0" step={row.method==="dollars"?"0.01":"0.0001"} value={row.value} onChange={e=>updateInAppRow(id,{value:e.target.value})}/>:row.method==="spread"?"Automatic":"—"}</td>
              <td>{inAppResult.allocated[id]!==undefined?usd(dollars(inAppResult.allocated[id])):"—"}</td><td>{inAppRecommendedIds.has(id)?"Suggested":"Manual"}</td>
            </tr>;})}
          </tbody></table></div>
          <button type="button" disabled={inAppLocked||!inAppResult.ready||!clins.some(c=>c.accepted&&String(c.id)===String(inAppCurrent.clin))} onClick={approveInApp}>Approve balanced pool</button>{" "}
          <button type="button" disabled={inAppCurrent.status!=="approved"} onClick={reopenInApp}>Reopen approved pool</button>
          <p className="cli-footnote">Approved pools are locked until explicitly reopened. Changes after reopening require reapproval. Save or export a backup after approvals. A receiving activity may receive allocations from multiple pools; totals are combined only in the 06C register. No 06C XER generation is enabled.</p>
        </>}
        {inAppError&&<p role="status">{inAppError}</p>}
      </>}
    </div>}
    {activeCostTab==="setup"&&<details className="cli-panel"><summary><strong>Legacy Excel bulk allocation builder (06B)</strong></summary>
{audit && <div className="cli-panel">
      <h3>Patch 06B — Bulk activity allocation workbook builder</h3>
      <p className="cli-footnote">Select a cost pool and multiple P6 activities, then export an updated Excel workbook for review. This does not approve a pool, change CLINs, or modify an XER. Existing selections for the chosen pool are replaced; other pools are retained.</p>
      {!allocationWorkbook ? <p>Import your existing allocation workbook under Patch 05B first.</p> : <>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
          <label>Cost pool <select value={bulkPool} onChange={e=>{setBulkPool(e.target.value);setBulkShowAll(false);setBulkSelected([]);setBulkWeights({});setBulkError("");}}>
            <option value="">Choose a pool</option>
            {bulkPools.map(p=><option key={p.key} value={p.key}>{p.scope} — {p.key}{p.approved?" (approved)":""}</option>)}
          </select></label>
          <label>Search activities <input value={bulkSearch} onChange={e=>setBulkSearch(e.target.value)} placeholder="Activity ID, name, WBS, code"/></label>
          <label>WBS <select value={bulkWbs} onChange={e=>setBulkWbs(e.target.value)}><option value="all">All WBS</option>{bulkWbsOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          <label>Subcontractor <select value={bulkTrade} onChange={e=>setBulkTrade(e.target.value)}><option value="all">All subcontractors</option>{bulkTradeOptions.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        </div>
        <p><label><input type="checkbox" checked={bulkShowAll} onChange={e=>setBulkShowAll(e.target.checked)}/> Show all eligible P6 activities (including those not recommended)</label></p>
        <p>{bulkActivities.length} {bulkShowAll ? "filtered activities" : "recommended activities"} · {bulkRecommendations.length} total scope recommendations · {bulkSelected.length} selected</p>
        {bulkPool && !bulkShowAll && bulkRecommendations.length===0 && <p className="cli-footnote">No conservative scope matches were found for this pool. Use Show all eligible P6 activities to make a manual selection.</p>}
        <p className="cli-footnote">Recommendations use the existing scope-matching rules. They are not approvals; review each activity before selecting it. Selected activities remain selected when switching views.</p>
        <button type="button" disabled={!bulkPool||!bulkActivities.length} onClick={()=>setBulkSelected(prev=>[...new Set([...prev,...bulkActivities.map(a=>a.activityId)])])}>Select all filtered activities</button>{" "}
        <button type="button" onClick={()=>setBulkSelected([])}>Clear selection</button>
        <div className="cli-table-wrap" style={{maxHeight:310,overflowY:"auto"}}><table><thead><tr><th>Select</th><th>Activity ID</th><th>Activity</th><th>WBS</th><th>Subcontractor</th><th>Match / explanation</th></tr></thead><tbody>
          {bulkActivities.map(a=><tr key={a.activityId}><td><input type="checkbox" checked={bulkSelected.includes(a.activityId)} onChange={()=>toggleBulkActivity(a.activityId)}/></td><td>{a.activityId}</td><td>{a.name}</td><td>{a.wbs}</td><td>{codeLabel(a,"101301 - SUBC")}</td><td>{bulkCandidateMap.has(String(a.activityId)) ? `Score ${bulkCandidateMap.get(String(a.activityId)).score} — ${bulkCandidateMap.get(String(a.activityId)).explanation}` : "Manual review — not recommended"}</td></tr>)}
        </tbody></table></div>
        <label>Weighting method <select value={bulkMode} onChange={e=>{setBulkMode(e.target.value);setBulkError("");}}><option value="equal">Equal distribution</option><option value="manual">Manual percentages</option></select></label>
        {bulkSelected.length>0 && <div className="cli-table-wrap" style={{maxHeight:280,overflowY:"auto"}}><table><thead><tr><th>Selected activity</th><th>Allocation weight %</th></tr></thead><tbody>{bulkSelected.map(id=><tr key={id}><td>{id}</td><td>{bulkMode==="equal"?bulkEqualWeights[id].toFixed(4):<input type="number" min="0" max="100" step="0.0001" value={bulkWeights[id]??""} onChange={e=>setBulkWeights(prev=>({...prev,[id]:e.target.value}))}/>}</td></tr>)}</tbody></table></div>}
        <p><strong>Total weights: {bulkTotal.toFixed(4)}%</strong> · Pool approval and approved dollar amount must be completed on the Cost Pools Excel tab.</p>
        {bulkError && <p role="alert" className="cli-error">{bulkError}</p>}
        <button type="button" disabled={!bulkPool||!bulkSelected.length||Math.abs(bulkTotal-100)>0.0001} onClick={exportBulk}>Download updated allocation workbook</button>
        <p className="cli-footnote">After download, review the workbook in Excel and re-import it under Patch 05B. For subsequent pools, use the latest downloaded workbook to preserve prior selections. No automatic cost approvals are made.</p>
      </>}
    </div>}
    </details>}
    {activeCostTab==="setup"&&<details className="cli-panel"><summary><strong>Legacy readiness and validation tools (06A–05L)</strong></summary>
{audit && <div className="cli-panel">
      <h3>Patch 06A — Full construction allocation readiness (read-only)</h3>
      <p className="cli-footnote">Expands the electrical proof of concept to all approved cost pools in the uploaded allocation workbook. Unapproved pools are excluded. This is a project-wide readiness audit, not an XER export. The accepted CLIN register is an award ceiling, not an automatic instruction to allocate every dollar.</p>
      {!fullConstructionReview ? <p>Import a completed Cost Pools / Activity Allocations workbook in Patch 05B to evaluate all pools.</p> : <>
        <p><strong>{fullConstructionReview.approvedPools}</strong> approved pools · <strong>{fullConstructionReview.unapprovedPools}</strong> unapproved pools · <strong>{fullConstructionReview.receivers.length}</strong> unique receiving activities · <strong>{fullConstructionReview.shared.length}</strong> shared activities · <strong>{fullConstructionReview.blockers}</strong> blockers</p>
        <p>Approved transfer: <strong>{usd(fullConstructionReview.transfer)}</strong> · Holding budget before: <strong>{usd(fullConstructionReview.holdingBudget||0)}</strong> · Illustrative holding balance after: <strong>{usd((fullConstructionReview.holdingBudget||0)-fullConstructionReview.transfer)}</strong></p>
        <h4>Accepted CLINs versus approved cost pools</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>CLIN</th><th>Description</th><th>Accepted award</th><th>Approved pools</th><th>Not yet allocated</th></tr></thead><tbody>{fullConstructionReview.clinsRows.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{usd(r.award)}</td><td>{usd(r.assigned)}</td><td>{usd(r.unallocated)}</td></tr>)}</tbody></table></div>
        <h4>Project-wide findings</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>Severity</th><th>Code</th><th>Finding</th></tr></thead><tbody>{fullConstructionReview.issues.map((r,i)=><tr key={i}><td>{r.level}</td><td>{r.code}</td><td>{r.message}</td></tr>)}</tbody></table></div>
        <button type="button" onClick={()=>downloadFullConstructionReview(fullConstructionReview)}>Download full construction readiness Excel</button>
        <p><strong>06A does not authorize XER export.</strong> Review shared activities and resource-assignment exceptions before any larger controlled test.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05C — Construction holding account reconciliation (read-only)</h3>
      <p className="cli-footnote">Source: uploaded XER TASKRSRC assignments.  Budgeted and remaining amounts are reported separately; neither is automatically authorized for transfer.  No XER is modified.</p>
      {!audit.holdingAccounts?.length ? <p role="alert" className="cli-error">No holding activity identified.  Check the activity ID and name in the source XER before proceeding.</p> : <>
        {audit.holdingAccounts.length!==1 && <p role="alert" className="cli-error">Found {audit.holdingAccounts.length} possible holding activities.  Confirm the correct holding activity before any transfer.</p>}
        {audit.holdingAccounts.map(holding=><div key={holding.taskId}>
          <p><strong>{holding.activityId} — {holding.name}</strong></p>
          <p>Holding budget: <strong>{usd(holding.budget)}</strong> · Actual: <strong>{usd(holding.actual)}</strong> · Remaining: <strong>{usd(holding.remaining)}</strong> · Budget minus actual and remaining: <strong>{usd(holding.difference)}</strong></p>
          <p>{holding.assignments.length} resource assignments · {holding.hasDiscrepancies ? "Assignment discrepancies detected — manual investigation required." : "No assignment arithmetic discrepancies detected."}</p>
          {allocationValidation?.report && <p>Approved allocation pools: <strong>{usd(allocationValidation.report.approvedTotal)}</strong> · Holding budget less approved allocations: <strong>{usd(holding.budget-allocationValidation.report.approvedTotal)}</strong> · Holding remaining less approved allocations: <strong>{usd(holding.remaining-allocationValidation.report.approvedTotal)}</strong></p>}
          <div className="cli-table-wrap"><table><thead><tr><th>Assignment ID</th><th>Resource</th><th>Type</th><th>Budget</th><th>Actual</th><th>Remaining</th><th>Budget − actual − remaining</th></tr></thead><tbody>
            {holding.assignments.map((r,i)=><tr key={r.assignmentId||i}><td>{r.assignmentId||"—"}</td><td>{r.resourceCode||r.resourceName||r.resourceId||"Unknown"}</td><td>{r.resourceType||"—"}</td><td>{usd(r.budget)}</td><td>{usd(r.actual)}</td><td>{usd(r.remaining)}</td><td>{usd(r.difference)}</td></tr>)}
          </tbody></table></div>
          <details style={{marginTop: "12px"}}>
            <summary><strong>Patch 05D — Raw P6 holding-assignment quantities, rates and costs (read-only)</strong></summary>
            <p className="cli-footnote">Values below are copied directly from TASKRSRC in the uploaded XER.  Field names are retained exactly; blank fields and unit/rate conventions must be interpreted against the source P6 version.  The budget/remaining difference is not automatically an available transfer amount.</p>
            {holding.assignments.map((r,i)=><div key={r.assignmentId||i}>
              <p><strong>Assignment {r.assignmentId||"Unknown"} — {r.resourceCode||r.resourceName||r.resourceId}</strong></p>
              <div className="cli-table-wrap"><table><thead><tr><th>XER TASKRSRC field</th><th>Raw exported value</th></tr></thead><tbody>
                {(r.xerFields||[]).map(item=><tr key={item.field}><td><code>{item.field}</code></td><td>{item.value==="" ? "(blank)" : item.value}</td></tr>)}
              </tbody></table></div>
            </div>)}
          </details>
          {holding.assignments.some(r=>r.resourceCode!=="MCGSTANDCOSTONLY") && <p className="cli-footnote">Holding account includes resource assignments other than MCGSTANDCOSTONLY.  Their eligibility for transfer must be established separately.</p>}
        </div>)}
      </>}
      <p><strong>Transfer authorization: NOT ESTABLISHED.</strong>  This panel is diagnostic only.  Existing design and other costs are untouched.</p>
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05E — Cost transfer simulation (read-only)</h3>
      <p className="cli-footnote">Budget-only illustration using approved Excel allocations. Existing receiving activity budgets are preserved and increased, while the construction holding budget is reduced by the same amount. No resource assignments are created, no remaining costs are adjusted, and no XER is written.</p>
      {!allocationValidation?.report ? <p>Import the completed allocation workbook in Patch 05B to calculate the simulation.</p> : transferSimulation && <>
        <p><strong>Simulation status: {transferSimulation.errors ? "BLOCKED — validation errors" : "PREVIEW ONLY — not authorized for XER export"}</strong></p>
        <p>Proposed transfer: <strong>{usd(transferSimulation.transfer)}</strong> · Receiving activities: <strong>{transferSimulation.rows.length}</strong></p>
        <div className="cli-table-wrap"><table><thead><tr><th>Budget account</th><th>Before</th><th>Change</th><th>Simulated after</th></tr></thead><tbody>
          <tr><td>Construction holding — {transferSimulation.source?.activityId || "Not uniquely identified"}</td><td>{transferSimulation.source ? usd(transferSimulation.source.budget) : "—"}</td><td>{usd(-transferSimulation.transfer)}</td><td>{transferSimulation.holdingAfter == null ? "—" : usd(transferSimulation.holdingAfter)}</td></tr>
          <tr><td>Whole P6 schedule</td><td>{usd(transferSimulation.originalBudget)}</td><td>{usd(transferSimulation.afterBudget-transferSimulation.originalBudget)}</td><td><strong>{usd(transferSimulation.afterBudget)}</strong></td></tr>
        </tbody></table></div>
        <h4>Receiving activity budget preview</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>Activity ID</th><th>Activity</th><th>Existing budget</th><th>Proposed addition</th><th>Simulated budget</th><th>Source pool(s)</th></tr></thead><tbody>
          {transferSimulation.rows.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{usd(r.existingBudget)}</td><td>{usd(r.addition)}</td><td>{usd(r.afterBudget)}</td><td>{r.sourcePools.join(", ")}</td></tr>)}
        </tbody></table></div>
        <h4>Simulation findings</h4>
        {transferSimulation.issues.length ? <div className="cli-table-wrap"><table><thead><tr><th>Severity</th><th>Finding</th></tr></thead><tbody>{transferSimulation.issues.map((i,index)=><tr key={index}><td>{i.severity}</td><td>{i.message}</td></tr>)}</tbody></table></div> : <p>No simulation arithmetic errors detected. Transfer authorization remains NOT ESTABLISHED.</p>}
        <p><strong>XER export disabled.</strong> The 05D remaining-cost discrepancy must be resolved before defining a safe XER write procedure.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05F — XER export preflight (read-only)</h3>
      <p className="cli-footnote">This is a proposed assignment plan, not an XER export.  Existing assignments are not modified.  Remaining-cost policy and source discrepancies must be resolved before any XER write is allowed.</p>
      {!exportPreflight ? <p>Import the completed allocation workbook in Patch 05B to generate the preflight.</p> : <>
        <p><strong>Preflight status: {exportPreflight.status}</strong> · {exportPreflight.summary.blockers} blockers · {exportPreflight.summary.receivingActivities} receiving activities</p>
        <p>Holding reduction: <strong>{usd(exportPreflight.summary.proposedTransfer)}</strong> · Proposed receiving additions: <strong>{usd(exportPreflight.summary.receivingBudgetAdditions)}</strong> · Project budget before/after: <strong>{usd(exportPreflight.summary.projectBudget)} / {usd(exportPreflight.summary.projectBudgetAfter)}</strong></p>
        <button type="button" onClick={()=>downloadCostLoadingPreflight(exportPreflight)}>Download Excel preflight report</button>
        <h4>Proposed assignment operations — NOT applied</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>Activity ID</th><th>P6 task ID</th><th>Proposed operation</th><th>Resource</th><th>Existing budget</th><th>Proposed addition</th><th>Simulated budget</th><th>Existing assignments</th><th>Remaining cost</th></tr></thead><tbody>
          {exportPreflight.changes.map(r=><tr key={r.activityId}><td>{r.activityId}</td><td>{r.taskId}</td><td>{r.operation}</td><td>{r.proposedResource}</td><td>{usd(r.existingBudget)}</td><td>{usd(r.proposedBudgetAddition)}</td><td>{usd(r.simulatedBudget)}</td><td>{r.existingAssignmentCount}</td><td>{r.remainingCost}</td></tr>)}
        </tbody></table></div>
        <h4>Preflight findings</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>Severity</th><th>Code</th><th>Finding</th></tr></thead><tbody>{exportPreflight.findings.map((f,i)=><tr key={i}><td>{f.severity}</td><td>{f.code}</td><td>{f.detail}</td></tr>)}</tbody></table></div>
        <p><strong>XER export remains disabled.</strong> This preflight workbook does not authorize a transfer or change the original P6 file.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05G — Existing resource assignment audit (read-only)</h3>
      <p className="cli-footnote">Exact TASKRSRC assignments for proposed receiving activities. A matching standard resource is not automatically approved for update. No XER is written.</p>
      {!assignmentAudit ? <p>Import the completed allocation workbook under Patch 05B to inspect receiving assignments.</p> : <>
        <p><strong>{assignmentAudit.activities.length} receiving activities</strong> · {assignmentAudit.activities.reduce((n,a)=>n+a.assignments.length,0)} existing resource assignments · {assignmentAudit.findings.length} additional findings</p>
        <div className="cli-table-wrap"><table><thead><tr><th>Activity ID</th><th>Proposed operation</th><th>Existing standard assignments</th><th>Proposed addition</th></tr></thead><tbody>
          {assignmentAudit.activities.map(a=><tr key={a.activityId}><td>{a.activityId}</td><td>{a.operation}</td><td>{a.standardCount}</td><td>{usd(a.proposedBudgetAddition)}</td></tr>)}
        </tbody></table></div>
        <h4>Receiving activity assignment details</h4>
        {assignmentAudit.activities.map(a=><details key={a.activityId} style={{marginBottom:"10px"}}>
          <summary><strong>{a.activityId} — {a.activityName}</strong> ({a.assignments.length} existing assignments)</summary>
          <div className="cli-table-wrap"><table><thead><tr><th>Assignment ID</th><th>Resource</th><th>Type</th><th>Budget</th><th>Actual</th><th>Remaining</th><th>Difference</th><th>Target qty</th><th>Remaining qty</th><th>Cost/qty</th><th>Rate type</th><th>Cost/qty linked</th></tr></thead><tbody>
            {a.assignments.map((r,i)=><tr key={r.assignmentId||i}><td>{r.assignmentId||"—"}</td><td>{r.resourceCode||r.resourceName||r.resourceId}</td><td>{r.resourceType||"—"}</td><td>{usd(r.budget)}</td><td>{usd(r.actual)}</td><td>{usd(r.remaining)}</td><td>{usd(r.difference)}</td><td>{r.targetQty}</td><td>{r.remainQty}</td><td>{r.costPerQty}</td><td>{r.rateType}</td><td>{r.costQtyLinkFlag}</td></tr>)}
          </tbody></table></div>
          {a.assignments.map((r,i)=><details key={r.assignmentId||i}><summary>Raw XER fields — assignment {r.assignmentId||"Unknown"}</summary><div className="cli-table-wrap"><table><thead><tr><th>Field</th><th>Exported value</th></tr></thead><tbody>{r.xerFields.map(x=><tr key={x.field}><td><code>{x.field}</code></td><td>{x.value||"(blank)"}</td></tr>)}</tbody></table></div></details>)}
        </details>)}
        {assignmentAudit.findings.length>0 && <><h4>Assignment findings</h4><div className="cli-table-wrap"><table><thead><tr><th>Severity</th><th>Activity</th><th>Finding</th></tr></thead><tbody>{assignmentAudit.findings.map((f,i)=><tr key={i}><td>{f.severity}</td><td>{f.activityId}</td><td>{f.message}</td></tr>)}</tbody></table></div></>}
        <p><strong>XER export disabled.</strong> Remaining-cost policy and assignment-update decisions are not authorized.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05H — Field-level cost transfer preview (read-only)</h3>
      <p className="cli-footnote">Proposed TASKRSRC target_cost updates only. Original raw XER field values are shown alongside proposed values. Remaining-cost changes are deliberately undefined, and all changes are blocked from export.</p>
      {!fieldPreview ? <p>Upload the Grand Portage XER and completed allocation workbook to preview proposed field changes.</p> : <>
        <p><strong>{fieldPreview.rows.length} field-review rows</strong> · Net budget change: <strong>{usd(fieldPreview.netBudgetChange)}</strong> · Whole-schedule budget: <strong>{usd(fieldPreview.sourceProjectBudget)}</strong></p>
        <div className="cli-table-wrap"><table><thead><tr><th>Activity</th><th>Assignment ID</th><th>Operation</th><th>TASKRSRC field</th><th>Original XER value</th><th>Proposed value</th><th>Budget delta</th><th>Status</th></tr></thead><tbody>
          {fieldPreview.rows.map((r,i)=><tr key={`${r.assignmentId}-${r.field}-${i}`}><td>{r.activityId}</td><td>{r.assignmentId}</td><td>{r.operation}</td><td><code>{r.field}</code></td><td>{r.before ?? "(field missing)"}</td><td>{r.after ?? "UNDECIDED"}</td><td>{r.delta == null ? "—" : usd(r.delta)}</td><td>{r.status}</td></tr>)}
        </tbody></table></div>
        <h4>Unresolved safeguards</h4>
        {fieldPreview.findings.map((f,i)=><p key={i} className="cli-footnote">• {f}</p>)}
        <p><strong>XER export disabled.</strong> Budget conservation in a preview does not resolve remaining-cost policy or authorize changes.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05I — Remaining-cost policy comparison (read-only)</h3>
      <p className="cli-footnote">Three illustrative treatments of TASKRSRC remain_cost. No policy is selected or approved. Actual costs are preserved in every scenario; no XER is written.</p>
      {!remainingPolicyComparison ? <p>Upload the XER and completed allocation workbook in Patch 05B to compare policies.</p> : remainingPolicyComparison.error ? <p role="alert" className="cli-error">{remainingPolicyComparison.error}</p> : <>
        <p>Holding assignment: <strong>{remainingPolicyComparison.sourceActivityId} / {remainingPolicyComparison.sourceAssignmentId}</strong> · Budget transfer: <strong>{usd(remainingPolicyComparison.transfer)}</strong> · Holding remaining before: <strong>{usd(remainingPolicyComparison.sourceRemainingBefore)}</strong></p>
        <div className="cli-table-wrap"><table><thead><tr><th>Scenario</th><th>Holding remaining after</th><th>Receiver remaining added</th><th>Combined remaining before</th><th>Combined remaining after</th><th>Change in combined remaining</th></tr></thead><tbody>
          {remainingPolicyComparison.scenarios.map(s=><tr key={s.key}><td>{s.name}</td><td>{usd(s.holdingRemaining)}</td><td>{usd(s.receiverRemainingAdded)}</td><td>{usd(s.combinedRemainingBefore)}</td><td>{usd(s.combinedRemainingAfter)}</td><td>{usd(s.combinedRemainingChange)}</td></tr>)}
        </tbody></table></div>
        {remainingPolicyComparison.scenarios.map(s=><details key={s.key} style={{marginTop:"12px"}}><summary><strong>{s.name}</strong> — receiving assignment detail</summary><p className="cli-footnote">{s.description}</p><div className="cli-table-wrap"><table><thead><tr><th>Activity</th><th>Assignment ID</th><th>Remaining before</th><th>Remaining after</th><th>Change</th></tr></thead><tbody>{s.receivers.map(r=><tr key={r.assignmentId}><td>{r.activityId}</td><td>{r.assignmentId}</td><td>{usd(r.remainingBefore)}</td><td>{usd(r.remainingAfter)}</td><td>{usd(r.change)}</td></tr>)}</tbody></table></div></details>)}
        <p><strong>Policy decision: NOT APPROVED. XER export disabled.</strong> These scenarios do not correct the original holding-assignment discrepancy or establish P6 import behavior.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05J — Remaining-cost policy decision and export readiness (read-only)</h3>
      <p className="cli-footnote">Select a treatment for test planning only. Acknowledgment records the intended scenario in this browser session; it is NOT approval to write or import an XER. Source records and actual costs remain unchanged.</p>
      {!remainingPolicyComparison || remainingPolicyComparison.error ? <p>Complete Patch 05I before selecting a test policy.</p> : <>
        <label>Test remaining-cost treatment{" "}
          <select value={testPolicy} onChange={e=>{setTestPolicy(e.target.value);setPolicyAcknowledged(false);}}>
            <option value="">Choose a scenario — none selected</option>
            {remainingPolicyComparison.scenarios.map(s=><option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
        {testPolicy && <p><label><input type="checkbox" checked={policyAcknowledged} onChange={e=>setPolicyAcknowledged(e.target.checked)}/> I acknowledge this policy for read-only test planning. It does not approve an XER modification.</label></p>}
        {policyDecision?.error && <p role="alert" className="cli-error">{policyDecision.error}</p>}
        {policyDecision && !policyDecision.error && <>
          <p><strong>Status: {policyDecision.reviewStatus}</strong></p>
          <p>Net budget change: <strong>{usd(policyDecision.budgetDelta)}</strong> · Net remaining-cost change: <strong>{usd(policyDecision.remainingDelta)}</strong> · Budget conserved: <strong>{policyDecision.budgetConserved?"YES":"NO"}</strong> · Remaining conserved: <strong>{policyDecision.remainingConserved?"YES":"NO"}</strong></p>
          <h4>Proposed TASKRSRC field values — NOT applied</h4>
          <div className="cli-table-wrap"><table><thead><tr><th>Activity</th><th>Assignment ID</th><th>XER field</th><th>Original value</th><th>Proposed value</th><th>Change</th></tr></thead><tbody>
            {policyDecision.rows.map((r,i)=><tr key={i}><td>{r.activityId}</td><td>{r.assignmentId}</td><td><code>{r.field}</code></td><td>{usd(r.before)}</td><td>{usd(r.after)}</td><td>{usd(r.delta)}</td></tr>)}
          </tbody></table></div>
          <h4>Export readiness findings</h4>
          <div className="cli-table-wrap"><table><thead><tr><th>Finding</th></tr></thead><tbody>{policyDecision.issues.map((s,i)=><tr key={i}><td>{s}</td></tr>)}</tbody></table></div>
          <p><strong>XER export disabled.</strong> This preview does not resolve the source discrepancy, clear existing preflight blockers, or establish P6 import behavior.</p>
        </>}
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05K — Controlled XER test preparation package (read-only)</h3>
      <p className="cli-footnote">Exports a review workbook, NOT an XER. Original P6 data is never modified. Source cost discrepancies and preflight blockers remain open.</p>
      {!testPackage ? <p>Select a scenario and check the acknowledgment box in Patch 05J to prepare a review package.</p> : <>
        <p><strong>Status: {testPackage.status}</strong> · {testPackage.rows.length} field changes · {testPackage.sourceIssues.length} source preflight findings</p>
        <p>Policy: <strong>{testPackage.scenario}</strong> · Budget transfer: <strong>{usd(testPackage.transfer)}</strong> · Net budget change: <strong>{usd(testPackage.budgetDelta)}</strong> · Net remaining change: <strong>{usd(testPackage.remainingDelta)}</strong></p>
        {testPackage.issues.length>0 && <div><strong>Package validation errors</strong><ul>{testPackage.issues.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
        <button type="button" disabled={testPackage.issues.length>0} onClick={()=>downloadXerTestPackage(testPackage)}>Download Excel test preparation package</button>
        <p><strong>XER export disabled.</strong> This package is a review aid and cannot be imported into P6 as an updated schedule.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05L — Budgeted Total Cost transfer preview (read-only)</h3>
      <p className="cli-footnote">Controlling field: P6 Budgeted Total Cost, stored as TASKRSRC.target_cost. No changes are proposed to remaining, actual, earned value, units, rates, dates, or relationships. P6 may recalculate some values when importing a future test XER; this is not yet verified.</p>
      {!budgetOnlyPreview ? <p>Import the completed allocation workbook under Patch 05B to prepare the budget-only preview.</p> : <>
        <p><strong>Status: {budgetOnlyPreview.status}</strong> · {budgetOnlyPreview.rows.length} existing resource assignments · {budgetOnlyPreview.findings.filter(f=>f.severity==="BLOCKER").length} new budget-only blockers</p>
        <p>Proposed transfer: <strong>{usd(budgetOnlyPreview.transfer)}</strong> · Net Budgeted Total Cost change: <strong>{usd(budgetOnlyPreview.delta)}</strong> · Whole-schedule budget before / after: <strong>{usd(budgetOnlyPreview.projectBefore)} / {usd(budgetOnlyPreview.projectAfter)}</strong></p>
        <div className="cli-table-wrap"><table><thead><tr><th>Activity</th><th>Assignment ID</th><th>Operation</th><th>Field</th><th>Original</th><th>Proposed</th><th>Change</th><th>Actual untouched</th><th>Remaining untouched</th></tr></thead><tbody>
          {budgetOnlyPreview.rows.map((r,i)=><tr key={i}><td>{r.activityId}</td><td>{r.assignmentId}</td><td>{r.operation}</td><td><code>{r.field}</code></td><td>{usd(r.before)}</td><td>{usd(r.after)}</td><td>{usd(r.delta)}</td><td>{usd(r.actualUnchanged)}</td><td>{usd(r.remainingUnchanged)}</td></tr>)}
        </tbody></table></div>
        <h4>Source conditions and budget-only findings</h4>
        <div className="cli-table-wrap"><table><thead><tr><th>Severity</th><th>Code</th><th>Finding</th></tr></thead><tbody>
          {budgetOnlyPreview.findings.map((f,i)=><tr key={i}><td>{f.severity}</td><td>{f.code}</td><td>{f.message}</td></tr>)}
        </tbody></table></div>
        <p>Legacy 05F preflight blockers: <strong>{budgetOnlyPreview.oldPreflight.length}</strong>. These are retained for historical visibility, not automatically cleared by the budget-only preview.</p>
        <button type="button" onClick={()=>downloadBudgetOnlyPreview(budgetOnlyPreview)}>Download budget-only preview Excel</button>
        <p><strong>XER export disabled.</strong> The preview does not authorize changes to the source file or establish P6 import behavior.</p>
      </>}
    </div>}
    </details>}
    {activeCostTab==="export"&&<>
{audit && <div className="cli-panel">
      <h3>Patch 05M — Controlled budget-only TEST XER export</h3>
      <p className="cli-footnote">Creates a separate test copy of the uploaded XER. Changes only TASKRSRC.target_cost on the existing assignments identified in 05L. The original file is not modified. Actual, remaining, earned value, resource units, dates, and logic are not intentionally changed. P6 import recalculation remains unverified.</p>
      {!xerTestExport ? <p>Upload the source XER and the approved allocation workbook to prepare the controlled test file.</p> : <>
        <p><strong>Validation: {xerTestExport.problems.length ? "BLOCKED" : "PASSED — TEST FILE ONLY"}</strong> · Changed assignment records: {xerTestExport.changedAssignments ?? "—"}</p>
        {xerTestExport.problems.length>0 ? <ul>{xerTestExport.problems.map((p,i)=><li key={i}>{p}</li>)}</ul> : <p>Resource-assignment budget before / after: <strong>{usd(xerTestExport.assignmentBudgetBefore)} / {usd(xerTestExport.assignmentBudgetAfter)}</strong>. Only the intended four assignment budget values differ.</p>}
        <label style={{display:"block",margin:"12px 0"}}><input type="checkbox" checked={xerTestAcknowledged} onChange={e=>setXerTestAcknowledged(e.target.checked)}/> I will import this XER only into an isolated P6 test project or database, never over the production project, and compare Budgeted Total Cost and other cost fields after import.</label>
        <button type="button" disabled={!!xerTestExport.problems.length || !xerTestAcknowledged} onClick={()=>downloadBudgetOnlyTestXer(xerTestExport,filename)}>Download controlled TEST XER</button>
        <p><strong>TEST ONLY.</strong> A successful byte-level XER check does not establish P6 import safety. Back up the source schedule and verify import behavior independently.</p>
      </>}
    </div>}
    {audit && <div className="cli-panel">
      <h3>Patch 05N — P6 re-export reconciliation (read-only)</h3>
      <p className="cli-footnote">After importing the 05M TEST XER into an isolated P6 project, export that project back to XER and upload it below. Compares the original XER to the P6 re-export, including approved budget transfers, resource assignments, remaining/actual cost, activity dates, and relationship counts. This does not change either file.</p>
      <label>P6 test-project re-export (.xer) <input type="file" accept=".xer" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;setP6ReexportError("");setP6ReexportText("");setP6ReexportName(f.name);try{if(!/\.xer$/i.test(f.name))throw Error("Select a P6 .xer file.");setP6ReexportText(await f.text());}catch(err){setP6ReexportError(err.message);}}}/></label>
      {p6ReexportName && <p>Re-export: {p6ReexportName}</p>}
      {p6ReexportError && <p role="alert" className="cli-error">{p6ReexportError}</p>}
      {!p6Reconciliation ? <p>Upload the P6 test-project re-export to compare against the original XER. Keep the $5 million allocation workbook uploaded for the expected-change check.</p> : <>
        <p><strong>Reconciliation status: {p6Reconciliation.status}</strong></p>
        <p>Assignment budget before / after: <strong>{usd(p6Reconciliation.summary.before||0)} / {usd(p6Reconciliation.summary.after||0)}</strong> · Budget changes observed: {p6Reconciliation.summary.observedChanges??"—"} · Expected: {p6Reconciliation.summary.expectedChanges??"—"}</p>
        <p>Activities: {p6Reconciliation.summary.activityBefore??"—"} / {p6Reconciliation.summary.activityAfter??"—"} · Resource assignments: {p6Reconciliation.summary.assignmentBefore??"—"} / {p6Reconciliation.summary.assignmentAfter??"—"} · Relationships: {p6Reconciliation.summary.relationshipBefore??"—"} / {p6Reconciliation.summary.relationshipAfter??"—"}</p>
        <div className="cli-table-wrap"><table><thead><tr><th>Severity</th><th>Code</th><th>Finding</th></tr></thead><tbody>{p6Reconciliation.findings.slice(0,100).map((f,i)=><tr key={i}><td>{f.severity}</td><td>{f.code}</td><td>{f.message}</td></tr>)}</tbody></table></div>
        {p6Reconciliation.findings.length>100 && <p>Showing first 100 of {p6Reconciliation.findings.length} findings. Download Excel for full results.</p>}
        <button type="button" onClick={()=>downloadP6Reconciliation(p6Reconciliation)}>Download 05N reconciliation Excel</button>
        <p><strong>Important:</strong> P6 may change internal identifiers and recalculate derived fields during import. This is a preliminary reconciliation, not automatic authorization for production use.</p>
      </>}
    </div>}
    </>}
    {activeCostTab==="setup"&&<>
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
