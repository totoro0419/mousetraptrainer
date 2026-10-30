import {el,isSheetOpen} from './ui.js';
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
export function mountStick(parent,scroller,jumpMine,onScroll=()=>{}){
 const dock=el('<div class="stick-dock"><button type="button" class="stick-base" aria-label="台本をスクロール。上下にドラッグ、上下半分のタップ、方向キーで移動。同じ方向へ素早く2回倒すと自分のセリフへ移動。"></button></div>');parent.append(dock);const base=dock.querySelector('.stick-base'),detector=new FlickDetector();let frame=0,last=0,value=0,pointer=null,center=0,centerX=0,press=null;
 const stop=()=>{value=0;pointer=null;cancelAnimationFrame(frame);frame=0;last=0;base.style.transform='';dock.classList.remove('active');};
 const tick=t=>{if(isSheetOpen()||document.hidden){stop();detector.reset();return;}const dt=last?Math.min(t-last,40):0;last=t;const magnitude=Math.max(0,(Math.abs(value)-.12)/.88);if(magnitude>0)onScroll();scroller.scrollTop+=Math.sign(value)*Math.pow(magnitude,1.7)*1050*dt/1000;frame=requestAnimationFrame(tick);};
 const move=e=>{if(pointer!==e.pointerId)return;value=Math.max(-1,Math.min(1,(e.clientY-center)/32));if(press)press.distance=Math.max(press.distance,Math.hypot(e.clientX-press.x,e.clientY-press.y));base.style.transform=`translate(${Math.max(-8,Math.min(8,(e.clientX-centerX)*.25))}px,${value*20}px)`;const jump=detector.move(value,performance.now());if(jump)jumpMine(jump);};
 base.onpointerdown=e=>{if(e.button!==0||isSheetOpen())return;e.preventDefault();const r=base.getBoundingClientRect();pointer=e.pointerId;center=r.top+r.height/2;centerX=r.left+r.width/2;press={x:e.clientX,y:e.clientY,distance:0,time:performance.now()};base.setPointerCapture(e.pointerId);dock.classList.add('active');move(e);if(!frame)frame=requestAnimationFrame(tick);};base.onpointermove=move;base.onpointerup=e=>{if(pointer!==e.pointerId)return;const jump=detector.finish(performance.now());if(jump)jumpMine(jump);else if(press&&press.distance<6&&performance.now()-press.time<190){onScroll();scroller.scrollTop+=(press.y<center?-1:1)*100;}press=null;stop();};base.onpointercancel=()=>{press=null;detector.reset();stop();};base.onlostpointercapture=()=>{if(pointer!==null)stop();};
 base.onkeydown=e=>{if(isSheetOpen()||!['ArrowUp','ArrowDown',' ','Enter'].includes(e.key))return;e.preventDefault();const direction=e.key==='ArrowUp'?-1:1;if(e.altKey)jumpMine(direction);else{onScroll();scroller.scrollTop+=direction*scroller.clientHeight*.65;}};
 const onVisibility=()=>{if(document.hidden){stop();detector.reset();}};document.addEventListener('visibilitychange',onVisibility);window.addEventListener('blur',stop);
 return ()=>{stop();dock.remove();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('blur',stop);};
}
