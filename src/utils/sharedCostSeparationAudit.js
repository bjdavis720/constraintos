// Read-only separation audit. Never mutates pools, approvals or P6 records.
const validCents = value => Number.isSafeInteger(value) && value >= 0;
export function auditSharedCostSeparation(pools = {}, estimate = null) {
  const rows = [];
  const source = new Map((estimate?.clins || []).flatMap(c => c.subs.map(s => [s.key, { ...s, clin:c.id }])));
  for (const [key,pool] of Object.entries(pools)) {
    if(pool?.status !== 'approved') continue;
    if(pool.separation?.completed) continue; // direct-only reapproved pools no longer contain embedded shared costs
    const notes = [];
    const base = Number(pool.costX?.baseCents);
    const additions = pool.costX?.additions;
    const recorded = Number(pool.amount);
    const approvedCents = Number.isFinite(recorded) ? Math.round(recorded*100) : NaN;
    const hasMetadata = pool.costX && validCents(base) && additions && typeof additions === 'object';
    const components = hasMetadata ? Object.entries(additions).map(([category, amount]) => ({category, cents:Number(amount)})) : [];
    if(!hasMetadata) notes.push('Missing original CostX cost composition; cannot safely separate.');
    if(components.some(c => !Number.isSafeInteger(c.cents))) notes.push('Invalid shared-cost category amount.');
    const shared = components.reduce((s,c) => s + (Number.isSafeInteger(c.cents) ? c.cents : 0),0);
    if(!Number.isSafeInteger(approvedCents)) notes.push('Invalid approved pool amount.');
    if(hasMetadata && Number.isSafeInteger(approvedCents) && base + shared !== approvedCents) notes.push('Approved amount differs from recorded direct plus shared costs.');
    const estimateRow = source.get(key);
    if(estimate && !estimateRow) notes.push('Pool not found in current CostX estimate.');
    if(estimateRow && hasMetadata && estimateRow.baseCents !== base) notes.push('Direct cost differs from current CostX estimate.');
    rows.push({key,clin:pool.clin || estimateRow?.clin || '',name:estimateRow?.description || key,
      approvedCents,baseCents:hasMetadata?base:null,sharedCents:hasMetadata?shared:null,
      components,notes,ready:notes.length===0,hasShared:hasMetadata && shared!==0});
  }
  const sum = field => rows.reduce((s,r) => s + (Number.isSafeInteger(r[field]) ? r[field] : 0),0);
  return {rows,approvedCents:sum('approvedCents'),directCents:sum('baseCents'),sharedCents:sum('sharedCents'),
    issues:rows.filter(r=>!r.ready).length,withShared:rows.filter(r=>r.hasShared).length,
    reconcilable:rows.length>0 && rows.every(r=>r.ready),
    // This audit is not authorization to convert approved pools or export monthly costs.
    migrationAuthorized:false};
}
