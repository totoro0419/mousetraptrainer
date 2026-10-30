import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=async path=>readFile(new URL('../dist/'+path,import.meta.url),'utf8');
const app=await source('app.js'),css=await source('styles.css'),ui=await source('modules/ui.js');

test('settings keeps only actionable viewing and audio controls',()=>{
 const view=app.slice(app.indexOf('function renderSettings('),app.indexOf('function openDataManagement('));
 for(const id of ['font-size','line-height','show-stick','playback-rate'])assert.ok(view.includes('id="'+id+'"'),id);
 assert.ok(view.includes('data-action="audio-import"'));
 assert.ok(view.includes('data-action="manage-data"'));
 assert.equal((view.match(/class="setting-group"/g)||[]).length,2);
 assert.doesNotMatch(view,/offline-note|install-note|class="version"|data-summary|data-action="update"/);
});

test('critical low-frequency operations remain available through management',()=>{
 const start=app.indexOf('function openDataManagement('),end=app.indexOf('async function activate(',start);
 const section=app.slice(start,end);
 for(const action of ['import','library','export','install','update'])assert.ok(section.includes('data-action="'+action+'"'),action);
 assert.match(section,/import:openImport/);
 assert.match(section,/library:showLibrary/);
 assert.match(section,/export:exportBackup/);
 assert.match(section,/install:installApp/);
 assert.match(section,/update:checkUpdate/);
 assert.match(app,/function openImport\(\)/);
 assert.match(app,/'confirm-import'/);
});

test('no duplicate settings gear and obsolete offline row remain',()=>{
 assert.doesNotMatch(app,/data-action="settings-sheet"|class="topbar-title desktop-only"/);
 assert.doesNotMatch(app,/refreshOffline\(\)|id="offline-note"/);
 assert.match(app,/data-action="open-settings"/);
 assert.doesNotMatch(app,/navItem\('settings','設定','settings'\)/);
});

test('intentional motion covers entrances, press states, sheet snap and reduced-motion setting',()=>{
 for(const name of ['page-enter','toolbar-enter','choice-enter','tab-enter','content-reveal','backdrop-enter'])assert.ok(css.includes('@keyframes '+name),name);
 assert.match(css,/\.page-scroll>\.page\{animation:page-enter/);
 assert.match(css,/\.primary:active,\.secondary:active/);
 assert.match(css,/\.app-select-trigger\[aria-expanded=true\] \.icon\{transform:rotate\(180deg\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(ui,/const settle=dy=>/);
 assert.match(ui,/duration:210/);
 assert.match(ui,/if\(action==='dismiss'\)animateSheetDismiss/);
});
