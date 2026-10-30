const CACHE='mousetrap-shell-20261030-5';
const ASSETS=['./','./index.html','./styles.css','./app.js','./data/mousetrap.json','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./modules/data.js','./modules/bundled.js','./modules/storage.js','./modules/ui.js','./modules/reader.js','./modules/stick.js','./modules/session.js','./modules/audio.js','./modules/rehearsal.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mousetrap-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='activate')self.skipWaiting();});
self.addEventListener('fetch',event=>{if(self.location.hostname==='terminal.local')return;const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./index.html',self.registration.scope))));
 else if(ASSETS.some(p=>new URL(p,self.registration.scope).href===u.href))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
