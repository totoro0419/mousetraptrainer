// Independent reveal state: scrolling and jumping never change which lines are visible.
export function normalizeClozeResume(saved,lines,role){
 const fallback=lines.findIndex(line=>line.speaker===role);
 if(!saved||saved.role!==role)return Math.max(fallback,0);
 const byId=lines.findIndex(line=>line.id===(saved.anchorId||saved.lineId));
 if(byId>=0)return byId;
 return Number.isInteger(saved.index)&&saved.index>=0&&saved.index<lines.length
  ?saved.index:Math.max(fallback,0);
}
export function nextOwnIndex(lines,role,from,direction){
 if(direction>0){
  for(let i=from+1;i<lines.length;i++)if(lines[i].speaker===role)return i;
 }else{
  for(let i=from-1;i>=0;i--)if(lines[i].speaker===role)return i;
 }
 return -1;
}
export function previousCueIndex(lines,role,index){
 for(let i=index-1;i>=0;i--)if(lines[i].speaker!==role)return i;
 return -1;
}
export function toggleClozeLine(revealed,id){
 const next=new Set(revealed);
 if(next.has(id))next.delete(id);else next.add(id);
 return next;
}
// Keep the target visible, reserving up to 42% of the viewport for prior dialogue.
export function clozeContextOffset(viewportHeight,targetHeight,cueHeight=0){
 const room=Math.max(20,viewportHeight-targetHeight-20);
 return Math.max(20,Math.min(room,viewportHeight*.42,Math.max(24,cueHeight+12)));
}
