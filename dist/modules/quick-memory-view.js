import {sceneName} from './data.js';
import {icon,esc} from './ui.js';
import {showAnalysis,showDirection,directionText} from './reader.js';
import {bindLinePlayback} from './audio.js';

// Only the immediate previous and following speech are shown initially.
// More context must be requested explicitly; ordinary reader state is untouched.
export function mountQuickMemory(main,ctx){
 const target=ctx.currentQuickLine();
 if(!target){
  main.innerHTML='<div class="page-scroll"><div class="page empty"><h2>この役のセリフがありません</h2><a href="#home" class="secondary">ホームへ戻る</a></div></div>';
  return ()=>{};
 }
 const lines=ctx.data.lines.filter(line=>line.scene===target.scene);
 const index=lines.findIndex(line=>line.id===target.id);
 const context=ctx.data.quickContexts?.[target.id];
 const scene=sceneName(target.scene);
 let before=1,after=1,stopAudio=()=>{},disposed=false;
 main.innerHTML=`<header class="quick-memory-header">
  <a href="#home" class="quick-memory-back" aria-label="完了せずにホームへ戻る">${icon('back')}<span>戻る</span></a>
  <div class="quick-memory-heading"><h1>今覚える！</h1><span>${esc(scene)}</span></div>
 </header>
 <div class="page-scroll quick-memory-scroll" tabindex="0" aria-label="対象セリフと前後の会話">
  <div class="quick-memory-body" style="--font:${ctx.small.font}px;--reader-leading:${ctx.small.leading}">
   <section class="quick-memory-context" aria-labelledby="quick-context-title">
    <h2 id="quick-context-title">状況・コンテクスト</h2>
    ${context?`<p class="quick-memory-context-setting">${esc(context.setting)}</p>
     <p class="quick-memory-context-phase">${esc(context.phase)}</p>
     <p class="quick-memory-context-situation">${esc(context.situation)}</p>
     <p class="quick-memory-context-cue">${esc(context.cue)}</p>`:'<p class="quick-memory-context-missing">この台本の状況データは未収録です。前後のセリフをご確認ください。</p>'}
   </section>
   <div class="quick-memory-scene">${esc(scene)}</div>
   <div class="quick-memory-dialogue"></div>
  </div>
 </div>
 <div class="quick-memory-footer"><button type="button" class="primary quick-memory-complete">${icon('check')}<span>完了</span></button></div>`;
 const scroller=main.querySelector('.quick-memory-scroll');
 ctx.stickTarget?.('quick',scroller);
 const area=main.querySelector('.quick-memory-dialogue');
 const renderLine=line=>{
  const mine=line.id===target.id,direction=directionText(line.direction);
  return `<article class="quick-memory-speech${mine?' is-target':''}" data-line-id="${esc(line.id)}" tabindex="0" role="button" aria-label="${esc(line.speaker)} のセリフの解説を開く">
   <div class="quick-memory-speech-head"><span class="quick-memory-speaker">${esc(line.speaker)}</span>${mine?'<span class="quick-memory-target-label">覚えるセリフ</span>':''}${mine?'<button type="button" class="quick-memory-audio icon-button" aria-label="このセリフの音声を再生">'+icon('play')+'</button>':''}</div>
   ${direction?'<button type="button" class="quick-memory-direction" aria-label="ト書きの詳細">'+esc(direction)+'</button>':''}
   <p class="quick-memory-text" lang="en">${esc(line.text)}</p>
  </article>`;
 };
 function draw(){
  stopAudio();
  const from=Math.max(0,index-before),to=Math.min(lines.length,index+after+1);
  const previous=from>0?`<button type="button" class="quick-memory-more" data-more="before">さらに前のセリフを見る ${icon('chevron')}</button>`:'';
  const following=to<lines.length?`<button type="button" class="quick-memory-more" data-more="after">さらに後のセリフを見る ${icon('chevron')}</button>`:'';
  area.innerHTML=previous+lines.slice(from,to).map(renderLine).join('')+following;
  const audio=area.querySelector('.quick-memory-speech.is-target .quick-memory-audio');
  stopAudio=audio?bindLinePlayback(audio,{dataset:ctx.data.id,id:target.id,rate:()=>ctx.small.rate}):()=>{};
  area.querySelectorAll('.quick-memory-speech').forEach(node=>{
   const line=lines.find(item=>item.id===node.dataset.lineId);
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
  area.querySelector('[data-more="before"]')?.addEventListener('click',()=>{
   const targetBefore=area.querySelector('.quick-memory-speech.is-target')?.getBoundingClientRect().top;
   before++;draw();
   if(targetBefore!==undefined){
    const targetAfter=area.querySelector('.quick-memory-speech.is-target')?.getBoundingClientRect().top;
    scroller.scrollTop+=targetAfter-targetBefore;
   }
  });
  area.querySelector('[data-more="after"]')?.addEventListener('click',()=>{after++;draw();});
 }
 draw();
 const done=main.querySelector('.quick-memory-complete');
 let completing=false;
 const finish=()=>{
  if(completing||disposed)return;
  completing=true;
  done.disabled=true;
  const sheetButton=document.querySelector('#sheet .quick-memory-sheet-complete');
  if(sheetButton)sheetButton.disabled=true;
  if(ctx.completeQuick(target.id)){
   location.hash='home';
  }else{
   completing=false;
   done.disabled=false;
   if(sheetButton)sheetButton.disabled=false;
  }
 };
 done.addEventListener('click',finish);
 // showModal() puts #sheet in the browser's top layer, above all page elements.
 // Provide the same completion action INSIDE the sheet rather than using z-index.
 const attachSheetComplete=event=>{
  if(disposed)return;
  const sheet=event.detail;
  if(!sheet?.open||!sheet.querySelector('.sheet-body'))return;
  sheet.classList.add('quick-memory-sheet-mode');
  const footer=document.createElement('div');
  footer.className='quick-memory-sheet-footer';
  footer.innerHTML=`<button type="button" class="primary quick-memory-sheet-complete">${icon('check')}<span>完了</span></button>`;
  const button=footer.querySelector('button');
  button.disabled=completing;
  button.addEventListener('click',finish);
  sheet.append(footer);
 };
 document.addEventListener('mousetrap:sheetopen',attachSheetComplete);
 return ()=>{
  disposed=true;
  ctx.stickTarget?.('quick',null);
  document.removeEventListener('mousetrap:sheetopen',attachSheetComplete);
  stopAudio();
 };
}
