import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBundle} from '../dist/modules/data.js';
import {selectRange} from '../dist/modules/session.js';
import {PRACTICE_SCENES,PRACTICE_GROUPS,getPracticeParts,hasPracticeSource,practicePartForRange,practiceRangeLabel} from '../dist/modules/practice-scenes.js';
import {practicePickerMarkup} from '../dist/modules/practice-scenes-ui.js';

const raw=JSON.parse(await readFile(new URL('../dist/data/mousetrap.json',import.meta.url),'utf8'));
const data=normalizeBundle(raw);
const rangeOf=p=>({scene:p.group,from:p.from,to:p.to,practiceId:p.id});

test('verified production script has 40 non-overlapping, exhaustive practice scenes',()=>{
 assert.ok(hasPracticeSource(data));
 const parts=getPracticeParts(data,'MOLLIE');
 assert.equal(parts.length,40);
 assert.equal(parts[0].id,'S01');
 assert.equal(parts[39].id,'S40');
 assert.deepEqual(PRACTICE_GROUPS.map(g=>parts.filter(p=>p.group===g.id).length),[9,14,17]);
 assert.deepEqual(PRACTICE_GROUPS.map(g=>parts.filter(p=>p.group===g.id).reduce((total,p)=>total+p.length,0)),[190,336,638]);
 const ids=parts.flatMap(p=>selectRange(data,rangeOf(p)).map(line=>line.id));
 assert.deepEqual(ids,data.lines.map(line=>line.id),'each original speech belongs to exactly one part, in original order');
 assert.equal(new Set(ids).size,1164);
 assert.equal(parts.reduce((n,p)=>n+p.length,0),1164);
 for(const part of parts){
  assert.equal(selectRange(data,rangeOf(part)).length,part.length);
  assert.ok(part.length>0);
  assert.equal(PRACTICE_SCENES.find(p=>p.id===part.id).start,
   data.lines.findIndex(line=>line.id===selectRange(data,rangeOf(part))[0].id)+1);
 }
});

test('role highlights and learning counters use actual role lines, not sample estimates',()=>{
 const chosen='MOLLIE',lines=data.lines.filter(line=>line.speaker===chosen);
 const progress=Object.fromEntries(lines.slice(0,5).map((line,i)=>[line.id,{level:i<3?2:0,review:i===4}]));
 const parts=getPracticeParts(data,chosen,progress);
 assert.equal(parts.reduce((sum,p)=>sum+p.ownCount,0),lines.length);
 assert.equal(parts.reduce((sum,p)=>sum+p.mastered,0),3);
 assert.equal(parts.reduce((sum,p)=>sum+p.review,0),1);
 for(const p of parts){
  const actual=selectRange(data,rangeOf(p)).filter(line=>line.speaker===chosen);
  assert.equal(p.ownCount,actual.length);
  assert.equal(p.ownedPercent,Math.round(actual.length/p.length*100));
  assert.equal(p.memorizedPercent,actual.length?Math.round(p.mastered/actual.length*100):0);
 }
 const asOther=getPracticeParts(data,'GILES',progress);
 assert.notDeepEqual(parts.map(p=>p.ownCount),asOther.map(p=>p.ownCount));
 assert.equal(data.lines.length,1164,'selecting a role never mutates source script');
});

test('part range roundtrip, custom numbered range, and summary label',()=>{
 const p=getPracticeParts(data,'MOLLIE')[13];
 const range=rangeOf(p);
 assert.equal(practicePartForRange(range)?.id,p.id);
 assert.match(practiceRangeLabel(range,'fallback'),new RegExp(p.id));
 assert.equal(practicePartForRange({...range,to:range.to-1}),null);
 assert.equal(practiceRangeLabel({...range,to:range.to-1},'元の幕'),'元の幕');
 const firstLine=selectRange(data,range)[0];
 assert.equal(firstLine.id,data.lines[p.start-1].id);
 assert.equal(selectRange(data,{scene:'all',from:1,to:1164}).length,1164);
});

test('selecting a practice part respects non-speaking roles and original stage directions',()=>{
 const parts=getPracticeParts(data,'MOLLIE');
 const without=parts.find(part=>part.ownCount===0);
 assert.ok(without,'some parts should remain selectable despite no speaking lines');
 assert.ok(selectRange(data,rangeOf(without)).length>0);
 const every=parts.flatMap(p=>selectRange(data,rangeOf(p)));
 for(let i=0;i<every.length;i++)assert.equal(every[i].direction,data.lines[i].direction);
});

test('scene picker is accessible and theme-driven rather than hard-coded role data',()=>{
 const parts=getPracticeParts(data,'MOLLIE');
 const html=practicePickerMarkup(parts,rangeOf(parts[1]));
 assert.equal((html.match(/data-practice-id="/g)||[]).length,40);
 assert.match(html,/aria-pressed="true"/);
 assert.match(html,/第1幕・第1場/);
 assert.match(html,/自分のセリフ/);
 assert.equal(practicePickerMarkup([],{}),'');
});

test('modified and sample scripts cannot accidentally inherit production scene offsets',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/script.json',import.meta.url),'utf8'));
 assert.equal(getPracticeParts(normalizeBundle(fixture),'ALEX').length,0);
 const other={...data,lines:data.lines.map((line,i)=>i===16?{...line,id:'changed-id'}:line)};
 assert.equal(hasPracticeSource(other),false);
 assert.deepEqual(getPracticeParts(other,'MOLLIE'),[]);
});
