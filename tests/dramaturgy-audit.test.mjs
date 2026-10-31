import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspect,DATA_URL} from '../scripts/validate-dramaturgy.mjs';

test('completed content-audit ledger covers every current ID and records exact revised fields',async()=>{
 const [report,ledger,data]=await Promise.all([
  inspect(),
  readFile(new URL('../docs/dramaturgy/independent-audit.json',import.meta.url),'utf8').then(JSON.parse),
  readFile(DATA_URL,'utf8').then(JSON.parse)
 ]);
 assert.equal(ledger.status,'completed');
 assert.equal(ledger.datasetSha256,report.datasetSha256);
 assert.deepEqual(Object.keys(ledger.entries),Object.keys(data));
 let revised=0;
 for(const [id,entry] of Object.entries(ledger.entries)){
  assert.ok(['maintained','revised'].includes(entry.decision));
  if(entry.decision==='maintained')continue;
  revised++;
  assert.ok(entry.issues.length&&entry.reason&&entry.changes.length,id);
  for(const change of entry.changes){
   assert.notDeepEqual(change.before,change.after,id);
   assert.deepEqual(data[id][change.field],change.after,id+'.'+change.field);
  }
 }
 assert.equal(ledger.summary.audited,1164);
 assert.equal(revised,ledger.summary.revised);
 assert.equal(ledger.summary.maintained,1164-revised);
 assert.equal(ledger.summary.issuesFound,revised);
});
