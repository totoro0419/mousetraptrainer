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
export function mountStick(parent,scroller,jumpMine=()=>{},onScroll=()=>{},{settings={},modal=false}={}){
 const dock=el('<div class="stick-dock"><button type="button" class="stick-base" aria-label="スクロールスティック。上下ドラッグでスクロール、同方向へ素早く2回倒すと前後へジャンプ。Altと方向キーでもジャンプ。"></button></div>');
 const size=settings.size||62;
 dock.style.setProperty('--stick-size',size+'px');
 dock.style.left=(settings.x??50)+'%';
 dock.style.bottom=(modal?20:settings.bottom??92)+'px';
 dock.style.opacity=String(settings.opacity??.7);
 if(modal)dock.classList.add('stick-modal');
 parent.append(dock);
 const base=dock.querySelector('.stick-base'),detector=new FlickDetector();
 let frame=0,last=0,value=0,pointer=null,center=0,centerX=0,press=null,disposed=false;
 const blocked=()=>disposed||document.hidden||(modal?!parent.open:isSheetOpen());
 const typing=()=>document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]');
 const stop=()=>{value=0;pointer=null;cancelAnimationFrame(frame);frame=0;last=0;base.style.transform='';dock.classList.remove('active');};
 const tick=t=>{
  if(blocked()||typing()){stop();detector.reset();return;}
  const dt=last?Math.min(t-last,40):0;last=t;
  const magnitude=Math.max(0,(Math.abs(value)-.12)/.88);
  if(magnitude>0&&scroller.isConnected){
   onScroll();
   scroller.scrollTop+=Math.sign(value)*Math.pow(magnitude,1.7)*1050*(settings.speed??1)*dt/1000;
  }
  frame=requestAnimationFrame(tick);
 };
 const jump=direction=>{if(!blocked()&&!typing())jumpMine(direction);};
 const move=e=>{
  if(pointer!==e.pointerId)return;
  value=Math.max(-1,Math.min(1,(e.clientY-center)/(size*.52)));
  if(press)press.distance=Math.max(press.distance,Math.hypot(e.clientX-press.x,e.clientY-press.y));
  base.style.transform=`translate(${Math.max(-8,Math.min(8,(e.clientX-centerX)*.25))}px,${value*size*.32}px)`;
  const direction=detector.move(value,performance.now());if(direction)jump(direction);
 };
 base.onpointerdown=e=>{
  if(e.button!==0||blocked()||typing())return;
  e.preventDefault();
  const r=base.getBoundingClientRect();
  pointer=e.pointerId;center=r.top+r.height/2;centerX=r.left+r.width/2;
  press={x:e.clientX,y:e.clientY,distance:0,time:performance.now()};
  base.setPointerCapture(e.pointerId);dock.classList.add('active');move(e);
  if(!frame)frame=requestAnimationFrame(tick);
 };
 base.onpointermove=move;
 base.onpointerup=e=>{
  if(pointer!==e.pointerId)return;
  const direction=detector.finish(performance.now());
  if(direction)jump(direction);
  else if(press&&press.distance<6&&performance.now()-press.time<190&&scroller.isConnected){
   onScroll();scroller.scrollTop+=(press.y<center?-1:1)*100*(settings.speed??1);
  }
  press=null;stop();
 };
 base.onpointercancel=()=>{press=null;detector.reset();stop();};
 base.onlostpointercapture=()=>{if(pointer!==null)stop();};
 base.onkeydown=e=>{
  if(blocked()||typing()||!['ArrowUp','ArrowDown',' ','Enter'].includes(e.key))return;
  e.preventDefault();const direction=e.key==='ArrowUp'?-1:1;
  if(e.altKey)jump(direction);else if(scroller.isConnected){
   onScroll();scroller.scrollTop+=direction*scroller.clientHeight*.65*(settings.speed??1);
  }
 };
 const onVisibility=()=>{if(document.hidden){stop();detector.reset();}};
 document.addEventListener('visibilitychange',onVisibility);
 window.addEventListener('blur',stop);
 return ()=>{
  disposed=true;stop();dock.remove();
  document.removeEventListener('visibilitychange',onVisibility);
  window.removeEventListener('blur',stop);
 };
}
