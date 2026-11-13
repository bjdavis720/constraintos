import { createBudgetOnlyTestXer } from './costLoadingXerTestExport.js';

const cents = value => Math.round(Number(value) * 100);
const dollars = value => value / 100;
const standard = row => String(row.resourceCode || '').trim().toUpperCase() === 'MCGSTANDCOSTONLY';
const ascii = bytes => { let out=''; for(let i=0;i<bytes.length;i+=8192) out+=String.fromCharCode(...bytes.subarray(i,i+8192)); return out; };
const bytesOf = text => Uint8Array.from(text, ch => ch.charCodeAt(0));
const parseTables = text => {
  const tables=new Map(); let table='',fields=[];
  for(const line of text.split(/\r\n|\n|\r/)) {
    if(line.startsWith('%T\t')) {table=line.slice(3);fields=[];tables.set(table,{fields,rows:[]});}
    else if(line.startsWith('%F\t') && tables.has(table)) {fields=line.slice(3).split('\t');tables.get(table).fields=fields;}
    else if(line.startsWith('%R\t') && tables.has(table)) tables.get(table).rows.push(line.slice(3).split('\t'));
  }
  return tables;
};
const objectRow=(table,cells)=>Object.fromEntries(table.fields.map((f,i)=>[f,cells[i]||'']));
const newGuid=()=>{
  const data=new Uint8Array(16);
  if(!globalThis.crypto?.getRandomValues) throw Error('Secure random identifier generation is unavailable.');
  globalThis.crypto.getRandomValues(data);
  return btoa(String.fromCharCode(...data)).replace(/\+/g,'A').replace(/\//g,'B').replace(/=/g,'');
};
function addMissingAssignments(sourceBytes,missing, audit) {
  const original=ascii(sourceBytes), tables=parseTables(original);
  const assignmentTable=tables.get('TASKRSRC'), taskTable=tables.get('TASK'), resourceTable=tables.get('RSRC');
  if(!assignmentTable||!taskTable||!resourceTable) throw Error('XER must contain TASKRSRC, TASK and RSRC tables.');
  const required=['taskrsrc_id','task_id','proj_id','rsrc_id','target_cost','guid','target_qty','remain_qty','act_reg_cost','act_ot_cost','remain_cost','cost_per_qty','rsrc_type','cost_per_qty_source_type'];
  if(required.some(f=>!assignmentTable.fields.includes(f))) throw Error('TASKRSRC schema is missing fields needed to create safe assignments.');
  const resources=resourceTable.rows.map(r=>objectRow(resourceTable,r));
  const matchingResources=resources.filter(r=>r.rsrc_short_name==='MCGSTANDCOSTONLY');
  if(matchingResources.length!==1) throw Error(`Expected exactly one MCGSTANDCOSTONLY resource; found ${matchingResources.length}.`);
  const resource=matchingResources[0];
  const tasks=new Map(taskTable.rows.map(r=>{const obj=objectRow(taskTable,r);return [obj.task_id,obj];}));
  const assignments=assignmentTable.rows.map(r=>objectRow(assignmentTable,r));
  const donor=assignments.find(r=>r.rsrc_id===resource.rsrc_id);
  if(!donor) throw Error('No existing standard-cost assignment available as schema template.');
  const usedIds=new Set(assignments.map(r=>r.taskrsrc_id));
  const usedGuids=new Set(assignments.map(r=>r.guid).filter(Boolean));
  let nextId=Math.max(...assignments.map(r=>Number(r.taskrsrc_id)).filter(Number.isSafeInteger))+1;
  if(!Number.isSafeInteger(nextId)) throw Error('Cannot generate safe assignment identifiers.');
  const newRows=[]; const records=[];
  for(const item of missing){
    const activity=(audit.activities||[]).find(a=>String(a.activityId)===String(item.activityId));
    const task=activity&&tasks.get(String(activity.taskId));
    if(!task) throw Error(`TASK record missing for ${item.activityId}.`);
    if(assignments.some(r=>r.task_id===String(activity.taskId)&&r.rsrc_id===resource.rsrc_id)) throw Error(`Standard assignment already exists for ${item.activityId}.`);
    while(usedIds.has(String(nextId)))nextId++;
    const id=String(nextId++);usedIds.add(id);
    let guid=newGuid();while(usedGuids.has(guid))guid=newGuid();usedGuids.add(guid);
    const row={...donor,taskrsrc_id:id,task_id:String(activity.taskId),proj_id:task.proj_id,rsrc_id:resource.rsrc_id,guid,
      target_cost:'0.0000',act_reg_cost:'0.0000',act_ot_cost:'0.0000',remain_cost:'0.0000',
      remain_qty:'0',target_qty:'0',act_ot_qty:'0',act_reg_qty:'0',act_this_per_cost:'0.0000',act_this_per_qty:'0',
      cost_per_qty:'1.0000',cost_qty_link_flag:'N',target_lag_drtn_hr_cnt:'0',target_qty_per_hr:'0',remain_qty_per_hr:'0',
      target_start_date:task.target_start_date||task.early_start_date||'',target_end_date:task.target_end_date||task.early_end_date||'',
      act_start_date:'',act_end_date:'',restart_date:'',reend_date:'',rem_late_start_date:'',rem_late_end_date:'',
      role_id:'',acct_id:'',pobs_id:'',skill_level:'',cbs_id:'',taskrsrc_sum_id:'',
      target_crv:'',remain_crv:'',actual_crv:'',curv_id:'',ts_pend_act_end_flag:'N',rollup_dates_flag:'Y',
      rate_type:'COST_PER_QTY',rsrc_type:resource.rsrc_type,cost_per_qty_source_type:'ST_Rsrc',
      create_user:donor.create_user,create_date:donor.create_date};
    newRows.push('%R\t'+assignmentTable.fields.map(f=>row[f]??'').join('\t'));
    records.push({activityId:item.activityId,assignmentId:id,field:'target_cost',before:0,after:item.addition,delta:item.addition,created:true});
  }
  if(!newRows.length) return {bytes:sourceBytes,records};
  const eol=original.includes('\r\n')?'\r\n':'\n';
  const lines=original.split(/\r\n|\n|\r/);
  const start=lines.findIndex(l=>l==='%T\tTASKRSRC');
  if(start<0) throw Error('TASKRSRC section not found.');
  let end=start+1;while(end<lines.length&&!lines[end].startsWith('%T\t')&&!lines[end].startsWith('%E'))end++;
  lines.splice(end,0,...newRows);
  const output=lines.join(eol);
  const check=parseTables(output).get('TASKRSRC');
  if(check.rows.length!==assignmentTable.rows.length+newRows.length)throw Error('New assignment record count failed validation.');
  return {bytes:bytesOf(output),records};
}

// TEST ONLY: create missing standard-cost assignments in a temporary XER copy,
// then use the existing exact-field budget writer for the complete balanced transfer.
export function prepareInAppTestXer(audit, bridge, sourceBytes) {
  const findings=[];
  if(!sourceBytes?.length)findings.push('Original source XER bytes are unavailable.');
  if(!audit?.activities?.length)findings.push('Source schedule audit is unavailable.');
  if(!bridge||bridge.status==='BLOCKED'||!bridge.budgetConserved)findings.push('Approved in-app allocations have not passed bridge reconciliation.');
  const holding=audit?.holdingAccounts||[];
  if(holding.length!==1)findings.push('Exactly one construction holding activity is required.');
  const transferCents=bridge?.transferCents||0;
  if(!Number.isSafeInteger(transferCents)||transferCents<=0)findings.push('No positive, valid approved transfer.');
  const rows=[],missing=[];
  if(holding.length===1){
    const matches=(holding[0].assignments||[]).filter(standard);
    if(matches.length!==1)findings.push(`Holding ${holding[0].activityId} must have exactly one standard-cost assignment; found ${matches.length}.`);
    else {
      const a=matches[0],before=cents(a.budget);
      if(before!==cents(bridge.holdingBefore))findings.push('Holding assignment does not match bridge starting balance.');
      if(before<transferCents)findings.push('Transfer exceeds holding assignment budget.');
      rows.push({activityId:holding[0].activityId,assignmentId:String(a.assignmentId),field:'target_cost',before:dollars(before),after:dollars(before-transferCents),delta:-dollars(transferCents)});
    }
  }
  const activityMap=new Map((audit?.activities||[]).map(a=>[String(a.activityId),a]));
  for(const receiver of bridge?.receivingRows||[]){
    const activity=activityMap.get(String(receiver.activityId));
    if(!activity){findings.push(`Receiving activity ${receiver.activityId} not found.`);continue;}
    const matches=(audit.assignmentDetailsByTask?.[activity.taskId]||[]).filter(standard);
    if(matches.length>1){findings.push(`Activity ${receiver.activityId} has duplicate standard-cost assignments.`);continue;}
    if(matches.length===0){missing.push(receiver);continue;}
    const a=matches[0],before=cents(a.budget);
    if(!Number.isSafeInteger(before)||before<0){findings.push(`Invalid existing budget on ${receiver.activityId}.`);continue;}
    rows.push({activityId:receiver.activityId,assignmentId:String(a.assignmentId),field:'target_cost',before:dollars(before),after:dollars(before+receiver.additionCents),delta:dollars(receiver.additionCents)});
  }
  if(findings.length)return {status:'BLOCKED',findings,rows,bytes:null};
  try {
    const augmented=addMissingAssignments(sourceBytes,missing,audit);
    rows.push(...augmented.records);
    if(new Set(rows.map(r=>r.assignmentId)).size!==rows.length)throw Error('Duplicate assignment identifiers in transfer.');
    if(rows.length!==(bridge.receivingRows.length+1))throw Error('Not every receiving activity has a valid assignment.');
    const net=rows.reduce((sum,r)=>sum+cents(r.delta),0);
    if(net!==0)throw Error(`Resource-assignment changes do not net to zero (${dollars(net)}).`);
    const result=createBudgetOnlyTestXer(augmented.bytes,{rows,delta:0,findings:[]});
    if(result.problems.length)throw Error(result.problems.join('; '));
    const finalTables=parseTables(ascii(result.bytes));
    const finalRows=finalTables.get('TASKRSRC').rows.map(r=>objectRow(finalTables.get('TASKRSRC'),r));
    for(const r of rows){const found=finalRows.filter(x=>x.taskrsrc_id===r.assignmentId);
      if(found.length!==1||cents(found[0].target_cost)!==cents(r.after))throw Error(`Final assignment validation failed for ${r.activityId}.`);
    }
    return {status:'TEST XER READY',findings:[],rows,bytes:result.bytes,changedAssignments:result.changedAssignments,
      createdAssignments:missing.length,assignmentBudgetBefore:result.assignmentBudgetBefore,assignmentBudgetAfter:result.assignmentBudgetAfter};
  }catch(err){return {status:'BLOCKED',findings:[`Schema-validated assignment creation failed: ${err.message}`],rows,bytes:null};}
}
