import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSettings, memberStats, groupBoard, todayFrom } from '../group.js';

const T = '2026-11-18'; // a Wednesday
const at = (d, min) => ({ d, start: new Date(d + 'T10:00:00Z').getTime(), end: new Date(d + 'T10:00:00Z').getTime() + min * 60000 });

test('group settings share only when switched on, and trim the names', () => {
  assert.deepEqual(groupSettings({}), { share: false, alias: '', area: '' });
  assert.deepEqual(groupSettings({ group: { share: true, alias: '  Dominic  ', area: 'IT' } }), { share: true, alias: 'Dominic', area: 'IT' });
  assert.equal(groupSettings({ group: { share: 'yes' } }).share, false);
});

test('member stats count this week (Monday first), this month and minutes', () => {
  const S = { workouts: [at('2026-11-16', 60), at('2026-11-18', 45), at('2026-11-10', 50), at('2026-10-30', 40), at('2026-11-19', 30)] };
  const s = memberStats(S, T);
  assert.equal(s.week, 2);
  assert.equal(s.month, 3);
  assert.equal(s.minWeek, 105);
  assert.equal(s.minMonth, 155);
  assert.ok(s.streak >= 1);
});

test('the board shows only people who share, and nothing to someone who does not', () => {
  const people = [
    { uid: 'a', name: 'Ana', S: { group: { share: true, area: 'HR' }, workouts: [at('2026-11-17', 30)] } },
    { uid: 'b', name: 'Bo', S: { group: { share: true, alias: 'Dominic', area: 'IT' }, workouts: [at('2026-11-16', 30), at('2026-11-17', 30)] } },
    { uid: 'c', name: 'Cy', S: { workouts: [at('2026-11-16', 30)] } },
  ];
  const outsider = groupBoard(people, 'c', T);
  assert.deepEqual(outsider, { joined: false, count: 2, members: [], totals: null });
  const board = groupBoard(people, 'a', T);
  assert.equal(board.joined, true);
  assert.deepEqual(board.members.map(m => [m.alias, m.area, m.week, m.me]), [['Dominic', 'IT', 2, false], ['Ana', 'HR', 1, true]]);
  assert.deepEqual(board.totals, { week: 3, month: 3, minMonth: 90 });
  assert.equal(JSON.stringify(board).includes('workouts'), false);
});

test('today follows the app within a day of the server', () => {
  const now = new Date('2026-11-18T23:30:00Z').getTime();
  assert.equal(todayFrom('2026-11-19', now), '2026-11-19');
  assert.equal(todayFrom('2026-12-30', now), '2026-11-18');
  assert.equal(todayFrom('bad', now), '2026-11-18');
});
