import assert from 'node:assert/strict';
import test from 'node:test';
import {createUpdateManager} from '../dist/modules/update-manager.js';

class Events extends EventTarget {
  fire(type, props = {}) { const event = new Event(type); Object.assign(event, props); this.dispatchEvent(event); }
}
function fixture({waiting = false, controlled = true, hidden = false} = {}) {
  const doc = new Events(); doc.hidden = hidden;
  const win = new Events();
  const serviceWorker = new Events(); serviceWorker.controller = controlled ? {} : null;
  let updateCount = 0; let reloadCount = 0; let saveCount = 0; let activationCount = 0;
  const registration = new Events();
  const activeWorker = {postMessage(value) { assert.equal(value, 'activate'); activationCount++; }};
  registration.waiting = waiting ? activeWorker : null;
  registration.installing = null;
  registration.update = async () => { updateCount++; };
  serviceWorker.register = async (url, options) => {
    assert.equal(url, './sw.js'); assert.deepEqual(options, {updateViaCache: 'none'}); return registration;
  };
  const updateManager = createUpdateManager({serviceWorker, doc, win, beforeReload:() => {saveCount++;return true;},reload:() => {reloadCount++;}});
  return { doc, win, serviceWorker, registration, activeWorker, updateManager,
    counts:() => ({updateCount, reloadCount, saveCount, activationCount}) };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('already waiting update is automatically activated on opening, reloads exactly once', async () => {
 const f = fixture({waiting:true}); await f.updateManager.start(); await flush();
 assert.equal(f.counts().activationCount,1);assert.equal(f.counts().saveCount,1);
 f.serviceWorker.fire('controllerchange'); f.serviceWorker.fire('controllerchange');
 assert.equal(f.counts().reloadCount,1);assert.equal(f.counts().saveCount,2);
});

test('update installed shortly after opening applies without button clicks', async () => {
 const f=fixture();await f.updateManager.start();
 const worker=new Events();worker.state='installing';
 f.registration.installing=worker;f.registration.fire('updatefound');
 f.registration.waiting=f.activeWorker;worker.state='installed';worker.fire('statechange');
 assert.equal(f.counts().activationCount,1);
});

test('interactions defer an update until reopening the app', async () => {
 const f=fixture();await f.updateManager.start();f.doc.fire('pointerdown');
 f.registration.waiting=f.activeWorker; await f.updateManager.check();
 assert.equal(f.counts().activationCount,0);
 f.doc.hidden=true;f.doc.fire('visibilitychange');
 f.doc.hidden=false;f.doc.fire('visibilitychange');
 assert.equal(f.counts().activationCount,1);
});

test('keyboard interactions, hidden tabs and first installation do not interrupt learning', async () => {
 const fresh=fixture({waiting:true,controlled:false});await fresh.updateManager.start();
 assert.equal(fresh.counts().activationCount,0);
 const hidden=fixture({waiting:true,hidden:true});await hidden.updateManager.start();
 assert.equal(hidden.counts().activationCount,0);
 hidden.doc.hidden=false;hidden.doc.fire('visibilitychange');
 assert.equal(hidden.counts().activationCount,1);
 const keyboard=fixture();await keyboard.updateManager.start();keyboard.doc.fire('keydown');
 keyboard.registration.waiting=keyboard.activeWorker;await keyboard.updateManager.check();
 assert.equal(keyboard.counts().activationCount,0);
 keyboard.win.fire('pageshow',{persisted:true});
 assert.equal(keyboard.counts().activationCount,1);
});

test('failed persistence and failed network checks preserve the working release', async () => {
 const f=fixture();
 const manager=createUpdateManager({serviceWorker:f.serviceWorker,doc:f.doc,win:f.win,beforeReload:()=>false,reload:()=>assert.fail('unexpected reload')});
 await manager.start();f.registration.waiting=f.activeWorker;await manager.check();assert.equal(f.counts().activationCount,0);
 f.registration.update=async()=>{throw Error('offline')};assert.equal(await manager.check(),false);
});
