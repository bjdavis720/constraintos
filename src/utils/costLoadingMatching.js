import * as XLSX from "xlsx";

const norm = v => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stop = new Set(["the","and","for","with","from","other","building","work","works","install","installation","construction","project","phase","activities"]);
const words = v => [...new Set(norm(v).split(" ").filter(t => t.length > 2 && !stop.has(t)))];
const amount = v => { if (typeof v === "number") return Number.isFinite(v) ? v : null; const s=String(v??"").trim(); if(!s || s === "-")return null; const n=Number(s.replace(/[$,\s()]/g,""));return Number.isFinite(n)?(s.includes("(")?-n:n):null; };
const cell = (r,i) => Array.isArray(r) ? r[i] : r?.[i];
function sourceRows(sheet) {
  if (!sheet) return [];
  const rows=sheet.rows||[];
  const summary=sheet.name === "Summary of All CLINs";
  const sub=sheet.name === "Subcontractor Summary";
  if(!summary&&!sub)return [];
  return rows.slice(summary?2:1).map((r,i)=>({
    key:`${sheet.name}-${i+(summary?3:2)}`,row:i+(summary?3:2),
    description:String(cell(r,summary?1:0)??"").trim(),
    subcontractor:summary?"":String(cell(r,1)??cell(r,2)??"").trim(),
    referenceAmount:amount(cell(r,summary?7:6))
  })).filter(x=>x.description && x.referenceAmount!==null && x.referenceAmount!==0 && !/\b(grand total|subtotal|total|summary total)\b/i.test(x.description));
}
// Conservative scope families: an activity must share the estimate's scope family.
// Generic terms such as "site", "structure", and "work" are deliberately not sufficient.
const families = [
 {id:"temporary-fence",estimate:/temporary\s+(?:security\s+)?fenc/i,activity:/temporar.{0,25}fenc|fenc.{0,25}temporar/i},
 {id:"permanent-fence",estimate:/permanent\s+fenc|security\s+fenc/i,activity:/perimeter.{0,30}fenc|permanent.{0,25}fenc|security.{0,25}fenc|fenc.{0,25}gate/i},
 {id:"precast",estimate:/precast/i,activity:/precast|pre cast/i},
 {id:"site-concrete",estimate:/site\s+concrete|concrete\s+pav|sidewalk|curb\s*(?:and|&)\s*gutter/i,activity:/concrete.{0,30}(?:pav|sidewalk|curb)|(?:pav|sidewalk|curb).{0,30}concrete/i},
 {id:"concrete",estimate:/concrete|cast.in.place|foundations?/i,activity:/concrete|footing|foundation|slab|cast.in.place/i},
 {id:"roofing",estimate:/roof/i,activity:/roof|epdm|membrane/i},
 {id:"waterproofing",estimate:/waterproof/i,activity:/waterproof|dampproof/i},
 {id:"masonry",estimate:/masonry|cmu|brick/i,activity:/masonry|cmu|brick|block wall/i},
 {id:"structural-steel",estimate:/steel\s+erection|structural\s+steel/i,activity:/structural.{0,20}steel|steel.{0,20}(?:erect|fram)|erect.{0,20}steel/i},
 {id:"electrical",estimate:/electrical|power\s+distribution/i,activity:/electrical|conduit|cable|switchgear|transformer|panelboard|lighting|wiring/i},
 {id:"plumbing",estimate:/plumbing|domestic\s+water|sanitary/i,activity:/plumb|domestic water|sanitary|water piping/i},
 {id:"mechanical",estimate:/mechanical|hvac|air\s+handling/i,activity:/hvac|mechanical|ductwork|air handling|chiller|boiler/i},
 {id:"fire-protection",estimate:/fire\s+protection|sprinkler/i,activity:/fire protection|sprinkler|fire suppression/i},
 {id:"demolition",estimate:/demolition|demo\s*\//i,activity:/demolish|demolition|remove existing/i},
 {id:"earthwork",estimate:/earthwork|excavat|grading/i,activity:/earthwork|excavat|backfill|grading|soil correction|subgrade/i},
 {id:"paving",estimate:/paving|asphalt/i,activity:/pav|asphalt/i},
 {id:"interiors",estimate:/interiors?|drywall|flooring|ceilings?/i,activity:/drywall|flooring|ceiling|interior finish|paint|wall finish/i},
];
const broadScope = /^(sitework|structure|substructure|general conditions|other general conditions|building equipment|misc(?:ellaneous)? site preparation|hoisting|traffic control|cleanup|surveying and layout|weather conditions)$/i;
const admin = /\b(submittals?|review|approval|meeting|milestone|tracking|documentation|documents|submit|design|permit|inspection|testing|start|finish|complete|completion|acceptance|coordination|workshop|procure(?:ment)?|shop drawing|mockup|fabricat(?:e|ion)|deliver(?:y)?|notice to proceed)\b/i;
const direct = /\b(place|pour|form|erect|set|construct|excavate|backfill|grade|pave|demolish|remove|install|rough in|wire|pull|terminate|coat|paint|roof|finish|commission|build|assemble)\b/i;
function codeText(a){return Object.values(a.codes||{}).map(v=>typeof v==="string"?v:[v?.code,v?.description,v?.name].filter(Boolean).join(" ")).join(" ");}
function candidateList(item,activities,limit=20){
 const scope=String(item.description||"");
 if(broadScope.test(scope.trim()))return [];
 const family=families.find(f=>f.estimate.test(scope));
 // Do not force a match for scopes without a defensible trade classification.
 if(!family)return [];
 const itemWords=words(scope);
 return activities.map(a=>{
  const name=String(a.name||"");const wbs=String(a.wbs||"");
  if(!a.activityId || /^L0E10000$/i.test(a.activityId) || /construction cost|holding account/i.test(name))return null;
  if(admin.test(name) || !direct.test(name))return null;
  const activityContext=[name,wbs,codeText(a)].join(" ");
  // Primary eligibility is based on actual work description, not WBS alone.
  if(!family.activity.test(name))return null;
  // Distinguish temporary and permanent fence; site concrete from general concrete.
  if(family.id==="concrete" && /precast/i.test(name) && !/precast/i.test(scope))return null;
  if(family.id==="permanent-fence" && /temporar/i.test(name))return null;
  if(family.id==="temporary-fence" && /permanent|perimeter/i.test(name))return null;
  const nameText=norm(name),wbsText=norm(wbs),codes=norm(codeText(a));
  const hits=itemWords.filter(t=>nameText.includes(t));
  const wHits=itemWords.filter(t=>wbsText.includes(t));
  const cHits=itemWords.filter(t=>codes.includes(t));
  const score=12+hits.length*5+wHits.length*2+Math.min(cHits.length,3)*2;
  return {activity:a,score,explanation:`Eligible ${family.id} execution activity; description matches ${hits.length}, WBS matches ${wHits.length}, code matches ${cHits.length}. Manual validation required.`};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.activity.activityId).localeCompare(String(b.activity.activityId))).slice(0,limit);
}
// Reuse the same conservative matching rules for the bulk allocation builder.
// Return the full candidate set rather than the Excel review's top 20.
export function getPoolActivityCandidates(scope, activities) {
  if (!String(scope || "").trim()) return [];
  return candidateList({description: scope}, activities || [], Infinity).map(c => ({
    activityId: String(c.activity.activityId),
    score: c.score,
    explanation: c.explanation,
  }));
}

export function createMatchingReview(audit,estimate,sourceSheet,clins){
 const sheet=estimate?.sheets?.find(s=>s.name===sourceSheet);
 const items=sourceRows(sheet).map(item=>{
  const candidates=candidateList(item,audit?.activities||[]);
  const best=candidates[0]; const margin=best ? best.score-(candidates[1]?.score||0):0;
  const confidence=!best?"Unmatched":best.score>=22&&margin>=5?"Medium":"Low";
  return {...item,candidate:best?.activity||null,candidates,confidence,score:best?.score||0,explanation:best?`${best.explanation} Candidate only; human approval required.`:"No eligible sufficiently relevant construction activity identified; manual mapping required."};
 });
 return {sourceSheet,items,matched:items.filter(x=>x.candidate).length,unmatched:items.filter(x=>!x.candidate).length,clins};
}

// Patch 05A: editable one-to-many allocation workbook. No XER writes.
function appendAllocationPlan(wb, review, audit, clins) {
 const activityIds = new Set((audit?.activities || []).map(a => String(a.activityId)));
 const clinIds = new Set((clins || []).filter(c => c.accepted).map(c => String(c.id)));
 const poolHeaders = ["Pool Key", "Estimate Scope", "Source Row", "Estimate Reference $ (NOT APPROVED)", "Approved CLIN (USER)", "Approved Pool $ (USER)", "Selected Activity Count", "Weight Total %", "Allocated $", "Difference $", "Validation", "Notes (USER)"];
 const lineHeaders = ["Pool Key", "Estimate Scope", "Activity ID (USER)", "Activity Name (Reference)", "WBS (Reference)", "Suggested Rank", "Suggested Score", "Selected? (YES)", "Allocation Weight % (USER)", "Calculated Allocation $", "Approved CLIN (Reference)", "Notes (USER)"];
 const pools = [poolHeaders];
 const lines = [lineHeaders];
 for (const [i, item] of review.items.entries()) {
  const poolRow = i + 2;
  const key = `${review.sourceSheet}::${item.row}`;
  const candidates = item.candidates || [];
  const rowCount = Math.max(candidates.length + 5, 8);
  for (let j = 0; j < rowCount; j++) {
   const c = candidates[j];
   const a = c?.activity;
   const lineRow = lines.length + 1;
   lines.push([key, item.description, a?.activityId || "", a?.name || "", a?.wbs || "", c ? j + 1 : "", c?.score ?? "", "", "", {f:`IF(OR(H${lineRow}<>"YES",I${lineRow}="",C${lineRow}=""),0,IFERROR(INDEX('Cost Pools'!$F$2:$F$${review.items.length+1},MATCH(A${lineRow},'Cost Pools'!$A$2:$A$${review.items.length+1},0))*I${lineRow}/100,0))`}, {f:`IFERROR(INDEX('Cost Pools'!$E$2:$E$${review.items.length+1},MATCH(A${lineRow},'Cost Pools'!$A$2:$A$${review.items.length+1},0)),"")`}, ""]);
  }
  const last = lines.length;
  const count = {f:`COUNTIFS('Activity Allocations'!$A$2:$A$${last},A${poolRow},'Activity Allocations'!$H$2:$H$${last},"YES")`};
  const weight = {f:`SUMIFS('Activity Allocations'!$I$2:$I$${last},'Activity Allocations'!$A$2:$A$${last},A${poolRow},'Activity Allocations'!$H$2:$H$${last},"YES")`};
  const allocated = {f:`SUMIF('Activity Allocations'!$A$2:$A$${last},A${poolRow},'Activity Allocations'!$J$2:$J$${last})`};
  const difference = {f:`IF(F${poolRow}="","",ROUND(F${poolRow}-I${poolRow},2))`};
  const validation = {f:`IF(AND(E${poolRow}="",F${poolRow}=""),"NOT APPROVED",IF(OR(E${poolRow}="",F${poolRow}=""),"INCOMPLETE",IF(G${poolRow}=0,"NO ACTIVITIES",IF(ABS(H${poolRow}-100)>0.0001,"WEIGHTS NOT 100%",IF(ABS(J${poolRow})>0.01,"OUT OF BALANCE","READY FOR REVIEW")))))`};
  pools.push([key,item.description,item.row,item.referenceAmount,"","",count,weight,allocated,difference,validation,""]);
 }
 const pw = XLSX.utils.aoa_to_sheet(pools);
 pw['!cols'] = [38,40,14,26,22,24,22,18,20,20,25,35].map(w => ({wch:w}));
 pw['!autofilter'] = {ref:`A1:L${pools.length}`};
 XLSX.utils.book_append_sheet(wb,pw,"Cost Pools");
 const lw = XLSX.utils.aoa_to_sheet(lines);
 lw['!cols'] = [38,40,22,48,36,16,18,18,26,24,24,35].map(w => ({wch:w}));
 lw['!autofilter'] = {ref:`A1:L${lines.length}`};
 XLSX.utils.book_append_sheet(wb,lw,"Activity Allocations");
 const checks = [["Validation / instruction", "Requirement"],
  ["One estimate item → many activities", "Each Cost Pool can have any number of selected schedule activities. Use the blank rows below its candidates for manual additions."],
  ["Cost Pools E", "Enter an awarded CLIN ID only. CLIN selection is a user decision, not inferred from estimate category."],
  ["Cost Pools F", "Enter approved pool amount, NOT automatically the estimate reference amount."],
  ["Activity Allocations C", "Enter or replace P6 Activity ID. Verify against P6 Activity Inventory."],
  ["Activity Allocations H", "Type YES to include a candidate or manually added activity."],
  ["Activity Allocations I", "Enter a weight as 0–100, e.g. 25 for 25%. Do not enter 0.25."],
  ["Validation", "Selected weights must total 100%; approved amount must balance. READY FOR REVIEW is NOT approval for XER transfer."],
  ["Allocation method", "Weights are entered by a reviewer. Schedule duration and activity count are NOT assumed to represent cost."],
  ["Unmatched scopes", "Use blank allocation rows to enter manually chosen schedule activities; do not force low-confidence matches."],
  ["Existing assignments", "Do not overwrite design assignments, actuals, or other P6 fields. This workbook does not modify the XER."],
  ["Duplicate activities", "An activity may appear in multiple cost pools. Reviewer must check for double counting before export."],
  ["Eligible CLINs", [...clinIds].join(", ")],
  ["P6 activity inventory", `${activityIds.size} IDs available for manual review`],
  ["Important", "Excel formulas may require opening in Microsoft Excel or compatible spreadsheet software to recalculate."]];
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(checks),"Allocation Instructions");
}

export function exportMatchingReview(review,audit,clins,estimateFilename){
 if(!review?.items?.length)throw new Error("No usable estimate scope rows were found in the selected worksheet.");
 const wb=XLSX.utils.book_new();
 const columns=["Source Sheet","Source Row","Estimate Scope","Subcontractor","Reference Amount (NOT APPROVED)","Suggested Activity ID","Suggested Activity Name","Suggested WBS","Match Confidence","Match Score","Match Explanation","Approved CLIN (USER)","Approved Activity ID (USER)","Approved Allocation $ (USER)","Approval Status (USER)","Notes (USER)"];
 const data=[columns,...review.items.map(x=>[review.sourceSheet,x.row,x.description,x.subcontractor,x.referenceAmount,x.candidate?.activityId||"",x.candidate?.name||"",x.candidate?.wbs||"",x.confidence,x.score,x.explanation,"","","","Pending",""])];
 const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=[20,12,38,24,24,20,44,32,17,12,65,22,24,24,22,35].map(w=>({wch:w}));ws['!autofilter']={ref:`A1:P${data.length}`};XLSX.utils.book_append_sheet(wb,ws,"Matching Review");
 const candidates=[["Source Sheet","Source Row","Estimate Scope","Candidate Rank","Activity ID","Activity Name","WBS","Score","Explanation","User Selection","Approved CLIN","Approved Allocation $","Allocation Weight % (USER)","Notes"]];
 for(const item of review.items)for(const [index,c] of item.candidates.entries())candidates.push([review.sourceSheet,item.row,item.description,index+1,c.activity.activityId,c.activity.name,c.activity.wbs,c.score,c.explanation,"","","","",""]);
 const cw=XLSX.utils.aoa_to_sheet(candidates);cw['!cols']=[20,12,34,15,20,48,32,12,65,18,18,22,24,35].map(w=>({wch:w}));cw['!autofilter']={ref:`A1:N${candidates.length}`};XLSX.utils.book_append_sheet(wb,cw,"Candidate Activities");
 const types=audit?.activityCodeTypes||[];
 const inv=[["Activity ID","Activity Name","WBS","Current Budget","Existing Assignments",...types.map(t=>t.name)],...(audit?.activities||[]).map(a=>[a.activityId,a.name,a.wbs,a.budget,a.assignments,...types.map(t=>a.codes?.[t.id]?.code||"")])];
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(inv),"P6 Activity Inventory");
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Accepted","CLIN","Description","Award Value"],...clins.map(c=>[c.accepted?"Yes":"No",c.id,c.name,Number(c.amount)||0])]),"Awarded CLIN Register");
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([["Sentinel Cost Loading Intelligence — REVIEW ONLY"],["Estimate file",estimateFilename],["Source worksheet",review.sourceSheet],["Source rows",review.items.length],["Candidate matches",review.matched],["Unmatched",review.unmatched],["IMPORTANT","Candidate Activities lists up to 20 eligible suggestions per source row; multiple activities may be needed."],["IMPORTANT","Candidate ranks and scores are heuristic, not approved allocations."],["IMPORTANT","Allocation Weight % is user-entered and must total 100% per approved estimate scope before dollar allocation."],["IMPORTANT","Do not sum reference values across summary worksheets or include unawarded CLINs."],["IMPORTANT","No costs are moved from holding activities. No XER is modified."],["Workflow","Review Candidate Activities and enter approved activity IDs, CLINs and dollars in the Matching Review sheet or later approval workflow."]]),"Instructions");
 appendAllocationPlan(wb,review,audit,clins);
 XLSX.writeFile(wb,"Sentinel-Cost-Loading-Matching-Review.xlsx");
}
