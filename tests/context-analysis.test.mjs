import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBundle} from '../dist/modules/data.js';
import {analysisNeighbor,analysisNarrative} from '../dist/modules/reader.js';

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

test('legacy scripts keep neighboring translations and available stage cues before learning information',()=>{
 const line=data.lines[0],html=analysisNarrative(line,data);
 assert.match(html,/会話の流れ・文脈/);
 assert.match(html,/analysis-neighbor/);
 assert.ok(html.includes(data.lines[1].speaker));
 const display=reader.slice(reader.indexOf('export function showAnalysis'),reader.indexOf('export function speechNode'));
 assert.ok(display.indexOf('日本語訳')<display.indexOf('analysisNarrative(line,data)'));
 assert.ok(display.indexOf('analysisNarrative(line,data)')<display.indexOf('文法・構文'));
 assert.match(display,/sheet\.querySelector\('#context-note'\)/);
 assert.match(display,/sheet\.querySelector\('#acting-note'\)/);
});
