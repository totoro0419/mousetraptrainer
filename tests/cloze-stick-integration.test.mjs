import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeClozeResume,nextOwnIndex,previousCueIndex,toggleClozeLine,clozeContextOffset} from '../dist/modules/cloze.js';
import {DEFAULT_STICK_SETTINGS,readStickSettings,saveStickSettings,stickEnabled,normalizeStickSettings,STICK_SCREENS} from '../dist/modules/stick-settings.js';
import {quickCompletedProgress,reconcileQuickProgress,completeQuickMemory,refreshQuickMemory} from '../dist/modules/quick-memory.js';

const lines=[
 {id:'a',speaker:'A',scene:'one'},
 {id:'b',speaker:'B',scene:'one'},
 {id:'c',speaker:'A',scene:'one'},
 {id:'d',speaker:'A',scene:'one'},
 {id:'e',speaker:'B',scene:'one'},
 {id:'f',speaker:'A',scene:'one'}
];
const source=async path=>readFile(new URL('../dist/'+path,import.meta.url),'utf8');

test('cloze reveals are independent and repeatable without advancing',()=>{
 const original=new Set();
 const a=toggleClozeLine(original,'c');
 assert.deepEqual([...a],['c']);
 assert.equal(original.size,0);
 const b=toggleClozeLine(a,'f');
 assert.deepEqual([...b],['c','f']);
 assert.deepEqual([...toggleClozeLine(b,'c')],['f']);
 assert.equal(nextOwnIndex(lines,'A',2,1),3);
 assert.equal(nextOwnIndex(lines,'A',3,1),5);
 assert.equal(nextOwnIndex(lines,'A',5,1),-1);
 assert.equal(nextOwnIndex(lines,'A',0,-1),-1);
 assert.equal(nextOwnIndex(lines,'A',5,-1),3);
});

test('context jumps use previous opposite speaker and never hide the target',()=>{
 assert.equal(previousCueIndex(lines,'A',3),1);
 assert.equal(previousCueIndex(lines,'A',5),4);
 assert.equal(previousCueIndex(lines,'A',0),-1);
 for(const [height,target,cue] of [[700,100,150],[320,290,850],[500,40,2000]]){
  const offset=clozeContextOffset(height,target,cue);
  assert.ok(offset>=20);
  assert.ok(offset<=Math.max(20,height-target-20));
 }
});

test('legacy cloze resume can restore by line ID and recovers invalid state',()=>{
 assert.equal(normalizeClozeResume({role:'A',lineId:'f',index:0},lines,'A'),5);
 assert.equal(normalizeClozeResume({role:'A',anchorId:'c',index:1},lines,'A'),2);
 assert.equal(normalizeClozeResume({role:'A',lineId:'deleted',index:3},lines,'A'),3);
 assert.equal(normalizeClozeResume({role:'B',lineId:'f'},lines,'A'),0);
 assert.equal(normalizeClozeResume({role:'A',lineId:'deleted',index:999},lines,'A'),0);
});

test('stick settings default by screen, migrate master, clamp values and persist',()=>{
 const raw=new Map(),store={getItem:k=>raw.get(k)||null,setItem:(k,v)=>raw.set(k,v)};
 const before=readStickSettings(false,store);
 assert.equal(before.master,false);
 for(const screen of STICK_SCREENS){
  assert.equal(DEFAULT_STICK_SETTINGS.screens[screen],['script','cloze','quick','analysis'].includes(screen));
 }
 assert.equal(stickEnabled(before,'script'),false);
 const adjusted=normalizeStickSettings({...before,master:true,x:999,size:12,opacity:5,speed:0,bottom:999,screens:{...before.screens,home:true}});
 assert.equal(adjusted.x,90);assert.equal(adjusted.size,44);
 assert.equal(adjusted.opacity,1);assert.equal(adjusted.speed,.3);
 assert.equal(adjusted.bottom,220);
 assert.equal(saveStickSettings(adjusted,store),true);
 const restored=readStickSettings(true,store);
 assert.equal(restored.screens.home,true);
 assert.equal(stickEnabled(restored,'home'),true);
 assert.equal(stickEnabled(restored,'settings'),false);
 const failing={setItem(){throw Error('quota');}};
 assert.equal(saveStickSettings(adjusted,failing),false);
});

test('quick completion upgrades only untouched, preserves review and mastery',()=>{
 const original={review:true,bookmarked:true};
 const upgraded=quickCompletedProgress(original);
 assert.equal(upgraded.level,1);assert.equal(upgraded.review,true);
 assert.equal(upgraded.bookmarked,true);
 assert.equal(original.level,undefined);
 const practiced={level:1,review:true};
 const mastered={level:2,review:true};
 assert.equal(quickCompletedProgress(practiced),practiced);
 assert.equal(quickCompletedProgress(mastered),mastered);
 const progress={a:{level:2,review:true},c:{review:true},e:{level:1},f:{level:0,updatedAt:2500}};
 reconcileQuickProgress(progress,{progressUpgrades:{a:1000,c:1000,e:1000,b:0,f:2000}});
 assert.equal(progress.a.level,2);
 assert.equal(progress.c.level,1);
 assert.equal(progress.c.review,true);
 assert.equal(progress.e.level,1);
 assert.equal(progress.b,undefined);
 assert.equal(progress.f.level,0,'later intentional reset is never undone by recovery');
});

test('quick completion is a pure proposal, stale repeat has no new count',()=>{
 const data={lines:[{id:'a',speaker:'A'},{id:'c',speaker:'A'}]};
 const progress={a:{level:0}};
 const current=refreshQuickMemory(data,progress,null,'A',()=>0);
 const proposal=completeQuickMemory(data,progress,current,'A',current.currentByRole.A,new Date(),()=>0);
 assert.equal(current.counts.a,undefined,'unfinished state unchanged');
 assert.equal(progress.a.level,0,'progress is not promoted before durable commit');
 assert.equal(completeQuickMemory(data,progress,proposal,'A','a',new Date(),()=>0),null);
});

test('route integration, modal isolation and dark swipe underlay use shared components',async()=>{
 const [app,reader,rehearsal,cloze,stick,controller,ui,css,theme,sw]=await Promise.all(
  ['app.js','modules/reader.js','modules/rehearsal.js','modules/cloze-view.js','modules/stick.js','modules/stick-controller.js','modules/ui.js','styles.css','theme.css','sw.js'].map(source));
 assert.match(app,/createStickController\(/);
 assert.match(app,/reconcileQuickProgress\(progress,small\.quickMemorize\)/);
 assert.match(app,/next\.progressUpgrades\[lineId\]=updated\.updatedAt/);
 assert.match(reader,/stickTarget\?\.\('script'/);
 assert.match(reader,/stickScreen:'analysis'/);
 assert.match(rehearsal,/mountCloze\(holder/);
 assert.match(cloze,/class="reveal-mask cloze-toggle"/);
 assert.match(cloze,/ctx\.stickTarget\?\.\('cloze'/);
 assert.match(cloze,/cloze-line-audio/);
 assert.match(stick,/scroller\.isConnected/);
 assert.match(controller,/mountModal\(/);
 assert.match(ui,/d\.dataset\.stickScreen=stickScreen/);
 assert.match(css,/\.reader-scroll \.speech \.swipe-hint\.left/);
 assert.match(theme,/\[data-theme-mode="dark"\] \.reader-scroll \.speech \.swipe-hint/);
 for(const asset of ['./modules/cloze.js','./modules/cloze-view.js','./modules/stick-settings.js','./modules/stick-controller.js'])
  assert.ok(sw.includes(asset),asset+' must be precached for offline mode');
});
