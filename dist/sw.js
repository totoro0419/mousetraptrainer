// Each release refreshes cached assets online, while retaining a complete offline shell.
const CACHE='mousetrap-shell-20261102-quick-sheet-complete-v15';
const ASSETS=['./','./index.html','./styles.css','./home-refresh.css','./app.js','./data/mousetrap.json','./data/mousetrap-dramaturgy.ja.json','./data/mousetrap-context.ja.json','./icon-v2-192.png','./icon-v2-512.png','./icon-v2-maskable-512.png','./manifest.webmanifest','./modules/data.js','./modules/bundled.js','./modules/dramaturgy.js','./modules/festival-countdown.js','./modules/home-progress.js','./modules/quick-memory.js','./modules/quick-context.js','./modules/quick-memory-view.js','./modules/storage.js','./modules/ui.js','./modules/reader.js','./modules/role-menu.js','./modules/stick.js','./modules/session.js','./modules/audio.js','./modules/rehearsal.js','./modules/offline-audio.js','./modules/notifications.js','./modules/daily-notifications.js','./data/notifications.json','./data/daily-editorial.json'];
const assetURL=path=>new URL(path,self.registration.scope).href;
const stored=async path=>caches.match(assetURL(path));
async function freshOrCached(request,path,event){
 try{
  // Bypass HTTP and service-worker caches: a successful deploy must not show old JS/CSS.
  const response=await fetch(request,{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  event.waitUntil(caches.open(CACHE).then(cache=>cache.put(assetURL(path),response.clone())));
  return response;
 }catch(err){
  const cached=await stored(path);
  if(cached)return cached;
  throw err;
 }
}
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mousetrap-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener('message',event=>{if(event.data==='activate')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 if(self.location.hostname==='terminal.local')return;
 const request=event.request,u=new URL(request.url);
 if(request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith(freshOrCached(request,'./index.html',event));
  return;
 }
 const asset=ASSETS.find(path=>assetURL(path)===u.href);
 if(asset){event.respondWith(freshOrCached(request,asset,event));return;}
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
