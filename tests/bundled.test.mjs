import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BUNDLED_SCRIPT,loadStartupScript} from '../dist/modules/bundled.js';
import {normalizeBundle} from '../dist/modules/data.js';

const raw=JSON.parse(await readFile(new URL('../dist/data/mousetrap.json',import.meta.url),'utf8'));
const real=normalizeBundle(raw);
const sample=normalizeBundle(JSON.parse(await readFile(new URL('./fixtures/script.json',import.meta.url),'utf8')));
function storage(initial=[]){
 const records=new Map(initial);
 return {records,get:async k=>records.get(k),atomicPut:async entries=>{for(const [k,v] of entries)records.set(k,v);}};
}
const load=async url=>{assert.equal(url,BUNDLED_SCRIPT.url);return raw;};
test('built-in production data contains all real lines, supplements, dictionary and PDF directions',()=>{
 assert.equal(real.sample,false);assert.equal(real.id,'mousetrap-private');assert.equal(real.title,'The Mousetrap');
 assert.equal(real.lines.length,1164);assert.equal(real.scenes.length,3);assert.equal(Object.keys(real.dictionary).length,578);assert.equal(real.lines.filter(l=>l.direction).length,450);
 assert.equal(real.warnings.length,0);assert.equal(new Set(real.lines.map(l=>l.id)).size,1164);
 for(const l of real.lines)for(const supplement of [real.translations,real.vocabulary,real.grammar])assert.ok(l.id in supplement);
});
test('first launch opens the actual production script without a file picker',async()=>{
 const s=storage(),result=await loadStartupScript(s,load);
 assert.equal(result.data.lines.length,1164);assert.equal(result.warning,'');
 assert.equal(s.records.get('active-script'),real.id);assert.deepEqual(s.records.get('script-list'),[real.id]);
});
test('old default sample migrates while learning and resume records stay unchanged',async()=>{
 const progress={'act1-scene1-speech-0001':{level:2,review:true}},resume={role:'MOLLIE',read:{id:'act1-scene1-speech-0001',offset:30}};
 const s=storage([['active-script',sample.id],[`script:${sample.id}`,sample],[`mt-progress:${real.id}`,progress],[`mt-state:${real.id}`,resume]]);
 assert.equal((await loadStartupScript(s,load)).data.id,real.id);
 assert.deepEqual(s.records.get(`mt-progress:${real.id}`),progress);assert.deepEqual(s.records.get(`mt-state:${real.id}`),resume);
 assert.equal(s.records.get(`script:${sample.id}`),sample);
});
test('a user-selected imported script remains active while the built-in script is added',async()=>{
 const imported={...sample,id:'my-script',sample:false},s=storage([['active-script',imported.id],[`script:${imported.id}`,imported],['script-list',[imported.id]]]);
 assert.equal((await loadStartupScript(s,load)).data.id,imported.id);assert.equal(s.records.get('active-script'),imported.id);
 assert.deepEqual(s.records.get('script-list'),[imported.id,real.id]);
});
test('legacy sample selection returns to the production script after removal',async()=>{
 const s=storage([['active-script',sample.id],[`script:${sample.id}`,sample],[`script:${real.id}`,real],['bundled-script-revision',BUNDLED_SCRIPT.revision]]);
 const result=await loadStartupScript(s,()=>{throw Error('must not fetch');});assert.equal(result.data.id,real.id);assert.equal(s.records.get('active-script'),real.id);
});
test('installed production script starts offline without fetching or losing records',async()=>{
 const s=storage([['active-script',real.id],[`script:${real.id}`,real],['bundled-script-revision',BUNDLED_SCRIPT.revision]]);
 assert.equal((await loadStartupScript(s,()=>{throw Error('must not fetch');})).data.id,real.id);
});
test('failed data update keeps the cached production and its revision',async()=>{
 const s=storage([['active-script',real.id],[`script:${real.id}`,real],['bundled-script-revision','older']]);
 const result=await loadStartupScript(s,async()=>{throw Error('offline');});assert.equal(result.data,real);assert.ok(result.warning);assert.equal(s.records.get('bundled-script-revision'),'older');
});
test('missing or invalid built-in content fails honestly instead of silently opening a sample',async()=>{
 const s=storage();await assert.rejects(loadStartupScript(s,async()=>{throw Error('404');}),/収録台本を読み込めません/);
 await assert.rejects(loadStartupScript(s,async()=>({...raw,script:{}})),/収録台本を読み込めません/);assert.equal(s.records.size,0);
});
