// Groups (fork): people on this server who train "together". Anyone signed in can create a group
// and gets a join code; anyone with the code joins; you can be in several; joining a group is the
// consent to show that group how often you train (counts only, api/group.js memberStats). The
// one who created a group runs it (rename, new code, remove someone, delete); if they leave, the
// longest-standing member takes over, and the last one out deletes it.
//
// Stored in db.json as db.groups = [{ id, name, code, owner, members: [{ uid, at }], at }]: it is
// shared between accounts, so it cannot live in one profile's state. Pure over the array it is
// given, so the rules are tested (test/groups.test.js); server.js saves db after a change.
import crypto from 'node:crypto';
import { groupSettings, memberStats } from './group.js';

export const NAME_MAX = 40;
export const MAX_GROUPS_PER_USER = 20;
export const MAX_MEMBERS = 200;
// No 0/O, 1/I/L: a code read out loud or typed from a screen should survive it.
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const cleanName = n => (typeof n === 'string' ? n.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '');
export const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export function newCode(taken, rand = n => crypto.randomInt(n)) {
  for (;;) {
    let c = '';
    for (let i = 0; i < 8; i++) c += CODE_ABC[rand(CODE_ABC.length)];
    if (!taken.has(c)) return c;
  }
}

/** A member's id as the owner sees it: stable per group, never the account id itself. */
export const memberKey = (groupId, uid) => crypto.createHash('sha256').update(groupId + ':' + uid).digest('base64url').slice(0, 12);

const err = (status, error) => ({ status, body: { error } });
const ok = body => ({ status: 200, body, changed: true });
const mine = (groups, uid) => groups.filter(g => g.members.some(m => m.uid === uid));

/** Create a group named `name` owned by `uid`. */
export function createGroup(groups, uid, name, { now = Date.now(), id = crypto.randomBytes(9).toString('base64url') } = {}) {
  const n = cleanName(name);
  if (!n) return err(400, 'a name is required');
  if (mine(groups, uid).length >= MAX_GROUPS_PER_USER) return err(409, 'too many groups');
  const g = { id, name: n, code: newCode(new Set(groups.map(x => x.code))), owner: uid, members: [{ uid, at: now }], at: now };
  groups.push(g);
  return ok({ id: g.id, code: g.code });
}

/** Join the group whose code is `code`. Joining twice is fine and changes nothing. */
export function joinGroup(groups, uid, code, { now = Date.now() } = {}) {
  const c = cleanCode(code);
  const g = c && groups.find(x => x.code === c);
  if (!g) return err(404, 'no group has that code');
  if (g.members.some(m => m.uid === uid)) return { status: 200, body: { id: g.id, name: g.name } };
  if (g.members.length >= MAX_MEMBERS) return err(409, 'the group is full');
  if (mine(groups, uid).length >= MAX_GROUPS_PER_USER) return err(409, 'too many groups');
  g.members.push({ uid, at: now });
  return ok({ id: g.id, name: g.name });
}

/** Leave group `id`. The owner leaving hands it to the longest-standing member; the last one out deletes it. */
export function leaveGroup(groups, uid, id) {
  const i = groups.findIndex(x => x.id === id);
  const g = groups[i];
  if (!g || !g.members.some(m => m.uid === uid)) return err(404, 'not in that group');
  g.members = g.members.filter(m => m.uid !== uid);
  if (!g.members.length) { groups.splice(i, 1); return ok({ deleted: true }); }
  if (g.owner === uid) g.owner = [...g.members].sort((a, b) => a.at - b.at)[0].uid;
  return ok({ left: true });
}

const owned = (groups, uid, id) => {
  const g = groups.find(x => x.id === id);
  if (!g || !g.members.some(m => m.uid === uid)) return { e: err(404, 'not in that group') };
  if (g.owner !== uid) return { e: err(403, 'only the one who runs the group can do that') };
  return { g };
};

export function renameGroup(groups, uid, id, name) {
  const { g, e } = owned(groups, uid, id); if (e) return e;
  const n = cleanName(name); if (!n) return err(400, 'a name is required');
  g.name = n;
  return ok({ name: n });
}

/** A new join code: the old one stops working, members stay. */
export function newGroupCode(groups, uid, id) {
  const { g, e } = owned(groups, uid, id); if (e) return e;
  g.code = newCode(new Set(groups.map(x => x.code)));
  return ok({ code: g.code });
}

export function removeMember(groups, uid, id, key) {
  const { g, e } = owned(groups, uid, id); if (e) return e;
  const m = g.members.find(x => memberKey(g.id, x.uid) === key);
  if (!m) return err(404, 'no such member');
  if (m.uid === uid) return err(400, 'leave the group instead');
  g.members = g.members.filter(x => x !== m);
  return ok({ removed: true });
}

export function deleteGroup(groups, uid, id) {
  const { e } = owned(groups, uid, id); if (e) return e;
  groups.splice(groups.findIndex(x => x.id === id), 1);
  return ok({ deleted: true });
}

/**
 * The groups of `uid` with their boards. `people` maps uid → { name, S } for accounts that are
 * not disabled; members of a disabled account are left off the board, not out of the group.
 */
export function myGroups(groups, uid, people, today) {
  return mine(groups, uid).map(g => {
    const isOwner = g.owner === uid;
    const members = g.members.filter(m => people.has(m.uid)).map(m => {
      const p = people.get(m.uid);
      const s = groupSettings(p.S);
      return {
        alias: s.alias || cleanName(p.name).slice(0, 24) || '?', area: s.area, me: m.uid === uid, owner: m.uid === g.owner,
        ...(isOwner ? { key: memberKey(g.id, m.uid) } : {}), ...memberStats(p.S, today),
      };
    });
    members.sort((a, b) => b.week - a.week || b.month - a.month || b.streak - a.streak || a.alias.localeCompare(b.alias));
    const totals = members.reduce((t, m) => ({ week: t.week + m.week, month: t.month + m.month, minMonth: t.minMonth + m.minMonth }), { week: 0, month: 0, minMonth: 0 });
    return { id: g.id, name: g.name, code: g.code, isOwner, count: members.length, members, totals };
  });
}
