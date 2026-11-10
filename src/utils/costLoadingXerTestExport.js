// 05M: byte-preserving, budget-only test XER patch. No changes except TASKRSRC.target_cost.
const cents = n => Math.round(Number(n) * 100);
const money = n => (cents(n) / 100).toFixed(4);
const ascii = bytes => {
  let out = "";
  for (let i=0;i<bytes.length;i+=8192) out += String.fromCharCode(...bytes.subarray(i,i+8192));
  return out;
};
const bytesOf = str => Uint8Array.from(str, ch => ch.charCodeAt(0));
export function createBudgetOnlyTestXer(sourceBytes, preview) {
  const problems=[];
  if (!(sourceBytes instanceof Uint8Array) || !sourceBytes.length) problems.push("Original XER bytes unavailable.");
  if (!preview || !Array.isArray(preview.rows) || preview.rows.length < 2) problems.push("No valid budget-only allocation preview.");
  if (preview?.findings?.some(f=>f.severity === "BLOCKER")) problems.push("Budget-only preview contains blockers.");
  if (preview && cents(preview.delta)!==0) problems.push("Budget transfer is not balanced.");
  if (problems.length) return {problems,bytes:null};
  const original=ascii(sourceBytes);
  const lineParts=original.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g).filter(Boolean);
  let table="",fields=null, found=0, sumBefore=0, sumAfter=0;
  const requested=new Map();
  for (const r of preview.rows) {
    const id=String(r.assignmentId);
    if (!/^\d+$/.test(id) || requested.has(id)) problems.push(`Invalid or duplicate assignment ID ${id}.`);
    if (r.field!=="target_cost" || !Number.isFinite(r.before) || !Number.isFinite(r.after) || cents(r.after)<0) problems.push(`Invalid budget values for ${id}.`);
    requested.set(id,r);
  }
  const output=[];
  for (const line of lineParts) {
    const ending=line.endsWith("\r\n")?"\r\n":line.endsWith("\n")?"\n":line.endsWith("\r")?"\r":"";
    const content=ending?line.slice(0,-ending.length):line;
    if(content.startsWith("%T\t")){table=content.slice(3);fields=null;output.push(line);continue;}
    if(table==="TASKRSRC" && content.startsWith("%F\t")){fields=content.slice(3).split("\t");output.push(line);continue;}
    if(table!=="TASKRSRC" || !content.startsWith("%R\t")){output.push(line);continue;}
    if(!fields){problems.push("TASKRSRC record appeared without its field header.");output.push(line);continue;}
    const cells=content.split("\t");
    const idIndex=fields.indexOf("taskrsrc_id")+1;
    const costIndex=fields.indexOf("target_cost")+1;
    if(!idIndex || !costIndex || cells.length<=Math.max(idIndex,costIndex)) {problems.push("TASKRSRC schema missing required columns.");output.push(line);continue;}
    const id=cells[idIndex];
    const current=Number(cells[costIndex]);
    if(!Number.isFinite(current)) {problems.push(`Non-numeric budget on assignment ${id}.`);output.push(line);continue;}
    sumBefore+=cents(current);
    const change=requested.get(id);
    if(!change){sumAfter+=cents(current);output.push(line);continue;}
    found++;
    if(cents(current)!==cents(change.before)) {problems.push(`Source budget mismatch for assignment ${id}: expected ${change.before}, found ${current}.`);sumAfter+=cents(current);output.push(line);continue;}
    cells[costIndex]=money(change.after);
    sumAfter+=cents(change.after);
    output.push(cells.join("\t")+ending);
  }
  if(found!==requested.size) problems.push(`Found ${found} of ${requested.size} required TASKRSRC assignments.`);
  if(sumBefore!==sumAfter) problems.push(`Total TASKRSRC budget changed by ${(sumAfter-sumBefore)/100}.`);
  if(!original.includes("%T\tTASKRSRC")) problems.push("TASKRSRC table not found.");
  const modified=output.join("");
  // Independent exact-field verification: each changed row must differ only at target_cost.
  const originalLines=lineParts;
  const modifiedLines=modified.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g).filter(Boolean);
  let differences=0;
  if(originalLines.length!==modifiedLines.length) problems.push("XER line count changed.");
  else {
    let currentTable="", currentFields=[];
    for(let i=0;i<originalLines.length;i++) {
      const old=originalLines[i],next=modifiedLines[i];
      if(old===next)continue;
      if(old.startsWith("%T\t")){currentTable=old.slice(3).trim();continue;}
      // Determine table from nearest prior %T, not just changed lines.
      let j=i;while(j>=0&&!originalLines[j].startsWith("%T\t"))j--;
      currentTable=j>=0?originalLines[j].slice(3).trim():"";
      j=i;while(j>=0&&!originalLines[j].startsWith("%F\t"))j--;
      currentFields=j>=0?originalLines[j].trim().slice(3).split("\t"):[];
      const idx=currentFields.indexOf("target_cost")+1;
      const before=old.replace(/\r?\n$/,"").split("\t");
      const after=next.replace(/\r?\n$/,"").split("\t");
      if(currentTable!=="TASKRSRC"||!idx||before.length!==after.length||before.some((v,k)=>k!==idx&&v!==after[k])) problems.push(`Unexpected change at XER line ${i+1}.`);
      else differences++;
    }
  }
  if(differences!==requested.size) problems.push(`Expected ${requested.size} modified records, found ${differences}.`);
  if(problems.length)return {problems,bytes:null};
  return {problems:[],bytes:bytesOf(modified),changedAssignments:differences,assignmentBudgetBefore:sumBefore/100,assignmentBudgetAfter:sumAfter/100};
}
export function downloadBudgetOnlyTestXer(result, filename) {
  if(!result?.bytes||result.problems?.length)throw new Error("Test XER failed validation.");
  const name=String(filename||"schedule.xer").replace(/\.xer$/i,"").replace(/[^a-z0-9._-]/gi,"_");
  const blob=new Blob([result.bytes],{type:"application/octet-stream"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=`${name}-BUDGET-ONLY-TEST-05M.xer`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
