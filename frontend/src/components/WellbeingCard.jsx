import { useNavigate } from 'react-router-dom'
import { t, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { moodOf, suppList, suppCountsOn, habitList, habitsDoneOn, symptomsOf, MOOD_FACE, MOOD_LABEL } from '../lib/wellbeing.js'
import { dayNutrition } from '../lib/nutrition.js'
import { trainedDays } from '../lib/wellbeing-insights.js'
import Icon from './Icon.jsx'
import CardHead from './CardHead.jsx'
import '../views/Wellbeing.css'

// Home's Wellbeing card (fork module): today at a glance (mood, calories with the deficit so far,
// protein, supplements, habits). Each tile with a goal fills from the bottom as the day gets there,
// turns green once it is reached (orange when calories go over the range), and keeps its number.
// A tap opens the Wellbeing screen, where the day is logged.

/** One tile: the value, a line under it, and how full it is (0 to 1, null for no fill). */
function Tile({ v, l, extra, fill, state, title }) {
  const pct = fill == null ? null : Math.max(0, Math.min(100, Math.round(fill * 100)))
  return <div className={'wbc-i' + (state ? ' ' + state : '')} title={title}>
    {pct != null && <span className="wbc-f" style={{ height: pct + '%' }} aria-hidden="true" />}
    {state === 'done' && <Icon name="check" className="wbc-ok" />}
    <span className="wbc-v">{v}</span><span className="small dim">{l}</span>{extra}
  </div>
}

export default function WellbeingCard({ S }) {
  const nav = useNavigate()
  const day = todayISO()
  const m = moodOf(S, day)
  const tot = dayNutrition(S, day, { today: day, trained: trainedDays(S) })
  const loc = v => Math.round(v).toLocaleString(dateLocale())
  const rangeOf = x => (x.min != null && x.max != null && x.min !== x.max ? `${loc(x.min)}–${loc(x.max)}` : loc(x.max ?? x.min))
  const aim = x => (x ? x.min ?? x.max : null)
  const r = tot.target
  const p = tot.goals?.protein
  const supps = suppList(S), counts = suppCountsOn(S, day)
  const suppShare = supps.length ? supps.reduce((a, x) => a + Math.min(counts[x.id] || 0, x.times) / x.times, 0) / supps.length : 0
  const suppFull = supps.filter(x => (counts[x.id] || 0) >= x.times).length
  const habits = habitList(S), done = habitsDoneOn(S, day)
  const sym = Object.keys(symptomsOf(S, day)?.s || {}).length
  const nothing = !m && !tot.count && !tot.water && !Object.keys(counts).length && !done.length && !sym
  // A ceiling alone ("up to 2,250") is not something to reach: only a range with a floor turns green.
  const kcalState = tot.status === 'over' ? 'over' : tot.status === 'in' && r?.min != null ? 'done' : ''
  const protein = tot.protein ?? 0
  return <div className="card tap-host">
    <CardHead icon="smile" tint="var(--green)" eyebrow={t('Wellbeing')} title={nothing ? t('How is your day going?') : t('Today')}
      open={{ onClick: () => nav('/wellbeing') }} action={<Icon name="chevronRight" className="chev" />} />
    <div className="wbc">
      <Tile title={t('Mood')} v={m ? MOOD_FACE[m.mood] : '–'} l={m ? t(MOOD_LABEL[m.mood]) : t('Mood')} />
      <Tile v={loc(tot.kcal)} l={r ? t('of {0} kcal', rangeOf(r)) : 'kcal'} fill={r ? tot.kcal / aim(r) : null} state={kcalState}
        extra={tot.deficit != null && <span className={'small wbc-dl ' + (tot.deficit >= 0 ? 'wbc-def' : 'wbc-sur')}>
          {tot.deficit >= 0 ? t('{0} kcal deficit', loc(tot.deficit)) : t('{0} kcal surplus', loc(-tot.deficit))}</span>} />
      <Tile v={`${protein} g`} l={p ? t('of {0} g protein', rangeOf(p)) : t('Protein')} fill={p ? protein / aim(p) : null}
        state={p && protein >= aim(p) ? 'done' : ''} />
      {supps.length > 0 && <Tile v={`${suppFull}/${supps.length}`} l={t('Supplements')} fill={suppShare} state={suppFull === supps.length ? 'done' : ''} />}
      {habits.length > 0 && <Tile v={`${done.length}/${habits.length}`} l={t('Habits')} fill={done.length / habits.length} state={done.length === habits.length ? 'done' : ''} />}
    </div>
  </div>
}
