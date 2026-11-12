import test from 'node:test';
import assert from 'node:assert/strict';
import {bookmarkedLines,newestBookmark,normalizeSingleBookmark,prepareBookmarkJump} from '../dist/modules/bookmarks.js';

const lines=[
 {id:'act1-speech-0001',scene:'act1',speaker:'A',ordinal:1,text:'First line.'},
 {id:'act1-speech-0002',scene:'act1',speaker:'B',ordinal:2,text:'Second line.'},
 {id:'act2-speech-0003',scene:'act2',speaker:'A',ordinal:3,text:'Third line.'}
];

test('only the latest marked line is returned, regardless of script order',()=>{
 const progress={
  'act1-speech-0001':{bookmarked:true,bookmarkAt:300,level:1},
  'act2-speech-0003':{bookmarked:true,bookmarkAt:200,level:2}
 };
 assert.equal(newestBookmark({lines},progress)?.id,'act1-speech-0001');
 assert.deepEqual(bookmarkedLines({lines},progress).map(l=>l.id),['act1-speech-0001']);
 assert.deepEqual(bookmarkedLines({lines},{}),[]);
 assert.deepEqual(bookmarkedLines(null,progress),[]);
});

test('legacy multiple bookmarks migrate without resetting other progress',()=>{
 const progress={
  'act1-speech-0001':{bookmarked:true,updatedAt:20,review:true,level:2},
  'act1-speech-0002':{bookmarked:false,updatedAt:200,review:true,level:1},
  'act2-speech-0003':{bookmarked:true,updatedAt:120,level:0}
 };
 assert.equal(normalizeSingleBookmark({lines},progress),true);
 assert.equal(progress['act1-speech-0001'].bookmarked,false);
 assert.equal(progress['act1-speech-0001'].review,true);
 assert.equal(progress['act1-speech-0001'].level,2);
 assert.equal(progress['act2-speech-0003'].bookmarked,true);
 assert.equal(progress['act1-speech-0002'].review,true);
 assert.equal(normalizeSingleBookmark({lines},progress),false);
 assert.equal(newestBookmark({lines},progress).id,'act2-speech-0003');
});

test('bookmarkAt is preferred over unrelated mastery updates',()=>{
 const progress={
  'act1-speech-0001':{bookmarked:true,bookmarkAt:100,updatedAt:9999},
  'act2-speech-0003':{bookmarked:true,bookmarkAt:200,updatedAt:201}
 };
 assert.equal(newestBookmark({lines},progress)?.id,'act2-speech-0003');
});

test('jump restores bookmark across scene, role, search and review filters',()=>{
 const small={role:'A',font:22,scene:'act1',speaker:'B',query:'keyword',reviewOnly:true,bookmarkOnly:true,read:{id:'old',offset:42}};
 assert.equal(prepareBookmarkJump(small,lines[2]),true);
 assert.deepEqual({scene:small.scene,speaker:small.speaker,query:small.query,reviewOnly:small.reviewOnly,bookmarkOnly:small.bookmarkOnly,read:small.read},
  {scene:'act2',speaker:'all',query:'',reviewOnly:false,bookmarkOnly:false,read:{id:'act2-speech-0003',scene:'act2',highlight:true}});
 assert.equal(small.font,22);
 assert.equal(small.role,'A');
 assert.deepEqual(JSON.parse(JSON.stringify(small)).read,small.read);
});

test('invalid target leaves reading position intact',()=>{
 const small={scene:'act1',read:{id:'current'}};
 assert.equal(prepareBookmarkJump(small,null),false);
 assert.deepEqual(small,{scene:'act1',read:{id:'current'}});
});
