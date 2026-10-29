import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
test('service worker caches shell, serves offline navigation and preserves unrelated caches',async()=>{
 const listeners={},items=new Map(),names=new Set(['unrelated-cache','mousetrap-shell-old']);let installed=[];
 const scope='https://example.test/mousetraptrainer/';
 const context={URL,Promise,self:{location:{origin:'https://example.test',hostname:'example.test'},registration:{scope},clients:{claim:async()=>{}},skipWaiting(){},addEventListener(n,f){listeners[n]=f;}},caches:{open:async name=>{names.add(name);return {addAll:async urls=>{installed=urls;for(const u of urls)items.set(new URL(u,scope).href,'cached:'+u);}};},keys:async()=>[...names],delete:async k=>names.delete(k),match:async key=>items.get(String(key.url||key))},fetch:async()=>{throw Error('offline');}};
 vm.runInNewContext(await readFile(new URL('../dist/sw.js',import.meta.url),'utf8'),context);
 let pending;listeners.install({waitUntil(p){pending=p;}});await pending;assert.ok(installed.includes('./modules/rehearsal.js'));assert.ok(installed.includes('./icon-512.png'));
 listeners.activate({waitUntil(p){pending=p;}});await pending;assert.ok(names.has('unrelated-cache'));assert.ok(!names.has('mousetrap-shell-old'));
 listeners.fetch({request:{url:scope+'index.html',mode:'navigate',method:'GET'},respondWith(p){pending=p;}});assert.equal(await pending,'cached:./index.html');
 listeners.fetch({request:{url:scope+'modules/reader.js',mode:'cors',method:'GET'},respondWith(p){pending=p;}});assert.equal(await pending,'cached:./modules/reader.js');
 let intercepted=false;listeners.fetch({request:{url:'https://other.test/private',mode:'cors',method:'GET'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
});
