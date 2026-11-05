import {mountStick} from './stick.js';
import {stickEnabled} from './stick-settings.js';

// Single route-scoped owner of stick lifecycle, scroll target, and modal handoff.
export function createStickController(shell,readSettings){
 let target=null,destroyMain=()=>{},destroyModal=()=>{},disposed=false;
 const sheet=document.querySelector('#sheet');
 function mountMain(){
  destroyMain();destroyMain=()=>{};
  if(disposed||!target||!stickEnabled(readSettings(),target.screen))return;
  destroyMain=mountStick(shell,target.scroller,target.jump,target.onScroll,{settings:readSettings()});
 }
 function mountModal(){
  destroyModal();destroyModal=()=>{};
  if(disposed||!sheet.open)return;
  const screen=sheet.dataset.stickScreen||'';
  const body=sheet.querySelector('.sheet-body');
  if(!body||!stickEnabled(readSettings(),screen))return;
  destroyModal=mountStick(sheet,body,()=>{},()=>{},{settings:readSettings(),modal:true});
 }
 const opened=()=>{mountModal();};
 const closed=()=>{destroyModal();destroyModal=()=>{};};
 document.addEventListener('mousetrap:sheetopen',opened);
 sheet.addEventListener('close',closed);
 return {
  setTarget(screen,scroller,jump=()=>{},onScroll=()=>{}){
   target=scroller?{screen,scroller,jump,onScroll}:null;
   mountMain();
  },
  reconfigure(){mountMain();mountModal();},
  destroy(){
   disposed=true;destroyMain();destroyModal();
   document.removeEventListener('mousetrap:sheetopen',opened);
   sheet.removeEventListener('close',closed);
  }
 };
}
