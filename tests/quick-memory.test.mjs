import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 normalizeQuickMemory,currentQuickLine,selectQuickLine,refreshQuickMemory,
 ensureQuickMemory,completeQuickMemory,quickMemoryStats,localDay
} from '../dist/modules/quick-memory.js';

const lines=[
 {id:'A-1',speaker:'A',scene:'s',text:'Alpha one'},
 {id:'B-1',speaker:'B',scene:'s',text:'Other role'},
 {id:'A-2',speaker:'A',scene:'s',text:'Alpha two'},
 {id:'A-3',speaker:'A',scene:'s',text:'Alpha three'},
 {id:'A-4',speaker:'A',scene:'s',text:'Alpha four'},
 {id:'A-5',speaker:'A',scene:'s',text:'Alpha five'},
 {id:'A-6',speaker:'A',scene:'s',text:'Alpha six'},
 {id:'A-7',speaker:'A',scene:'s',text:'Alpha seven'}
];
const data={id:'script-demo',lines};

test('draws only current actor dialogue, never other speakers',()=>{
 for(let i=0;i<100;i++)assert.equal(selectQuickLine(data,{},'A',[],()=>i/100).speaker,'A');
 assert.equal(selectQuickLine(data,{},'B',[],()=>0)?.id,'B-1');
 assert.equal(selectQuickLine(data,{},'nobody',[],()=>0),null);
});

test('prioritizes nonmemorized lines and review regardless of memorization level',()=>{
 const progress={};
 for(const line of lines.filter(l=>l.speaker==='A'))progress[line.id]={level:2};
 progress['A-2']={level:2,review:true};
 assert.equal(selectQuickLine(data,progress,'A',[],()=>0.99).id,'A-2');
 delete progress['A-2'].review;
 assert.ok(selectQuickLine(data,progress,'A',[],()=>0));
});

test('excludes the recent five when possible and relaxes exclusion if necessary',()=>{
 const recent=['A-1','A-2','A-3','A-4','A-5'];
 for(let i=0;i<100;i++)assert.ok(['A-6','A-7'].includes(selectQuickLine(data,{},'A',recent,()=>i/100).id));
 const lone={lines:[{id:'one',speaker:'A'}]};
 assert.equal(selectQuickLine(lone,{},'A',['one'],()=>.9).id,'one');
});

test('startup redraws once; returning home or changing routes preserves current prompt',()=>{
 const first=refreshQuickMemory(data,{},null,'A',()=>0);
 assert.equal(first.currentByRole.A,'A-1');
 assert.equal(currentQuickLine(data,first,'A')?.id,'A-1');
 const unchanged=ensureQuickMemory(data,{},first,'A',()=>.99);
 assert.equal(unchanged.currentByRole.A,'A-1');
 const restarted=refreshQuickMemory(data,{},unchanged,'A',()=>0);
 assert.notEqual(restarted.currentByRole.A,'A-1');
 assert.equal(restarted.currentByRole.A,'A-2');
 assert.equal(currentQuickLine(data,restarted,'B'),null);
 const switched=ensureQuickMemory(data,{},restarted,'B',()=>0);
 assert.equal(switched.currentByRole.B,'B-1');
 assert.equal(switched.currentByRole.A,'A-2');
});

test('completion records once and selects next; stale clicks cannot double count',()=>{
 const now=new Date(2026,10,2,20,22,0);
 const initial=refreshQuickMemory(data,{},null,'A',()=>0);
 const before=structuredClone(initial);
 const id=initial.currentByRole.A;
 const completed=completeQuickMemory(data,{},initial,'A',id,now,()=>0);
 assert.ok(completed);
 assert.equal(completed.counts[id].count,1);
 assert.equal(completed.daily.A[localDay(now)],1);
 assert.equal(completed.recentCompletions[0].id,id);
 assert.equal(completed.currentByRole.A,'A-2');
 assert.equal(completeQuickMemory(data,{},completed,'A',id,now,()=>0),null);
 assert.deepEqual(initial,before,'original quick state is unchanged until storage commits');
 assert.equal(completeQuickMemory(data,{},completed,'B',id,now,()=>0),null,'other speaker cannot mark completion');
 const next=completeQuickMemory(data,{},completed,'A','A-2',now,()=>0);
 assert.equal(next.counts['A-2'].count,1);
 const st=quickMemoryStats(data,next,'A',now);
 assert.equal(st.total,2);
 assert.equal(st.today,2);
 assert.equal(st.unique,2);
 assert.equal(st.recent[0].line.id,'A-2');
 assert.deepEqual(quickMemoryStats(data,next,'B',now).recent,[]);
});

test('completed dialogues do not silently change normal memorization progress',()=>{
 const progress={'A-1':{level:1,review:true}};
 const before=structuredClone(progress);
 const initial=refreshQuickMemory(data,progress,null,'A',()=>0);
 completeQuickMemory(data,progress,initial,'A',initial.currentByRole.A,new Date(),()=>.9);
 assert.deepEqual(progress,before);
});

test('current prompt is invalid if the saved dialogue belongs to a different role',()=>{
 const bad=normalizeQuickMemory({currentByRole:{A:'B-1'},recentByRole:{}});
 assert.equal(currentQuickLine(data,bad,'A'),null);
 assert.notEqual(ensureQuickMemory(data,{},bad,'A',()=>0).currentByRole.A,'B-1');
});

test('integration: home placement, isolated route, and offline module inclusion',async()=>{
 const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../dist/home-refresh.css',import.meta.url),'utf8');
 const view=await readFile(new URL('../dist/modules/quick-memory-view.js',import.meta.url),'utf8');
 const sw=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
 assert.ok(app.indexOf('class="quick-memory-home"')>app.indexOf('class="home-progress-dashboard"'));
 assert.ok(app.indexOf('class="quick-memory-home"')<app.indexOf('class="home-role-row"'));
 assert.match(app,/loadState\(\);refreshQuickOnLaunch\(\);await render\(\)/);
 assert.match(app,/route==='quick'/);
 assert.match(app,/small\\.role=next;ensureQuickForRole\\(\\)/);
 assert.match(view,/line\\.scene===target\\.scene/);
 assert.match(view,/ctx\\.completeQuick\\(target\\.id\\)/);
 assert.match(view,/location\\.hash='home'/);
 assert.match(css,/text-overflow:ellipsis/);
 assert.ok(sw.includes('./modules/quick-memory.js'));
 assert.ok(sw.includes('./modules/quick-memory-view.js'));
});
