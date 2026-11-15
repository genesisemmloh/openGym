import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroup, joinGroup, leaveGroup, renameGroup, newGroupCode, removeMember, deleteGroup, myGroups, memberKey, newCode, cleanCode } from '../groups.js';

const T = '2026-11-18';
const at = d => ({ d, start: Date.parse(d + 'T10:00:00Z'), end: Date.parse(d + 'T11:00:00Z') });

test('codes avoid look-alike letters and never repeat', () => {
  const c = newCode(new Set());
  assert.match(c, /^[A-HJKMNP-Z2-9]{8}$/);
  let n = 0;
  const seq = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
  assert.equal(newCode(new Set(['AAAAAAAA']), () => seq[n++]), 'BBBBBBBB');
  assert.equal(cleanCode(' gym-4k7p '), 'GYM4K7P');
});

test('create, join with any spelling of the code, and be in several groups', () => {
  const groups = [];
  const a = createGroup(groups, 'ana', 'Oficina IT', { id: 'g1' });
  assert.equal(a.status, 200);
  const b = createGroup(groups, 'bo', 'Amigos', { id: 'g2' });
  assert.equal(joinGroup(groups, 'ana', b.body.code.toLowerCase()).status, 200);
  assert.equal(joinGroup(groups, 'bo', a.body.code).status, 200);
  assert.equal(joinGroup(groups, 'bo', a.body.code).changed, undefined); // twice changes nothing
  assert.equal(joinGroup(groups, 'cy', 'NOPE1234').status, 404);
  assert.equal(createGroup(groups, 'ana', '   ').status, 400);
  const people = new Map([['ana', { name: 'Ana', S: { group: { area: 'HR' }, workouts: [at('2026-11-17')] } }], ['bo', { name: 'Bo', S: { workouts: [at('2026-11-16'), at('2026-11-18')] } }]]);
  const anas = myGroups(groups, 'ana', people, T);
  assert.deepEqual(anas.map(g => [g.name, g.isOwner, g.count]), [['Oficina IT', true, 2], ['Amigos', false, 2]]);
  assert.deepEqual(anas[0].members.map(m => [m.alias, m.week, m.me, !!m.key]), [['Bo', 2, false, true], ['Ana', 1, true, true]]);
  assert.equal(anas[1].members.some(m => m.key), false); // only the owner sees member keys
  assert.deepEqual(anas[0].totals, { week: 3, month: 3, minMonth: 180 });
  assert.equal(JSON.stringify(anas).includes('workouts'), false);
});

test('only the owner renames, renews the code, removes and deletes', () => {
  const groups = [];
  const { body } = createGroup(groups, 'ana', 'Team', { id: 'g1' });
  joinGroup(groups, 'bo', body.code);
  assert.equal(renameGroup(groups, 'bo', 'g1', 'X').status, 403);
  assert.equal(renameGroup(groups, 'ana', 'g1', 'Equipo A').body.name, 'Equipo A');
  const old = groups[0].code;
  const fresh = newGroupCode(groups, 'ana', 'g1').body.code;
  assert.notEqual(fresh, old);
  assert.equal(joinGroup(groups, 'cy', old).status, 404);
  assert.equal(removeMember(groups, 'ana', 'g1', memberKey('g1', 'ana')).status, 400);
  assert.equal(removeMember(groups, 'ana', 'g1', memberKey('g1', 'bo')).status, 200);
  assert.equal(groups[0].members.length, 1);
  assert.equal(deleteGroup(groups, 'bo', 'g1').status, 404);
  assert.equal(deleteGroup(groups, 'ana', 'g1').status, 200);
  assert.equal(groups.length, 0);
});

test('the owner leaving hands the group on; the last one out deletes it', () => {
  const groups = [];
  const { body } = createGroup(groups, 'ana', 'Team', { id: 'g1', now: 1 });
  joinGroup(groups, 'bo', body.code, { now: 2 });
  joinGroup(groups, 'cy', body.code, { now: 3 });
  leaveGroup(groups, 'ana', 'g1');
  assert.equal(groups[0].owner, 'bo');
  leaveGroup(groups, 'bo', 'g1');
  leaveGroup(groups, 'cy', 'g1');
  assert.equal(groups.length, 0);
  assert.equal(leaveGroup(groups, 'cy', 'g1').status, 404);
});
