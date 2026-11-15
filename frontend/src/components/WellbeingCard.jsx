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

/** One nutrition line: name and note on the left, value and goal on the right, a bar under them. */
function Bar({ icon, label, note, noteCls, v, goal, fill, state }) {
  const pct = fill == null ? null : Math.max(0, Math.min(100, Math.round(fill * 100)))
  return <div className={'wbn-r' + (state ? ' ' + state : '')}>
    <div className="wbn-t">
      <span className="wbn-l"><Icon name={icon} />{label}{note && <span className={'wbn-note ' + (noteCls || '')}>{note}</span>}</span>
      <span className="wbn-v">{v}{goal && <span className="dim"> / {goal}</span>}{state === 'done' && <Icon name="check" className="wbn-ok" />}</span>
    </div>
    {pct != null && <div className="wbn-bar"><span style={{ width: pct + '%' }} /></div>}
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
      <Bar icon="flame" label={t('Calories')} v={`${loc(tot.kcal)} kcal`} goal={r ? rangeOf(r) : null}
        fill={r ? tot.kcal / aim(r) : null} state={kcalState}
        note={tot.deficit != null ? (tot.deficit >= 0 ? t('{0} kcal deficit', loc(tot.deficit)) : t('{0} kcal surplus', loc(-tot.deficit))) : null}
        noteCls={tot.deficit != null && tot.deficit < 0 ? 'sur' : 'def'} />
      <Bar icon="medal" label={t('Protein')} v={`${protein} g`} goal={g?.protein ? rangeOf(g.protein) + ' g' : null}
        fill={g?.protein ? protein / aim(g.protein) : null} state={g?.protein && protein >= aim(g.protein) ? 'done' : ''} />
      <Bar icon="drop" label={t('Water')} v={`${lit(tot.water)} L`} goal={g?.water ? rangeOf(g.water, lit) + ' L' : `${lit(wAim)} L`}
        fill={tot.water / wAim} state={tot.water >= wAim ? 'done' : ''} />
    </div>
  </div>
}
