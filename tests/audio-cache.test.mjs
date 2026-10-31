import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
const scope='https://example.test/mousetraptrainer/';

test('PWA audio uses complete bounded on-demand cache, range responses and offline replay',async()=>{
 const events=new Map(),stores=new Map();let online=true,fetches=0;
 const key=r=>typeof r==='string'?r:r.url;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {
  match:async r=>store.get(key(r))?.clone(),put:async(r,v)=>store.set(key(r),v.clone()),keys:async()=>[...store.keys()],delete:async r=>store.delete(key(r))};},keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n),match:async r=>{for(const store of stores.values())if(store.has(key(r)))return store.get(key(r)).clone();}};
 vm.runInNewContext(source,{URL,Response,Request,Blob,console,caches,fetch:async()=>{fetches++;if(!online)throw Error('offline');return new Response('0123456789',{headers:{'Content-Type':'audio/mpeg'}});},self:{registration:{scope},location:new URL(scope),addEventListener:(n,fn)=>events.set(n,fn),skipWaiting(){},clients:{claim(){}}}});
 const get=async(path,range)=>{const pending=[];let response;events.get('fetch')({request:new Request(scope+path,{headers:range?{Range:range}:{}}),waitUntil:p=>pending.push(p),respondWith:p=>response=p});const result=await response;await Promise.all(pending);return result;};
 const file='audio/lines/act2/act2-speech-0001.mp3';
 let r=await get(file,'bytes=2-4');assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-4/10');assert.equal(await r.text(),'234');assert.equal(fetches,1);
 online=false;r=await get(file,'bytes=7-');assert.equal(await r.text(),'789');r=await get(file,'bytes=-2');assert.equal(await r.text(),'89');assert.equal(fetches,1);
 assert.equal((await get(file,'bytes=20-')).status,416);
 r=await get(file);assert.equal(r.status,200);assert.equal(await r.text(),'0123456789');
 online=true;for(let i=2;i<=42;i++)await get(`audio/lines/act2/act2-speech-${String(i).padStart(4,'0')}.mp3`);
 const audio=stores.get('mousetrap-audio-v1');assert.equal(audio.size,40);assert.equal(audio.has(scope+file),false);
 assert.doesNotMatch(source.match(/const ASSETS=\[([^;]+)/)[1],/speech-.*\.mp3/,'No MP3 is included in initial precache');
});
