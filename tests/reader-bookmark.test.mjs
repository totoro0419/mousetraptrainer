import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeBundle,filterLines,advanceProgress} from '../dist/modules/data.js';

const read=async path=>readFile(new URL('../dist/'+path,import.meta.url),'utf8');
const [reader,css,app,ui]=await Promise.all(['modules/reader.js','styles.css','app.js','modules/ui.js'].map(read));
const fixture=JSON.parse(await readFile(new URL('./fixtures/script.json',import.meta.url)));
const data=normalizeBundle(fixture);

test('bookmarks are a distinct persistent progress property that does not overwrite review or learning',()=>{
 const state={'sample-001':{bookmarked:true,review:true,level:1}};
 const next=advanceProgress(state['sample-001']);
 assert.equal(next.bookmarked,true);
 assert.equal(next.review,true);
 assert.equal(next.level,2);
 assert.deepEqual(filterLines(data,{bookmarkedOnly:true,progress:state}).map(l=>l.id),['sample-001']);
 assert.deepEqual(filterLines(data,{reviewOnly:true,progress:state}).map(l=>l.id),['sample-001']);
 assert.equal(filterLines(data,{bookmarkedOnly:true,reviewOnly:true,progress:{'sample-001':{bookmarked:true}}}).length,0);
});

test('no ellipsis: independent bookmark button and row tapping preserve word and stage-direction actions',()=>{
 assert.doesNotMatch(reader,/speech-analysis|data-action=analysis|icon\('more'\)/);
 assert.match(reader,/class="speech-bookmark" data-action="bookmark"/);
 assert.match(reader,/aria-pressed="\$\{!!p\.bookmarked\}"/);
 assert.match(reader,/ctx\.setProgress\(line\.id,\{\.\.\.current,bookmarked:!current\.bookmarked/);
 assert.match(reader,/closest\('button,a,input,select,textarea,\[contenteditable\]'\)/);
 assert.match(reader,/showDictionary\(line,token,ctx\)/);
 assert.match(reader,/showDirection\(line\)/);
 assert.match(reader,/bookmarkOnly=filters\.querySelector/);
 assert.match(app,/栞を付けました/);
 assert.match(ui,/flag:'M5 3v18/);
});

test('reader highlights own lines subtly and prioritizes meaning and context over grammar',()=>{
 assert.match(css,/\.reader-scroll \.speech\.mine\{background:#eef6ff/);
 assert.match(css,/\.speech-bookmark\[aria-pressed="true"\]/);
 const template=reader.slice(reader.indexOf('export function showAnalysis'),reader.indexOf('export function speechNode'));
 const inOrder=['日本語訳','analysisNarrative(line,data)','文法・構文','重要表現','学習状態'].map(word=>template.indexOf(word));
 assert.ok(inOrder.every((value,index)=>value>=0&&(!index||value>inOrder[index-1])),'Prioritized analysis order');
});
