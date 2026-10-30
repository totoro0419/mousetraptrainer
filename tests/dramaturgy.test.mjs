import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspect,parseUniqueJson,validateDramaturgy,SOURCE_URL,DATA_URL} from '../scripts/validate-dramaturgy.mjs';
const source=parseUniqueJson(await readFile(SOURCE_URL,'utf8'));
const data=parseUniqueJson(await readFile(DATA_URL,'utf8'));

test('dramaturgy covers all unchanged source speeches in source order with valid references',async()=>{
 const report=await inspect();assert.deepEqual(report.errors,[]);assert.equal(report.entries,1164);
 assert.deepEqual(report.scenes,{'act1-scene1':190,'act1-scene2':336,act2:638});
 assert.equal(report.fields.explanation,1164);assert.ok(report.referenceCount>400);
});
test('strict JSON parsing catches duplicate IDs and duplicate or escaped field keys',()=>{
 for(const text of ['{"same":1,"same":2}','{"id":{"explanation":"甲","explanation":"乙"}}','{"a":1,"\\u0061":2}'])assert.throws(()=>parseUniqueJson(text),/Duplicate JSON key/);
 assert.deepEqual(parseUniqueJson('{"a":["x:y","{quoted}"],"b":{"a":2}}'),{a:['x:y','{quoted}'],b:{a:2}});
});
test('coverage validator rejects omissions, bad references, empty content and copied translation',()=>{
 const clone=structuredClone(data),[first,second]=Object.keys(clone);delete clone[first];
 clone[second]={explanation:source.translations[second].translation,acting:'',relatedLineIds:['missing',second]};
 const errors=validateDramaturgy(source,clone).errors;
 for(const needle of ['IDs or insertion order','invalid reference missing','invalid reference '+second,'nonempty trimmed','equals translation'])assert.ok(errors.some(e=>e.includes(needle)),needle);
});
test('decisive clue references preserve chronology and point to the actual reveals',()=>{
 assert.ok(data['act1-scene2-speech-0077'].relatedLineIds.includes('act2-speech-0587'));
 assert.ok(data['act2-speech-0224'].relatedLineIds.includes('act2-speech-0618'));
 assert.ok(data['act2-speech-0450'].relatedLineIds.includes('act2-speech-0600'));
 assert.ok(data['act2-speech-0582'].relatedLineIds.includes('act2-speech-0584'));
 assert.ok(data['act2-speech-0620'].premise.includes('推量'));
});
test('saved validation reports describe these exact current data bytes',async()=>{
 const current=await inspect();
 const recorded=JSON.parse(await readFile(new URL('../docs/dramaturgy/validation.json',import.meta.url),'utf8'));
 assert.deepEqual(recorded,current);
 const pdf=JSON.parse(await readFile(new URL('../docs/dramaturgy/source-validation.json',import.meta.url),'utf8'));
 assert.equal(pdf.sourceSha256,current.sourceSha256);assert.equal(pdf.normalizedSpeechMatches,1164);assert.equal(pdf.speakerOrderMatches,true);assert.deepEqual(pdf.errors,[]);
});
