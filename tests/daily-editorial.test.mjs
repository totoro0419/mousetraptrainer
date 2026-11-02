import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {todayInTokyo,receiveDailyToday,receivedDailyItems,quoteSentence} from '../dist/modules/daily-notifications.js';

const calendar=JSON.parse(await readFile(new URL('../dist/data/daily-editorial.json',import.meta.url),'utf8'));
const bundled=JSON.parse(await readFile(new URL('../dist/data/mousetrap.json',import.meta.url),'utf8'));
const lines=Object.values(bundled.script).flatMap(scene=>scene.speeches);
const byId=new Map(lines.map(line=>[line.id,line]));
const dayMs=86400000;
const dayValue=date=>Math.floor(Date.parse(date+'T00:00:00Z')/dayMs);

test('177 consecutive local calendar dates, exactly one post per day',()=>{
 assert.equal(calendar.items.length,177);
 const dates=calendar.items.map(item=>item.date);
 assert.equal(new Set(dates).size,177);
 assert.equal(dates[0],'2026-11-02');
 assert.equal(dates.at(-1),'2027-04-27');
 for(let i=1;i<dates.length;i++)assert.equal(dayValue(dates[i])-dayValue(dates[i-1]),1);
 const counts=Object.groupBy(calendar.items,item=>item.type);
 assert.equal(counts.trivia.length,114);
 assert.equal(counts.theory.length,45);
 assert.equal(counts.milestone.length,18);
 for(const item of counts.milestone)assert.equal((dayValue('2027-04-27')-dayValue(item.date))%10,0);
});

test('all 114 quotes link to the right bundled speech and have at most 25 words',()=>{
 for(const item of calendar.items.filter(i=>i.type==='trivia')){
  assert.match(item.lineId,/^act(?:1-scene[12]|2)-speech-\d{4}$/);
  const line=byId.get(item.lineId);
  assert.ok(line,'missing line: '+item.id);
  assert.ok(line.text.toLowerCase().includes(item.quoteAnchor.toLowerCase()),'anchor mismatch: '+item.id);
  const excerpt=quoteSentence(line.text,item.quoteAnchor);
  assert.ok(excerpt.length>0,'empty quote: '+item.id);
  assert.ok(excerpt.toLowerCase().includes(item.quoteAnchor.toLowerCase()),'anchor cropped: '+item.id);
  assert.ok(excerpt.replaceAll('…','').trim().split(/\s+/).length<=25,'more than 25 words: '+item.id);
 }
});

test('Tokyo day is independent of device locale',()=>{
 assert.equal(todayInTokyo(new Date('2026-11-01T15:00:00Z')),'2026-11-02');
 assert.equal(todayInTokyo(new Date('2026-11-02T14:59:59Z')),'2026-11-02');
 assert.equal(todayInTokyo(new Date('2026-11-02T15:00:00Z')),'2026-11-03');
});

test('missed days never backfill; one receipt per actually opened day',async()=>{
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;
 let stored=null;
 globalThis.localStorage={getItem:()=>stored,setItem:(_,v)=>{stored=v}};
 globalThis.fetch=async()=>({ok:true,json:async()=>calendar});
 try{
  assert.equal(await receiveDailyToday(new Date('2026-11-02T06:00:00Z')),true);
  assert.equal(await receiveDailyToday(new Date('2026-11-02T12:00:00Z')),false);
  assert.equal(await receiveDailyToday(new Date('2026-11-05T06:00:00Z')),true);
  const items=receivedDailyItems();
  assert.deepEqual(items.map(item=>item.date),['2026-11-02','2026-11-05']);
 }finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;}
});
