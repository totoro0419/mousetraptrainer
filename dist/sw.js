// Release-pinned, offline-first app shell. The build stamps file digests and a release ID.
const CACHE='mousetrap-shell-bootstrap';
const ASSETS=['./','./index.html','./styles.css','./home-refresh.css','./theme.css','./app.js','./data/mousetrap.json','./data/dictionary-nouns.ja.json','./data/dictionary-general.ja.json','./data/mousetrap-dramaturgy.ja.json','./data/mousetrap-context.ja.json','./icon-v2-192.png','./icon-v2-512.png','./icon-v2-maskable-512.png','./manifest.webmanifest','./modules/data.js','./modules/bundled.js','./modules/dramaturgy.js','./modules/festival-countdown.js','./modules/home-progress.js','./modules/quick-memory.js','./modules/quick-context.js','./modules/quick-memory-view.js','./modules/storage.js','./modules/theme.js','./modules/ui.js','./modules/reader.js','./modules/update-manager.js','./modules/role-menu.js','./modules/stick.js','./modules/stick-settings.js','./modules/stick-controller.js','./modules/cloze.js','./modules/cloze-view.js','./modules/session.js','./modules/audio.js','./modules/rehearsal.js','./modules/offline-audio.js','./modules/notifications.js','./modules/daily-notifications.js','./data/notifications.json','./data/daily-editorial.json'];
const ASSET_REVISIONS={};
const CACHE_PREFIX='mousetrap-shell-';
const META_PATH='./__release-revisions.json';
const assetURL=path=>new URL(path,self.registration.scope).href;
const lookup=path=>caches.match(assetURL(path));

self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const oldNames=(await caches.keys()).filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE);
 let oldCache=null,oldRevisions={};
 for(const name of oldNames){
  const candidate=await caches.open(name);
  const stored=await candidate.match(assetURL(META_PATH));
  if(!stored)continue;
  try{oldRevisions=await stored.json();oldCache=candidate;break;}catch{}
 }
 // Reuse bytes only when the previous and new content hashes agree.
 await Promise.all(ASSETS.map(async path=>{
  const url=assetURL(path);
  if(oldCache&&oldRevisions[path]&&oldRevisions[path]===ASSET_REVISIONS[path]){
   const saved=await oldCache.match(url);
   if(saved){await cache.put(url,saved);return;}
  }
  const response=await fetch(url,{cache:'reload'});
  if(!response.ok)throw Error('Could not install '+path+' (HTTP '+response.status+')');
  await cache.put(url,response);
 }));
 await cache.put(assetURL(META_PATH),new Response(JSON.stringify(ASSET_REVISIONS),{headers:{'Content-Type':'application/json'}}));
 // Upgrades wait for the window to request activation at a safe opening.
 if(!self.registration.active)await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));

self.addEventListener('message',event=>{if(event.data==='activate')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 if(self.location.hostname==='terminal.local')return;
 const request=event.request,u=new URL(request.url);
 if(request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   // Display the last verified release immediately; checking for updates is independent.
   const cached=await lookup('./index.html');
   if(cached)return cached;
   try{return await fetch(request);}catch(err){
    const fallback=await lookup('./');
    if(fallback)return fallback;
    throw err;
   }
  })());
  return;
 }
 const asset=ASSETS.find(path=>assetURL(path)===u.href);
 if(asset){
  event.respondWith((async()=>{
   const cached=await lookup(asset);
   if(cached)return cached;
   const response=await fetch(request);
   if(response.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put(u.href,response.clone())));
   return response;
  })());
  return;
 }
 if(u.href.startsWith(assetURL('./audio/'))){
  // Bulk installer writes verified clips to the shared cache itself; avoid duplicate writes.
  if(request.headers.get('X-Mousetrap-Bulk-Audio')==='1'){
   event.respondWith(fetch(request));
   return;
  }
  event.respondWith((async()=>{
   const cache=await caches.open('mousetrap-audio-runtime-v1');
   try{
    const response=await fetch(request);
    if(response.status===200&&!request.headers.has('range'))event.waitUntil(cache.put(request,response.clone()));
    return response;
   }catch(err){
    const cached=await cache.match(request);
    if(cached)return cached;
    throw err;
   }
  })());
 }
});
