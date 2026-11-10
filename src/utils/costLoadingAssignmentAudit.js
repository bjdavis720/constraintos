// Patch 05G: read-only assignment-level analysis. No XER changes.
export function inspectReceivingAssignments(audit, preflight) {
  if (!audit || !preflight) return null;
  const activities = (preflight.changes || []).map(change => {
    const assignments = (audit.assignmentDetailsByTask?.[change.taskId] || []).map(r => ({
      ...r,
      difference: Math.round((r.budget - r.actual - r.remaining) * 100) / 100,
    }));
    const standard = assignments.filter(r => String(r.resourceCode).trim().toUpperCase() === "MCGSTANDCOSTONLY");
    const operation = standard.length > 1 ? "MANUAL RESOLUTION — DUPLICATES"
      : standard.length === 1 ? "REVIEW UPDATE EXISTING"
      : "PROPOSE NEW ASSIGNMENT";
    return {...change, assignments, standardCount:standard.length, operation};
  });
  const findings = [];
  for (const a of activities) {
    if (a.standardCount > 1) findings.push({severity:"BLOCKER",activityId:a.activityId,message:"Multiple MCGSTANDCOSTONLY assignments found."});
    for (const r of a.assignments) {
      if (Math.abs(r.difference) > .01) findings.push({severity:"WARNING",activityId:a.activityId,message:`Assignment ${r.assignmentId}: budget minus actual and remaining = ${r.difference.toFixed(2)}.`});
      if (r.actual !== 0) findings.push({severity:"WARNING",activityId:a.activityId,message:`Assignment ${r.assignmentId} has actual costs; preserve them in any future write.`});
    }
  }
  return {activities, findings, exportEnabled:false};
}
