import test from 'node:test';
import assert from 'node:assert/strict';
import {bookmarkedLines,prepareBookmarkJump} from '../dist/modules/bookmarks.js';

const lines=[
 {id:'act1-speech-0001',scene:'act1',speaker:'A',ordinal:1,text:'First line.'},
 {id:'act1-speech-0002',scene:'act1',speaker:'B',ordinal:2,text:'Second line.'},
 {id:'act2-speech-0003',scene:'act2',speaker:'A',ordinal:3,text:'Third line.'}
];

test('bookmarked lines are listed in script order and include every role/scene',()=>{
 const progress={
  'act2-speech-0003':{bookmarked:true,level:2},
  'act1-speech-0002':{bookmarked:false,review:true},
  'act1-speech-0001':{bookmarked:true,level:0}
 };
 assert.deepEqual(bookmarkedLines({lines},progress).map(item=>item.id),['act1-speech-0001','act2-speech-0003']);
 assert.equal(progress['act2-speech-0003'].bookmarked,true);
 assert.deepEqual(bookmarkedLines({lines},{}),[]);
 assert.deepEqual(bookmarkedLines(null,progress),[]);
});

test('bookmark jump reveals target across filters and persists using current read state',()=>{
 const small={role:'A',font:22,scene:'act1',speaker:'B',query:'keyword',reviewOnly:true,bookmarkOnly:true,read:{id:'old',offset:42}};
 assert.equal(prepareBookmarkJump(small,lines[2]),true);
 assert.deepEqual({scene:small.scene,speaker:small.speaker,query:small.query,reviewOnly:small.reviewOnly,bookmarkOnly:small.bookmarkOnly,read:small.read},
  {scene:'act2',speaker:'all',query:'',reviewOnly:false,bookmarkOnly:false,read:{id:'act2-speech-0003',scene:'act2',highlight:true}});
 assert.equal(small.font,22);
 assert.equal(small.role,'A');
 assert.deepEqual(JSON.parse(JSON.stringify(small)).read,small.read);
});

test('invalid bookmark target does not destroy the current reading position',()=>{
 const small={scene:'act1',read:{id:'current'}};
 assert.equal(prepareBookmarkJump(small,null),false);
 assert.deepEqual(small,{scene:'act1',read:{id:'current'}});
});
