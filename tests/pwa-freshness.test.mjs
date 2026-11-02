import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
const scope='https://example.test/mousetraptrainer/';
const revisions=JSON.parse(sw.match(/const ASSET_REVISIONS=([^\n]*);/)[1]);
const assets=Object.keys(revisions);
const release=sw.match(/const CACHE='([^']+)';/)[1];

function harness({upgrade=true}={}){
 const stores=new Map(),events=new Map(),fetched=[];
 stores.set('unrelated-cache',new Map([['private',new Response('keep me')]]));
 let online=true,claimed=0,skipped=0;
 if(upgrade){
  const old={...revisions,'./styles.css':'prior-styles-digest'};
  const content=new Map(Object.keys(revisions).map(p=>[new URL(p,scope).href,new Response('prior:'+p)]));
  content.set(new URL('./__release-revisions.json',scope).href,new Response(JSON.stringify(old)));
  stores.set('mousetrap-shell-prior-release',content);
 }
 const caches={
  async open(name){
   if(!stores.has(name))stores.set(name,new Map());
   const store=stores.get(name);
   return {
    match:async url=>store.get(typeof url==='string'?url:url.url)?.clone(),
    put:async(url,value)=>{store.set(typeof url==='string'?url:url.url,value.clone());},
    keys:async()=>[...store.keys()].map(url=>({url}))
   };
  },
  async keys(){return [...stores.keys()];},
  async delete(name){return stores.delete(name);},
  async match(url){
   const key=typeof url==='string'?url:url.url;
   for(const store of stores.values()){const value=store.get(key);if(value)return value.clone();}
  }
 };
 const self={
  location:{hostname:'example.test',origin:'https://example.test'},
  registration:{scope,active:upgrade?{}:null},
  clients:{claim:async()=>{claimed++;}},
  skipWaiting:async()=>{skipped++;},
  addEventListener(name,fn){events.set(name,fn);}
 };
 const fetch=async(url,options)=>{
  const target=typeof url==='string'?url:url.url;
  fetched.push({url:target,cache:options?.cache||null});
  if(!online)throw Error('offline');
  return new Response('deployed:'+target,{status:200});
 };
 vm.runInNewContext(sw,{URL,Response,Request,Headers,Promise,self,caches,fetch});
 async function dispatch(type,request){
  const waits=[];let response;
  const event={request,data:request?.data,waitUntil(p){waits.push(Promise.resolve(p));},respondWith(p){response=p;}};
  events.get(type)(event);
  const answer=response?await response:undefined;
  await Promise.all(waits);
  return answer;
 }
 return {dispatch,stores,fetched,events,get claimed(){return claimed;},get skipped(){return skipped;},setOnline(value){online=value;}};
}

test('updated release downloads changed assets only, reuses verified bytes and remains waiting',async()=>{
 const h=harness();
 await h.dispatch('install');
 assert.equal(h.skipped,0,'an update must not force itself on an active reader');
 const requested=h.fetched.filter(x=>x.cache==='reload');
 assert.deepEqual(requested.map(x=>x.url),[new URL('./styles.css',scope).href]);
 assert.equal(await h.stores.get(release).get(new URL('./modules/reader.js',scope).href).text(),'prior:./modules/reader.js');
 assert.equal(await h.stores.get(release).get(new URL('./styles.css',scope).href).text(),'deployed:'+new URL('./styles.css',scope).href);
 assert.ok(h.stores.has('mousetrap-shell-prior-release'),'old release is retained until activation');
 await h.dispatch('activate');
 assert.equal(h.claimed,1);
 assert.equal(h.stores.has('mousetrap-shell-prior-release'),false);
 assert.equal(h.stores.has('unrelated-cache'),true);
 h.dispatch('message',{data:'activate'});
 assert.equal(h.skipped,1,'user-triggered activation is supported');
});

test('repeated offline launches serve the same verified HTML, JS and CSS without network',async()=>{
 const h=harness();
 await h.dispatch('install');
 await h.dispatch('activate');
 h.setOnline(false);
 const before=h.fetched.length;
 const nav=await h.dispatch('fetch',{url:scope,mode:'navigate',method:'GET'});
 assert.equal(await nav.text(),'prior:./index.html');
 const js=await h.dispatch('fetch',{url:scope+'modules/reader.js',mode:'cors',method:'GET'});
 assert.equal(await js.text(),'prior:./modules/reader.js');
 const css=await h.dispatch('fetch',{url:scope+'styles.css',mode:'cors',method:'GET'});
 assert.match(await css.text(),/^deployed:/);
 assert.equal(h.fetched.length,before,'cached app shell must not wait for network');
});

test('the first installation still pre-caches every offline asset',async()=>{
 const h=harness({upgrade:false});
 await h.dispatch('install');
 assert.equal(h.skipped,1,'first install may activate immediately');
 assert.equal(h.fetched.filter(x=>x.cache==='reload').length,assets.length);
 assert.ok(assets.includes('./data/mousetrap.json'));
 assert.ok(assets.includes('./data/mousetrap-context.ja.json'));
 assert.ok(assets.includes('./modules/rehearsal.js'));
 await h.dispatch('activate');
 h.setOnline(false);
 const nav=await h.dispatch('fetch',{url:scope+'index.html',method:'GET',mode:'navigate'});
 assert.match(await nav.text(),/^deployed:/);
});

test('hosted audio retains on-demand network and offline fallback',async()=>{
 const h=harness();
 await h.dispatch('install');await h.dispatch('activate');
 const url=scope+'audio/lines/act2/act2-speech-0001.mp3';
 const request={url,method:'GET',mode:'cors',headers:new Headers()};
 assert.equal(await (await h.dispatch('fetch',request)).text(),'deployed:'+url);
 assert.ok(h.stores.get('mousetrap-audio-runtime-v1').has(url));
 h.setOnline(false);
 assert.equal(await (await h.dispatch('fetch',request)).text(),'deployed:'+url);
 const before=h.fetched.length;
 await h.dispatch('fetch',{url:'https://other.example/private',method:'GET',mode:'cors',headers:new Headers()});
 assert.equal(h.fetched.length,before);
});

test('startup is not blocked on optional explanations, context or service worker registration',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/class="boot-screen"/);
 assert.match(html,/class="boot-status"/);
 assert.match(html,/prefers-reduced-motion/);
 const worker=app.indexOf("const updateStatus=await registerForUpdates();");
 const anchor=app.indexOf("const startup=await loadStartupScript(storage,fetchData)",worker);
 const render=app.indexOf("await render();",anchor);
 const supplements=app.indexOf("prepareSupplements(data);",anchor);
 assert.ok(worker>=0&&anchor>worker&&render>anchor&&supplements>render,'update gate must run before rendering app');
 assert.match(app,/if\(updateStatus!=='reloading'\)/);
 assert.doesNotMatch(app,/data-action="update"|function checkUpdate\(/);
 assert.match(app,/import \{createUpdateManager\} from '\.\/modules\/update-manager\.js';/);
 assert.match(app,/updateManager=createUpdateManager\(/);
 assert.match(app,/loadQuickContexts\(storage,fetchData,target,\{preferSaved:true\}\)/);
 const manager=await readFile(new URL('../dist/modules/update-manager.js',import.meta.url),'utf8');
 assert.match(manager,/serviceWorker\.register\('\.\/sw\.js',\s*\{\s*updateViaCache:\s*'none'\s*\}\)/);
});
