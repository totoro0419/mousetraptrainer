import {sceneName} from './data.js';
import {icon,esc} from './ui.js';
import {showAnalysis,showDirection,directionText} from './reader.js';
import {bindLinePlayback} from './audio.js';

// Lightweight, read-only script view: unlike the normal reader it never swipes
// a neighbouring line into a different memorization status.
export function mountQuickMemory(main,ctx){
 const role=ctx.small.role;
 const target=ctx.currentQuickLine();
 if(!target){
  main.innerHTML='<div class="page-scroll"><div class="page empty"><h2>この役のセリフがありません</h2><a href="#home" class="secondary">ホームへ戻る</a></div></div>';
  return ()=>{};
 }
 const lines=ctx.data.lines.filter(line=>line.scene===target.scene);
 const scene=sceneName(target.scene);
 const script=lines.map(line=>{
  const mine=line.id===target.id;
  const direction=directionText(line.direction);
  return `<article class="quick-memory-speech${mine?' is-target':''}" data-line-id="${esc(line.id)}" tabindex="0" role="button" aria-label="${esc(line.speaker)} のセリフの解説を開く">
   <div class="quick-memory-speech-head"><span class="quick-memory-speaker">${esc(line.speaker)}</span>${mine?'<span class="quick-memory-target-label">覚えるセリフ</span>':''}${mine?'<button type="button" class="quick-memory-audio icon-button" aria-label="このセリフの音声を再生">'+icon('play')+'</button>':''}</div>
   ${direction?'<button type="button" class="quick-memory-direction" aria-label="ト書きの詳細">'+esc(direction)+'</button>':''}
   <p class="quick-memory-text" lang="en">${esc(line.text)}</p>
  </article>`;
 }).join('');
 main.innerHTML=`<header class="quick-memory-header">
  <a href="#home" class="quick-memory-back" aria-label="完了せずにホームへ戻る">${icon('back')}<span>戻る</span></a>
  <div class="quick-memory-heading"><h1>今覚える！</h1><span>${esc(scene)}</span></div>
 </header>
 <div class="page-scroll quick-memory-scroll" tabindex="0" aria-label="前後の会話を読む">
  <div class="quick-memory-body" style="--font:${ctx.small.font}px;--reader-leading:${ctx.small.leading}">
   <div class="quick-memory-scene">${esc(scene)}</div>${script}
  </div>
 </div>
 <div class="quick-memory-footer"><button type="button" class="primary quick-memory-complete">${icon('check')}<span>完了</span></button></div>`;
 const scroller=main.querySelector('.quick-memory-scroll');
 const selected=main.querySelector('.quick-memory-speech.is-target');
 const audio=selected?.querySelector('.quick-memory-audio');
 const stopAudio=audio?bindLinePlayback(audio,{dataset:ctx.data.id,id:target.id,rate:()=>ctx.small.rate}):()=>{};
 let disposed=false;
 const align=()=>{
  if(disposed||!selected?.isConnected)return;
  const item=selected.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
  const offset=Math.max(16,(scroller.clientHeight-Math.min(item.height,scroller.clientHeight))/2);
  scroller.scrollTop+=item.top-viewport.top-offset;
 };
 // Scroll to the highlighted sentence without changing normal reader position.
 requestAnimationFrame(()=>requestAnimationFrame(align));
 main.querySelectorAll('.quick-memory-speech').forEach(node=>{
  const line=ctx.data.lines.find(item=>item.id===node.dataset.lineId);
  if(!line)return;
  node.addEventListener('click',event=>{
   if(event.target.closest('button')||window.getSelection()?.toString())return;
   showAnalysis(line,ctx);
  });
  node.addEventListener('keydown',event=>{
   if(event.target===node&&(event.key==='Enter'||event.key===' ')){event.preventDefault();showAnalysis(line,ctx);}
  });
  node.querySelector('.quick-memory-direction')?.addEventListener('click',()=>showDirection(line));
 });
 const done=main.querySelector('.quick-memory-complete');
 done.addEventListener('click',()=>{
  if(done.disabled)return;
  done.disabled=true;
  if(ctx.completeQuick(target.id))location.hash='home';
  else done.disabled=false;
 });
 return ()=>{disposed=true;stopAudio();};
}
