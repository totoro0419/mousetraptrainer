import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBundle} from '../dist/modules/data.js';

const raw=JSON.parse(await readFile('dist/data/mousetrap.json','utf8'));
const sidecar=JSON.parse(await readFile('dist/data/mousetrap-directions-ja.json','utf8'));

test('all 450 verified directions have source-faithful Japanese summary data',()=>{
  const directions=raw.directions;
  const ids=Object.keys(directions);
  const summaries=sidecar.summaries;
  const speechIds=new Set(Object.values(raw.script).flatMap(scene=>scene.speeches.map(speech=>speech.id)));
  assert.equal(sidecar.version,1);
  assert.equal(sidecar.source,'dist/data/mousetrap.json');
  assert.equal(ids.length,450);
  assert.deepEqual(Object.keys(summaries),ids);
  for(const id of ids){
    const direction=directions[id];
    assert.ok(speechIds.has(id),`Missing corresponding speech: ${id}`);
    assert.equal(direction.verified,true,`Unverified original: ${id}`);
    assert.ok(typeof direction.original==='string'&&direction.original.trim(),`Missing English: ${id}`);
    assert.ok(typeof direction.ja==='string'&&direction.ja.trim(),`Missing Japanese: ${id}`);
    assert.equal(direction.ja,summaries[id],`Sidecar mismatch: ${id}`);
    assert.ok(direction.ja.length<=120,`Japanese summary unexpectedly long: ${id}`);
  }
  assert.equal(normalizeBundle(raw).lines.length,1164);
});

test('production dialogue ordering and speaker IDs remain unique',()=>{
  const speeches=Object.values(raw.script).flatMap(scene=>scene.speeches);
  assert.equal(speeches.length,1164);
  assert.equal(new Set(speeches.map(speech=>speech.id)).size,1164);
  assert.ok(speeches.every(speech=>speech.speaker&&speech.text));
});
