import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeBundle} from '../dist/modules/data.js';
import {analysisNarrative} from '../dist/modules/reader.js';
import {DRAMATURGY,loadDramaturgy,validateDramaturgyEntries,scriptFingerprint,fingerprint,sha256Bytes} from '../dist/modules/dramaturgy.js';
import {esc} from '../dist/modules/ui.js';
const raw=JSON.parse(await readFile(new URL('../dist/data/mousetrap.json',import.meta.url),'utf8'));
const data=normalizeBundle(raw);
const dataText=await readFile(new URL('../dist/data/mousetrap-dramaturgy.ja.json',import.meta.url),'utf8');
const entries=JSON.parse(dataText);
const digest=v=>createHash('sha256').update(v).digest('hex');
function storage(initial=[]){
 const records=new Map(initial),writes=[];
 return {records,writes,get:async key=>records.get(key),atomicPut:async pairs=>{writes.push(...pairs);for(const [k,v] of pairs)records.set(k,v);}};
}
const fetchJSON=async url=>{assert.equal(url,DRAMATURGY.url);return structuredClone(entries);};
const offline=async()=>{throw Error('offline');};

test('runtime release fingerprints bind both exact source lines and reviewed content',async()=>{
 assert.equal(await scriptFingerprint(data),DRAMATURGY.sourceFingerprint);
 assert.equal(await fingerprint(entries),DRAMATURGY.contentFingerprint);
 assert.equal(digest(dataText),DRAMATURGY.revision);
 for(const text of ['', 'abc','あいうえお🙂','x'.repeat(55),'x'.repeat(56),'x'.repeat(64),dataText]){
  assert.equal(sha256Bytes(new TextEncoder().encode(text)),digest(text));
 }
});
test('first enrichment joins every ID without changing translations, dictionary or learning records',async()=>{
 const progress={one:{level:2,review:true,bookmarked:true}},state={role:'MOLLIE',read:{id:data.lines[4].id},notes:{}};
 const s=storage([['mt-progress:'+data.id,progress],['mt-state:'+data.id,state]]),before=JSON.stringify(data);
 const result=await loadDramaturgy(s,fetchJSON,data);
 assert.equal(result.warning,'');assert.equal(Object.keys(result.data.dramaturgy).length,1164);
 assert.equal(JSON.stringify(data),before);
 for(const key of ['lines','translations','vocabulary','grammar','dictionary'])assert.equal(result.data[key],data[key]);
 assert.deepEqual(s.writes.map(([key])=>key),[DRAMATURGY.key]);
 assert.equal(s.records.get('mt-progress:'+data.id),progress);assert.equal(s.records.get('mt-state:'+data.id),state);
});
test('same-version offline launch uses the exact saved explanations without network',async()=>{
 const s=storage([[DRAMATURGY.key,{revision:DRAMATURGY.revision,entries}]]);
 const result=await loadDramaturgy(s,offline,data);
 assert.equal(result.data.dramaturgy,entries);assert.equal(result.warning,'');assert.equal(s.writes.length,0);
});
test('online update replaces prior sidecar; failed or stale updates retain the old revision honestly',async()=>{
 const oldEntries=structuredClone(entries);oldEntries[data.lines[0].id].explanation='以前の解説を保持する検査用文章。';
 const saved={revision:'previous',entries:oldEntries},s=storage([[DRAMATURGY.key,saved]]);
 let result=await loadDramaturgy(s,offline,data);
 assert.equal(result.data.dramaturgy,oldEntries);assert.ok(result.warning);assert.equal(s.records.get(DRAMATURGY.key),saved);
 result=await loadDramaturgy(s,async()=>oldEntries,data);
 assert.equal(result.data.dramaturgy,oldEntries);assert.ok(result.warning);assert.equal(s.records.get(DRAMATURGY.key).revision,'previous');
 result=await loadDramaturgy(s,fetchJSON,data);
 assert.equal(result.warning,'');assert.equal(s.records.get(DRAMATURGY.key).revision,DRAMATURGY.revision);
 assert.deepEqual(result.data.dramaturgy,entries);
});
test('invalid content cannot replace good data; missing sidecar does not make the script unusable',async()=>{
 const saved={revision:'previous',entries},s=storage([[DRAMATURGY.key,saved]]);
 const invalid=structuredClone(entries);invalid[data.lines[0].id].relatedLineIds=['missing'];
 assert.throws(()=>validateDramaturgyEntries(invalid,data));
 const result=await loadDramaturgy(s,async()=>invalid,data);
 assert.equal(result.data.dramaturgy,entries);assert.equal(s.records.get(DRAMATURGY.key),saved);
 const first=await loadDramaturgy(storage(),offline,data);assert.equal(first.data,data);assert.ok(first.warning);
});
test('unrelated and edited scripts never receive annotations by coincidentally matching IDs',async()=>{
 for(const custom of [{...data,id:'other'}, {...data,lines:data.lines.map((line,i)=>i?line:{...line,text:'Different speech.'})}]){
  const s=storage(),result=await loadDramaturgy(s,()=>{throw Error('should not fetch');},custom);
  assert.equal(result.data,custom);assert.equal(result.warning,'');assert.equal(s.writes.length,0);
 }
});
test('storage quota failure keeps fetched explanations usable and reports loss of offline persistence',async()=>{
 const s=storage();s.atomicPut=async()=>{throw Error('quota');};
 const result=await loadDramaturgy(s,fetchJSON,data);
 assert.deepEqual(result.data.dramaturgy,entries);assert.match(result.warning,/保存できません/);
});
test('all 1164 narratives render the correct explanation and only their available supplemental fields',()=>{
 const enriched={...data,dramaturgy:entries};
 for(const line of data.lines){
  const d=entries[line.id],html=analysisNarrative(line,enriched);
  assert.ok(html.includes(`data-analysis-id="${line.id}"`),line.id);
  assert.ok(html.includes(esc(d.explanation)),line.id);
  assert.ok(!html.includes('analysis-neighbor'),line.id);
  assert.equal(html.includes('analysis-spoiler'),!!d.spoiler,line.id);
  assert.equal(html.includes('analysis-supplement'),!!(d.premise||d.cause||d.emotion||d.intention||d.subtext||d.devices),line.id);
  for(const key of ['premise','cause','emotion','intention','subtext','spoiler','acting'])if(d[key])assert.ok(html.includes(esc(d[key])),line.id+'.'+key);
  for(const ref of d.relatedLineIds||[])assert.ok(html.includes(`data-related-id="${ref}"`),line.id+'->'+ref);
  assert.doesNotMatch(html,/未収録|伏線なし|演技指示はありません/);
 }
 const simple=data.lines.find(line=>Object.keys(entries[line.id]).length===1&&!line.direction&&!line.acting);
 const html=analysisNarrative(simple,enriched);assert.ok(!html.includes('analysis-acting'));assert.ok(!html.includes('analysis-related'));
});
test('annotation text and optional fields are escaped instead of executed as markup',()=>{
 const line=data.lines[0],payload='<img src=x onerror=alert(1)>';
 const html=analysisNarrative(line,{...data,dramaturgy:{[line.id]:{explanation:payload,premise:payload,spoiler:payload,acting:payload,devices:[payload]}}});
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
});
