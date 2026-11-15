import { useNavigate } from 'react-router-dom'
import { t, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { moodOf, suppList, suppCountsOn, habitList, habitsDoneOn, symptomsOf, MOOD_FACE, MOOD_LABEL } from '../lib/wellbeing.js'
import { dayNutrition, waterAim } from '../lib/nutrition.js'
import { trainedDays } from '../lib/wellbeing-insights.js'
import Icon from './Icon.jsx'
import CardHead from './CardHead.jsx'
import '../views/Wellbeing.css'

// Home's Wellbeing card (fork module), today at a glance:
//   on top, three tiles: mood, supplements and habits (these two fill as the day gets there);
//   below, nutrition as three bars against the goals: calories with the deficit so far, protein, water.
// A bar turns green once its goal is reached (calories orange over the range). A tap opens the
// Wellbeing screen, where the day is logged.

/** One tile: the value, a line under it, and how full it is (0 to 1, null for no fill). */
function Tile({ v, l, fill, done, title }) {
  const pct = fill == null ? null : Math.max(0, Math.min(100, Math.round(fill * 100)))
  return <div className={'wbc-i' + (done ? ' done' : '')} title={title}>
    {pct != null && <span className="wbc-f" style={{ height: pct + '%' }} aria-hidden="true" />}
    {done && <Icon name="check" className="wbc-ok" />}
    <span className="wbc-v">{v}</span><span className="small dim">{l}</span>
  </div>
}

/**
 * One nutrition line: the name, and on the right what is left to go (or what was had, without a
 * goal); a bar filled with what was had; under it, what was had against the goal, and a note.
 */
function Bar({ icon, label, v, sub, note, noteCls, fill, state }) {
  const pct = fill == null ? null : Math.max(0, Math.min(100, Math.round(fill * 100)))
  return <div className={'wbn-r' + (state ? ' ' + state : '')}>
    <div className="wbn-t">
      <span className="wbn-l"><Icon name={icon} />{label}</span>
      <span className="wbn-v">{v}{state === 'done' && <Icon name="check" className="wbn-ok" />}</span>
    </div>
    {pct != null && <div className="wbn-bar"><span style={{ width: pct + '%' }} /></div>}
    {(sub || note) && <div className="wbn-s"><span className="dim">{sub}</span>{note && <span className={'wbn-note ' + (noteCls || '')}>{note}</span>}</div>}
  </div>
}

export default function WellbeingCard({ S }) {
  const nav = useNavigate()
  const day = todayISO()
  const m = moodOf(S, day)
  const tot = dayNutrition(S, day, { today: day, trained: trainedDays(S) })
  const loc = v => Math.round(v).toLocaleString(dateLocale())
  const lit = ml => (Math.round(ml / 10) / 100).toLocaleString(dateLocale(), { maximumFractionDigits: 2 })
  const rangeOf = (x, f = loc) => (x.min != null && x.max != null && x.min !== x.max ? `${f(x.min)}–${f(x.max)}` : f(x.max ?? x.min))
  const aim = x => (x ? x.min ?? x.max : null)
  // What can still be eaten runs to the top of the range; what is still to reach, to its bottom.
  const top = x => x.max ?? x.min
  const g = tot.goals
  const r = tot.target
  const supps = suppList(S), counts = suppCountsOn(S, day)
  const suppShare = supps.length ? supps.reduce((a, x) => a + Math.min(counts[x.id] || 0, x.times) / x.times, 0) / supps.length : 0
  const suppFull = supps.filter(x => (counts[x.id] || 0) >= x.times).length
  const habits = habitList(S), done = habitsDoneOn(S, day)
  const sym = Object.keys(symptomsOf(S, day)?.s || {}).length
  const nothing = !m && !tot.count && !tot.water && !Object.keys(counts).length && !done.length && !sym
  // A ceiling alone ("up to 2,250") is not something to reach: only a range with a floor turns green.
  const kcalState = tot.status === 'over' ? 'over' : tot.status === 'in' && r?.min != null ? 'done' : ''
  const protein = tot.protein ?? 0
  const wAim = waterAim(g)
  return <div className="card tap-host">
    <CardHead icon="smile" tint="var(--green)" eyebrow={t('Wellbeing')} title={nothing ? t('How is your day going?') : t('Today')}
      open={{ onClick: () => nav('/wellbeing') }} action={<Icon name="chevronRight" className="chev" />} />
    <div className="wbc">
      <Tile title={t('Mood')} v={m ? MOOD_FACE[m.mood] : '–'} l={m ? t(MOOD_LABEL[m.mood]) : t('Mood')} />
      {supps.length > 0 && <Tile v={`${suppFull}/${supps.length}`} l={t('Supplements')} fill={suppShare} done={suppFull === supps.length} />}
      {habits.length > 0 && <Tile v={`${done.length}/${habits.length}`} l={t('Habits')} fill={done.length / habits.length} done={done.length === habits.length} />}
    </div>
    <div className="wbn" aria-label={t('Nutrition')}>
      <Bar icon="flame" label={t('Calories')}
        v={!r ? `${loc(tot.kcal)} kcal` : tot.kcal > top(r) ? t('{0} kcal over', loc(tot.kcal - top(r))) : t('{0} kcal left', loc(top(r) - tot.kcal))}
        sub={r ? t('{0} of {1} kcal', loc(tot.kcal), rangeOf(r)) : null}
        fill={r ? tot.kcal / aim(r) : null} state={kcalState}
        note={tot.deficit != null ? (tot.deficit >= 0 ? t('{0} kcal deficit', loc(tot.deficit)) : t('{0} kcal surplus', loc(-tot.deficit))) : null}
        noteCls={tot.deficit != null && tot.deficit < 0 ? 'sur' : 'def'} />
      <Bar icon="medal" label={t('Protein')}
        v={!g?.protein ? `${protein} g` : protein >= aim(g.protein) ? `${protein} g` : t('{0} g to go', loc(aim(g.protein) - protein))}
        sub={g?.protein ? t('{0} of {1} g', protein, rangeOf(g.protein)) : null}
        fill={g?.protein ? protein / aim(g.protein) : null} state={g?.protein && protein >= aim(g.protein) ? 'done' : ''} />
      <Bar icon="drop" label={t('Water')}
        v={tot.water >= wAim ? `${lit(tot.water)} L` : t('{0} L to go', lit(wAim - tot.water))}
        sub={t('{0} of {1} L', lit(tot.water), g?.water ? rangeOf(g.water, lit) : lit(wAim))}
        fill={tot.water / wAim} state={tot.water >= wAim ? 'done' : ''} />
    </div>
  </div>
}
