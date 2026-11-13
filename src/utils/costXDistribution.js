// CostX federal estimate parser and auditable CLIN-local shared-cost distribution.
// Values are integer cents. Original estimate rows are never modified.
const money = value => {
  if(typeof value==='number')return Number.isFinite(value)?Math.round(value*100):null;
  let s=String(value??'').trim();if(!s||s==='-'||s==='—')return null;
  const negative=/^\(.*\)$/.test(s);s=s.replace(/[$,\s()%]/g,'');
  const n=Number(s);return Number.isFinite(n)?Math.round(n*100)*(negative?-1:1):null;
};
const text = v => String(v??'').trim();
const isClin = (code,label) => /^\d{4}$/.test(text(code)) && /^CLIN\s*\d{4}/i.test(text(label));
const excludedTotal = s => /\b(subtotal|grand total|total clin|total construction|total of|subtotal of|summary total)\b/i.test(s);
function categoryFor(label,section){
 const s=(label+' '+section).toLowerCase();
 if(/contingency|escalation|allowance/.test(label.toLowerCase()))return 'Contingency';
 if(/fee\b|profit/.test(label.toLowerCase()))return 'Fees & Profit';
 if(/insurance|bond|sd[i]|builders risk/.test(label.toLowerCase()))return 'Insurance & Bonds';
 if(/hoist|crane|lift|scaffold|construction aids|equipment/.test(s))return 'Hoisting & Equipment';
 if(/weather|winter|snow|cold weather/.test(s))return 'Weather Conditions';
 return 'General Requirements';
}
export function parseCostXEstimate(estimate){
 const sheet=(estimate?.sheets||[]).find(s=>(s.rows||[]).some(r=>isClin(r?.[0],r?.[1])));
 if(!sheet)return null;
 const rows=sheet.rows||[], starts=[];
 rows.forEach((r,i)=>{if(isClin(r?.[0],r?.[1]))starts.push({index:i,id:text(r[0])});});
 const clins=[], warnings=[];
 for(let j=0;j<starts.length;j++){
  const start=starts[j], end=j+1<starts.length?starts[j+1].index:rows.length;
  const subs=[],shared=[];let section='',region='';
  for(let i=start.index+1;i<end;i++){
   const r=rows[i]||[],code=text(r[0]),label=text(r[1]),upper=label.toUpperCase();
   if(upper==='SUBCONTRACTED WORK'){region='sub';continue;}
   if(upper==='GENERAL REQUIREMENTS'){region='shared';section='General Requirements';continue;}
   if(region==='shared'&&!code&&label&&money(r[7])===null&&!excludedTotal(label)){section=label;continue;}
   if(!label||excludedTotal(label))continue;
   const cents=money(r[7]);if(cents===null||cents===0)continue;
   const row=i+1;
   if(region==='sub'&&code&&/^(\d+\.)+\d+$/.test(code))subs.push({key:`CostX::${start.id}::${row}`,row,code,description:label,baseCents:cents});
   else if(region==='shared'&&!/^CLIN\b/i.test(label))shared.push({row,code,description:label,category:categoryFor(label,section),amountCents:cents});
  }
  if(!subs.length)warnings.push(`CLIN ${start.id}: no nonzero subcontractor detail rows in column H.`);
  clins.push({id:start.id,startRow:start.index+1,endRow:end,subs,shared});
 }
 return {sheetName:sheet.name,clins,warnings};
}
const roundSplit=(amount,weights)=>{
 const sum=weights.reduce((s,n)=>s+n,0);
 if(sum<=0)return weights.map(()=>0);
 const raw=weights.map(w=>amount*w/sum),base=raw.map(Math.floor);
 let extra=amount-base.reduce((s,n)=>s+n,0);
 const order=raw.map((v,i)=>({i,f:v-base[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
 for(let i=0;i<extra;i++)base[order[i%order.length].i]++;
 return base;
};
export function distributeCostXClin(clin,settings={}){
 const errors=[],lines=clin.subs.map(s=>({...s,additions:{},loadedCents:s.baseCents}));
 const byCategory={};for(const row of clin.shared)(byCategory[row.category]??=[]).push(row);
 const categories=[];
 for(const [category,rows] of Object.entries(byCategory)){
  const amountCents=rows.reduce((s,r)=>s+r.amountCents,0);
  const config=settings[category]||{};const mode=config.mode||'proportional';
  const selected=lines.filter(s=>mode==='proportional'||mode==='manual'||(mode==='targeted'&&(config.codes||[]).includes(s.code)));
  let allocations=Array(lines.length).fill(0);
  if(amountCents<0)errors.push(`${category}: negative category amount needs manual review.`);
  if(mode==='excluded'){} // Excluded amounts remain explicitly outside activity loading.
  else if(mode==='manual'){
   allocations=lines.map(s=>money(config.manual?.[s.code]||0)||0);
   if(allocations.some(x=>x<0))errors.push(`${category}: negative manual allocation.`);
   if(allocations.reduce((a,b)=>a+b,0)!==amountCents)errors.push(`${category}: manual allocations must equal category amount to the cent.`);
  }else if(!selected.length||selected.reduce((sum,s)=>sum+Math.max(0,s.baseCents),0)<=0){
   errors.push(`${category}: no eligible positive subcontractor base costs.`);
  }else{
   const weights=selected.map(s=>Math.max(0,s.baseCents));
   const values=roundSplit(amountCents,weights);
   selected.forEach((s,i)=>allocations[lines.findIndex(l=>l.key===s.key)]=values[i]);
  }
  lines.forEach((s,i)=>{s.additions[category]=allocations[i];s.loadedCents+=allocations[i];});
  categories.push({category,mode,sourceRows:rows.map(r=>r.row),amountCents,distributedCents:allocations.reduce((a,b)=>a+b,0),excludedCents:mode==='excluded'?amountCents:0});
 }
 const baseCents=lines.reduce((s,r)=>s+r.baseCents,0),sharedCents=clin.shared.reduce((s,r)=>s+r.amountCents,0);
 const distributedCents=categories.reduce((s,r)=>s+r.distributedCents,0),excludedCents=categories.reduce((s,r)=>s+r.excludedCents,0);
 if(distributedCents+excludedCents!==sharedCents)errors.push('Shared-cost categories do not reconcile.');
 if(lines.reduce((s,r)=>s+r.loadedCents,0)!==baseCents+distributedCents)errors.push('Loaded subcontractor costs do not reconcile.');
 return {clin:clin.id,lines,categories,baseCents,sharedCents,distributedCents,excludedCents,loadedCents:baseCents+distributedCents,errors};
}
