import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sheetSwipeDecision,enhanceSelects,syncSelects} from '../dist/modules/ui.js';

const source=async name=>readFile(new URL('../dist/'+name,import.meta.url),'utf8');

test('down swipe closes, up swipe expands, horizontal and short gestures do not close',()=>{
 assert.equal(sheetSwipeDecision(120,8,400),'dismiss');
 assert.equal(sheetSwipeDecision(45,2,45),'dismiss');
 assert.equal(sheetSwipeDecision(40,3,400),'snap');
 assert.equal(sheetSwipeDecision(120,145,280),'snap');
 assert.equal(sheetSwipeDecision(-80,0,300),'expand');
 assert.equal(sheetSwipeDecision(-20,0,50),'snap');
 assert.equal(sheetSwipeDecision(0,0,0),'snap');
});

test('all select widgets are wired to the in-app picker',async()=>{
 const app=await source('app.js');
 const reader=await source('modules/reader.js');
 const rehearsal=await source('modules/rehearsal.js');
 const ui=await source('modules/ui.js');
 assert.equal(typeof enhanceSelects,'function');
 assert.equal(typeof syncSelects,'function');
 assert.match(app,/enhanceSelects\(main\)/);
 assert.match(reader,/syncSelects\(filters\)/);
 assert.match(rehearsal,/enhanceSelects\(holder\)/);
 assert.match(ui,/source\.hidden=true/);
 assert.match(ui,/source\.dispatchEvent\(new Event\('change'/);
 assert.match(ui,/sheet\.querySelector\('\.app-choice\[aria-current="true"\]'\)/);
 assert.match(ui,/aria-haspopup','dialog'/);
 assert.match(ui,/body\.addEventListener\('touchmove'/);
 assert.match(ui,/header\.onpointerup/);
 assert.match(ui,/e\.preventDefault\(\);translate/);
 assert.match(ui,/pointerEvents='none'/);
});

test('custom controls use no native popup or stock switch appearance',async()=>{
 const css=await source('styles.css');
 assert.match(css,/\.native-select-source\{display:none!important\}/);
 assert.match(css,/\.app-select-trigger\{/);
 assert.match(css,/\.app-choice\{/);
 assert.match(css,/input\[type=checkbox\][^{]*\{appearance:none/);
 assert.match(css,/input\[type=range\]\{appearance:none/);
 assert.match(css,/input\[type=number\]\{appearance:textfield/);
 assert.match(css,/\.sheet-head\{touch-action:none/);
 assert.match(css,/\.role-choice input\[type=radio\]\{appearance:none/);
});

test('plain radio inputs retain semantic names and stored role behavior',async()=>{
 const app=await source('app.js');
 assert.match(app,/name="role"/);
 assert.match(app,/input\[name=role\]:checked/);
 assert.match(app,/changeRole\(next\)/);
 assert.match(app,/id="home-role"/);
 assert.match(app,/onchange=e=>changeRole/);
});

test('automated swipe decision checks avoid depending on browser animations',()=>{
 // Unit tests exercise threshold/velocity; browser QA still required.
 assert.equal(sheetSwipeDecision(98,0,1000),'dismiss');
 assert.equal(sheetSwipeDecision(38,0,60),'snap');
 assert.equal(sheetSwipeDecision(39,0,48),'dismiss');
});
