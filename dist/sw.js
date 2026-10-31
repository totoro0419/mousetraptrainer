// Each release refreshes cached assets online, while retaining a complete offline shell.
const CACHE='mousetrap-shell-20261031-audio-v8';
const ASSETS=['./','./index.html','./styles.css','./app.js','./data/mousetrap.json','./data/mousetrap-dramaturgy.ja.json','./data/audio-manifest.json','./icon-v2-192.png','./icon-v2-512.png','./icon-v2-maskable-512.png','./manifest.webmanifest','./modules/data.js','./modules/bundled.js','./modules/dramaturgy.js','./modules/storage.js','./modules/ui.js','./modules/reader.js','./modules/role-menu.js','./modules/stick.js','./modules/session.js','./modules/audio.js','./modules/audio-library.js','./modules/audio-session.js','./modules/audio-controls.js','./modules/rehearsal.js'];
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
const AUDIO_CACHE='mousetrap-audio-v1';
const AUDIO_LIMIT=40;
let audioWrites=Promise.resolve();
async function audioResponse(request,event){
 const cache=await caches.open(AUDIO_CACHE),url=request.url;
 let full=await cache.match(url);
 if(!full){
  // Cache complete media, never a 206 fragment. Browsers may request arbitrary ranges.
  full=await fetch(url,{cache:'no-cache'});
  if(full.status!==200)return full;
  const copy=full.clone();
  audioWrites=audioWrites.catch(()=>{}).then(async()=>{
   await cache.put(url,copy);const keys=await cache.keys();
   for(const key of keys.slice(0,Math.max(0,keys.length-AUDIO_LIMIT)))await cache.delete(key);
  });event.waitUntil(audioWrites.catch(()=>{}));
 }
 const range=request.headers.get('range');if(!range)return full;
 const blob=await full.blob(),size=blob.size,m=/^bytes=(\d*)-(\d*)$/.exec(range);
 if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 const start=m[1]?+m[1]:Math.max(0,size-(+m[2])),end=m[1]?(m[2]?Math.min(+m[2],size-1):size-1):size-1;
 if(start>end||start>=size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
 return new Response(blob.slice(start,end+1),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${size}`,'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch',event=>{
 if(self.location.hostname==='terminal.local')return;
 const request=event.request,u=new URL(request.url);
 if(request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 if(u.pathname.startsWith(new URL('./audio/lines/',self.registration.scope).pathname)&&u.pathname.endsWith('.mp3')){event.respondWith(audioResponse(request,event));return;}
 if(request.mode==='navigate'){
  event.respondWith(freshOrCached(request,'./index.html',event));
  return;
 }
 const asset=ASSETS.find(path=>assetURL(path)===u.href);
 if(asset)event.respondWith(freshOrCached(request,asset,event));
});
