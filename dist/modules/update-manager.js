// Release checks occur before opening the learning UI. No manual update controls.
export function createUpdateManager({serviceWorker,doc,win,beforeReload,reload,onError=()=>{},onStage=()=>{},timeoutMs=8000}){
 let registration=null,started=false,opening=true,interacted=false,activating=false,reloading=false;
 let resolveActivation=null;
 const report=error=>{try{onError(error);}catch{}};
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const markInteracted=()=>{interacted=true;};
 function onControllerChange(){
  if(!activating||reloading)return;
  reloading=true;
  try{reload();}finally{resolveActivation?.('reloading');}
 }
 function waitForInstall(worker){
  if(!worker||worker.state==='installed'||worker.state==='redundant')return Promise.resolve();
  return new Promise(resolve=>{
   let settled=false;
   let timer;
   const finish=()=>{
    if(settled)return;
    settled=true;
    clearTimeout(timer);
    worker.removeEventListener?.('statechange',changed);
    resolve();
   };
   const changed=()=>{
    if(worker.state==='installed'||worker.state==='redundant')finish();
   };
   worker.addEventListener('statechange',changed);
   timer=setTimeout(finish,timeoutMs);
   changed();
  });
 }
 async function activateBeforeOpening(){
  if(!opening||!registration?.waiting||!serviceWorker.controller||doc.hidden||interacted)return 'ready';
  try{
   if(beforeReload()===false)return 'ready';
   activating=true;
   onStage('applying');
   const applied=new Promise(resolve=>{resolveActivation=resolve;});
   registration.waiting.postMessage('activate');
   // A broken worker must not leave the splash screen stuck indefinitely.
   await Promise.race([applied,sleep(3500)]);
   if(!reloading){reloading=true;reload();}
   return 'reloading';
  }catch(error){report(error);return 'ready';}
 }
 async function checkForOpening(){
  if(registration.waiting)return;
  try{
   await registration.update();
   if(registration.installing){
    onStage('updating');
    await waitForInstall(registration.installing);
   }
  }catch(error){report(error);}
 }
 function stageFutureUpdate(){
  if(!registration||doc.hidden)return;
  void registration.update().catch(report);
 }
 async function start(){
  if(started)return 'ready';
  started=true;
  if(!serviceWorker)return 'ready';
  for(const type of ['pointerdown','keydown','input'])doc.addEventListener(type,markInteracted,{capture:true,passive:true});
  serviceWorker.addEventListener('controllerchange',onControllerChange);
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&!opening)stageFutureUpdate();});
  win.addEventListener('pageshow',event=>{if(event.persisted&&!opening)stageFutureUpdate();});
  try{
   onStage('checking');
   registration=await Promise.race([
    serviceWorker.register('./sw.js',{updateViaCache:'none'}),
    sleep(timeoutMs).then(()=>null)
   ]);
   if(!registration)return 'ready';
   if(!serviceWorker.controller){
    // First installation: no active version needs replacement.
    opening=false;
    stageFutureUpdate();
    return 'ready';
   }
   // A staged release can be applied immediately, without an additional fetch.
   if(!registration.waiting){
    await Promise.race([checkForOpening(),sleep(timeoutMs)]);
   }
   const result=await activateBeforeOpening();
   opening=false;
   return result;
  }catch(error){
   report(error);
   opening=false;
   return 'ready';
  }finally{opening=false;}
 }
 return {start};
}
