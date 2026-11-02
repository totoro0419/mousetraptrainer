import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('service worker keeps the built-in production script and all offline app modules',async()=>{
 const worker=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
 for(const asset of ['./index.html','./styles.css','./app.js','./data/mousetrap.json','./data/mousetrap-dramaturgy.ja.json','./data/mousetrap-context.ja.json','./modules/bundled.js','./modules/reader.js','./modules/rehearsal.js']){
  assert.ok(worker.includes("'"+asset+"'"),asset+' must be included in the offline shell');
 }
 assert.match(worker,/const CACHE='mousetrap-shell-[^']+'/);
 assert.match(worker,/const ASSET_REVISIONS={/);
 assert.match(worker,/if(!self.registration.active)await self.skipWaiting()/);
});
