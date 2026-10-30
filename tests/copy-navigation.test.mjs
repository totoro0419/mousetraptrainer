import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=async p=>readFile(new URL('../dist/'+p,import.meta.url),'utf8');
const [app,reader,practice,ui,css,audio]=await Promise.all(
 ['app.js','modules/reader.js','modules/rehearsal.js','modules/ui.js','styles.css','modules/audio.js'].map(file)
);
test('visible navigation has three tabs; settings opens via global top-right gear',()=>{
 const shell=app.slice(app.indexOf('function shell()'),app.indexOf('async function render()'));
 assert.match(shell,/data-action="open-settings"/);
 assert.equal((shell.match(/navItem\('settings','設定','settings'\)/g)||[]).length,0);
 assert.match(shell,/navItem\('rehearse','練習','play'\)/);
 assert.match(app,/lastContentRoute/);
 assert.match(app,/gear\.onclick=/);
 assert.match(css,/\.main-shell>\.global-settings\{/);
 assert.match(css,/\.reader-top\{padding-right:/);
 const glyph=ui.match(/settings:'([^']+)'/);
 assert.ok(glyph,'settings icon registered');
 assert.ok((glyph[1].match(/L/g)||[]).length>30,'settings icon is an outlined gear, not a sun with spokes');
 assert.ok(glyph[1].includes('a3.05'),'gear has a center hole');
});
test('natural and consistent practice labels replace awkward legacy wording',()=>{
 assert.match(app,/練習を始める/);
 assert.match(app,/ナビゲーション|<nav class="bottom-nav"/);
 assert.doesNotMatch(app,/稽古する|稽古の続き/);
 assert.match(practice,/セリフの練習/);
 assert.match(practice,/穴埋め練習/);
 assert.match(practice,/音声練習/);
 assert.match(practice,/練習が終わりました/);
 assert.doesNotMatch(practice,/稽古をはじめよう|台本穴埋め|音声稽古|YOUR TURN|おつかれさまでした/);
 assert.match(reader,/セリフを検索/);
 assert.match(reader,/すべての場面を表示/);
 assert.match(audio,/音声ファイルを追加/);
 assert.doesNotMatch(audio,/録音音声を追加/);
});
test('reader typography control is reachable through settings without duplicated toolbar button',()=>{
 assert.doesNotMatch(reader,/data-action="type"/);
 assert.match(app,/id="font-size"/);
 assert.match(app,/id="line-height"/);
 assert.match(app,/data-action="open-settings"/);
});
