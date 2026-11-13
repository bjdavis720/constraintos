// Planning-only monthly distribution. No changes to P6/XER assignments.
export const moneyCents = n => Math.round((Number(n)||0)*100);
export const monthKey = date => { const d=new Date(date); return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
export function scheduleMonths(activities) {
  const dates=(activities||[]).flatMap(a=>[a.start,a.finish,a.end].filter(Boolean)).map(v=>new Date(v)).filter(d=>!Number.isNaN(d.getTime()));
  if(!dates.length)return [];
  const first=new Date(Math.min(...dates.map(d=>d.getTime())));const last=new Date(Math.max(...dates.map(d=>d.getTime())));
  const start=new Date(first.getFullYear(),first.getMonth(),1), end=new Date(last.getFullYear(),last.getMonth(),1);
  const months=[];for(let d=new Date(start);d<=end&&months.length<240;d.setMonth(d.getMonth()+1))months.push(monthKey(d));
  return months;
}
export function splitCents(total,weights){
  if(!weights.length)return [];
  const sum=weights.reduce((a,b)=>a+b,0);if(sum<=0)return weights.map(()=>0);
  const raw=weights.map(w=>total*w/sum),parts=raw.map(Math.floor);
  let remaining=total-parts.reduce((a,b)=>a+b,0);
  const ranked=raw.map((n,i)=>({i,remainder:n-parts[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
  for(let i=0;i<remaining;i++)parts[ranked[i%ranked.length].i]++;
  return parts;
}
export function recommendMonthly(totalCents,months,frontPercent=60){
  if(!months.length)return [];
  const firstHalf=Math.max(1,Math.ceil(months.length/2));
  if(months.length===1)return [totalCents];
  const early=Math.round(totalCents*Math.min(90,Math.max(10,Number(frontPercent)||60))/100);
  return [...splitCents(early,months.slice(0,firstHalf).map(()=>1)),...splitCents(totalCents-early,months.slice(firstHalf).map(()=>1))];
}
