import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioSession,speakingSeconds} from '../dist/modules/audio-session.js';
import {bundledClip,loadAudioManifest,NextClipPreloader} from '../dist/modules/audio-library.js';
import {AudioPlayer} from '../dist/modules/audio.js';
import {validateAudio} from '../scripts/validate-audio.mjs';
import {readFile} from 'node:fs/promises';
import {normalizeBundle} from '../dist/modules/data.js';

const data={id:'fixture',lines:[{id:'a',index:0,speaker:'A',scene:'s',ordinal:1,text:'One'},{id:'b',index:1,speaker:'B',scene:'s',ordinal:2,text:'Two'},{id:'c',index:2,speaker:'A',scene:'s',ordinal:3,text:'Three'},{id:'d',index:3,speaker:'A',scene:'s',ordinal:4,text:'Four'}]};
function setup({resolve}={}){
 const events=[],ctx={data,small:{role:'A',rate:1,sessions:{}},save(){}};
 const player={audio:null,position:0,pause(){events.push('pause');},stop(){this.audio=null;events.push('stop');},setRate(r){this.rate=r;},seek(p){this.position=p;},async play(c,o){this.audio={};this.position=o.position||0;this.options=o;events.push(c.id);o.onready();}};
 const s=new AudioSession(ctx,{player,resolve:resolve||(async(_d,id)=>({id,duration:4})),manifest:async()=>new Map(data.lines.map(l=>[l.id,{...l,duration:4}])),preloader:{clear(){},set(){}}});
 return {s,player,ctx,events};
}
const flush=()=>new Promise(r=>setTimeout(r,0));

test('all 1164 static MP3s match exact script IDs, text, speakers, byte counts and SHA-256',async()=>{assert.deepEqual(await validateAudio(),{total:1164,bytes:32496480,seconds:5416.08,missing:0});});
test('manifest rejects an edited script instead of joining by matching filenames',async()=>{
 const manifest=JSON.parse(await readFile('dist/data/audio-manifest.json'));const d=normalizeBundle(JSON.parse(await readFile('dist/data/mousetrap.json')));
 assert.equal((await loadAudioManifest(d,async()=>({ok:true,json:async()=>manifest}))).size,1164);
 d.lines[0].text+=' edited';assert.equal(await loadAudioManifest(d),null);
 assert.equal(bundledClip({file:'../../evil.mp3'}),null);
 assert.match(bundledClip(manifest.clips[0]).url,/\/dist\/audio\/lines\//);
});
test('read playback advances in canonical order, pauses at completion, stale ends cannot skip',async()=>{
 const {s,player}=setup();s.select(data.lines[0],{play:true,continuous:true});await flush();assert.equal(s.phase,'playing');
 const stale=player.options.onended;stale();await flush();assert.equal(s.line.id,'b');stale();assert.equal(s.line.id,'b');s.dispose();
});
test('rehearsal plays other roles, stops at consecutive own lines and model playback does not advance',async()=>{
 const {s,player}=setup();s.startPractice('audio',{scene:'all',from:2,to:4});await flush();assert.equal(s.line.id,'b');assert.equal(s.phase,'playing');
 player.options.onended();assert.equal(s.phase,'own');assert.equal(s.line.id,'c');assert.equal(s.revealed,false);
 await s.replay();assert.equal(s.phase,'playing');player.options.onended();assert.equal(s.phase,'own');assert.equal(s.line.id,'c');
 s.step(1,true);assert.equal(s.phase,'own');assert.equal(s.line.id,'d');s.dispose();
});
test('manual next genuinely advances a hidden own line and previous hides it again',()=>{
 const {s}=setup();s.startPractice('cloze',{scene:'all',from:1,to:4});s.reveal();assert.equal(s.revealed,true);s.step(1);assert.equal(s.line.id,'b');s.step(-1);assert.equal(s.line.id,'a');assert.equal(s.revealed,false);s.dispose();
});
test('practice range repeat, completion, resume and role-specific saved position',async()=>{
 const {s,ctx}=setup();s.startPractice('audio',{scene:'all',from:3,to:4});s.reveal();s.seek(1.2);s.pause();assert.equal(ctx.small.sessions.audio.lineId,'c');assert.equal(ctx.small.sessions.audio.revealed,true);
 s.startPractice('audio',ctx.small.sessions.audio.range,{resume:true});assert.equal(s.line.id,'c');assert.equal(s.revealed,true);assert.equal(s.position,1.2);
 s.prefs.repeat=true;s.step(1);s.step(1);assert.equal(s.line.id,'c');s.prefs.repeat=false;s.step(1);s.step(1);assert.equal(s.phase,'complete');assert.equal(ctx.small.sessions.audio,undefined);s.dispose();
});
test('stopping while clip resolution is pending cannot start stale media',async()=>{
 let done;const {s,events}=setup({resolve:()=>new Promise(r=>done=r)});s.select(data.lines[0],{play:true});await flush();s.stop();done({id:'a',duration:1});await flush();assert.equal(events.includes('a'),false);assert.equal(s.phase,'idle');s.dispose();
});
test('missing clips and autoplay failure retain manual progress and permit retry',async()=>{
 const {s,player}=setup({resolve:async()=>null});s.select(data.lines[0],{play:true});await flush();assert.equal(s.phase,'missing');s.step(1);assert.equal(s.line.id,'b');
 s.resolve=async()=>({id:'b'});player.play=async()=>{throw Object.assign(Error('blocked'),{name:'NotAllowedError'});};await s.play();assert.equal(s.phase,'error');assert.match(s.message,/再生ボタン/);s.dispose();
});
test('speed and seek preserve current line; speaking budget includes adjustable margin',async()=>{
 const {s,player}=setup();s.select(data.lines[0],{play:true});await flush();s.setRate(1.25);s.seek(2);assert.equal(s.line.id,'a');assert.equal(player.rate,1.25);assert.equal(player.position,2);
 assert.equal(speakingSeconds(8,1,3),13);assert.equal(speakingSeconds(0,1,0),3.75);s.dispose();
});
test('one next-clip prefetch releases the old element instead of accumulating media',()=>{
 const list=[];const p=new NextClipPreloader(()=>{const a={load(){},removeAttribute(){this.src='';}};list.push(a);return a;});
 p.set({id:'a',file:'audio/lines/s/a.mp3'});p.set({id:'a',file:'audio/lines/s/a.mp3'});assert.equal(list.length,1);p.set({id:'b',file:'audio/lines/s/b.mp3'});assert.equal(list[0].src,'');p.clear();assert.equal(list[1].src,'');
});
test('own-turn automatic progression honors speech budget and explicit interruption',async t=>{
 const {s}=setup();await s.manifest;
 t.mock.timers.enable({apis:['setTimeout','Date']});
 s.startPractice('audio',{scene:'all',from:3,to:4});s.setPrefs({auto:true,extra:0});
 t.mock.timers.tick(4000);assert.equal(s.line.id,'c');s.pause();t.mock.timers.tick(20000);assert.equal(s.line.id,'c');
 await s.toggle();t.mock.timers.tick(1000);assert.equal(s.line.id,'d');s.dispose();
});
test('static URL playback avoids object URLs and resumes at a bounded saved offset',async()=>{
 let a;const p=new AudioPlayer(()=>a={pause(){},load(){},removeAttribute(){},play:async()=>{},duration:10,currentTime:0});
 await p.play({url:'https://example.test/app/audio.mp3',start:0,end:null},{position:4});a.onloadedmetadata();assert.equal(a.currentTime,4);assert.equal(p.url,null);p.stop();
});
