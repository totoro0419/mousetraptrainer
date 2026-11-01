import test from 'node:test';
import assert from 'node:assert/strict';
import {homeProgressRings,festivalRemainingRing,HOME_RING_INNER_LENGTH,FESTIVAL_RING_WINDOW_DAYS} from '../dist/modules/home-progress.js';
import {festivalCountdown} from '../dist/modules/festival-countdown.js';

test('home ring uses the selected role counts, not global speech metadata',()=>{
 const m=homeProgressRings({total:16,counts:[3,3,10],percent:63,review:2});
 assert.equal(m.completed,10);
 assert.equal(m.practicing,3);
 assert.equal(m.unstarted,3);
 assert.equal(m.completedPercent,63);
 assert.equal(m.practicingPercent,19);
 assert.equal(m.unstartedPercent,19);
 assert.equal(Number(m.doingOffset),-Number((HOME_RING_INNER_LENGTH*0 + (2*Math.PI*55)*(10/16)).toFixed(3)));
});

test('zero and fully memorized progress remain finite',()=>{
 const empty=homeProgressRings({total:0,counts:[0,0,0]});
 assert.equal(empty.completedPercent,0);
 assert.equal(empty.practicingPercent,0);
 assert.equal(empty.unstartedPercent,0);
 const complete=homeProgressRings({total:4,counts:[0,0,4]});
 assert.equal(complete.completedPercent,100);
 assert.equal(complete.unstartedPercent,0);
});

test('festival thin ring counts down using the Japan calendar day',()=>{
 const state=festivalCountdown(new Date('2026-11-01T02:00:00Z'));
 assert.equal(state.days,177);
 const ring=festivalRemainingRing(state);
 assert.equal(ring.value,'177');
 assert.equal(ring.unit,'日');
 assert.equal(Number(ring.dash.split(' ')[0]),Number((HOME_RING_INNER_LENGTH*177/FESTIVAL_RING_WINDOW_DAYS).toFixed(3)));
});

test('festival ring is full at 365 days and empty on the day and after',()=>{
 assert.equal(festivalRemainingRing({days:365}).dash.split(' ')[0],HOME_RING_INNER_LENGTH.toFixed(3));
 assert.equal(festivalRemainingRing({days:0}).value,'本日');
 assert.equal(festivalRemainingRing({days:0}).dash.split(' ')[0],'0.000');
 assert.equal(festivalRemainingRing({days:-1}).value,'終了');
});
