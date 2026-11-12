// A script has a single bookmark. Existing multi-bookmark states are migrated
// deterministically by the saved bookmark timestamp, falling back to updatedAt.
export function newestBookmark(data,progress){
 let latest=null,latestAt=-Infinity;
 for(const line of data?.lines||[]){
  const entry=progress?.[line.id];
  if(entry?.bookmarked!==true)continue;
  const raw=Number(entry.bookmarkAt??entry.updatedAt);
  const at=Number.isFinite(raw)?raw:0;
  if(at>=latestAt){latest=line;latestAt=at;}
 }
 return latest;
}

export function bookmarkedLines(data,progress){
 const line=newestBookmark(data,progress);
 return line?[line]:[];
}

// Remove older bookmarks without touching mastery, review, notes, or timestamps.
export function normalizeSingleBookmark(data,progress){
 if(!progress||typeof progress!=='object')return false;
 const current=newestBookmark(data,progress);
 let changed=false;
 for(const [id,entry] of Object.entries(progress)){
  if(entry?.bookmarked===true&&id!==current?.id){
   progress[id]={...entry,bookmarked:false};
   changed=true;
  }
 }
 return changed;
}

// Opening a saved line must work even when another scene or filter is selected.
export function prepareBookmarkJump(small,line){
 if(!small||!line?.id||!line?.scene)return false;
 small.scene=line.scene;
 small.speaker='all';
 small.query='';
 small.reviewOnly=false;
 small.bookmarkOnly=false;
 small.read={id:line.id,scene:line.scene,highlight:true};
 return true;
}
