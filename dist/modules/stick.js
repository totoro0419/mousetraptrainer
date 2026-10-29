import {el,icon,isSheetOpen} from './ui.js';
// Two short excursions, separated by neutral, form one jump. Holds never count.
export class FlickDetector{
 constructor(){this.excursion=null;this.previous=null;}
 move(value,time){const direction=Math.abs(value)>.46?Math.sign(value):0;
  if(direction&&!this.excursion)this.excursion={direction,start:time};
  if(this.excursion&&direction&&direction!==this.excursion.direction){this.excursion=null;this.previous=null;}
  if(!direction&&this.excursion&&Math.abs(value)<.18)return this.finish(time);
  return 0;
 }
 finish(time){const e=this.excursion;this.excursion=null;if(!e)return 0;
  if(time-e.start>190){this.previous=null;return 0;}
  const p=this.previous;this.previous={direction:e.direction,end:time};
  if(p&&p.direction===e.direction&&time-p.end>45&&time-p.end<360){this.previous=null;return e.direction;}return 0;
 }
 reset(){this.excursion=null;this.previous=null;}
}
export function mountStick(parent,scroller,jumpMine){
 const dock=el(`<div class="stick-dock" aria-label="台本スクロール補助"><div class="stick-side"><button aria-label="1画面上へ" data-page="-1">${icon('up')}</button><button class="stick-jump" aria-label="前の自分のセリフへ" data-jump="-1">自分↑</button></div><div class="stick-base" role="group" aria-label="上下へ倒してスクロール。同方向へ素早く2回倒すと自分のセリフへ移動"><div class="stick-knob">${icon('more')}</div></div><div class="stick-side"><button aria-label="1画面下へ" data-page="1">${icon('down')}</button><button class="stick-jump" aria-label="次の自分のセリフへ" data-jump="1">自分↓</button></div></div>`);parent.append(dock);const base=dock.querySelector('.stick-base'),knob=dock.querySelector('.stick-knob'),detector=new FlickDetector();let frame=0,last=0,value=0,pointer=null,center=0;
 const stop=()=>{value=0;pointer=null;cancelAnimationFrame(frame);frame=0;last=0;knob.style.transform='';dock.classList.remove('active');};
 const tick=t=>{if(isSheetOpen()||document.hidden){stop();detector.reset();return;}const dt=last?Math.min(t-last,40):0;last=t;const magnitude=Math.max(0,(Math.abs(value)-.12)/.88);scroller.scrollTop+=Math.sign(value)*Math.pow(magnitude,1.7)*1050*dt/1000;frame=requestAnimationFrame(tick);};
 const move=e=>{if(pointer!==e.pointerId)return;value=Math.max(-1,Math.min(1,(e.clientY-center)/32));knob.style.transform=`translate(${Math.max(-7,Math.min(7,(e.clientX-base.getBoundingClientRect().left-36)*.18))}px,${value*22}px)`;const jump=detector.move(value,performance.now());if(jump)jumpMine(jump);};
 base.onpointerdown=e=>{if(e.button!==0||isSheetOpen())return;e.preventDefault();pointer=e.pointerId;center=base.getBoundingClientRect().top+36;base.setPointerCapture(e.pointerId);dock.classList.add('active');move(e);if(!frame)frame=requestAnimationFrame(tick);};base.onpointermove=move;base.onpointerup=e=>{if(pointer!==e.pointerId)return;const jump=detector.finish(performance.now());if(jump)jumpMine(jump);stop();};base.onpointercancel=()=>{detector.reset();stop();};base.onlostpointercapture=()=>{if(pointer!==null)stop();};
 dock.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{if(!isSheetOpen())scroller.scrollBy({top:+b.dataset.page*scroller.clientHeight*.75,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});dock.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{if(!isSheetOpen())jumpMine(+b.dataset.jump);});
 const onVisibility=()=>{if(document.hidden){stop();detector.reset();}};document.addEventListener('visibilitychange',onVisibility);window.addEventListener('blur',stop);
 return ()=>{stop();dock.remove();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('blur',stop);};
}
