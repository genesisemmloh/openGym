// The Group (fork): a board of the people on this server who chose to share how often they train.
// Opt-in per profile (S.group = { share: true, alias, area }); someone who does not share is not on
// the board and does not see it. Only counts leave a profile: workouts this week and this month,
// minutes trained, and the week streak (the same walk the app and the trainer view use). Never
// weights, routines, body weight or anything of the Wellbeing module. Pure, so it is tested.
import { streakWalk, weekKeyOf } from './coach/core/streak.js';

export const ALIAS_MAX = 24;
export const AREA_MAX = 24;
const MAX_MIN = 300; // a session left running all night counts as five hours at most

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clip = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** { share, alias, area } of a profile; share only when it is exactly true. */
export function groupSettings(S) {
  const g = S && typeof S.group === 'object' && S.group ? S.group : {};
  return { share: g.share === true, alias: clip(g.alias, ALIAS_MAX), area: clip(g.area, AREA_MAX) };
}

const minutesOf = w => {
  const s = Number(w?.start), e = Number(w?.end);
  return s > 0 && e > s ? Math.min(MAX_MIN, Math.round((e - s) / 60000)) : 0;
};

/** One profile's counts on `today` (YYYY-MM-DD): { week, month, minWeek, minMonth, streak }. */
export function memberStats(S, today) {
  const wk = weekKeyOf(today, 1);
  const ym = today.slice(0, 7);
  const out = { week: 0, month: 0, minWeek: 0, minMonth: 0, streak: 0 };
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    if (!w || !ISO.test(w.d || '') || w.d > today) continue;
    const m = minutesOf(w);
    if (w.d.startsWith(ym)) { out.month++; out.minMonth += m; }
    if (weekKeyOf(w.d, 1) === wk) { out.week++; out.minWeek += m; }
  }
  try { out.streak = streakWalk(S, today).current || 0; } catch { out.streak = 0; }
  return out;
}

/**
 * The board for `meUid` from `people` ([{ uid, name, S }], disabled accounts already left out).
 * { joined, count, members: [{ alias, area, me, ...stats }], totals: { week, month, minMonth } }.
 * Someone who does not share gets only how many people do, never the list.
 */
export function groupBoard(people, meUid, today) {
  const sharing = people.filter(p => groupSettings(p.S).share);
  const me = people.find(p => p.uid === meUid);
  const joined = !!me && groupSettings(me.S).share;
  if (!joined) return { joined: false, count: sharing.length, members: [], totals: null };
  const members = sharing.map(p => {
    const g = groupSettings(p.S);
    return { alias: g.alias || clip(p.name, ALIAS_MAX) || '?', area: g.area, me: p.uid === meUid, ...memberStats(p.S, today) };
  });
  const totals = members.reduce((t, m) => ({ week: t.week + m.week, month: t.month + m.month, minMonth: t.minMonth + m.minMonth }), { week: 0, month: 0, minMonth: 0 });
  members.sort((a, b) => b.week - a.week || b.month - a.month || b.streak - a.streak || a.alias.localeCompare(b.alias));
  return { joined: true, count: members.length, members, totals };
}

/** `today` as the app sent it when it is a date within a day of the server's, else the server's. */
export function todayFrom(param, now = Date.now()) {
  const server = new Date(now).toISOString().slice(0, 10);
  if (!ISO.test(String(param || ''))) return server;
  const diff = Math.abs(new Date(param + 'T12:00:00Z').getTime() - new Date(server + 'T12:00:00Z').getTime());
  return diff <= 86400000 ? param : server;
}
