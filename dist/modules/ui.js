import {openRoleMenu} from './role-menu.js';
const paths={book:'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4z M12 6v15',home:'m3 10 9-7 9 7 M5 9v12h5v-7h4v7h5V9',play:'m8 5 12 7-12 7z',arrow:'M4 12h16 m-6-6 6 6-6 6',back:'M20 12H4 m6-6-6 6 6 6',settings:'M8.82 4.33L10.27 3.88L10.25 1.55L13.75 1.55L13.73 3.88L15.18 4.33L15.18 4.33L16.52 5.04L18.16 3.37L20.63 5.84L18.96 7.48L19.67 8.82L19.67 8.82L20.12 10.27L22.45 10.25L22.45 13.75L20.12 13.73L19.67 15.18L19.67 15.18L18.96 16.52L20.63 18.16L18.16 20.63L16.52 18.96L15.18 19.67L15.18 19.67L13.73 20.12L13.75 22.45L10.25 22.45L10.27 20.12L8.82 19.67L8.82 19.67L7.48 18.96L5.84 20.63L3.37 18.16L5.04 16.52L4.33 15.18L4.33 15.18L3.88 13.73L1.55 13.75L1.55 10.25L3.88 10.27L4.33 8.82L4.33 8.82L5.04 7.48L3.37 5.84L5.84 3.37L7.48 5.04L8.82 4.33Z M15.05 12a3.05 3.05 0 1 0-6.1 0 3.05 3.05 0 1 0 6.1 0',close:'m6 6 12 12M6 18 18 6',chevron:'m8 4 8 8-8 8',down:'m6 9 6 6 6-6',up:'m6 15 6-6 6 6',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',check:'m5 12 4 4L19 6',bookmark:'M6 3h12v18l-6-4-6 4z',flag:'M5 3v18 M5 4h13l-3 5 3 5H5',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',audio:'M4 10v4h4l5 4V6l-5 4z M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',pause:'M8 4v16M16 4v16',more:'M5 12h.01M12 12h.01M19 12h.01',refresh:'M20 7A9 9 0 1 0 21 14M20 3v5h-5',download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',info:'M12 10v7M12 6h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',type:'M4 19 10 5l6 14M6 15h8M16 11h6m-3 0v8'};
export const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.info}"/></svg>`;
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const button=(text,action,cls='secondary',ico='')=>`<button type="button" class="${cls}" data-action="${action}">${ico?icon(ico):''}<span>${text}</span></button>`;
export function el(html){const t=document.createElement('template');t.innerHTML=html;return t.content.firstElementChild;}
let toastTimer,undoAction;
export function toast(message,undo){clearTimeout(toastTimer);undoAction=undo;const t=document.querySelector('#toast');t.replaceChildren();t.append(document.createTextNode(message));if(undo){const b=document.createElement('button');b.textContent='取り消す';b.onclick=()=>{undoAction?.();t.classList.remove('show');};t.append(b);}t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),undo?9000:4500);}
let invoker,onClose,currentCleanup;

export function sheetSwipeDecision(dy,dx,elapsed){
 const velocity=Math.abs(dy)/Math.max(1,elapsed);
 if(Math.abs(dx)>Math.abs(dy)*1.15)return 'snap';
 if(dy>96||(dy>38&&velocity>.78))return 'dismiss';
 if(dy< -65)return 'expand';
 return 'snap';
}
export const isSheetOpen=()=>document.querySelector('#sheet').open;
export function closeSheet(){
 const d=document.querySelector('#sheet');if(d?.open)d.close();
}
function animateSheetDismiss(d,offset=0){
 if(!d.open||d.dataset.dismissing==='true')return;
 d.dataset.dismissing='true';
 d.style.transform='';d.style.pointerEvents='none';
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||typeof d.animate!=='function'){closeSheet();return;}
 const animation=d.animate([{transform:`translateY(${Math.max(0,offset)}px)`,opacity:1},{transform:'translateY(100%)',opacity:.96}],{duration:190,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
 animation.finished.then(()=>{if(d.open)closeSheet();},()=>{if(d.open)closeSheet();}).finally(()=>{animation.cancel();});
}
export function openSheet(title,content,{wide=false,onclose,setup}={}){
 const d=document.querySelector('#sheet'),wasOpen=d.open;
 currentCleanup?.();currentCleanup=null;
 if(!wasOpen)invoker=document.activeElement;
 onClose=onclose;
 d.style.transform='';d.style.pointerEvents='';delete d.dataset.dismissing;
 d.className=wide?'sheet expanded':'sheet';
 d.innerHTML=`<header class="sheet-head"><button class="sheet-handle" type="button" aria-label="シートを上下に動かす" aria-expanded="${wide}"><span></span></button><div class="sheet-heading"><h2 id="sheet-title">${esc(title)}</h2><div><button type="button" class="icon-button expand-sheet" aria-label="${wide?'小さく表示':'大きく表示'}">${icon(wide?'down':'up')}</button><button type="button" class="icon-button close-sheet" aria-label="閉じる">${icon('close')}</button></div></div></header><div class="sheet-body">${content}</div>`;
 const header=d.querySelector('.sheet-head'),body=d.querySelector('.sheet-body'),handle=d.querySelector('.sheet-handle');
 const toggleExpanded=()=>{
  d.classList.toggle('expanded');
  const expanded=d.classList.contains('expanded');
  handle.setAttribute('aria-expanded',String(expanded));
  const b=d.querySelector('.expand-sheet');
  b.setAttribute('aria-label',expanded?'小さく表示':'大きく表示');b.innerHTML=icon(expanded?'down':'up');
 };
 let ignoreHandleClick=false;
 d.querySelector('.close-sheet').onclick=closeSheet;
 d.querySelector('.expand-sheet').onclick=toggleExpanded;
 handle.onclick=()=>{if(!ignoreHandleClick)toggleExpanded();};
 d.onclose=()=>{
  currentCleanup?.();currentCleanup=null;
  d.style.transform='';d.style.pointerEvents='';delete d.dataset.dismissing;
  onClose?.();
  if(invoker?.isConnected)invoker.focus({preventScroll:true});
 };
 d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)closeSheet();}};
 // Header: pointer capture keeps the gesture even when the finger leaves the handle.
 let drag=null;
 const translate=dy=>{d.style.transform=dy>0?`translateY(${dy}px)`:'';};
 const settle=dy=>{
  d.style.transform='';
  if(dy>0&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&typeof d.animate==='function'){
   d.animate([{transform:`translateY(${Math.min(dy,600)}px)`},{transform:'translateY(0)'}],
    {duration:210,easing:'cubic-bezier(.22,1,.36,1)'});
  }
 };
 const finish=(dy,dx,ms)=>{
  const action=sheetSwipeDecision(dy,dx,ms);
  if(action==='dismiss')animateSheetDismiss(d,dy);
  else{settle(dy);if(action==='expand'&&!d.classList.contains('expanded'))toggleExpanded();}
 };
 header.onpointerdown=e=>{
  if(e.button!==0||e.target.closest('.sheet-heading button'))return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),moved:false};
  header.setPointerCapture(e.pointerId);
 };
 header.onpointermove=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const dy=e.clientY-drag.y,dx=e.clientX-drag.x;
  if(Math.abs(dy)>9&&Math.abs(dy)>Math.abs(dx)*1.15){drag.moved=true;translate(dy);}
 };
 header.onpointerup=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const a=drag;drag=null;
  if(a.moved){ignoreHandleClick=true;setTimeout(()=>{ignoreHandleClick=false;},0);}
  finish(e.clientY-a.y,e.clientX-a.x,performance.now()-a.t);
 };
 header.onpointercancel=()=>{drag=null;translate(0)};
 header.onlostpointercapture=()=>{if(drag){drag=null;translate(0)}};
 // Body: drag down only when the scroll area is already at the top.
 let touch=null;
 body.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest('input,textarea,select,[contenteditable="true"]')){touch=null;return;}
  const t=e.touches[0];
  touch={x:t.clientX,y:t.clientY,time:performance.now(),active:false,blocked:body.scrollTop>1};
 },{passive:true});
 body.addEventListener('touchmove',e=>{
  if(!touch||e.touches.length!==1)return;
  const t=e.touches[0],dy=t.clientY-touch.y,dx=t.clientX-touch.x;
  if(touch.blocked||dy<0||Math.abs(dx)>Math.abs(dy)*1.15){if(!touch.active)touch.blocked=true;return;}
  if(!touch.active&&dy>12&&body.scrollTop<=1)touch.active=true;
  if(touch.active){e.preventDefault();translate(Math.max(0,dy));}
 },{passive:false});
 body.addEventListener('touchend',e=>{
  if(!touch)return;
  const a=touch;touch=null;
  if(!a.active){translate(0);return;}
  const t=e.changedTouches[0];finish(t.clientY-a.y,t.clientX-a.x,performance.now()-a.time);
 },{passive:true});
 body.addEventListener('touchcancel',()=>{touch=null;translate(0)},{passive:true});
 if(!wasOpen)d.showModal();
 d.querySelector('.close-sheet').focus({preventScroll:true});
 currentCleanup=setup?.(d);
 enhanceSelects(d);
 return d;
}
// Native SELECT elements retain their values and existing onchange handlers, but
// are hidden from interaction. In-app choice sheets replace OS-native pickers.
export function syncSelects(root=document){
 root.querySelectorAll('.app-select').forEach(wrapper=>{
  const source=wrapper.querySelector('select');
  const label=wrapper.querySelector('.app-select-value');
  if(source&&label)label.textContent=source.selectedOptions[0]?.textContent||'選択してください';
  wrapper.querySelector('.app-select-trigger')?.setAttribute('aria-disabled',String(!!source?.disabled));
 });
}
export function enhanceSelects(root=document){
 root.querySelectorAll('select:not(.native-select-source)').forEach(source=>{
  const roleMenu=source.dataset.roleMenu==='true';
  const wrapper=document.createElement('span');wrapper.className='app-select';
  const trigger=document.createElement('button');trigger.type='button';trigger.className='app-select-trigger';
  const textLabel=source.getAttribute('aria-label')||
   (source.id?document.querySelector(`label[for="${CSS.escape(source.id)}"]`)?.textContent?.trim():'')||
   source.closest('label')?.firstChild?.textContent?.trim()||'選択';
  trigger.setAttribute('aria-label',textLabel);
  trigger.setAttribute('aria-haspopup',roleMenu?'listbox':'dialog');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML=`<span class="app-select-value"></span>${icon('down')}`;
  source.before(wrapper);wrapper.append(source,trigger);
  source.classList.add('native-select-source');
  source.hidden=true;source.setAttribute('aria-hidden','true');source.tabIndex=-1;
  const label=source.id?document.querySelector(`label[for="${CSS.escape(source.id)}"]`):null;
  if(label)label.addEventListener('click',e=>{if(e.target===label){e.preventDefault();trigger.click()}});
  trigger.onclick=()=>{
   if(source.disabled)return;
   if(roleMenu){
    const options=[...source.options].filter(o=>!o.disabled);
    openRoleMenu(trigger,options.map(o=>o.value),source.value,next=>{
     if(!source.isConnected||source.value===next)return;
     source.value=next;
     syncSelects(wrapper.parentElement||document);
     source.dispatchEvent(new Event('input',{bubbles:true}));
     source.dispatchEvent(new Event('change',{bubbles:true}));
    });
    return;
   }
   trigger.setAttribute('aria-expanded','true');
   const options=[...source.options].filter(o=>!o.disabled);
   const content=`<div class="app-choice-list" role="group" aria-label="${esc(textLabel)}">${options.map(o=>
    `<button type="button" class="app-choice" aria-current="${o.value===source.value?'true':'false'}"><span>${esc(o.textContent)}</span>${o.value===source.value?icon('check'):''}</button>`
   ).join('')}</div>`;
   const sheet=openSheet(textLabel,content,{setup:d=>{
    d.querySelectorAll('.app-choice').forEach((choice,i)=>choice.onclick=()=>{
     const next=options[i]?.value;
     closeSheet();
     if(next===undefined||!source.isConnected||source.value===next)return;
     source.value=next;
     syncSelects(wrapper.parentElement||document);
     source.dispatchEvent(new Event('input',{bubbles:true}));
     source.dispatchEvent(new Event('change',{bubbles:true}));
    });
   },onclose:()=>{if(trigger.isConnected)trigger.setAttribute('aria-expanded','false');}});
   sheet.querySelector('.app-choice[aria-current="true"]')?.focus({preventScroll:true});
  };
 });
 syncSelects(root);
}
export function empty(title,body){return `<div class="empty"><div class="empty-icon">${icon('book')}</div><h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;}
