import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBundle} from '../dist/modules/data.js';
import {analysisNeighbor} from '../dist/modules/reader.js';

const sample=JSON.parse(await readFile(new URL('./fixtures/script.json',import.meta.url)));
const data=normalizeBundle(sample);
const reader=await readFile(new URL('../dist/modules/reader.js',import.meta.url),'utf8');

test('neighboring context uses supplied translation, not invented interpretations',()=>{
 const first=data.lines[0];
 assert.equal(analysisNeighbor(data,first,-1),null,'scene start has no previous speech');
 const next=analysisNeighbor(data,first,1);
 assert.equal(next.speaker,data.lines[1].speaker);
 assert.equal(next.translation,data.translations[next&&data.lines[1].id]?.translation||data.translations[data.lines[1].id]);
 assert.equal(next.text,data.lines[1].text);
});

test('context never leaks across scene boundaries',()=>{
 const secondScene=data.lines.findIndex((l,i)=>i>0&&l.scene!==data.lines[i-1].scene);
 assert.ok(secondScene>0);
 assert.equal(analysisNeighbor(data,data.lines[secondScene],-1),null);
 assert.equal(analysisNeighbor(data,data.lines[secondScene-1],1),null);
});

test('analysis shows Japanese translation, actual adjacent lines and verified cue before grammar',()=>{
 const s=reader.slice(reader.indexOf('export function showAnalysis'),reader.indexOf('export function speechNode'));
 const headings=['日本語訳','会話の流れ・文脈','演技のポイント','文法・構文'].map(label=>s.indexOf(label));
 assert.ok(headings.every((i,j)=>i>=0&&(!j||i>headings[j-1])));
 assert.match(s,/analysisNeighbor\(data,line,-1\)/);
 assert.match(s,/analysisNeighbor\(data,line,1\)/);
 assert.match(s,/directionText\(line\.direction\)/);
 assert.doesNotMatch(s,/解説は未収録です。前後のやり取りを確認/);
 assert.match(s,/sheet\.querySelector\('#context-note'\)/);
 assert.match(s,/sheet\.querySelector\('#acting-note'\)/);
});
