import test from 'node:test';
import assert from 'node:assert/strict';
import {directionCue,directionText} from '../dist/modules/reader.js';
import {readFile} from 'node:fs/promises';
const dataset=JSON.parse(await readFile(new URL('../dist/data/mousetrap.json',import.meta.url),'utf8'));

test('450 production cues appear with their audited Japanese summary',()=>{
 const rows=Object.entries(dataset.directions);
 assert.equal(rows.length,450);
 for(const [id,direction] of rows){
  const html=directionCue({id,direction});
  assert.ok(html.includes('data-action="direction"'),id);
  assert.ok(!html.includes('direction-cue-label'),id);
  assert.ok(html.includes('direction-cue-text'),id);
  assert.ok(!html.includes('direction-cue-chevron'),id);
  assert.ok(!html.includes('>ト書き<'),id);
  assert.ok(html.includes('aria-label="ト書きの詳細'),id);
  assert.ok(directionText(direction)===direction.ja,id);
  assert.ok(html.includes(direction.ja.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')),id);
 }
});

test('missing directions stay absent; imported original-only entries remain discoverable',()=>{
 assert.equal(directionCue({direction:null}),'');
 assert.equal(directionText({original:'[walks]'}),'英語のト書きを確認');
 assert.ok(directionCue({direction:{original:'[walks]'}}).includes('data-action="direction"'));
 const html=directionCue({direction:{ja:'<b onload="bad">',original:'[test]'}});
 assert.ok(html.includes('&lt;b onload=&quot;bad&quot;&gt;'));
 assert.ok(!html.includes('<b onload'));
});
