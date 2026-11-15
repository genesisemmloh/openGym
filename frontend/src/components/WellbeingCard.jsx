import { useNavigate } from 'react-router-dom'
import { t, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { moodOf, suppList, suppsTakenOn, habitList, habitsDoneOn, symptomsOf, MOOD_FACE, MOOD_LABEL } from '../lib/wellbeing.js'
import { dayNutrition } from '../lib/nutrition.js'
import { trainedDays } from '../lib/wellbeing-insights.js'
import Icon from './Icon.jsx'
import CardHead from './CardHead.jsx'
import '../views/Wellbeing.css'

// Home's Wellbeing card (fork module): today at a glance (mood, calories, supplements, habits,
// symptoms). A tap opens the Wellbeing screen, where the day is logged.
export default function WellbeingCard({ S }) {
  const nav = useNavigate()
  const day = todayISO()
  const m = moodOf(S, day)
  const tot = dayNutrition(S, day, { today: day, trained: trainedDays(S) })
  const r = tot.target
  const loc = v => v.toLocaleString(dateLocale())
  const rangeOf = x => (x.min != null && x.max != null && x.min !== x.max ? `${loc(x.min)}–${loc(x.max)}` : loc(x.max ?? x.min))
  const goalText = r ? rangeOf(r) : null
  const p = tot.goals?.protein
  const supps = suppList(S), taken = suppsTakenOn(S, day)
  const habits = habitList(S), done = habitsDoneOn(S, day)
  const sym = Object.keys(symptomsOf(S, day)?.s || {}).length
  const nothing = !m && !tot.count && !tot.water && !taken.length && !done.length && !sym
  return <div className="card tap-host">
    <CardHead icon="smile" tint="var(--green)" eyebrow={t('Wellbeing')} title={nothing ? t('How is your day going?') : t('Today')}
      open={{ onClick: () => nav('/wellbeing') }} action={<Icon name="chevronRight" className="chev" />} />
    <div className="wbc">
      <div className="wbc-i" title={t('Mood')}><span className="wbc-v">{m ? MOOD_FACE[m.mood] : '–'}</span><span className="small dim">{m ? t(MOOD_LABEL[m.mood]) : t('Mood')}</span></div>
      <div className="wbc-i"><span className="wbc-v">{tot.kcal.toLocaleString(dateLocale())}</span><span className="small dim">{goalText ? t('of {0} kcal', goalText) : 'kcal'}</span></div>
      {tot.deficit != null && <div className="wbc-i"><span className={'wbc-v ' + (tot.deficit >= 0 ? 'wbc-def' : 'wbc-sur')}>{loc(Math.abs(tot.deficit))}</span>
        <span className="small dim">{tot.deficit >= 0 ? t('kcal deficit so far') : t('kcal surplus')}</span></div>}
      {(tot.protein != null || p) && <div className="wbc-i"><span className="wbc-v">{tot.protein ?? 0} g</span>
        <span className="small dim">{p ? t('of {0} g protein', rangeOf(p)) : t('Protein')}</span></div>}
      {supps.length > 0 && <div className="wbc-i"><span className="wbc-v">{taken.length}/{supps.length}</span><span className="small dim">{t('Supplements')}</span></div>}
      {habits.length > 0 && <div className="wbc-i"><span className="wbc-v">{done.length}/{habits.length}</span><span className="small dim">{t('Habits')}</span></div>}
      {sym > 0 && <div className="wbc-i"><span className="wbc-v wbc-sym">{sym}</span><span className="small dim">{t('Symptoms')}</span></div>}
    </div>
  </div>
}
