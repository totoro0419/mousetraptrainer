// "今覚える！" state lives in the existing script-scoped mt-state record.
// Opening the app creates a new prompt; route changes do not.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const count=value=>Number.isInteger(value)&&value>=0?value:0;
export function normalizeQuickMemory(raw){
 const state=object(raw);
 return {
  currentByRole:{...object(state.currentByRole)},
  recentByRole:{...object(state.recentByRole)},
  counts:{...object(state.counts)},
  daily:{...object(state.daily)},
  recentCompletions:Array.isArray(state.recentCompletions)?state.recentCompletions.slice(0,30):[]
 };
}
export function currentQuickLine(data,state,role){
 const id=object(state?.currentByRole)[role];
 return data.lines.find(line=>line.id===id&&line.speaker===role)||null;
}
export function selectQuickLine(data,progress,role,recent=[],random=Math.random){
 const mine=data.lines.filter(line=>line.speaker===role);
 if(!mine.length)return null;
 const pending=mine.filter(line=>progress[line.id]?.review||progress[line.id]?.level!==2);
 const pool=pending.length?pending:mine;
 const latest=Array.isArray(recent)?recent.slice(0,5):[];
 let options=pool.filter(line=>!latest.includes(line.id));
 if(!options.length)options=pool.filter(line=>line.id!==latest[0]);
 if(!options.length)options=pool;
 const weight=line=>progress[line.id]?.review?5:progress[line.id]?.level===2?1:progress[line.id]?.level===1?2:3;
 const total=options.reduce((sum,line)=>sum+weight(line),0);
 const value=Number(random());
 let remaining=(Number.isFinite(value)?Math.min(Math.max(value,0),1-Number.EPSILON):0)*total;
 for(const line of options){remaining-=weight(line);if(remaining<0)return line;}
 return options.at(-1);
}
export function refreshQuickMemory(data,progress,raw,role,random=Math.random){
 const next=normalizeQuickMemory(raw);
 const recent=Array.isArray(next.recentByRole[role])?next.recentByRole[role]:[];
 const chosen=selectQuickLine(data,progress,role,recent,random);
 if(chosen){
  next.currentByRole[role]=chosen.id;
  next.recentByRole[role]=[chosen.id,...recent.filter(id=>id!==chosen.id)].slice(0,5);
 }else delete next.currentByRole[role];
 return next;
}
export function ensureQuickMemory(data,progress,raw,role,random=Math.random){
 const next=normalizeQuickMemory(raw);
 return currentQuickLine(data,next,role)?next:refreshQuickMemory(data,progress,next,role,random);
}
export function localDay(now=new Date()){
 const d=new Date(now);
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function completeQuickMemory(data,progress,raw,role,lineId,now=new Date(),random=Math.random){
 if(currentQuickLine(data,raw,role)?.id!==lineId)return null;
 const next=normalizeQuickMemory(raw);
 const previous=object(next.counts[lineId]);
 next.counts[lineId]={count:count(previous.count)+1,lastAt:new Date(now).toISOString()};
 const days={...object(next.daily[role])};
 const day=localDay(now);
 days[day]=count(days[day])+1;
 next.daily[role]=days;
 next.recentCompletions=[{id:lineId,role,at:new Date(now).toISOString()},...next.recentCompletions].slice(0,30);
 return refreshQuickMemory(data,progress,next,role,random);
}
export function quickMemoryStats(data,raw,role,now=new Date()){
 const state=normalizeQuickMemory(raw);
 const mine=data.lines.filter(line=>line.speaker===role);
 const total=mine.reduce((sum,line)=>sum+count(state.counts[line.id]?.count),0);
 const unique=mine.filter(line=>count(state.counts[line.id]?.count)>0).length;
 const recent=state.recentCompletions.filter(item=>item?.role===role)
  .map(item=>({line:mine.find(line=>line.id===item.id),at:item.at}))
  .filter(item=>item.line).slice(0,5);
 return {total,unique,today:count(object(state.daily[role])[localDay(now)]),recent};
}
