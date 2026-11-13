// Phase 5B. Production release gate around the P6-tested combined XER writer.
// Never modifies project state or regenerates XER assignment data.
const cents = value => Math.round(Number(value) * 100);
const validInteger = value => Number.isSafeInteger(value) && value >= 0;
export function validateControlledProductionXer(exportResult, readiness, audit) {
  const findings=[];
  if(exportResult?.status!=="COMBINED BUDGET-ONLY TEST XER READY" || !exportResult?.bytes?.length)
    findings.push("Combined XER has not passed the tested export engine.");
  if(readiness?.status!=="PREVIEW PASSED — EXPORT STILL DISABLED" || readiness?.blockers?.length)
    findings.push("Approved allocation readiness is blocked.");
  for(const key of ["directCents","sharedCents","combinedCents","holdingCents","holdingAfterCents"])
    if(!validInteger(readiness?.[key])) findings.push(`Invalid ${key} in independent reconciliation.`);
  if(validInteger(readiness?.directCents)&&validInteger(readiness?.sharedCents)&&validInteger(readiness?.combinedCents)&&
    readiness.directCents+readiness.sharedCents!==readiness.combinedCents)
    findings.push("Direct and shared allocations do not sum to the combined transfer.");
  if(validInteger(readiness?.holdingCents)&&validInteger(readiness?.holdingAfterCents)&&validInteger(readiness?.combinedCents)&&
    readiness.holdingCents-readiness.combinedCents!==readiness.holdingAfterCents)
    findings.push("Construction holding account does not reconcile.");
  if(readiness?.combinedCents!==exportResult?.combinedCents || readiness?.sharedCents!==exportResult?.sharedCents || readiness?.directCents!==exportResult?.directCents)
    findings.push("Exported transfers differ from independent approval reconciliation.");
  const before=exportResult?.assignmentBudgetBefore,after=exportResult?.assignmentBudgetAfter,original=audit?.totals?.budget;
  if(![before,after,original].every(Number.isFinite) || cents(before)!==cents(after) || cents(before)!==cents(original))
    findings.push("Total P6 resource budget is not conserved against the original XER.");
  if(!Array.isArray(exportResult?.rows) || !exportResult.rows.length ||
    !exportResult.rows.every(r=>[r.before,r.after,r.delta].every(Number.isFinite)&&cents(r.after-r.before)===cents(r.delta)))
    findings.push("Resource-assignment change rows failed numeric reconciliation.");
  else if(exportResult.rows.reduce((sum,r)=>sum+cents(r.delta),0)!==0)
    findings.push("Resource-assignment changes do not net to zero.");
  if(!validInteger(exportResult?.approvedRecords) || exportResult.approvedRecords!==readiness?.approvedMonths)
    findings.push("Approved shared record counts differ.");
  return {findings};
}
export function downloadControlledProductionXer(exportResult, readiness, audit, sourceFilename) {
  const {findings}=validateControlledProductionXer(exportResult,readiness,audit);
  if(findings.length)throw Error(findings.join(" | "));
  const base=String(sourceFilename||"schedule").replace(/\.xer$/i,"").replace(/[^a-z0-9._-]/gi,"_");
  const blob=new Blob([exportResult.bytes],{type:"application/octet-stream"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=`${base}-CONTROLLED-PRODUCTION.xer`;
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
