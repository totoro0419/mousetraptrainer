import test from 'node:test';
import assert from 'node:assert/strict';
import {FESTIVAL, festivalCountdown} from '../dist/modules/festival-countdown.js';

test('festival date stays fixed at April 27, 2027', () => {
  assert.equal(FESTIVAL.date, '2027-04-27');
  assert.equal(FESTIVAL.weekday, 'TUE');
});

test('counts calendar days in Japan, including when a device uses another timezone', () => {
  assert.deepEqual(festivalCountdown(new Date('2026-11-01T02:00:00.000Z')), {
    phase: 'upcoming', days: 177, prefix: 'あと', value: '177', suffix: '日'
  });
  assert.equal(festivalCountdown(new Date('2026-10-31T14:59:59.000Z')).days, 178);
  assert.equal(festivalCountdown(new Date('2026-10-31T15:00:00.000Z')).days, 177);
});

test('changes at Japan midnight and shows the event day and finished state', () => {
  assert.equal(festivalCountdown(new Date('2027-04-26T14:59:59.000Z')).days, 1);
  assert.deepEqual(festivalCountdown(new Date('2027-04-26T15:00:00.000Z')), {
    phase: 'today', days: 0, prefix: '', value: '本日開催', suffix: ''
  });
  assert.equal(festivalCountdown(new Date('2027-04-27T14:59:59.000Z')).phase, 'today');
  assert.equal(festivalCountdown(new Date('2027-04-27T15:00:00.000Z')).phase, 'ended');
  assert.equal(festivalCountdown(new Date('2027-04-27T15:00:00.000Z')).value, '終了');
});
