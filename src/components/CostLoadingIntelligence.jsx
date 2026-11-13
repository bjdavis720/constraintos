import { assessSharedCostExportReadiness } from '../utils/sharedCostExportReadiness.js';
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
import { prepareInAppTestXer } from "../utils/costLoadingInAppXer.js";
import { prepareCombinedSharedTestXer } from "../utils/sharedCostCombinedTestXer.js";
import { reconcileP6Reexport, downloadP6Reconciliation } from "../utils/costLoadingP6Reconciliation.js";
import { reviewFullConstructionAllocation, downloadFullConstructionReview } from "../utils/costLoadingFullReadiness.js";
import { buildBulkAllocationWorkbook, downloadBulkAllocationWorkbook } from "../utils/costLoadingBulkAllocation.js";
import { calculatePool, summarizePools, dollars } from "../utils/costLoadingInApp.js";
import { readWorkspace, writeWorkspace, workspaceKey } from "../utils/costLoadingPersistence.js";
import { prepareInAppBridge, downloadInAppBridge } from "../utils/costLoadingInAppBridge.js";
import { parseCostXEstimate, distributeCostXClin } from "../utils/costXDistribution.js";
import { moneyCents, scheduleMonths, recommendMonthly } from "../utils/sharedCostMonthlyPlan.js";
import { auditSharedCostSeparation } from "../utils/sharedCostSeparationAudit.js";

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
const makeClins = () => []; // A new project has no prefilled award values.
const normalizeClin = value => String(value ?? "").trim().replace(/^0+(?=\d)/, "") || "";
const sourceClinFor = (item, pool) => {
  if (item?.clin) return String(item.clin);
  const match = String(item?.key || "").match(/^CostX::(\d+)::/i);
  return match ? match[1] : String(pool?.clin || "");
};
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
  const [activeCostTab,setActiveCostTab] = useState("setup");
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
  const [costXClin,setCostXClin]=useState("");
  const [costXSettings,setCostXSettings]=useState({});
  const [costXMessage,setCostXMessage]=useState("");
  const [sharedPlans,setSharedPlans]=useState({});
  const [sharedClin,setSharedClin]=useState("");
  const [sharedCategory,setSharedCategory]=useState("");
  const [previewMonth,setPreviewMonth]=useState("");
  const [previewSearch,setPreviewSearch]=useState("");
  const [previewSelections,setPreviewSelections]=useState({});
  const [previewDrafts,setPreviewDrafts]=useState({});
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
  const costX=useMemo(()=>parseCostXEstimate(estimate),[estimate]);
  const selectedCostXClin=costX?.clins.find(c=>c.id===costXClin)||costX?.clins[0];
  const selectedCostXSettings=costXSettings[selectedCostXClin?.id]||{};
  const costXDistribution=useMemo(()=>selectedCostXClin?distributeCostXClin(selectedCostXClin,selectedCostXSettings):null,[selectedCostXClin,selectedCostXSettings]);
  const scheduleAvailableMonths=useMemo(()=>scheduleMonths(audit?.activities||[]),[audit]);
  const planningClin=costX?.clins.find(c=>c.id===sharedClin)||costX?.clins[0];
  const planningCategories=useMemo(()=>planningClin?[...new Set(planningClin.shared.map(r=>r.category))]:[],[planningClin]);
  const planningCategory=planningCategories.includes(sharedCategory)?sharedCategory:planningCategories[0];
  const planningTotal=planningClin?.shared.filter(r=>r.category===planningCategory).reduce((a,r)=>a+r.amountCents,0)||0;
  const planningKey=planningClin&&planningCategory?`${planningClin.id}::${planningCategory}`:"";
  const planningSettings=sharedPlans[planningKey]||{};
  const planningStart=planningSettings.startMonth||scheduleAvailableMonths[0]||"";
  const planningEnd=planningSettings.endMonth||scheduleAvailableMonths[scheduleAvailableMonths.length-1]||"";
  const planningDateValid=!!planningStart&&!!planningEnd&&planningStart<=planningEnd;
  const planningMonths=planningDateValid?scheduleAvailableMonths.filter(m=>m>=planningStart&&m<=planningEnd):[];
  const planningMethod=planningSettings.method||"recommended";
  const planningRecommended=useMemo(()=>recommendMonthly(planningTotal,planningMonths,planningSettings.frontPercent??60),[planningTotal,planningMonths,planningSettings.frontPercent]);
  const planningAmounts=planningMethod==="manual"?planningMonths.map(m=>moneyCents(planningSettings.months?.[m]||0)):planningRecommended;
  const planningAllocated=planningAmounts.reduce((a,b)=>a+b,0);
  const planningRemaining=planningTotal-planningAllocated;
  // Phase 4A: advisory candidate list only. Never affects approvals, persistence or XER.
  const activePreviewMonth=planningMonths.includes(previewMonth)?previewMonth:planningMonths[0]||"";
  const previewMonthIndex=planningMonths.indexOf(activePreviewMonth);
  const previewTargetCents=previewMonthIndex<0?0:planningAmounts[previewMonthIndex];
  // Construction WBS eligibility: include root and all descendants by P6 parent_wbs_id.
  // Explicit selection persists with sharedPlans; ambiguous auto-detection requires user selection.
  // Older saved audits predate wbsNodes. Recover the authoritative PROJWBS
  // hierarchy from the stored original XER without altering saved allocations.
  const recoveredWbsNodes=useMemo(()=>{
    if(audit?.wbsNodes?.length || !xerSourceBytes)return [];
    try {
      const bytes=xerSourceBytes instanceof Uint8Array?xerSourceBytes:new Uint8Array(xerSourceBytes);
      const text=new TextDecoder("windows-1252").decode(bytes);
      return auditCostLoadingXer(text).wbsNodes||[];
    } catch {return [];}
  },[audit,xerSourceBytes]);
  const wbsNodes=audit?.wbsNodes?.length?audit.wbsNodes:recoveredWbsNodes;
  const constructionWbsOptions=useMemo(()=>wbsNodes.filter(n=>n.id).sort((a,b)=>
    String(a.code||a.name||"").localeCompare(String(b.code||b.name||""),undefined,{numeric:true,sensitivity:"base"})
  ),[wbsNodes]);
  const autoConstructionRoots=useMemo(()=>constructionWbsOptions.filter(n=>
    /^construction$/i.test(String(n.name||"").trim()) ||
    /(?:^|\.)06CONS$/i.test(String(n.code||"").trim())
  ),[constructionWbsOptions]);
  const storedConstructionRoot=sharedPlans.__constructionWbsRoot||"";
  const constructionRootId=constructionWbsOptions.some(n=>n.id===storedConstructionRoot)?storedConstructionRoot:(autoConstructionRoots.length===1?autoConstructionRoots[0].id:"");
  const constructionWbsIds=useMemo(()=>{
    const allowed=new Set();
    if(!constructionRootId)return allowed;
    const children=new Map();
    wbsNodes.forEach(n=>{const list=children.get(n.parentId)||[];list.push(n.id);children.set(n.parentId,list);});
    const stack=[constructionRootId];
    while(stack.length){const id=stack.pop();if(allowed.has(id))continue;allowed.add(id);(children.get(id)||[]).forEach(child=>stack.push(child));}
    return allowed;
  },[audit,constructionRootId]);
  const isConstructionActivity=a=>constructionWbsIds.has(String(a?.wbsId||""));
  const eligibleMonthActivities=useMemo(()=>{
    if(!activePreviewMonth||!constructionRootId)return [];
    const monthStart=new Date(`${activePreviewMonth}-01T00:00:00`);
    const monthEnd=new Date(monthStart.getFullYear(),monthStart.getMonth()+1,0,23,59,59);
    return (audit?.activities||[]).filter(a=>{
      if(!isConstructionActivity(a))return false;
      const start=new Date(a.start),finish=new Date(a.finish||a.start);
      if(!Number.isFinite(start.getTime())||!Number.isFinite(finish.getTime()))return false;
      if(start>monthEnd||finish<monthStart)return false;
      if(/^(LOE10000)$/i.test(String(a.activityId||"")))return false;
      if(/milestone|level of effort|\bLOE\b/i.test(String(a.name||"")))return false;
      return true;
    }).sort((a,b)=>String(a.activityId).localeCompare(String(b.activityId),undefined,{numeric:true}));
  },[audit,activePreviewMonth,constructionRootId,constructionWbsIds]);
  const previewCandidates=useMemo(()=>{
    const q=previewSearch.trim().toLowerCase();
    return q?eligibleMonthActivities.filter(a=>[a.activityId,a.name,a.wbs,JSON.stringify(a.codes||{})].some(v=>String(v||"").toLowerCase().includes(q))):eligibleMonthActivities;
  },[eligibleMonthActivities,previewSearch]);
  const previewSelectionKey=`${planningKey}::${activePreviewMonth}`;
  const savedMonthlyAllocation=planningSettings.allocations?.[activePreviewMonth]||null;
  // First visit: select all eligible construction activities, but do not assign dollars or approve.
  // Explicit saved/draft records, including intentionally empty selections, always take priority.
  const previewDraft=previewDrafts[previewSelectionKey]||savedMonthlyAllocation||{
    rows:eligibleMonthActivities.map(a=>({taskId:String(a.taskId),cents:0})),status:"draft"
  };
  const previewRows=previewDraft.rows||[];
  const previewSelected=previewRows.map(r=>String(r.taskId));
  const previewSelectedCandidates=previewRows.map(r=>(audit?.activities||[]).find(a=>String(a.taskId)===String(r.taskId))).filter(Boolean);
  const previewOutsideConstruction=previewRows.filter(r=>!isConstructionActivity((audit?.activities||[]).find(a=>String(a.taskId)===String(r.taskId))));
  const previewAssignedCents=previewRows.reduce((sum,r)=>sum+Number(r.cents||0),0);
  const previewDifferenceCents=previewTargetCents-previewAssignedCents;
  const previewIsApproved=!!constructionRootId&&!previewOutsideConstruction.length&&!!savedMonthlyAllocation&&savedMonthlyAllocation.status==="approved"&&savedMonthlyAllocation.targetCents===previewTargetCents&&JSON.stringify(previewRows)===JSON.stringify(savedMonthlyAllocation.rows||[]);
  const previewSuggestedCents=previewSelectedCandidates.length?Math.floor(previewTargetCents/previewSelectedCandidates.length):0;
  const previewApprovedCount=planningMonths.filter(m=>{const a=planningSettings.allocations?.[m];const i=planningMonths.indexOf(m);return a?.status==="approved"&&!!constructionRootId&&(a.rows||[]).every(r=>isConstructionActivity((audit?.activities||[]).find(x=>String(x.taskId)===String(r.taskId))))&&a.targetCents===planningAmounts[i]&&a.rows?.reduce((sum,r)=>sum+Number(r.cents||0),0)===planningAmounts[i];}).length;
  const editPreviewRows=rows=>setPreviewDrafts(prev=>({...prev,[previewSelectionKey]:{rows,status:"draft"}}));
  const togglePreviewActivity=(activity,checked)=>{
    const id=String(activity.taskId);
    const rows=checked?[...previewRows.filter(r=>String(r.taskId)!==id),{taskId:id,cents:0}]:previewRows.filter(r=>String(r.taskId)!==id);
    // Newly selected activities start with zero. The user can request an equal split or enter dollars.
    editPreviewRows(rows);
  };
  const selectAllPreview=()=>{
    const seen=new Set(previewRows.map(r=>String(r.taskId)));
    editPreviewRows([...previewRows,...eligibleMonthActivities.filter(a=>!seen.has(String(a.taskId))).map(a=>({taskId:String(a.taskId),cents:0}))]);
  };
  const deselectAllPreview=()=>editPreviewRows([]);
  const equalSplitPreview=()=>{
    if(!previewRows.length)return;
    const base=Math.floor(previewTargetCents/previewRows.length);
    const remainder=previewTargetCents-base*previewRows.length;
    editPreviewRows(previewRows.map((r,i)=>({...r,cents:base+(i<remainder?1:0)})));
  };
  const savePreviewAllocation=(approve=false)=>{
    if(approve&&(previewRows.length===0||previewDifferenceCents!==0||!planningDateValid||planningRemaining!==0||!constructionRootId||previewOutsideConstruction.length))return;
    const record={rows:previewRows.map(r=>({taskId:String(r.taskId),cents:Number(r.cents||0)})),status:approve?"approved":"draft",targetCents:previewTargetCents};
    updateSharedPlan({allocations:{...(planningSettings.allocations||{}),[activePreviewMonth]:record}});
    setPreviewDrafts(prev=>{const next={...prev};delete next[previewSelectionKey];return next;});
  };
  const reopenPreviewAllocation=()=>{
    if(!savedMonthlyAllocation)return;
    updateSharedPlan({allocations:{...(planningSettings.allocations||{}),[activePreviewMonth]:{...savedMonthlyAllocation,status:"draft"}}});
  };

  const updateSharedPlan=patch=>setSharedPlans(prev=>({...prev,[planningKey]:{...(prev[planningKey]||{}),...patch}}));
  const costXItems=useMemo(()=>costX?.clins.flatMap(c=>c.subs.map(s=>({key:s.key,description:s.description,row:s.row,referenceAmount:s.baseCents/100,clin:c.id})))||[],[costX]);
  const updateCostXCategory=(category,patch)=>{
    if(!selectedCostXClin)return;
    setCostXSettings(prev=>({...prev,[selectedCostXClin.id]:{...(prev[selectedCostXClin.id]||{}),[category]:{...(prev[selectedCostXClin.id]?.[category]||{}),...patch}}}));
  };
  const importCostXDrafts=()=>{
    if(!costX){setCostXMessage('Upload a CostX workbook first.');return;}
    const prepared=[];const failures=[];
    for(const clin of costX.clins){
      const result=distributeCostXClin(clin,costXSettings[clin.id]||{});
      if(result.errors.length)failures.push(`CLIN ${clin.id}: ${result.errors.join(' ')}`);
      if(result.excludedCents && !costXSettings[clin.id]?.excludedAcknowledged)failures.push(`CLIN ${clin.id}: ${usd(result.excludedCents/100)} excluded. Confirm the excluded reserve treatment for this CLIN before importing.`);
      for(const row of result.lines){if(row.loadedCents>0)prepared.push({clin:clin.id,row});}
    }
    if(failures.length){setCostXMessage(`Import blocked: ${failures.slice(0,6).join(' | ')}`);return;}
    const conflicts=prepared.filter(({row})=>inAppPools[row.key]?.status==='approved');
    if(conflicts.length){setCostXMessage(`${conflicts.length} approved cost pools already exist. Reopen them before refreshing the CostX import.`);return;}
    if(!window.confirm(`Create or refresh ${prepared.length} draft cost pools from CostX? Existing draft activity allocations will be retained, but draft pool amounts will update. Approved pools will not be changed.`))return;
    setInAppPools(prev=>{
      const next={...prev};
      for(const {clin,row} of prepared){
        const prior=next[row.key]||{};
        next[row.key]={...prior,amount:(row.loadedCents/100).toFixed(2),clin,type:'Direct Cost',status:'draft',rows:prior.rows||{},costX:{sourceRow:row.row,baseCents:row.baseCents,additions:row.additions}};
      }
      return next;
    });
    setCostXMessage(`${prepared.length} CostX subcontractor pools staged as drafts. Review activity allocations and approve each pool before TEST XER export.`);
  };

  // 06C in-app draft register; saved locally and separately from the proven 05M XER workflow.
  const [inAppPools,setInAppPools]=useState({});
  const separationAudit=useMemo(()=>auditSharedCostSeparation(inAppPools,costX),[inAppPools,costX]);
  const approvedLegacyShared=Object.values(inAppPools).filter(p=>p.status==="approved"&&!p.separation?.completed&&p.costX&&Object.values(p.costX.additions||{}).some(v=>Number(v)!==0));

  // Phase 4C-1: review-only aggregation of saved monthly approvals.
  // This does not change the existing direct-cost bridge or TEST XER exporter.
  const sharedReconciliation=useMemo(()=>{
    const categories=[];
    const receiving=new Map();
    let approvedCents=0, plannedCents=0, approvedMonths=0, pendingMonths=0;
    const findings=[];
    const allActivities=audit?.activities||[];
    const activityById=new Map(allActivities.map(a=>[String(a.taskId),a]));
    for(const clin of costX?.clins||[]){
      for(const category of [...new Set((clin.shared||[]).map(r=>r.category))]){
        const key=`${clin.id}::${category}`;
        const settings=sharedPlans[key]||{};
        const budget=(clin.shared||[]).filter(r=>r.category===category).reduce((v,r)=>v+Number(r.amountCents||0),0);
        const months=scheduleAvailableMonths.filter(m=>m>=(settings.startMonth||scheduleAvailableMonths[0]||"")&&m<=(settings.endMonth||scheduleAvailableMonths.at(-1)||""));
        const amounts=settings.method==="manual"?months.map(m=>moneyCents(settings.months?.[m]||0)):recommendMonthly(budget,months,settings.frontPercent??60);
        const planTotal=amounts.reduce((a,b)=>a+b,0);
        plannedCents+=budget;
        let categoryApproved=0, categoryApprovedMonths=0;
        if(planTotal!==budget)findings.push(`${key}: monthly plan does not reconcile to category budget.`);
        months.forEach((month,index)=>{
          const allocation=settings.allocations?.[month];
          if(!allocation){pendingMonths++;return;}
          const rows=allocation.rows||[];
          const assigned=rows.reduce((a,r)=>a+Number(r.cents||0),0);
          const valid=allocation.status==="approved"&&allocation.targetCents===amounts[index]&&assigned===amounts[index]&&rows.length>0;
          if(!valid){pendingMonths++;return;}
          categoryApprovedMonths++;approvedMonths++;categoryApproved+=assigned;
          for(const row of rows){
            const activity=activityById.get(String(row.taskId));
            if(!activity){findings.push(`${key} ${month}: missing activity ${row.taskId}`);continue;}
            const activityKey=String(activity.taskId);
            const record=receiving.get(activityKey)||{activityId:activity.activityId,name:activity.name,cents:0,months:new Set()};
            record.cents+=Number(row.cents||0);record.months.add(month);receiving.set(activityKey,record);
          }
        });
        approvedCents+=categoryApproved;
        categories.push({key,budget,approved:categoryApproved,remaining:budget-categoryApproved,approvedMonths:categoryApprovedMonths,totalMonths:months.length});
      }
    }
    if(Object.values(inAppPools).some(p=>p.status==="approved"&&!p.separation?.completed&&p.costX&&Object.values(p.costX.additions||{}).some(v=>Number(v)!==0)))findings.push("Approved direct-cost pools still contain shared costs; combined export must remain blocked.");
    return {categories,receiving:[...receiving.values()],approvedCents,plannedCents,approvedMonths,pendingMonths,findings};
  },[costX,sharedPlans,scheduleAvailableMonths,audit,inAppPools]);

  const [inAppPoolKey,setInAppPoolKey]=useState("");
  const [inAppPoolSearch,setInAppPoolSearch]=useState("");
  const [inAppAdvancedFilters,setInAppAdvancedFilters]=useState(false);
  const [inAppClinFilter,setInAppClinFilter]=useState("all");
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
  const inAppItems=costXItems.length ? costXItems
    : matching?.items?.length
    ? matching.items.map(i=>({...i,key:`${sourceSheet}::${i.row}`}))
    : inAppFallbackItems;
  const inAppSourceFilename=estimate?.filename||allocationFilename;
  const inAppStorageKey=projectName&&inAppSourceFilename&&audit
    ? `sentinel-06c-v1:${projectName}:${inAppSourceFilename}:${filename}` : "";
  const inAppClinOptions=useMemo(()=>[...new Set(inAppItems.map(item=>sourceClinFor(item,inAppPools[item.key])).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})),[inAppItems,inAppPools]);
  const inAppFilteredItems=useMemo(()=>inAppClinFilter==="all"?inAppItems:
    inAppItems.filter(item=>normalizeClin(sourceClinFor(item,inAppPools[item.key]))===normalizeClin(inAppClinFilter)),
    [inAppItems,inAppPools,inAppClinFilter]);
  const inAppPoolChoices=useMemo(()=>inAppFilteredItems.filter(item=>
    `${item.description} ${item.key} ${inAppPools[item.key]?.status||"draft"}`.toLowerCase().includes(inAppPoolSearch.trim().toLowerCase())
  ),[inAppFilteredItems,inAppPools,inAppPoolSearch]);
  const inAppClinProgress=useMemo(()=>({
    total:inAppFilteredItems.length,
    approved:inAppFilteredItems.filter(item=>inAppPools[item.key]?.status==="approved").length,
    approvedDollars:inAppFilteredItems.reduce((sum,item)=>sum+(inAppPools[item.key]?.status==="approved"?Number(inAppPools[item.key]?.amount||0):0),0)
  }),[inAppFilteredItems,inAppPools]);
  const nextInAppPool=()=>{
    const currentIndex=inAppFilteredItems.findIndex(item=>item.key===inAppPoolKey);
    const next=inAppFilteredItems[currentIndex+1]||inAppFilteredItems[0];
    if(!next)return;
    setInAppPoolSearch("");setInAppPoolKey(next.key);setInAppSearch("");setInAppShowAll(false);setInAppError("");
  };
  const inAppCurrentItem=inAppItems.find(i=>i.key===inAppPoolKey);
  const inAppCurrent=inAppPools[inAppPoolKey]||{amount:"",clin:"",type:"Direct Cost",status:"draft",rows:{}};
  const inAppSourceClin=sourceClinFor(inAppCurrentItem,inAppCurrent);
  const inAppEffectiveClin=inAppSourceClin||inAppCurrent.clin||"";
  const inAppAcceptedClin=clins.find(c=>c.accepted&&normalizeClin(c.id)===normalizeClin(inAppEffectiveClin));
  const inAppResult=useMemo(()=>calculatePool(inAppCurrent),[inAppCurrent]);
  const inAppReceivingIds=Object.keys(inAppCurrent.rows||{}).filter(id=>inAppCurrent.rows[id]?.method&&inAppCurrent.rows[id].method!=="none");
  const inAppActivityById=useMemo(()=>new Map((audit?.activities||[]).map(a=>[String(a.activityId),a])),[audit]);
  const inAppClinCodeType=clinCodeType||audit?.activityCodeTypes?.find(t=>/\bclin\b/i.test(t.name||""))?.id||"";
  const inAppClinConflicts=useMemo(()=>{
    if(!inAppClinCodeType||!inAppEffectiveClin)return [];
    return inAppReceivingIds.flatMap(id=>{
      const activity=inAppActivityById.get(id);
      const code=activity?.codes?.[inAppClinCodeType]?.code;
      return code&&normalizeClin(code)!==normalizeClin(inAppEffectiveClin)?[`${id}: P6 CLIN ${code} conflicts with pool CLIN ${inAppEffectiveClin}`]:[];
    });
  },[inAppReceivingIds.join("|"),inAppActivityById,inAppClinCodeType,inAppEffectiveClin]);
  const inAppUncodedCount=inAppClinCodeType?inAppReceivingIds.filter(id=>!inAppActivityById.get(id)?.codes?.[inAppClinCodeType]?.code).length:0;
  const inAppApprovalFindings=[
    ...(!inAppResult.ready?["Cost pool must be balanced with no calculation errors."]:[]),
    ...(!inAppReceivingIds.length?["Choose at least one receiving P6 activity."]:[]),
    ...(!inAppAcceptedClin?[`CLIN ${inAppEffectiveClin||"(not selected)"} must be registered and explicitly marked Accepted in Setup & Diagnostics.`]:[]),
    ...(inAppSourceClin&&inAppCurrent.clin&&normalizeClin(inAppCurrent.clin)!==normalizeClin(inAppSourceClin)?["Saved pool CLIN conflicts with its original CostX CLIN."]:[]),
    ...(!inAppClinCodeType?["Select the P6 CLIN activity-code type in Setup & Diagnostics to validate activity assignments (uncoded activities are allowed)."]:[]),
    ...inAppClinConflicts,
  ];
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
    if(inAppView==="recommended"&&!inAppShowAll&&!inAppSearch.trim()&&!inAppRecommendedIds.has(id)&&!inAppCurrent.rows[id])return false;
    if(inAppWbsFilter!=="all"&&(a.wbs||"Unassigned")!==inAppWbsFilter)return false;
    if(inAppTradeFilter!=="all"&&codeLabel(a,inAppEffectiveTradeCode)!==inAppTradeFilter)return false;
    const q=inAppSearch.toLowerCase().trim();return !q||`${id} ${a.name} ${a.wbs} ${JSON.stringify(a.codes||{})}`.toLowerCase().includes(q);
  }),[audit,inAppShowAll,inAppView,inAppRecommendedIds,inAppCurrent.rows,inAppSearch,inAppWbsFilter,inAppTradeFilter,inAppEffectiveTradeCode]);
  const inAppBridge=useMemo(()=>prepareInAppBridge(inAppPools,clins,audit),[inAppPools,clins,audit]);
  const combinedExportReadiness=useMemo(()=>assessSharedCostExportReadiness({
    audit,costX,sharedPlans,months:scheduleAvailableMonths,wbsNodes,directBridge:inAppBridge,directPools:inAppPools
  }),[audit,costX,sharedPlans,scheduleAvailableMonths,wbsNodes,inAppBridge,inAppPools]);
  const inAppTestXer=useMemo(()=>prepareInAppTestXer(audit,inAppBridge,xerSourceBytes),[audit,inAppBridge,xerSourceBytes]);
  const combinedTestXer=useMemo(()=>prepareCombinedSharedTestXer({audit,sourceBytes:xerSourceBytes,directBridge:inAppBridge,readiness:combinedExportReadiness,costX,sharedPlans,months:scheduleAvailableMonths}),[audit,xerSourceBytes,inAppBridge,combinedExportReadiness,costX,sharedPlans,scheduleAvailableMonths]);
  const [combinedTestAcknowledged,setCombinedTestAcknowledged]=useState(false);
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
  // Import the detected CostX CLIN identifiers into the award register without inventing award values or acceptance.
  useEffect(()=>{
    if(!persistenceReady||hydrationRef.current||!costX?.clins?.length)return;
    setClins(prev=>{
      const known=new Set(prev.map(c=>normalizeClin(c.id)));
      const missing=costX.clins.filter(c=>!known.has(normalizeClin(c.id)));
      if(!missing.length)return prev;
      return [...prev,...missing.map(c=>({id:String(c.id),name:c.name||`CostX CLIN ${c.id}`,amount:"",accepted:false}))]
        .sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
    });
  },[costX,persistenceReady]);
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
    if(inAppApprovalFindings.length){setInAppError(`Approval blocked: ${inAppApprovalFindings.join(" | ")}`);return;}
    const candidate={...inAppPools,[inAppPoolKey]:{...inAppCurrent,clin:inAppEffectiveClin,status:"approved"}};
    const summary=summarizePools(candidate,clins,audit?.activities?.map(a=>a.activityId)||[],inAppHolding);
    if(summary.errors.length){setInAppError(`Approval blocked: ${summary.errors.join("; ")}`);return;}
    setInAppPools(candidate);setInAppError("Pool approved in the in-app register. This does NOT authorize XER export. Save your work.");
  };
  // Controlled conversion: never silently approve or export a changed pool.
  const stageDirectOnlyPool=(key)=>{
    const review=separationAudit.rows.find(r=>r.key===key);
    const pool=inAppPools[key];
    if(!review?.ready||!review.hasShared||!pool||pool.status!=="approved"||pool.separation?.completed){
      setInAppError("Separation blocked: approved source composition must reconcile first.");return;
    }
    const direct=review.baseCents;
    const fixed=Object.values(pool.rows||{}).filter(r=>r.method==="dollars")
      .reduce((sum,r)=>sum+Math.round(Number(r.value)*100),0);
    if(!Number.isSafeInteger(fixed)||fixed>direct){
      setInAppError("Separation blocked: fixed-dollar allocations exceed the direct-only pool. Review manually.");return;
    }
    const rows=pool.rows||{};
    const hasFlexible=Object.values(rows).some(r=>r.method==="spread"||r.method==="percent");
    if(!hasFlexible&&fixed!==direct){
      setInAppError("Separation blocked: no flexible allocations can absorb the direct-cost adjustment. Review manually.");return;
    }
    if(!window.confirm(`Stage ${review.name} for DIRECT-ONLY reapproval?\n\nOriginal approved: ${usd(review.approvedCents/100)}\nNew draft: ${usd(direct/100)}\nShared costs retained in audit: ${usd(review.sharedCents/100)}\n\nThis removes the pool from TEST XER exports until you explicitly reapprove it. Existing activity methods and fixed dollars remain.`))return;
    setInAppPools(prev=>({...prev,[key]:{
      ...prev[key],amount:(direct/100).toFixed(2),status:"draft",
      separation:{completed:true,approvedOriginalCents:review.approvedCents,
        directCents:direct,sharedCents:review.sharedCents,
        originalAdditions:{...pool.costX.additions},stagedAt:new Date().toISOString()}
    }}));
    setInAppPoolKey(key);setActiveCostTab("allocation");
    setInAppError("Direct-only draft staged. Verify the new calculated allocations, then explicitly approve. Shared costs are NOT yet separately exported.");
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
      estimate,sourceSheet,clins,inAppPools,inAppPoolKey,costXSettings,sharedPlans,allocationFilename,
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
      setInAppPools(d.inAppPools||{});setInAppPoolKey(d.inAppPoolKey||"");setCostXSettings(d.costXSettings||{});setSharedPlans(d.sharedPlans||{});
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
    setInAppPools({});setInAppPoolKey("");setCostXSettings({});setSharedPlans({});setCostXClin("");setCostXMessage("");setEstimateError("");setClins(makeClins());
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
        setInAppPoolKey(d.inAppPoolKey||"");setCostXSettings(d.costXSettings||{});setSharedPlans(d.sharedPlans||{});
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
        inAppPools,inAppPoolKey,costXSettings,sharedPlans,allocationFilename,allocationWorkbookBytes};
      writeWorkspace(currentProjectKey,data).then(()=>{
        setPersistenceStatus(`Saved automatically · ${new Date().toLocaleTimeString()}`);
      }).catch(err=>setPersistenceStatus(`SAVE FAILED: ${err.message} · export a JSON backup`));
    },900);
    return ()=>clearTimeout(timer);
  },[persistenceReady,currentProjectKey,audit,xerSourceBytes,filename,estimate,sourceSheet,clins,inAppPools,inAppPoolKey,costXSettings,sharedPlans,allocationFilename,allocationWorkbookBytes]);

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
    <p>Allocate approved costs to P6 activities, review project totals, and generate a controlled TEST XER directly from approved in-app allocations. Production export is not authorized.</p>
    <div className="cli-panel" style={{padding:"12px 16px"}}>
      <strong>Project: {projectName || "Selected project"}</strong>
      <div role="tablist" aria-label="Cost loading sections" style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
        {[["setup","1 · Upload"],["allocation","2 · Allocate"],["shared","3 · Shared Costs"],["dashboard","4 · Validate"],["export","5 · Export"]].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={activeCostTab===id} onClick={()=>setActiveCostTab(id)} style={{padding:"10px 14px",borderRadius:7,border:"1px solid #b8c6d4",background:activeCostTab===id?"#174b86":"#f3f6f9",color:activeCostTab===id?"white":"#172a3a",fontWeight:activeCostTab===id?700:500}}>{label}</button>)}
      </div>
      <div role="status" aria-live="polite" title="Project data is stored in this browser on this device. Export a backup to transfer it or protect against browser data loss." style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:10,padding:"9px 12px",margin:"8px 0",border:"1px solid #d0d7e2",borderRadius:6,background:"#f6f8fb",fontSize:13}}>
        <strong style={{color:persistenceStatus.startsWith("SAVE FAILED")||persistenceStatus.startsWith("Automatic restore unavailable")?"#b42318":"#172a3a"}}>Project {persistenceStatus.toLowerCase().startsWith("saved automatically")?"saved automatically":persistenceStatus}</strong>
        <span style={{color:"#667085"}}>{persistenceStatus.toLowerCase().startsWith("saved automatically")?"· Last saved: "+persistenceStatus.split("·").slice(1).join("·").trim():""}</span>
        <button type="button" onClick={exportProjectBackup} disabled={!persistenceReady}>Export Backup</button>
        <label style={{display:"inline-flex",alignItems:"center",gap:6}}>Import Backup <input type="file" accept=".json" onChange={importProjectBackup} disabled={!persistenceReady} aria-label="Import project JSON backup"/></label>
      </div>
      {!audit&&activeCostTab!=="setup"&&<p>Start with <button type="button" onClick={()=>setActiveCostTab("setup")}>Upload</button> to add the P6 XER and estimate workbook.</p>}
    </div>
    {activeCostTab==="shared"&&<div className="cli-panel">
      <h3>Shared Cost Loading — Monthly Plan</h3>
      <p><strong>Planning preview only.</strong> Monthly plans are used to approve shared-cost allocations to activities. Approved shared allocations are included in the combined TEST XER; P6 spreads each activity cost over its duration.</p>
      {approvedLegacyShared.length>0&&<p role="alert" style={{color:"#a33",fontWeight:700}}>Migration required: {approvedLegacyShared.length} approved subcontractor pools already contain proportional shared costs. Do not add these costs again to P6. A controlled separation/reapproval is required before monthly loading can be exported.</p>}
      <details open style={{margin:"12px 0",padding:12,border:"1px solid #cbd5e1",borderRadius:8}}>
        <summary><strong>Phase 3 — Approved cost pool separation and reapproval</strong></summary>
        <p className="cli-footnote">This compares each approved pool with the original CostX direct cost and recorded shared-cost additions. Use Stage direct-only draft to preserve activity methods and fixed dollars while requiring explicit reapproval. The TEST XER excludes staged drafts.</p>
        <p><strong>Approved pools:</strong> {separationAudit.rows.length} · <strong>Containing shared costs:</strong> {separationAudit.withShared} · <strong>Review findings:</strong> {separationAudit.issues}</p>
        <p><strong>Approved total:</strong> {usd(separationAudit.approvedCents/100)} · <strong>Direct component:</strong> {usd(separationAudit.directCents/100)} · <strong>Shared component:</strong> {usd(separationAudit.sharedCents/100)}</p>
        {separationAudit.rows.length===0?<p>No approved pools to audit.</p>:<div className="cli-table-wrap" style={{maxHeight:310,overflowY:"auto"}}><table><thead><tr><th>CLIN / Scope</th><th>Approved</th><th>Direct</th><th>Shared embedded</th><th>Reconciliation</th><th>Action</th></tr></thead><tbody>{separationAudit.rows.map(r=><tr key={r.key}><td>{r.clin} · {r.name}</td><td>{Number.isSafeInteger(r.approvedCents)?usd(r.approvedCents/100):"—"}</td><td>{r.baseCents===null?"—":usd(r.baseCents/100)}</td><td>{r.sharedCents===null?"—":usd(r.sharedCents/100)}</td><td>{r.ready?"Matches recorded composition":r.notes.join(" ")}</td><td><button type="button" disabled={!r.ready||!r.hasShared||inAppPools[r.key]?.separation?.completed} onClick={()=>stageDirectOnlyPool(r.key)}>Stage direct-only draft</button></td></tr>)}</tbody></table></div>}
        <details style={{marginTop:10}}><summary>Shared-cost category details by approved pool</summary><div className="cli-table-wrap"><table><thead><tr><th>Scope</th><th>Category</th><th>Embedded amount</th></tr></thead><tbody>{separationAudit.rows.flatMap(r=>r.components.map(c=><tr key={`${r.key}-${c.category}`}><td>{r.name}</td><td>{c.category}</td><td>{usd(c.cents/100)}</td></tr>))}</tbody></table></div></details>
        <p role="status" style={{fontWeight:600}}>Monthly shared-cost export remains NOT AUTHORIZED. Stage each eligible approved pool as direct-only, review the resulting activity amounts in Step 2, and explicitly reapprove. Original shared-cost category values are retained for later monthly loading.</p>
      </details>
      {Object.entries(inAppPools).some(([,p])=>p.separation?.completed)&&<p role="status"><strong>Direct-only migration register:</strong> {Object.values(inAppPools).filter(p=>p.separation?.completed).length} staged pools, of which {Object.values(inAppPools).filter(p=>p.separation?.completed&&p.status==="approved").length} reapproved. Original shared costs are retained in each pool's separation record and are NOT included in monthly P6 exports.</p>}
      {!costX?<p>Upload the CostX estimate in Step 1 to plan shared costs.</p>:<>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
          <label>CLIN <select value={planningClin?.id||""} onChange={e=>{setSharedClin(e.target.value);setSharedCategory("");}}>{costX.clins.map(c=><option key={c.id} value={c.id}>{c.id}</option>)}</select></label>
          <label>Shared cost category <select value={planningCategory||""} onChange={e=>setSharedCategory(e.target.value)}>{planningCategories.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
        </div>
        {!planningCategory?<p>No shared-cost categories found in this CLIN.</p>:<>
          <p><strong>CostX category budget:</strong> {usd(planningTotal/100)} · <strong>Distribution months:</strong> {planningMonths.length}</p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"end",margin:"12px 0"}}>
            <label>Loading start month <input type="month" value={planningStart} min={scheduleAvailableMonths[0]||undefined} max={scheduleAvailableMonths[scheduleAvailableMonths.length-1]||undefined} onChange={e=>updateSharedPlan({startMonth:e.target.value})}/></label>
            <label>Loading end month <input type="month" value={planningEnd} min={scheduleAvailableMonths[0]||undefined} max={scheduleAvailableMonths[scheduleAvailableMonths.length-1]||undefined} onChange={e=>updateSharedPlan({endMonth:e.target.value})}/></label>
            <button type="button" onClick={()=>updateSharedPlan({startMonth:scheduleAvailableMonths[0]||"",endMonth:scheduleAvailableMonths[scheduleAvailableMonths.length-1]||""})}>Use full P6 date range</button>
          </div>
          <p className="cli-footnote">Dates are set separately for each CLIN and category. Select construction months rather than design months where appropriate. This planning period is limited to months found in the imported P6 schedule.</p>
          {!planningDateValid&&<p role="alert" style={{color:"#a33"}}>Start month must be on or before end month.</p>}
          <label>Distribution method <select value={planningMethod} onChange={e=>updateSharedPlan({method:e.target.value})}><option value="recommended">Recommended — front-loaded</option><option value="manual">Manual — enter each month</option></select></label>
          {planningMethod==="recommended"&&<label style={{display:"block",margin:"12px 0"}}>Share in first half of project: <strong>{planningSettings.frontPercent??60}%</strong> <input type="range" min="10" max="90" step="5" value={planningSettings.frontPercent??60} onChange={e=>updateSharedPlan({frontPercent:Number(e.target.value)})}/></label>}
          {!planningMonths.length?<p role="alert">No usable P6 activity dates found. Upload a dated schedule before preparing monthly targets.</p>:<div className="cli-table-wrap" style={{maxHeight:390,overflowY:"auto"}}><table><thead><tr><th>Month</th><th>Planned shared costs</th></tr></thead><tbody>{planningMonths.map((m,i)=><tr key={m}><td>{m}</td><td>{planningMethod==="manual"?<input type="number" min="0" step="0.01" aria-label={`Amount for ${m}`} value={planningSettings.months?.[m]??""} onChange={e=>updateSharedPlan({months:{...(planningSettings.months||{}),[m]:e.target.value}})} placeholder="0.00"/>:usd(planningAmounts[i]/100)}</td></tr>)}</tbody></table></div>}
          {planningMonths.length>0&&<div style={{margin:"16px 0",padding:12,border:"1px solid #d5dce6",borderRadius:8}}>
            <strong>Monthly and cumulative shared-cost curve — {planningCategory}</strong>
            <p className="cli-footnote">Category-only planning preview; not a full project billing forecast or an exported P6 cost curve.</p>
            <svg viewBox="0 0 820 240" role="img" aria-label="Monthly shared cost bars and cumulative planned cost line" style={{width:"100%",maxWidth:900,display:"block"}}>
              {(()=>{const w=780,h=175,x0=32,y0=15;const peak=Math.max(1,...planningAmounts);const cumMax=Math.max(1,planningAllocated);let cumulative=0;const coords=planningAmounts.map((v,i)=>{cumulative+=v;return `${x0+(i+.5)*w/planningAmounts.length},${y0+h-h*cumulative/cumMax}`;}).join(" ");return <>
                {[0,.25,.5,.75,1].map(t=><line key={t} x1={x0} x2={x0+w} y1={y0+h*(1-t)} y2={y0+h*(1-t)} stroke="#d9e0e8" strokeWidth="1"/>)}
                {planningAmounts.map((v,i)=><rect key={planningMonths[i]} x={x0+i*w/planningAmounts.length+1} y={y0+h-h*v/peak} width={Math.max(1,w/planningAmounts.length-2)} height={h*v/peak} fill="#70a4c7"/>)}
                <polyline points={coords} fill="none" stroke="#c26d29" strokeWidth="3" strokeLinejoin="round"/>
                <text x={x0} y="215" fontSize="12" fill="currentColor">{planningMonths[0]}</text><text x={x0+w} y="215" fontSize="12" textAnchor="end" fill="currentColor">{planningMonths[planningMonths.length-1]}</text>
                <rect x="260" y="225" width="12" height="9" fill="#70a4c7"/><text x="278" y="234" fontSize="11" fill="currentColor">Monthly allocation</text><line x1="430" x2="447" y1="230" y2="230" stroke="#c26d29" strokeWidth="3"/><text x="453" y="234" fontSize="11" fill="currentColor">Cumulative allocation</text>
              </>;})()}
            </svg>
          </div>}
          <p><strong>Monthly total:</strong> {usd(planningAllocated/100)} · <strong>Difference:</strong> {usd(planningRemaining/100)} · <strong>{planningRemaining===0?"BALANCED":"NOT BALANCED"}</strong></p>
          <p className="cli-footnote">Each category has its own settings. Monthly targets are not P6 activity allocations; an activity eligibility and cost-reconciliation step is required before export.</p>
          <section style={{marginTop:18,padding:14,border:"1px solid #b8c6d4",borderRadius:8}}>
            <h4>Phase 4B — Monthly P6 activity allocations (saved planning approvals)</h4>
            <p className="cli-footnote">Select receiving activities and assign dollars. Saved monthly approvals feed the combined TEST XER without changing direct-cost approvals. P6 distributes assigned cost over the receiving activity duration.</p>
            <p><strong>Approved months:</strong> {previewApprovedCount} of {planningMonths.length} · <strong>Current month:</strong> {previewIsApproved?"Approved":savedMonthlyAllocation?.status==="approved"?"Needs review — target or selections changed":savedMonthlyAllocation?"Saved draft":"Unsaved draft"}</p>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end"}}>
              <label>Allocation month <select value={activePreviewMonth} onChange={e=>{setPreviewMonth(e.target.value);setPreviewSearch("");}}>{planningMonths.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
              <label>Search ID / activity / WBS / code <input value={previewSearch} onChange={e=>setPreviewSearch(e.target.value)} placeholder="Find eligible activities"/></label>
            </div>
            <div style={{margin:"12px 0",padding:10,border:"1px solid #b8c6d4",borderRadius:6}}>
              <label><strong>Construction WBS (includes all descendant WBS levels)</strong>{" "}
                <select value={constructionRootId} onChange={e=>setSharedPlans(prev=>({...prev,__constructionWbsRoot:e.target.value}))}>
                  <option value="">Select Construction WBS</option>
                  {constructionWbsOptions.map(n=><option key={n.id} value={n.id}>{n.code||"(No WBS code)"} — {n.name||"Unnamed WBS"}</option>)}
                </select>
              </label>
              {!constructionWbsOptions.length&&<p role="alert" style={{color:"#a33"}}>No P6 WBS records are available in the saved schedule. Reimport the original P6 XER in Step 1 to rebuild the WBS hierarchy; your saved cost allocations will not be reset by this selector.</p>}
              {!constructionRootId&&!!constructionWbsOptions.length&&<p role="alert" style={{color:"#a33"}}>Select the Construction WBS to show eligible activities. No activities will be assumed eligible.</p>}
              {constructionRootId&&<p className="cli-footnote">Eligible WBS nodes: {constructionWbsIds.size}. Only activities in this WBS hierarchy that overlap the selected month appear below.</p>}
              {!!previewOutsideConstruction.length&&<p role="alert" style={{color:"#a33"}}><strong>Review required:</strong> {previewOutsideConstruction.length} previously selected receiving activities are outside the chosen Construction WBS (or missing from P6). They remain saved and visible below, but approval is blocked until removed or the WBS selection is corrected.</p>}
            </div>
            <p><strong>Monthly target:</strong> {usd(previewTargetCents/100)} · <strong>Selected:</strong> {previewRows.length} · <strong>Assigned:</strong> {usd(previewAssignedCents/100)} · <strong>Difference:</strong> {usd(previewDifferenceCents/100)}</p>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
              <button type="button" disabled={previewIsApproved||!eligibleMonthActivities.length} onClick={selectAllPreview}>Select all eligible ({eligibleMonthActivities.length})</button>
              <button type="button" disabled={previewIsApproved||!previewRows.length} onClick={deselectAllPreview}>Deselect all</button>
              <span className="cli-footnote">New months start with all eligible activities selected; amounts remain $0 until distributed.</span>
            </div>
            <div className="cli-table-wrap" style={{maxHeight:300,overflowY:"auto"}}><table><thead><tr><th><input type="checkbox" aria-label="Select or deselect all eligible activities" disabled={previewIsApproved||!eligibleMonthActivities.length} checked={!!eligibleMonthActivities.length&&eligibleMonthActivities.every(a=>previewSelected.includes(String(a.taskId)))} onChange={e=>e.target.checked?selectAllPreview():deselectAllPreview()}/></th><th>Activity ID</th><th>Description</th><th>WBS</th><th>Start</th><th>Finish</th></tr></thead><tbody>
              {previewCandidates.slice(0,250).map(a=><tr key={a.taskId}><td><input type="checkbox" disabled={previewIsApproved} checked={previewSelected.includes(String(a.taskId))} onChange={e=>togglePreviewActivity(a,e.target.checked)}/></td><td>{a.activityId}</td><td>{a.name}</td><td>{a.wbs}</td><td>{String(a.start||"").slice(0,10)}</td><td>{String(a.finish||"").slice(0,10)}</td></tr>)}
              {!previewCandidates.length&&<tr><td colSpan="6">No construction-WBS activities match this month and search. Check the selected Construction WBS and schedule dates.</td></tr>}
            </tbody></table></div>
            {previewCandidates.length>250&&<p className="cli-footnote">Showing first 250 matches. Narrow the search to see additional candidates.</p>}
            {previewRows.length>0&&<div style={{marginTop:12}}><div style={{display:"flex",alignItems:"center",gap:12}}><strong>Receiving activities and monthly dollars</strong><button type="button" disabled={previewIsApproved} onClick={equalSplitPreview}>Distribute equally</button></div><div className="cli-table-wrap"><table><thead><tr><th>Activity</th><th>Amount ($)</th><th></th></tr></thead><tbody>{previewRows.map((r,i)=>{const a=(audit?.activities||[]).find(x=>String(x.taskId)===String(r.taskId));return <tr key={r.taskId}><td>{a?`${a.activityId} — ${a.name}`:`Missing P6 activity (${r.taskId})`}</td><td><input type="number" min="0" step="0.01" disabled={previewIsApproved} value={(Number(r.cents||0)/100).toFixed(2)} onChange={e=>{const cents=Math.max(0,Math.round(Number(e.target.value||0)*100));editPreviewRows(previewRows.map((x,j)=>i===j?{...x,cents}:x));}}/></td><td><button type="button" disabled={previewIsApproved} onClick={()=>editPreviewRows(previewRows.filter((_,j)=>i!==j))}>Remove</button></td></tr>;})}</tbody></table></div></div>}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginTop:12}}>
              {previewIsApproved?<button type="button" onClick={reopenPreviewAllocation}>Reopen for editing</button>:<><button type="button" onClick={()=>savePreviewAllocation(false)}>Save draft</button><button type="button" disabled={!constructionRootId||!!previewOutsideConstruction.length||!previewRows.length||previewDifferenceCents!==0||planningRemaining!==0||!planningDateValid||previewRows.some(r=>!(audit?.activities||[]).some(a=>String(a.taskId)===String(r.taskId)))} onClick={()=>savePreviewAllocation(true)}>Approve month</button></>}
            </div>
            {previewDifferenceCents!==0&&<p role="status" style={{color:"#a33"}}>The assigned amount must equal this month's target before approval.</p>}
            {planningRemaining!==0&&<p role="status" style={{color:"#a33"}}>The category's monthly plan must reconcile to its CostX budget before approval.</p>}
            <p role="status" style={{fontWeight:600}}>Approved monthly allocations feed the combined TEST XER. P6 handles duration-based cost distribution; unapproved drafts are excluded.</p>
          </section>

        </>}
      </>}
    </div>}
    {activeCostTab==="dashboard"&&<div className="cli-panel">
      <h3>Validate allocations</h3>
      {!audit?<p>Upload the source P6 XER in Upload to begin.</p>:<>
        <p><strong>Existing P6 budget:</strong> {usd(audit.totals.budget)} · <strong>Resource assignments:</strong> {audit.assignmentCount} · <strong>Activities:</strong> {audit.activityCount}</p>
        <p><strong>Approved in-app pools:</strong> {Object.values(inAppPools).filter(p=>p.status==="approved").length} · <strong>Approved dollars:</strong> {usd(dollars(inAppSummary.approved))} · <strong>Receiving activities:</strong> {inAppSummary.activityCount} · <strong>Validation findings:</strong> {inAppSummary.errors.length}</p>
        {inAppSummary.errors.length>0&&<ul>{inAppSummary.errors.map((x,i)=><li key={i}>{x}</li>)}</ul>}
        <details style={{marginTop:14}} open><summary><strong>Phase 4C — Combined direct and shared cost reconciliation (review only)</strong></summary>
          <p className="cli-footnote">Approved shared-cost records are included in the combined TEST XER. Month labels identify planning approvals; P6 spreads resource costs over activity durations.</p>
          <p><strong>Approved direct costs:</strong> {usd(dollars(inAppSummary.approved))} · <strong>Approved shared costs:</strong> {usd(sharedReconciliation.approvedCents/100)} · <strong>Combined proposed transfer:</strong> {usd(dollars(inAppSummary.approved)+sharedReconciliation.approvedCents/100)}</p>
          <p><strong>Shared-cost category budgets:</strong> {usd(sharedReconciliation.plannedCents/100)} · <strong>Shared costs not yet approved:</strong> {usd((sharedReconciliation.plannedCents-sharedReconciliation.approvedCents)/100)} · <strong>Approved monthly records:</strong> {sharedReconciliation.approvedMonths} · <strong>Receiving activities in approved shared records:</strong> {sharedReconciliation.receiving.length}</p>
          {sharedReconciliation.findings.length>0&&<div role="alert" style={{color:"#a33"}}><strong>Review findings</strong><ul>{sharedReconciliation.findings.map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
          <div className="cli-table-wrap" style={{maxHeight:260,overflowY:"auto"}}><table><thead><tr><th>CLIN / Category</th><th>Category budget</th><th>Approved shared</th><th>Not yet approved</th><th>Approved months</th></tr></thead><tbody>{sharedReconciliation.categories.map(r=><tr key={r.key}><td>{r.key}</td><td>{usd(r.budget/100)}</td><td>{usd(r.approved/100)}</td><td>{usd(r.remaining/100)}</td><td>{r.approvedMonths} / {r.totalMonths}</td></tr>)}</tbody></table></div>
          <details style={{marginTop:10}}><summary>Approved shared-cost receiving activities</summary><div className="cli-table-wrap" style={{maxHeight:280,overflowY:"auto"}}><table><thead><tr><th>Activity ID</th><th>Activity</th><th>Shared allocation</th><th>Months</th></tr></thead><tbody>{sharedReconciliation.receiving.map(r=><tr key={r.activityId}><td>{r.activityId}</td><td>{r.name}</td><td>{usd(r.cents/100)}</td><td>{[...r.months].sort().join(", ")}</td></tr>)}</tbody></table></div></details>
          <p className="cli-footnote"><strong>TEST ONLY:</strong> Combined assignment merging and holding-account reconciliation are available under Export. Production use still requires final regression approval.</p>
        </details>
        <details style={{marginTop:12}} open><summary><strong>Phase 4C-2 — Combined XER export readiness (read only)</strong></summary>
          <p><strong>Status:</strong> {combinedExportReadiness.status} · <strong>Approved shared months:</strong> {combinedExportReadiness.approvedMonths} · <strong>Pending months:</strong> {combinedExportReadiness.pendingMonths}</p>
          <p><strong>Direct transfer:</strong> {usd(combinedExportReadiness.directCents/100)} · <strong>Shared transfer:</strong> {usd(combinedExportReadiness.sharedCents/100)} · <strong>Combined:</strong> {usd(combinedExportReadiness.combinedCents/100)}</p>
          <p><strong>Construction holding before:</strong> {usd(combinedExportReadiness.holdingCents/100)} · <strong>Proposed holding after:</strong> {usd(combinedExportReadiness.holdingAfterCents/100)} · <strong>Shared receiving activities:</strong> {combinedExportReadiness.receivingActivities}</p>
          {combinedExportReadiness.blockers.length>0&&<div role="alert" style={{color:"#a33"}}><strong>Blocking findings ({combinedExportReadiness.blockers.length})</strong><ul>{combinedExportReadiness.blockers.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
          <div><strong>Important limitations</strong><ul>{combinedExportReadiness.warnings.map((x,i)=><li key={i}>{x}</li>)}</ul></div>
          <p className="cli-footnote"><strong>READINESS REVIEW ONLY.</strong> Use the combined TEST XER in Export for an isolated P6 import; production export remains locked.</p>
        </details>
        <details style={{marginTop:12}}><summary><strong>Technical transfer reconciliation</strong></summary>
        <p><strong>Bridge status:</strong> {inAppBridge.status} · <strong>Approved pools:</strong> {inAppBridge.approvedPools} · <strong>Transfer:</strong> {usd(inAppBridge.transfer)} · <strong>Receiving activities:</strong> {inAppBridge.receivingRows.length}</p>
        <p>Construction holding {inAppBridge.holdingActivity||"not identified"}: {inAppBridge.holdingBefore==null?"—":usd(inAppBridge.holdingBefore)} → {inAppBridge.holdingAfter==null?"—":usd(inAppBridge.holdingAfter)} · <strong>Budget conservation:</strong> {inAppBridge.budgetConserved?"PASSED":"NOT VERIFIED"}</p>
        {inAppBridge.findings.length>0&&<div role="alert"><strong>Bridge validation findings</strong><ul>{inAppBridge.findings.map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
        <button type="button" disabled={inAppBridge.status==="BLOCKED"} onClick={()=>downloadInAppBridge(inAppBridge,projectName)}>Download validated bridge JSON (review only)</button>
        <details><summary>Receiving activity transfer preview</summary><div className="cli-table-wrap"><table><thead><tr><th>Activity ID</th><th>Activity</th><th>Existing P6 budget</th><th>Proposed addition</th><th>Illustrative new budget</th><th>Source pools</th></tr></thead><tbody>{inAppBridge.receivingRows.map(r=><tr key={r.activityId}><td>{r.activityId}</td><td>{r.activityName}</td><td>{usd(r.existingBudget)}</td><td>{usd(r.addition)}</td><td>{usd(r.proposedBudget)}</td><td>{r.pools.join(", ")}</td></tr>)}</tbody></table></div></details>
        <p className="cli-footnote">Review-only allocation summary. To create a controlled TEST XER, use P6 Export & Reconciliation. The original schedule and saved project data remain unchanged.</p>
        <details style={{marginTop:16}}><summary><strong>Cost distribution by type</strong></summary>
        <div className="cli-table-wrap"><table><thead><tr><th>Cost type</th><th>Pools</th><th>Entered $</th><th>Approved $</th><th>Unallocated $</th></tr></thead><tbody>{inAppTypeRows.map(r=><tr key={r.type}><td>{r.type}</td><td>{r.pools}</td><td>{usd(r.amount)}</td><td>{usd(r.approved)}</td><td>{usd(r.remaining)}</td></tr>)}</tbody></table></div>
        </details>
        </details><h4>CLIN allocation progress</h4>
        <p className="cli-footnote">Estimate pool totals are planning amounts, not verified awarded contract values. Approved amounts count only approved pools.</p>
        <div className="cli-table-wrap" style={{maxHeight:340,overflowY:"auto"}}><table><thead><tr><th>CLIN</th><th>Estimate pools</th><th>Approved</th><th>Not yet approved</th><th>Approved pools</th></tr></thead><tbody>{inAppClinOptions.map(clin=>{const rows=inAppDashboardRows.filter(r=>r.clin===clin);const total=rows.reduce((n,r)=>n+r.amount,0);const approved=rows.filter(r=>r.status==="approved").reduce((n,r)=>n+r.amount,0);return <tr key={clin}><td>{clin}</td><td>{usd(total)}</td><td>{usd(approved)}</td><td>{usd(Math.max(0,total-approved))}</td><td>{rows.filter(r=>r.status==="approved").length} / {rows.length}</td></tr>;})}</tbody></table></div>
        <details style={{marginTop:14}}><summary><strong>Detailed cost pool register</strong></summary>
        {!inAppItems.length?<p>Upload the Subcontractor Summary in Setup & Diagnostics, or import a validated legacy workbook.</p>:<div className="cli-table-wrap" style={{maxHeight:440,overflowY:"auto"}}><table><thead><tr><th>Scope</th><th>Type</th><th>CLIN</th><th>Pool $</th><th>Allocated $</th><th>Unallocated $</th><th>Status</th></tr></thead><tbody>{inAppDashboardRows.map(r=><tr key={r.key}><td><button type="button" onClick={()=>{setInAppClinFilter("all");setInAppPoolKey(r.key);setInAppSearch("");setActiveCostTab("allocation");}}>{r.name}</button></td><td>{r.type}</td><td>{r.clin||"—"}</td><td>{usd(r.amount)}</td><td>{usd(r.allocated)}</td><td>{usd(r.remaining)}</td><td>{r.status}{r.errors?` (${r.errors} errors)`:""}</td></tr>)}</tbody></table></div>}
        </details>
        <details style={{marginTop:16}}><summary><strong>CLIN award comparison</strong></summary>
        <div className="cli-table-wrap"><table><thead><tr><th>CLIN</th><th>Award</th><th>Approved in-app pools</th><th>Difference</th></tr></thead><tbody>{clins.filter(c=>c.accepted).map(c=>{const approved=inAppDashboardRows.filter(r=>r.status==="approved"&&r.clin===c.id).reduce((n,r)=>n+r.amount,0);return <tr key={c.id}><td>{c.id} — {c.name}</td><td>{usd(Number(c.amount)||0)}</td><td>{usd(approved)}</td><td>{usd((Number(c.amount)||0)-approved)}</td></tr>;})}</tbody></table></div>
        <p className="cli-footnote">Award amounts are contract values, not necessarily cost-pool budgets. The dashboard reflects in-app allocations only. No production XER modifications are authorized.</p></details>
      </>}
    </div>}
    {activeCostTab==="setup"&&<>
    <div className="cli-panel"><strong>Project: {projectName || "Selected project"}</strong><p>Upload a Primavera P6 XER to inspect existing activity-level cost assignments.</p><input type="file" accept=".xer" onChange={loadFile}/>{filename && <p>File: {filename}</p>}{error && <p role="alert" className="cli-error">{error}</p>}</div>
    <div className="cli-panel">
      <h3>Upload estimate and confirm CLINs</h3>
      <p>Upload your CostX federal estimate to identify CLINs, subcontractor costs, and shared-cost categories.  Review shared-cost distributions before allocating costs to P6 activities.  Awarded CLIN values are project-specific and must be entered or verified separately.</p>
      <label>Estimate workbook <input type="file" accept=".xlsx,.xls" onChange={loadEstimate}/></label>
      {costX&&<div className="cli-panel" style={{marginTop:16}}>
        <h3>Review shared-cost distribution</h3>
        <p>Detected {costX.clins.length} CLIN sections on worksheet <strong>{costX.sheetName}</strong>. Original estimate remains unchanged. Amounts are read from Column H; review formula results before approval.</p>
        <label>CLIN <select value={selectedCostXClin?.id||''} onChange={e=>{setCostXClin(e.target.value);setCostXMessage('');}}>{costX.clins.map(c=><option key={c.id} value={c.id}>{c.id} · {c.subs.length} subcontract scopes · {c.shared.length} shared-cost rows</option>)}</select></label>
        {costX.warnings.length>0&&<p role="alert">{costX.warnings.slice(0,4).join(' | ')}</p>}
        {costXDistribution&&<>
          <p><strong>Base subcontract costs:</strong> {usd(costXDistribution.baseCents/100)} · <strong>Shared costs:</strong> {usd(costXDistribution.sharedCents/100)} · <strong>Loaded subtotal:</strong> {usd(costXDistribution.loadedCents/100)} · <strong>Excluded:</strong> {usd(costXDistribution.excludedCents/100)}</p>
          <p className="cli-footnote">Default is proportional to eligible subcontract value within this CLIN. Select targeted trades or enter exact manual dollars for a category. Excluded categories remain visible but cannot silently disappear from reconciliation.</p>
          <div className="cli-table-wrap"><table><thead><tr><th>Shared cost category</th><th>Source rows</th><th>Amount</th><th>Distribution method</th><th>Eligible subcontract codes / manual dollars</th><th>Distributed</th></tr></thead><tbody>
          {costXDistribution.categories.map(cat=>{const config=selectedCostXSettings[cat.category]||{};return <tr key={cat.category}>
            <td>{cat.category}</td><td>{cat.sourceRows.join(', ')}</td><td>{usd(cat.amountCents/100)}</td>
            <td><select value={config.mode||'proportional'} onChange={e=>updateCostXCategory(cat.category,{mode:e.target.value})}><option value="proportional">Proportional — all scopes</option><option value="targeted">Proportional — selected scopes</option><option value="manual">Manual dollars</option><option value="excluded">Exclude from activity loading</option></select></td>
            <td>{config.mode==='targeted'?<><input style={{minWidth:240}} placeholder="e.g. 26.1, 27.1" value={(config.codes||[]).join(', ')} onChange={e=>updateCostXCategory(cat.category,{codes:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/><small>Use exact CostX codes; only these scopes receive this category.</small></>:config.mode==='manual'?<textarea rows={3} style={{minWidth:260}} placeholder={'26.1=100000\n27.1=50000'} value={Object.entries(config.manual||{}).map(([k,v])=>`${k}=${v}`).join('\n')} onChange={e=>{const manual={};e.target.value.split(/[\n,]+/).forEach(line=>{const [k,v]=line.split('=');if(k?.trim())manual[k.trim()]=v?.trim()||'';});updateCostXCategory(cat.category,{manual});}}/>:'—'}</td>
            <td>{usd(cat.distributedCents/100)}</td>
          </tr>;})}
          </tbody></table></div>
          {costXDistribution.errors.length>0&&<div role="alert"><strong>Distribution blocked</strong><ul>{costXDistribution.errors.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
          {costXDistribution.excludedCents>0&&<label style={{display:'block',margin:'10px 0'}}><input type="checkbox" checked={!!costXSettings[selectedCostXClin.id]?.excludedAcknowledged} onChange={e=>setCostXSettings(prev=>({...prev,[selectedCostXClin.id]:{...(prev[selectedCostXClin.id]||{}),excludedAcknowledged:e.target.checked}}))}/> I acknowledge {usd(costXDistribution.excludedCents/100)} in excluded shared costs will remain outside the P6 activity allocation. The excluded reserve must be tracked and reconciled separately.</label>}
          <details><summary>Preview loaded subcontract scopes ({costXDistribution.lines.length})</summary><div className="cli-table-wrap" style={{maxHeight:320,overflowY:'auto'}}><table><thead><tr><th>Row</th><th>Code</th><th>Scope</th><th>Base</th><th>Shared added</th><th>Loaded</th></tr></thead><tbody>{costXDistribution.lines.map(s=><tr key={s.key}><td>{s.row}</td><td>{s.code}</td><td>{s.description}</td><td>{usd(s.baseCents/100)}</td><td>{usd((s.loadedCents-s.baseCents)/100)}</td><td>{usd(s.loadedCents/100)}</td></tr>)}</tbody></table></div></details>
          <button type="button" onClick={importCostXDrafts}>Create / refresh CostX draft pools for all CLINs</button>
          {costXMessage&&<p role="status">{costXMessage}</p>}
          <p className="cli-footnote">Imported pools are drafts only; no automatic approval or P6 export. The importer will block excluded shared costs until they are explicitly reconciled. Existing approved pools are protected.</p>
        </>}
      </div>}

      {estimateError && <p role="alert" className="cli-error">{estimateError}</p>}
      {estimate && <details style={{margin:"12px 0"}}><summary><strong>Preview imported workbook: {estimate.filename}</strong></summary><strong>{estimate.filename} — {estimate.sheets.length} worksheets</strong><div className="cli-sheet-list">{estimate.sheets.map(sh=><details key={sh.name}><summary>{sh.name} — {sh.rowCount} populated rows</summary><div className="cli-table-wrap"><table><tbody>{sh.preview.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{String(v)}</td>)}</tr>)}</tbody></table></div></details>)}</div></details>}
      <div className="cli-table-wrap"><table><thead><tr><th>Accepted</th><th>CLIN</th><th>Description</th><th>Awarded value (editable)</th></tr></thead><tbody>{clins.map(c=><tr key={c.id}><td><input aria-label={`Accepted CLIN ${c.id}`} type="checkbox" checked={c.accepted} onChange={e=>changeClin(c.id,"accepted",e.target.checked)}/></td><td>{c.id}</td><td>{c.name}</td><td><input aria-label={`Awarded value CLIN ${c.id}`} type="number" min="0" step="0.01" value={c.amount} onChange={e=>changeClin(c.id,"amount",e.target.value)}/></td></tr>)}</tbody></table></div>
      <strong>Selected awarded CLIN total: {usd(selectedTotal)}</strong>
      <p className="cli-footnote">Award values are contract values, not estimated direct costs.  Changes are local to this page and are not yet saved to project data.</p>
    </div>
    </>}
    {activeCostTab==="allocation"&&audit && <div className="cli-panel">
      <h3>Assign estimate costs to P6 activities</h3>
      <p className="cli-footnote">Cost pools load from the imported estimate. Previously approved Excel allocations are not automatically approved here. Enter fixed dollars first; percentages apply to the remaining balance; Spread Remainder divides what is left equally. Use one method per activity per pool. Approved in-app allocations feed the controlled TEST XER export.</p>
      {!inAppItems.length ? <p>Upload a CostX federal estimate or Subcontractor Summary in Upload to begin.</p> : <>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",marginBottom:12}}>
          <label>CLIN <select value={inAppClinFilter} onChange={e=>{setInAppClinFilter(e.target.value);setInAppPoolKey("");setInAppPoolSearch("");setInAppSearch("");setInAppError("");}}><option value="all">All CLINs</option>{inAppClinOptions.map(c=><option key={c} value={c}>CLIN {c}</option>)}</select></label>
          <label>Find cost pool <input value={inAppPoolSearch} onChange={e=>setInAppPoolSearch(e.target.value)} placeholder="Search scope or trade" style={{minWidth:190}}/></label>
          <label>Cost pool <select value={inAppPoolKey} onChange={e=>{setInAppPoolKey(e.target.value);setInAppSearch("");setInAppShowAll(false);setInAppError("");}} style={{maxWidth:430}}><option value="">Choose scope ({inAppPoolChoices.length})</option>{inAppPoolChoices.map(i=><option key={i.key} value={i.key}>{i.description} · {usd(Number(inAppPools[i.key]?.amount||i.referenceAmount||0))} · {inAppPools[i.key]?.status==="approved"?"Approved":"Draft"}</option>)}{inAppPoolKey&&!inAppPoolChoices.some(i=>i.key===inAppPoolKey)&&<option value={inAppPoolKey}>{inAppCurrentItem?.description||inAppPoolKey} (selected)</option>}</select></label>
          <button type="button" disabled={!inAppPoolKey} onClick={nextInAppPool}>Next Pool (auto-saved)</button>
        </div>
        <p><strong>{inAppClinFilter==="all"?"All CLINs":`CLIN ${inAppClinFilter}`}</strong> · {inAppClinProgress.approved} of {inAppClinProgress.total} pools approved · {usd(inAppClinProgress.approvedDollars)} approved</p>
        <details style={{marginBottom:12}}><summary>Draft backup and recovery</summary><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}><button type="button" onClick={saveInApp}>Save draft in browser</button><button type="button" onClick={restoreInApp}>Restore saved draft</button><button type="button" onClick={exportInApp}>Export JSON backup</button><label>Import backup <input type="file" accept=".json" onChange={importInApp}/></label></div></details>
        {inAppSummary.errors.length>0&&<ul>{inAppSummary.errors.map((x,i)=><li key={i}>{x}</li>)}</ul>}
        {inAppPoolKey && inAppCurrentItem && <>
                     <p><strong>Source CLIN: {inAppSourceClin||"Not identified"}</strong> · <strong>{inAppCurrentItem.description}</strong> · {inAppCurrentItem.referenceAmount == null ? "Source: imported cost pool (amount must be entered and reviewed)" : `Estimate reference only: ${usd(inAppCurrentItem.referenceAmount)}`} · Status: <strong>{inAppCurrent.status}</strong></p>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <label>Approved pool $ <input disabled={inAppLocked} type="number" min="0" step="0.01" value={inAppCurrent.amount} onChange={e=>updateInAppPool({amount:e.target.value})}/></label>
                         <label>Awarded CLIN <select disabled={inAppLocked||!!inAppSourceClin} value={inAppEffectiveClin} onChange={e=>updateInAppPool({clin:e.target.value})}><option value="">Select CLIN</option>{clins.map(c=><option key={c.id} value={c.id}>{c.id} — {c.name}{c.accepted?" (Accepted)":" (Not accepted)"}</option>)}{inAppEffectiveClin&&!clins.some(c=>normalizeClin(c.id)===normalizeClin(inAppEffectiveClin))&&<option value={inAppEffectiveClin}>{inAppEffectiveClin} — Not registered</option>}</select></label>
            <label>Pool type <select disabled={inAppLocked} value={inAppCurrent.type} onChange={e=>updateInAppPool({type:e.target.value})}>{["Direct Cost","General Conditions","Contingency","Insurance","Profit","Other"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          <details><summary>Allocation calculation details</summary><p><strong>Fixed dollars:</strong> {usd(dollars(inAppResult.fixedTotal))} · <strong>Percentage basis:</strong> {usd(dollars(inAppResult.basis))} · <strong>Entered percentages:</strong> {inAppResult.pctTotal.toFixed(4)}% · <strong>Percentage dollars:</strong> {usd(dollars(inAppResult.pctAllocated))} · <strong>Remainder spread:</strong> {usd(dollars(inAppResult.spreadTotal))}</p></details>
          <p><strong>Allocated:</strong> {usd(dollars(inAppResult.total))} / {usd(dollars(inAppResult.amount))} · <strong>Unallocated:</strong> {usd(dollars(inAppResult.remaining))} · <strong>{inAppLocked?(inAppResult.ready?"APPROVED — BALANCED":"APPROVED — REVALIDATION REQUIRED"):(inAppResult.ready?"BALANCED — READY FOR APPROVAL":"NOT BALANCED / INCOMPLETE")}</strong></p>
          {inAppResult.errors.length>0&&<ul>{inAppResult.errors.map((x,i)=><li key={i}>{x}</li>)}</ul>}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <label>Find activity <input value={inAppSearch} onChange={e=>setInAppSearch(e.target.value)} placeholder="Search all P6: ID, name, WBS, codes"/></label>
            <button type="button" onClick={()=>{setInAppSearch("");setInAppView("all");setInAppShowAll(true);setInAppWbsFilter("all");setInAppTradeFilter("all");}}>Show all activities / clear filters</button>
            <label>View <select value={inAppView} onChange={e=>setInAppView(e.target.value)}><option value="recommended">Recommended + allocated</option><option value="allocated">Allocated only</option><option value="all">All eligible</option></select></label>
            <label>WBS <select value={inAppWbsFilter} onChange={e=>setInAppWbsFilter(e.target.value)}><option value="all">All WBS</option>{inAppWbsOptions.map(w=><option key={w} value={w}>{w}</option>)}</select></label>
            {inAppAdvancedFilters&&inAppTradeTypes.length>0&&<label>Responsible-party code <select value={inAppEffectiveTradeCode} onChange={e=>{setInAppTradeCode(e.target.value);setInAppTradeFilter("all");}}>{inAppTradeTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
            {inAppTradeOptions.length>0&&<label>Subcontractor <select value={inAppTradeFilter} onChange={e=>setInAppTradeFilter(e.target.value)}><option value="all">All subcontractors</option>{inAppTradeOptions.map(t=><option key={t} value={t}>{t}</option>)}</select></label>}
            <button type="button" onClick={()=>setInAppAdvancedFilters(v=>!v)}>{inAppAdvancedFilters?"Hide":"Show"} advanced filters</button>
            <span>{inAppVisible.length} shown of {(audit?.activities||[]).length} P6 activities · {Object.keys(inAppCurrent.rows).length} allocated methods · {inAppLocked?"Locked — reopen to edit":"Draft — editable"}</span>
          </div>
          {inAppVisible.length===0&&<p role="status">No activities match the current search and filters. Choose “Show all activities / clear filters” to browse the full P6 schedule.</p>}
          <div className="cli-table-wrap" style={{maxHeight:470,overflowY:"auto"}}><table style={{width:"100%"}}><thead><tr><th>Activity</th><th>Description</th><th>WBS</th><th>Trade</th><th>Method</th><th>Input $ / %</th><th>Assigned $</th></tr></thead><tbody>
            {inAppVisible.map(a=>{const id=String(a.activityId);const row=inAppCurrent.rows[id]||{method:"none",value:""};return <tr key={id}>
              <td>{id}</td><td>{a.name}{inAppRecommendedIds.has(id)&&<small style={{display:"block",color:"#64748b"}}>Suggested match</small>}</td><td>{a.wbs||"—"}</td><td>{codeLabel(a,inAppEffectiveTradeCode)}</td><td><select disabled={inAppLocked} value={row.method} onChange={e=>updateInAppRow(id,{method:e.target.value,value:""})}><option value="none">Not allocated</option><option value="dollars">Fixed dollars</option><option value="percent">% of available balance</option><option value="spread">Spread remainder</option></select></td>
              <td>{row.method==="dollars"||row.method==="percent"?<input disabled={inAppLocked} type="number" min="0" step={row.method==="dollars"?"0.01":"0.0001"} value={row.value} onChange={e=>updateInAppRow(id,{value:e.target.value})}/>:row.method==="spread"?"Automatic":"—"}</td>
              <td>{inAppResult.allocated[id]!==undefined?usd(dollars(inAppResult.allocated[id])):"—"}</td>
            </tr>;})}
          </tbody></table></div>
                     {inAppApprovalFindings.length>0&&<div role="status" style={{margin:"10px 0",color:"#9b2c20"}}><strong>Approval checks:</strong><ul>{inAppApprovalFindings.map((finding,i)=><li key={i}>{finding}</li>)}</ul></div>}
           {inAppUncodedCount>0&&<p className="cli-footnote">{inAppUncodedCount} receiving activities have no P6 CLIN code. They are not automatically rejected; verify their contract scope before approval.</p>}
           <button type="button" disabled={inAppLocked||inAppApprovalFindings.length>0} onClick={approveInApp}>Approve balanced pool</button>{" "}
          <button type="button" disabled={inAppCurrent.status!=="approved"} onClick={reopenInApp}>Reopen approved pool</button>
          <p className="cli-footnote">Approved pools are locked until explicitly reopened; changes require reapproval. Allocations from multiple approved pools are combined by receiving activity for the controlled TEST XER. Keep a full-project JSON backup.</p>
        </>}
        {inAppError&&<p role="status">{inAppError}</p>}
      </>}
    </div>}


    {activeCostTab==="export"&&<>
      <div className="cli-panel">
        <h3>Final Review &amp; Combined XER Export</h3>
        <p><strong>Release status: TEST ONLY</strong> · Production export remains locked until the full regression checklist is signed off.</p>
        <p>The approved allocation month is planning metadata. P6 spreads each activity's assigned cost across its scheduled duration. SentinelOS does not impose monthly resource curves.</p>
        <div className="cli-table-wrap"><table><tbody>
          <tr><th>Approved direct transfer</th><td>{usd((combinedExportReadiness.directCents||0)/100)}</td></tr>
          <tr><th>Approved shared transfer</th><td>{usd((combinedExportReadiness.sharedCents||0)/100)}</td></tr>
          <tr><th>Total transfer</th><td><strong>{usd((combinedExportReadiness.combinedCents||0)/100)}</strong></td></tr>
          <tr><th>Construction holding before</th><td>{usd((combinedExportReadiness.holdingCents||0)/100)}</td></tr>
          <tr><th>Construction holding after</th><td>{usd((combinedExportReadiness.holdingAfterCents||0)/100)}</td></tr>
          <tr><th>Approved / pending shared records</th><td>{combinedExportReadiness.approvedMonths} / {combinedExportReadiness.pendingMonths}</td></tr>
          <tr><th>Original project resource budget</th><td>{audit?usd(audit.totals.budget):"—"}</td></tr>
        </tbody></table></div>
        <p><strong>Combined exporter:</strong> {combinedTestXer.status}</p>
        {combinedTestXer.findings?.length>0&&<div role="alert" style={{color:"#a33"}}><strong>Export blocked — resolve before proceeding</strong><ul>{combinedTestXer.findings.map((f,i)=><li key={i}>{f}</li>)}</ul></div>}
        {combinedTestXer.status==="COMBINED BUDGET-ONLY TEST XER READY"&&<>
          <p><strong>Assignment budget before / after:</strong> {usd(combinedTestXer.assignmentBudgetBefore)} / {usd(combinedTestXer.assignmentBudgetAfter)} · <strong>New assignments:</strong> {combinedTestXer.createdAssignments} · <strong>Approved shared records:</strong> {combinedTestXer.approvedRecords}</p>
          <details><summary>Review source approvals and assignment changes</summary>
            <div className="cli-table-wrap"><table><thead><tr><th>CLIN / Category</th><th>Approval month</th><th>Amount</th><th>Receiving rows</th></tr></thead><tbody>{combinedTestXer.monthDetails.map(r=><tr key={`${r.key}:${r.month}`}><td>{r.key}</td><td>{r.month}</td><td>{usd(r.cents/100)}</td><td>{r.receiving}</td></tr>)}</tbody></table></div>
            <p>Changed assignment rows: {combinedTestXer.rows.length}</p>
          </details>
          <label style={{display:"block",margin:"12px 0"}}><input type="checkbox" checked={combinedTestAcknowledged} onChange={e=>setCombinedTestAcknowledged(e.target.checked)}/> I will import this XER only into an isolated P6 test project/database, verify its resource assignments and total budget, and will not use it for production.</label>
          <button type="button" disabled={!combinedTestAcknowledged} onClick={()=>downloadBudgetOnlyTestXer({bytes:combinedTestXer.bytes,problems:[]},filename.replace(/\.xer$/i,"")+"-COMBINED-BUDGET-TEST")}>Download combined TEST XER</button>
        </>}
        <details style={{marginTop:18}}><summary><strong>Production release checklist (manual verification)</strong></summary>
          <ul>
            <li>Export a project JSON backup and confirm it can be restored.</li>
            <li>Reconfirm all approved direct and shared allocations; pending records must remain excluded.</li>
            <li>Verify exactly one standard-cost resource assignment per receiving activity.</li>
            <li>Compare source and exported XER: budget, WBS, logic, activity dates, and actuals.</li>
            <li>Import into isolated P6 and verify resource budget rollups and P6's duration-based cost spreading.</li>
            <li>Obtain internal approval for production use. This release does not enable it.</li>
          </ul>
        </details>
      </div>
    </>}
    {activeCostTab==="setup"&&<>
    {audit && <details className="cli-panel"><summary><strong>Advanced CLIN and activity-code diagnostics</strong></summary>
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
    </details>}
    {audit && <>
      <div className="cli-metrics">{[["Activities",audit.activityCount],["Resource assignments",audit.assignmentCount],["Activities without assignments",audit.unassignedCount],["Budgeted cost",usd(audit.totals.budget)],["Actual cost (XER fields)",usd(audit.totals.actual)],["Remaining cost",usd(audit.totals.remaining)]].map(([k,v])=><div className="cli-metric" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
      <details className="cli-panel"><summary><strong>Advanced Diagnostics — Resource dictionary</strong></summary><p>{audit.resources.length} resources found. {audit.resources.some(r=>r.code==="MCGSTANDCOSTONLY") ? "McGough standard cost resource detected." : "McGough standard cost resource not detected."}</p><div className="cli-resource-list">{audit.resources.map(r=><span key={r.id}>{r.code || r.id} ({r.type})</span>)}</div></details>
      <details className="cli-panel"><summary><strong>Existing P6 cost loading — detailed activity audit</strong></summary>
        <div className="cli-toolbar">{clinCodeType && <label>CLIN filter <select value={clinFilter} onChange={e=>setClinFilter(e.target.value)}><option value="all">All CLINs</option><option value="unassigned">Unassigned</option>{clins.map(c=><option key={c.id} value={c.id}>{c.id} — {c.name}</option>)}</select></label>}<label>Primary group <select value={primary} onChange={e=>{setPrimary(e.target.value);if(e.target.value===secondary)setSecondary("none");}}>{groupOptions.filter(o=>o.value!==secondary || o.value==="none").map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label>Secondary group <select value={secondary} onChange={e=>setSecondary(e.target.value)}>{groupOptions.filter(o=>o.value!==primary || o.value==="none").map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label><input aria-label="Filter cost audit" placeholder="Search activities, WBS, or activity codes" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <p className="cli-footnote">{audit.activityCodeTypes.length} P6 activity-code types detected. Click a column heading to sort. Group headings can be expanded or collapsed.</p>
        <div className="cli-table-wrap"><table><thead><tr><th><button className="cli-sort" onClick={()=>sortColumn("activityId")}>Activity ID {sort==="activityId"?(descending?"▼":"▲"):""}</button></th><th>Activity</th><th>WBS</th>{audit.activityCodeTypes.map(t=><th key={t.id}>{t.name}</th>)}<th>Assignments</th><th><button className="cli-sort" onClick={()=>sortColumn("budget")}>Budgeted cost {sort==="budget"?(descending?"▼":"▲"):""}</button></th><th>Actual cost</th><th>Remaining cost</th></tr></thead><tbody>
          {result.groups.map(g=><FragmentGroup key={g.key} group={g} types={audit.activityCodeTypes} grouped={primary!=="none" || secondary!=="none"} collapsed={Boolean(collapsed[g.key])} toggle={()=>setCollapsed(v=>({...v,[g.key]:!v[g.key]}))}/>)}
        </tbody></table></div><p className="cli-footnote">Showing {result.count} matching activities. Cost figures are read-only. Use Cost Allocation for approvals and P6 Export & Reconciliation for controlled test exports.</p>
      </details>
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
