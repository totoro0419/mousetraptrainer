import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const workerSource=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
const appSource=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
const scope='https://example.test/mousetraptrainer/';

test('PWA updates: online uses the deployed CSS/JS, refreshes offline cache and preserves unrelated data',async()=>{
 const events=new Map(), stores=new Map(), fetches=[];
 stores.set('unrelated-cache',new Map([['some-key',new Response('personal data')]]));
 stores.set('mousetrap-shell-prior-release',new Map([[scope+'styles.css',new Response('old design')]]));
 let online=true,body='new design',skipWaitingCalls=0,claimed=0;
 const caches={
  async open(name){
   if(!stores.has(name))stores.set(name,new Map());
   const store=stores.get(name);
   return {
    async addAll(paths){for(const path of paths)store.set(new URL(path,scope).href,new Response('installed:'+path));},
    async put(url,response){store.set(String(url),response.clone());}
   };
  },
  async keys(){return [...stores.keys()];},
  async delete(name){return stores.delete(name);},
  async match(url){for(const store of stores.values()){const match=store.get(String(url));if(match)return match.clone();}}
 };
 const self={
  location:{hostname:'example.test',origin:'https://example.test'},
  registration:{scope},
  clients:{claim:async()=>{claimed++;}},
  skipWaiting:async()=>{skipWaitingCalls++;},
  addEventListener(type,handler){events.set(type,handler);}
 };
 const fetch=async(request,init)=>{
  fetches.push({url:request.url,cache:init?.cache});
  if(!online)throw Error('offline');
  return new Response(body,{status:200});
 };
 vm.runInNewContext(workerSource,{URL,Promise,self,caches,fetch,Response});
 async function dispatch(type,request){
  let response,wait=[];
  const event={request,
   respondWith(p){response=p;},
   waitUntil(p){wait.push(Promise.resolve(p));}
  };
  events.get(type)(event);
  const output=response?await response:undefined;
  await Promise.all(wait);
  return output;
 }
 await dispatch('install');
 assert.equal(skipWaitingCalls,1,'new SW activates without manual cache clearing');
 await dispatch('activate');
 assert.equal(claimed,1);
 assert.equal(stores.has('mousetrap-shell-prior-release'),false,'old app shell is deleted');
 assert.equal(stores.has('unrelated-cache'),true,'other caches are never removed');

 const cssRequest={url:scope+'styles.css',method:'GET',mode:'cors'};
 assert.equal(await (await dispatch('fetch',cssRequest)).text(),'new design');
 assert.equal(fetches.at(-1).cache,'no-store','live source bypasses HTTP cache');
 online=false;
 assert.equal(await (await dispatch('fetch',cssRequest)).text(),'new design','offline fallback uses refreshed design');

 online=true;body='subsequent release';
 assert.equal(await (await dispatch('fetch',cssRequest)).text(),'subsequent release',
  'unchanged worker revision cannot pin a stale stylesheet');
 online=false;
 assert.equal(await (await dispatch('fetch',cssRequest)).text(),'subsequent release',
  'latest stylesheet is cached after online access');

 const jsRequest={url:scope+'modules/reader.js',method:'GET',mode:'cors'};
 online=true;body='updated reader';assert.equal(await (await dispatch('fetch',jsRequest)).text(),'updated reader');
 online=false;assert.equal(await (await dispatch('fetch',jsRequest)).text(),'updated reader');
 const nav={url:scope+'index.html',method:'GET',mode:'navigate'};
 assert.equal(await (await dispatch('fetch',nav)).text(),'installed:./index.html','navigation works offline');
 online=true;body='new home';assert.equal(await (await dispatch('fetch',nav)).text(),'new home');
 online=false;assert.equal(await (await dispatch('fetch',nav)).text(),'new home');

 const outside={url:'https://other.example/private',method:'GET',mode:'cors'};
 assert.equal(await dispatch('fetch',outside),undefined,'unrelated origins are not intercepted');
 assert.match(appSource,/serviceWorker\.register\('\.\/sw\.js',\{updateViaCache:'none'\}\)/);
});

test('freshness strategy keeps full new UI in source and does not rollback previous features',async()=>{
 const css=await readFile(new URL('../dist/styles.css',import.meta.url),'utf8');
 const reader=await readFile(new URL('../dist/modules/reader.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(css,/LUMINOUS MINIMALISM V2/);
 assert.match(css,/\.reader-scroll \.speech\.mine\{background:#eef6ff/);
 assert.match(css,/\.speech-bookmark\[aria-pressed="true"\]/);
 assert.match(reader,/data-action="bookmark"/);
 assert.doesNotMatch(reader,/class="speech-analysis"/);
 assert.match(reader,/会話の流れ・文脈/);
 assert.match(reader,/そのセリフの解説/);
 assert.match(workerSource,/data\/mousetrap-dramaturgy\.ja\.json/);
 assert.match(workerSource,/modules\/dramaturgy\.js/);
 assert.match(reader,/analysisNeighbor/);
 assert.match(html,/styles\.css/);
 assert.match(workerSource,/const CACHE='mousetrap-shell-20261031-dramaturgy-v7'/);
});
