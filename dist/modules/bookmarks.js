import {sceneName} from './data.js';
import {esc,icon,openSheet} from './ui.js';

// Bookmark state lives in the existing per-script progress map. Preserve script order.
export function bookmarkedLines(data,progress){
 return (data?.lines||[]).filter(line=>progress?.[line.id]?.bookmarked===true);
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

export function openBookmarkPicker(data,progress,onSelect){
 const entries=bookmarkedLines(data,progress);
 const byId=new Map(entries.map(line=>[line.id,line]));
 const content=entries.length?
  '<p class="bookmark-list-summary">栞を付けたセリフ '+entries.length+'件</p><div class="bookmark-jump-list">'+
  entries.map(line=>'<button type="button" class="bookmark-jump" data-bookmark-id="'+esc(line.id)+'">'+
   '<span class="bookmark-jump-content"><span class="bookmark-jump-meta">'+
   esc(sceneName(line.scene))+' · '+esc(line.speaker)+(line.ordinal?' · '+esc(line.ordinal):'')+
   '</span><span class="bookmark-jump-text" lang="en">'+esc(line.text||'')+'</span></span>'+icon('chevron')+
   '</button>').join('')+'</div>':
  '<p class="bookmark-list-empty">栞はまだありません。台本の各セリフにある栞アイコンを押すと、ここから戻れるようになります。</p>';
 return openSheet('栞から読む',content,{setup:sheet=>{
  sheet.querySelectorAll('[data-bookmark-id]').forEach(button=>{
   button.onclick=()=>{
    const line=byId.get(button.dataset.bookmarkId);
    if(line)onSelect(line);
   };
  });
 }});
}
