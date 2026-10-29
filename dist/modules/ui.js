const paths={book:'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4z M12 6v15',home:'m3 10 9-7 9 7 M5 9v12h5v-7h4v7h5V9',play:'m8 5 12 7-12 7z',arrow:'M4 12h16 m-6-6 6 6-6 6',back:'M20 12H4 m6-6-6 6 6 6',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',close:'m6 6 12 12M6 18 18 6',chevron:'m8 4 8 8-8 8',down:'m6 9 6 6 6-6',up:'m6 15 6-6 6 6',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',check:'m5 12 4 4L19 6',bookmark:'M6 3h12v18l-6-4-6 4z',upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',audio:'M4 10v4h4l5 4V6l-5 4z M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',pause:'M8 4v16M16 4v16',more:'M5 12h.01M12 12h.01M19 12h.01',refresh:'M20 7A9 9 0 1 0 21 14M20 3v5h-5',download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',info:'M12 10v7M12 6h.01 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1',type:'M4 19 10 5l6 14M6 15h8M16 11h6m-3 0v8'};
export const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.info}"/></svg>`;
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const button=(text,action,cls='secondary',ico='')=>`<button type="button" class="${cls}" data-action="${action}">${ico?icon(ico):''}<span>${text}</span></button>`;
export function el(html){const t=document.createElement('template');t.innerHTML=html;return t.content.firstElementChild;}
let toastTimer,undoAction;
export function toast(message,undo){clearTimeout(toastTimer);undoAction=undo;const t=document.querySelector('#toast');t.replaceChildren();t.append(document.createTextNode(message));if(undo){const b=document.createElement('button');b.textContent='取り消す';b.onclick=()=>{undoAction?.();t.classList.remove('show');};t.append(b);}t.classList.add('show');toastTimer=setTimeout(()=>t.classList.remove('show'),undo?9000:4500);}
let invoker,onClose,currentCleanup;
export const isSheetOpen=()=>document.querySelector('#sheet').open;
export function closeSheet(){document.querySelector('#sheet').close();}
export function openSheet(title,content,{wide=false,onclose,setup}={}){
 const d=document.querySelector('#sheet'),wasOpen=d.open;currentCleanup?.();currentCleanup=null;if(!wasOpen)invoker=document.activeElement;onClose=onclose;
 d.className=wide?'sheet expanded':'sheet';d.innerHTML=`<header class="sheet-head"><button class="sheet-handle" aria-label="シートの高さを切り替える" aria-expanded="${wide}"><span></span></button><div class="sheet-heading"><h2 id="sheet-title">${esc(title)}</h2><div><button class="icon-button expand-sheet" aria-label="${wide?'小さく表示':'大きく表示'}">${icon(wide?'down':'up')}</button><button class="icon-button close-sheet" aria-label="閉じる">${icon('close')}</button></div></div></header><div class="sheet-body">${content}</div>`;
 const expand=()=>{d.classList.toggle('expanded');d.querySelector('.sheet-handle').setAttribute('aria-expanded',d.classList.contains('expanded'));};
 d.querySelector('.close-sheet').onclick=closeSheet;d.querySelector('.expand-sheet').onclick=expand;d.querySelector('.sheet-handle').onclick=expand;
 d.onclose=()=>{currentCleanup?.();currentCleanup=null;onClose?.();if(invoker?.isConnected)invoker.focus({preventScroll:true});};
 d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)d.close();}};
 let y=0;const handle=d.querySelector('.sheet-head');handle.onpointerdown=e=>{if(e.target.closest('button'))return;y=e.clientY;handle.setPointerCapture(e.pointerId);};handle.onpointerup=e=>{if(!y)return;const dy=e.clientY-y;y=0;if(dy>90)d.close();else if(dy<-35)d.classList.add('expanded');};
 if(!wasOpen)d.showModal();d.querySelector('.close-sheet').focus({preventScroll:true});currentCleanup=setup?.(d);
 return d;
}
export function empty(title,body){return `<div class="empty"><div class="empty-icon">${icon('book')}</div><h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;}
