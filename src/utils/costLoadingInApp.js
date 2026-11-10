// 06C: deterministic integer-cent allocations. Does not write XER.
export const cents = value => { const n=Number(value); return Number.isFinite(n) ? Math.round(n*100) : NaN; };
export const dollars = value => Math.round(value)/100;
export function calculatePool(pool) {
  const errors=[]; const amount=cents(pool.amount);
  if(!Number.isSafeInteger(amount)||amount<=0)errors.push("Enter a positive approved pool amount.");
  const entries=Object.entries(pool.rows||{}).filter(([,r])=>r?.method&&r.method!=="none");
  const fixed=entries.filter(([,r])=>r.method==="dollars");
  const percents=entries.filter(([,r])=>r.method==="percent");
  const spreads=entries.filter(([,r])=>r.method==="spread");
  const fixedAmounts=fixed.map(([id,r])=>({id,value:cents(r.value)}));
  if(fixedAmounts.some(x=>!Number.isSafeInteger(x.value)||x.value<=0))errors.push("Dollar entries must be positive valid amounts.");
  const fixedTotal=fixedAmounts.reduce((s,x)=>s+(Number.isFinite(x.value)?x.value:0),0);
  const basis=amount-fixedTotal;
  if(Number.isFinite(amount)&&basis<0)errors.push("Fixed dollars exceed the approved pool.");
  const percentages=percents.map(([id,r])=>({id,pct:Number(r.value)}));
  if(percentages.some(x=>!Number.isFinite(x.pct)||x.pct<=0||x.pct>100))errors.push("Percentages must be greater than 0 and at most 100.");
  const pctTotal=percentages.reduce((s,x)=>s+(Number.isFinite(x.pct)?x.pct:0),0);
  if(pctTotal>100+1e-9)errors.push("Entered percentages exceed 100% of the balance after fixed dollars.");
  // Allocate percentages in cents using largest remainder; preserve exact full basis when sum=100.
  const raw=percentages.map(x=>({...x,exact:basis*x.pct/100}));
  const pctTarget=Math.round(basis*Math.min(pctTotal,100)/100);
  const floors=raw.map(x=>Math.floor(x.exact));
  const extra=pctTarget-floors.reduce((a,b)=>a+b,0);
  const order=raw.map((x,i)=>({i,frac:x.exact-floors[i]})).sort((a,b)=>b.frac-a.frac||a.i-b.i);
  for(let i=0;i<Math.max(0,Math.min(extra,order.length));i++)floors[order[i].i]++;
  const pctAllocated=floors.reduce((a,b)=>a+b,0);
  const rest=basis-pctAllocated;
  const allocated={};
  fixedAmounts.forEach(x=>allocated[x.id]=x.value);
  percentages.forEach((x,i)=>allocated[x.id]=floors[i]);
  if(spreads.length){const each=Math.floor(rest/spreads.length);let extraCents=rest-each*spreads.length;spreads.forEach(([id])=>{allocated[id]=each+(extraCents>0?1:0);if(extraCents>0)extraCents--;});}
  const total=Object.values(allocated).reduce((s,v)=>s+v,0);
  const remaining=amount-total;
  if(!spreads.length&&remaining>0)errors.push("Unallocated dollars remain. Add Spread Remainder activities or allocate 100% of the available balance.");
  if(remaining<0)errors.push("Allocation exceeds the approved cost pool.");
  if(spreads.length&&rest<=0)errors.push("Spread Remainder requires a positive balance to distribute.");
  if(entries.length===0)errors.push("Select at least one receiving activity.");
  if(!pool.clin)errors.push("Select an awarded CLIN.");
  return {errors,allocated,amount,fixedTotal,basis,pctTotal,pctAllocated,spreadTotal:spreads.length?rest:0,remaining,total,ready:errors.length===0&&remaining===0};
}
export function summarizePools(pools,clins,activityIds,holdingBudget){
 const errors=[];const byClin={};const totals={};let approved=0;
 const known=new Set(activityIds.map(String));
 for(const [key,p] of Object.entries(pools)){
  if(p.status!=="approved")continue;
  const result=calculatePool(p);
  if(!result.ready)errors.push(`${key}: ${result.errors.join("; ")}`);
  const clin=clins.find(c=>String(c.id)===String(p.clin)&&c.accepted);
  if(!clin)errors.push(`${key}: CLIN ${p.clin} is not an accepted award.`);
  byClin[p.clin]=(byClin[p.clin]||0)+result.amount;
  approved+=result.amount;
  for(const [id,value] of Object.entries(result.allocated)){
   if(!known.has(String(id)))errors.push(`${key}: Activity ${id} is not in the uploaded P6 schedule.`);
   if(/^L[O0]E10000$/i.test(id))errors.push(`${key}: Construction holding cannot receive an allocation.`);
   totals[id]=(totals[id]||0)+value;
  }
 }
 for(const [id,value] of Object.entries(byClin)){
  const clin=clins.find(c=>String(c.id)===id);
  if(clin&&value>cents(clin.amount))errors.push(`Approved pools exceed awarded CLIN ${id}.`);
 }
 if(Number.isFinite(Number(holdingBudget))&&approved>cents(holdingBudget))errors.push("Approved pool allocations exceed construction holding budget.");
 return {errors,approved,byClin,totals,activityCount:Object.keys(totals).length};
}
