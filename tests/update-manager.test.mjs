import assert from 'node:assert/strict';
import test from 'node:test';
import {createUpdateManager} from '../dist/modules/update-manager.js';

class Events extends EventTarget {
 fire(type,props={}){const event=new Event(type);Object.assign(event,props);this.dispatchEvent(event);}
}
function fixture({waiting=false,controlled=true,hidden=false,timeoutMs=1000,failSave=false}={}){
 const doc=new Events();doc.hidden=hidden;
 const win=new Events(),serviceWorker=new Events();serviceWorker.controller=controlled?{}:null;
 const registration=new Events();registration.installing=null;
 let updateCount=0,reloadCount=0,saveCount=0,activationCount=0,stage=[];
 const waitingWorker={postMessage(value){assert.equal(value,'activate');activationCount++;}};
 registration.waiting=waiting?waitingWorker:null;
 registration.update=async()=>{updateCount++;};
 serviceWorker.register=async(url,opts)=>{assert.equal(url,'./sw.js');assert.deepEqual(opts,{updateViaCache:'none'});return registration;};
 const manager=createUpdateManager({
  serviceWorker,doc,win,timeoutMs,
  beforeReload:()=>{saveCount++;return !failSave;},
  reload:()=>{reloadCount++;},
  onStage:value=>stage.push(value)
 });
 const counts=()=>({updateCount,reloadCount,saveCount,activationCount});
 return {doc,win,serviceWorker,registration,waitingWorker,manager,counts,stage};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

test('staged updates are applied before the app can display its home screen',async()=>{
 const f=fixture({waiting:true});const opening=f.manager.start();await flush();
 assert.equal(f.counts().activationCount,1);
 assert.equal(f.counts().saveCount,1);
 f.serviceWorker.fire('controllerchange');
 assert.equal(await opening,'reloading');
 assert.equal(f.counts().reloadCount,1);
 assert.equal(f.counts().updateCount,0,'ready update requires no redundant network check');
});

test('an update discovered during launch finishes installing before reload',async()=>{
 const f=fixture();let finishCheck;
 f.registration.update=()=>new Promise(resolve=>{finishCheck=resolve;});
 const opening=f.manager.start();await flush();
 const worker=new Events();worker.state='installing';f.registration.installing=worker;
 finishCheck();await flush();
 assert.ok(f.stage.includes('updating'));
 f.registration.waiting=f.waitingWorker;
 worker.state='installed';worker.fire('statechange');await flush();
 assert.equal(f.counts().activationCount,1);
 f.serviceWorker.fire('controllerchange');
 assert.equal(await opening,'reloading');
 assert.equal(f.counts().reloadCount,1);
});

test('no available update opens the already cached version after the check',async()=>{
 const f=fixture();assert.equal(await f.manager.start(),'ready');
 assert.equal(f.counts().activationCount,0);
 assert.equal(f.counts().reloadCount,0);
 assert.equal(f.counts().updateCount,1);
});

test('first installation does not block on download or force a reload',async()=>{
 const f=fixture({controlled:false});
 f.registration.update=()=>new Promise(()=>{});
 assert.equal(await f.manager.start(),'ready');
 assert.equal(f.counts().reloadCount,0);
});

test('a network check failure does not trap the user on the splash screen',async()=>{
 const f=fixture();f.registration.update=async()=>{throw Error('offline');};
 assert.equal(await f.manager.start(),'ready');
 assert.equal(f.counts().reloadCount,0);
});

test('an already interacting session or failed save is not interrupted',async()=>{
 const f=fixture({failSave:true,waiting:true});
 assert.equal(await f.manager.start(),'ready');
 assert.equal(f.counts().activationCount,0);
 const g=fixture({waiting:true});
 g.doc.fire('pointerdown');
 assert.equal(await g.manager.start(),'ready');
 assert.equal(g.counts().activationCount,0);
});

test('backgrounding and returning only stage updates; no surprise session reload',async()=>{
 const f=fixture();assert.equal(await f.manager.start(),'ready');
 f.doc.hidden=true;f.doc.fire('visibilitychange');
 f.doc.hidden=false;f.doc.fire('visibilitychange');
 await flush();
 assert.equal(f.counts().updateCount,2);
 assert.equal(f.counts().reloadCount,0);
});

test('a delayed server check yields the offline-capable app after timeout',async()=>{
 const f=fixture({timeoutMs:20});f.registration.update=()=>new Promise(()=>{});
 assert.equal(await f.manager.start(),'ready');
 assert.equal(f.counts().reloadCount,0);
});
