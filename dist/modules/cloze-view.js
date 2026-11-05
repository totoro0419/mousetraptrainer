import {sceneName} from './data.js';
import {icon,esc,el,toast} from './ui.js';
import {directionText} from './reader.js';
import {bindLinePlayback} from './audio.js';
import {normalizeClozeResume,nextOwnIndex,previousCueIndex,clozeContextOffset} from './cloze.js';

// Cloze is a free-reading surface, not a single-question session.
export function mountCloze(holder,ctx,lines,range,savedIndex=0,onExit=()=>{}){
 const {small,save}=ctx,role=small.role;
 const old=small.sessions?.cloze;
 const index=normalizeClozeResume(old?.range?.scene===range.scene&&
  old?.range?.from===range.from&&old?.range?.to===range.to?old:null,lines,role);
 let anchor=Math.max(0,Math.min(lines.length-1,savedIndex||index));
 const revealed=new Set(),ownNodes=[],allNodes=[],audioStops=[];
 let disposed=false,scrollTimer=0,highlightTimer=0;
 holder.innerHTML=`<div class="reader-top"><div class="reader-heading">
  <button class="icon-button" data-action="exit" aria-label="練習方法を選び直す">${icon('back')}</button>
  <div><h1>穴埋め練習</h1><span class="reader-count">${esc(role)} · ${esc(sceneName(range.scene))}</span></div>
 </div><span class="reader-count">自分のセリフ ${lines.filter(line=>line.speaker===role).length}件</span></div>
 <div class="page-scroll rehearsal rehearsal-free" tabindex="0" aria-label="穴埋め練習">
 <div class="script-body" style="--font:${small.font}px;--reader-leading:${small.leading}"></div></div>`;
 const scroller=holder.querySelector('.rehearsal-free'),body=holder.querySelector('.script-body');
 function persist(){
  if(disposed)return;
  small.sessions||={};
  small.sessions.cloze={version:2,role,range,index:anchor,lineId:lines[anchor]?.id,anchorId:lines[anchor]?.id};
  save();
 }
 let scene='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i],mine=line.speaker===role;
  if(line.scene!==scene){scene=line.scene;body.append(el(`<div class="scene-divider"><h2>${esc(sceneName(scene))}</h2></div>`));}
  const node=el(`<article class="speech ${mine?'mine':''}" data-id="${esc(line.id)}" data-index="${i}">
  <div class="speech-head"><span class="speaker">${esc(line.speaker)}</span><span class="line-number">${String(line.ordinal).padStart(3,'0')}</span></div>
  ${line.direction?`<p class="direction">${esc(directionText(line.direction))}</p>`:''}
  <div class="line-content">${mine?`<button type="button" class="reveal-mask cloze-toggle" aria-expanded="false" aria-label="セリフ ${line.ordinal} を表示">タップしてセリフを表示</button>`:`<p lang="en" class="speech-text">${esc(line.text)}</p>`}</div>
  </article>`);
  body.append(node);allNodes.push(node);
  if(mine){
   ownNodes.push({index:i,node});
   const toggle=node.querySelector('.cloze-toggle');
   const audio=el('<button type="button" class="icon-button line-audio-button cloze-line-audio" aria-label="セリフの音声を再生" hidden>'+icon('audio')+'</button>');
   const actions=el('<div class="button-row cloze-progress-actions" hidden><button type="button" class="secondary cloze-review">要復習</button><button type="button" class="secondary cloze-mastered">覚えた</button></div>');
   toggle.after(audio,actions);
   const reviewButton=actions.querySelector('.cloze-review'),masterButton=actions.querySelector('.cloze-mastered');
   const syncReview=()=>{
    const checked=!!ctx.progress[line.id]?.review;
    reviewButton.setAttribute('aria-pressed',String(checked));
    reviewButton.textContent=checked?'要復習を解除':'要復習';
   };
   syncReview();
   reviewButton.addEventListener('click',()=>{
    const current=ctx.progress[line.id]||{};
    ctx.setProgress(line.id,{...current,review:!current.review,updatedAt:Date.now()});
    syncReview();
   });
   masterButton.addEventListener('click',()=>{
    const current=ctx.progress[line.id]||{};
    ctx.setProgress(line.id,{...current,level:2,updatedAt:Date.now()});
   });
   let stopAudio=()=>{};
   audioStops.push(()=>stopAudio());
   toggle.addEventListener('click',()=>{
    if(disposed)return;
    if(revealed.has(line.id))revealed.delete(line.id);else revealed.add(line.id);
    const show=revealed.has(line.id);
    toggle.textContent=show?line.text:'タップしてセリフを表示';
    toggle.classList.toggle('is-revealed',show);
    stopAudio();stopAudio=()=>{};
    audio.hidden=!show;
    actions.hidden=!show;
    if(show)stopAudio=bindLinePlayback(audio,{dataset:ctx.data.id,id:line.id,rate:()=>small.rate});
    toggle.setAttribute('aria-expanded',String(show));
    toggle.setAttribute('aria-label',`セリフ ${line.ordinal} を${show?'隠す':'表示'}`);
    anchor=i;persist();
   });
  }
 }
 const isOwn=i=>lines[i]?.speaker===role;
 function jumpTo(i,highlight=true){
  if(i<0||i>=lines.length||!isOwn(i)){toast('この方向に自分のセリフはありません');return;}
  anchor=i;persist();
  const node=allNodes[i],cueIndex=previousCueIndex(lines,role,i),cue=allNodes[cueIndex];
  const align=()=>{
   if(disposed||!node.isConnected)return;
   const viewport=scroller.getBoundingClientRect();
   const target=node.getBoundingClientRect();
   const prior=cue?.getBoundingClientRect();
   const cueDistance=prior?Math.max(0,target.top-prior.top):0;
   const offset=clozeContextOffset(viewport.height,target.height,cueDistance);
   scroller.scrollTop+=target.top-viewport.top-offset;
  };
  align();requestAnimationFrame(()=>requestAnimationFrame(align));
  if(highlight){
   clearTimeout(highlightTimer);node.classList.add('highlight');
   highlightTimer=setTimeout(()=>node.classList.remove('highlight'),1200);
  }
 }
 function jumpMine(direction){
  // A previous jump is used as the reference; free scrolling refreshes the anchor.
  const next=nextOwnIndex(lines,role,anchor,direction);
  if(next<0){toast(direction>0?'次の自分のセリフはありません':'前の自分のセリフはありません');return;}
  jumpTo(next);
 }
 function rememberScroll(){
  if(disposed)return;
  const box=scroller.getBoundingClientRect(),point=box.top+box.height*.35;
  let best=anchor,distance=Infinity;
  for(const {index,node} of ownNodes){
   const r=node.getBoundingClientRect();
   const d=r.top<=point&&r.bottom>=point?0:Math.min(Math.abs(r.top-point),Math.abs(r.bottom-point));
   if(d<distance){best=index;distance=d;}
  }
  if(best!==anchor){anchor=best;persist();}
 }
 const onScroll=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(rememberScroll,170);};
 scroller.addEventListener('scroll',onScroll,{passive:true});
 holder.querySelector('[data-action="exit"]').addEventListener('click',()=>{persist();onExit();});
 ctx.stickTarget?.('cloze',scroller,jumpMine,()=>clearTimeout(scrollTimer));
 // Resume from the last visible dialogue without changing any reveal state.
 if(old?.role===role&&old?.range?.scene===range.scene){
  requestAnimationFrame(()=>jumpTo(anchor,false));
 }
 const keyboard=e=>{
  if(!holder.isConnected||e.target.closest('input,select,textarea,button,a,[contenteditable]'))return;
  if(e.altKey&&e.key==='ArrowDown'){e.preventDefault();jumpMine(1);}
  if(e.altKey&&e.key==='ArrowUp'){e.preventDefault();jumpMine(-1);}
 };
 window.addEventListener('keydown',keyboard);
 persist();
 return ()=>{
  persist();disposed=true;clearTimeout(scrollTimer);clearTimeout(highlightTimer);
  window.removeEventListener('keydown',keyboard);
  for(const stop of audioStops)stop();
  ctx.stickTarget?.('cloze',null);
 };
}
