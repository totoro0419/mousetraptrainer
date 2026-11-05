import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetSwipeDecision,canStartSheetDismiss} from '../dist/modules/ui.js';

test('a short, purposeful downward flick dismisses the sheet',()=>{
 assert.equal(sheetSwipeDecision(32,1,45),'dismiss');
 assert.equal(sheetSwipeDecision(70,0,500),'dismiss');
 assert.equal(sheetSwipeDecision(15,0,400),'snap');
 assert.equal(sheetSwipeDecision(50,90,50),'snap');
 assert.equal(sheetSwipeDecision(-80,0,200),'expand');
});

test('dismissal only takes ownership when all scrolling content is at the top',()=>{
 const body={scrollTop:0,parentElement:null};
 const child={scrollTop:0,scrollHeight:500,clientHeight:200,parentElement:body};
 assert.equal(canStartSheetDismiss(body,child),true);
 body.scrollTop=10;
 assert.equal(canStartSheetDismiss(body,child),false);
 body.scrollTop=0;child.scrollTop=40;
 assert.equal(canStartSheetDismiss(body,child),false);
 child.scrollTop=0;
 assert.equal(canStartSheetDismiss(body,child),true);
 body.scrollTop=1;
 assert.equal(canStartSheetDismiss(body,child),true);
});
