import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBundle} from '../dist/modules/data.js';
import {validateQuickContexts,loadQuickContexts,QUICK_CONTEXT} from '../dist/modules/quick-context.js';
import {scriptFingerprint} from '../dist/modules/dramaturgy.js';

const [script,context]=await Promise.all([
 readFile(new URL('../dist/data/mousetrap.json',import.meta.url),'utf8').then(JSON.parse).then(normalizeBundle),
 readFile(new URL('../dist/data/mousetrap-context.ja.json',import.meta.url),'utf8').then(JSON.parse)
]);
test('all 1,164 situation entries match the actual source script and scene boundaries',async()=>{
 assert.equal(script.lines.length,1164);
 assert.equal(await scriptFingerprint(script),QUICK_CONTEXT.sourceFingerprint);
 const records=validateQuickContexts(context,script);
 assert.equal(Object.keys(records).length,1164);
 for(const line of script.lines){
  const item=records[line.id];
  assert.equal(item.scene,line.scene);
  assert.ok(item.setting.length>8);
  assert.ok(item.phase.length>4);
  assert.ok(item.cue.length>6);
  assert.ok(item.situation.length>8);
 }
});
test('each line has the right previous-line anchor, without crossing scenes',()=>{
 const contexts=validateQuickContexts(context,script);
 for(let i=0;i<script.lines.length;i++){
  const prev=script.lines[i-1],line=script.lines[i];
  assert.equal(contexts[line.id].previousLineId,prev?.scene===line.scene?prev.id:null);
 }
});
test('context refuses a changed script and does not contaminate imported scripts',async()=>{
 const bad={...script,id:'other-script'};
 let calls=0;
 const result=await loadQuickContexts({get:async()=>{throw Error('do not load')},put:async()=>{}},async()=>{calls++;return context;},bad);
 assert.equal(calls,0);
 assert.equal(result.data,bad);
 const wrong=structuredClone(context);wrong.entries[script.lines[1].id].scene='act2';
 assert.throws(()=>validateQuickContexts(wrong,script),/場面が一致/);
});
test('bundled situation data is loaded independently from psychology data',async()=>{
 const stores=new Map();
 const storage={put:async(k,v)=>stores.set(k,v),get:async k=>stores.get(k)};
 const fetchJSON=async url=>{assert.equal(url,'./data/mousetrap-context.ja.json');return context;};
 const result=await loadQuickContexts(storage,fetchJSON,script);
 assert.equal(result.warning,'');
 assert.deepEqual(result.data.quickContexts[script.lines[0].id],context.entries[script.lines[0].id]);
 assert.equal(stores.get(QUICK_CONTEXT.key).version,1);
 assert.equal(script.quickContexts,undefined,'source script was not mutated');
});
test('quick memory initially displays only 1+1 adjacent lines, with optional expansion',async()=>{
 const view=await readFile(new URL('../dist/modules/quick-memory-view.js',import.meta.url),'utf8');
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 const worker=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
 assert.match(view,/let before=1,after=1/);
 assert.match(view,/index-before/);
 assert.match(view,/index\+after\+1/);
 assert.match(view,/data-more="before"/);
 assert.match(view,/data-more="after"/);
 assert.match(view,/quick-memory-context-situation/);
 assert.match(app,/loadQuickContexts\(storage,fetchData/);
 assert.match(worker,/\.\/data\/mousetrap-context\.ja\.json/);
 assert.match(worker,/\.\/modules\/quick-context\.js/);
});

test('cached situation explanations are displayed without a network request while updates run later',async()=>{
 const store=new Map([[QUICK_CONTEXT.key,context]]);
 let requestCount=0;
 const storage={get:async key=>store.get(key),put:async(key,value)=>store.set(key,value)};
 const load=async()=>{requestCount++;return context;};
 const first=await loadQuickContexts(storage,load,script,{preferSaved:true});
 assert.equal(first.fromCache,true);
 assert.equal(requestCount,0);
 assert.equal(first.data.quickContexts[script.lines[0].id].scene,script.lines[0].scene);
 await loadQuickContexts(storage,load,script);
 assert.equal(requestCount,1,'an explicit background refresh still checks the server');
});
