import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, getLang, baseLang, dateLocale } from '../lib/i18n.js'
import { fmtDate, fmtDateRange, todayISO, uid } from '../lib/format.js'
import DateField from '../components/DateField.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, Check, TextField, TextArea, SearchField, NumberField } from '../components/ui.jsx'
import {
  MOODS, MOOD_LABEL, MOOD_FACE, REASON_LABEL, reasonList, hiddenReasons, withReasonShown, withOwnReason, SEVERITY_LABEL, MEALS, MEAL_LABEL, NOTE_MAX, NAME_MAX,
  moodOf, withMood, symptomList, symptomsOf, withSymptoms, nextSeverity, withOwnSymptom,
  habitList, withHabitDef, habitsDoneOn, withHabitToggled, HABIT_DEFAULTS, SYMPTOM_LABEL, hiddenSymptoms, withSymptomShown,
  SUPP_IDEAS, DOSE_MAX, suppList, withSuppDef, suppsTakenOn, withSuppToggled,
  foodsOn, withFood, dayTotals, kcalFor, recentFoods, kcalGoalOf, shiftDay, periodRange, shiftPeriod,
  favFoods, isFavFood, withFav, myFoodsMatching,
} from '../lib/wellbeing.js'
import { rangeRows, daysBetween, monthSummary, monthInsights } from '../lib/wellbeing-insights.js'
import { searchFoods } from '../lib/food-search.js'
import { searchBasic } from '../lib/basic-foods.js'
import './Wellbeing.css'

// The Wellbeing tab (fork module, lib/wellbeing.js): Today logs food, mood, symptoms and habits for
// one day; Detail lays a week, a month, a year or your own dates out next to the training log, with
// a summary and the patterns of that stretch.

const ui = () => useUI.getState()
const store = () => useStore.getState()
const save = fn => store().update(fn)
const fmt1 = v => (v == null ? '–' : Number(v).toLocaleString(dateLocale(), { maximumFractionDigits: 1 }))

export default function Wellbeing() {
  const [tab, setTab] = useState('day')
  return <>
    <div className="hdr"><div><h1>{t('Wellbeing')}</h1><div className="sub">{t('How you eat, feel and live, next to your training.')}</div></div></div>
    <Segmented className="wb-seg" value={tab} onChange={setTab}
      options={[{ value: 'day', label: t('Day') }, { value: 'detail', label: t('Detail') }]} />
    {tab === 'day' ? <DayView /> : <DetailView />}
  </>
}

/* ============================ one day ============================ */

function DayView() {
  const S = useStore(s => s.S)
  const today = todayISO()
  const [day, setDay] = useState(today)
  return <>
    <div className="wb-nav">
      <button className="iconbtn" onClick={() => setDay(shiftDay(day, -1))} aria-label={t('Previous day')}><Icon name="chevronLeft" /></button>
      <div className="wb-nav-t">{day === today ? t('Today') : day === shiftDay(today, -1) ? t('Yesterday') : fmtDate(day, true)}</div>
      <button className="iconbtn" disabled={day >= today} onClick={() => setDay(shiftDay(day, 1))} aria-label={t('Next day')}><Icon name="chevronRight" /></button>
    </div>
    <MoodCard S={S} day={day} />
    <FoodCard S={S} day={day} />
    <SupplementsCard S={S} day={day} />
    <SymptomsCard S={S} day={day} />
    <HabitsCard S={S} day={day} />
  </>
}

function MoodCard({ S, day }) {
  const m = moodOf(S, day)
  const [note, setNote] = useState(null)
  const set = next => save(s => { s.wbMood = withMood(s.wbMood, day, next) })
  const pick = mood => (m && m.mood === mood ? set(null) : set({ ...(m || { reasons: [], note: '' }), mood }))
  const toggleReason = r => set({ ...m, reasons: m.reasons.includes(r) ? m.reasons.filter(x => x !== r) : [...m.reasons, r] })
  const noteVal = note ?? m?.note ?? ''
  return <section className="card wb-card">
    <h2 className="wb-h"><Icon name="smile" />{t('Mood')}</h2>
    <div className="wb-moods" role="group" aria-label={t('Mood')}>
      {MOODS.map(v => <button key={v} type="button" className={'wb-mood' + (m?.mood === v ? ' on' : '')} aria-pressed={m?.mood === v}
        onClick={() => pick(v)} title={t(MOOD_LABEL[v])}>
        <span className="wb-face" aria-hidden="true">{MOOD_FACE[v]}</span><span className="wb-mood-l">{t(MOOD_LABEL[v])}</span>
      </button>)}
    </div>
    {m && <>
      <div className="small dim wb-sub">{t('Why? Pick what had to do with it.')}</div>
      <div className="chips">
        {reasonList(S).map(r => <button key={r.id} type="button" className={'chip nocap' + (m.reasons.includes(r.id) ? ' on' : '')} aria-pressed={m.reasons.includes(r.id)}
          onClick={() => toggleReason(r.id)}>{r.own ? r.label : t(r.label)}</button>)}
        <EditListChip onClick={() => listSheet('reasons')} />
      </div>
      <TextArea rows={2} maxLength={NOTE_MAX} className="wb-note" value={noteVal} placeholder={t('A line about your day (optional)')}
        aria-label={t('Note')} onChange={e => setNote(e.target.value)}
        onBlur={() => { if (note != null && note !== (m.note || '')) set({ ...m, note }); setNote(null) }} />
    </>}
  </section>
}

function SymptomsCard({ S, day }) {
  const cur = symptomsOf(S, day)?.s || {}
  const list = symptomList(S)
  const tap = id => {
    const v = nextSeverity(cur[id])
    const s = { ...cur }
    if (v) s[id] = v; else delete s[id]
    save(st => { st.wbSymptoms = withSymptoms(st.wbSymptoms, day, { s, note: symptomsOf(st, day)?.note }) })
  }
  const logged = Object.keys(cur).length
  return <section className="card wb-card">
    <h2 className="wb-h"><Icon name="warning" />{t('Symptoms')}{logged > 0 && <span className="wb-count">{logged}</span>}</h2>
    <div className="small dim wb-sub">{t('Tap once for mild, twice for moderate, three times for severe.')}</div>
    <div className="chips">
      {list.map(x => {
        const v = cur[x.id] || 0
        return <button key={x.id} type="button" className={'chip nocap wb-sym sev' + v + (v ? ' on' : '')} aria-pressed={!!v}
          onClick={() => tap(x.id)} aria-label={v ? `${x.own ? x.label : t(x.label)}, ${t(SEVERITY_LABEL[v])}` : undefined}>
          {x.own ? x.label : t(x.label)}{v > 0 && <span className="wb-sev">{t(SEVERITY_LABEL[v])}</span>}
        </button>
      })}
      <EditListChip onClick={() => listSheet('symptoms')} />
    </div>
  </section>
}

function EditListChip({ onClick }) {
  return <button type="button" className="chip nocap add wb-edit" onClick={onClick}><Icon name="pencil" />{t('Edit list')}</button>
}

const shown = x => (x.std ? t(x.name) : x.name)

/** A card of things you tick per day: tap a chip and it is done; tap it again and it is not. */
function TickCard({ icon, title, hint, list, done, onToggle, kind }) {
  return <section className="card wb-card">
    <h2 className="wb-h"><Icon name={icon} />{title}{list.length > 0 && <span className="wb-count">{done.length}/{list.length}</span>}</h2>
    <div className="small dim wb-sub">{hint}</div>
    <div className="chips">
      {list.map(x => {
        const on = done.includes(x.id)
        return <button key={x.id} type="button" className={'chip nocap wb-tick' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onToggle(x.id)}>
          {on && <Icon name="check" />}{shown(x)}{x.dose ? <span className="wb-dose-l">{x.dose}</span> : null}
        </button>
      })}
      <EditListChip onClick={() => listSheet(kind)} />
    </div>
  </section>
}

function SupplementsCard({ S, day }) {
  return <TickCard icon="plusCircle" title={t('Supplements')} kind="supps" list={suppList(S)} done={suppsTakenOn(S, day)}
    hint={t('Tap what you took today.')}
    onToggle={id => save(s => { s.wbSupps = withSuppToggled(s.wbSupps, day, suppsTakenOn(s, day), id) })} />
}

function HabitsCard({ S, day }) {
  return <TickCard icon="checkCircle" title={t('Habits')} kind="habits" list={habitList(S)} done={habitsDoneOn(S, day)}
    hint={t('Tap the habits you kept today.')}
    onToggle={id => save(s => { s.wbHabits = withHabitToggled(s.wbHabits, day, habitsDoneOn(s, day), id) })} />
}


function FoodCard({ S, day }) {
  const foods = foodsOn(S, day)
  const tot = dayTotals(S, day)
  const goal = kcalGoalOf(S)
  const pct = goal ? Math.min(100, Math.round(tot.kcal / goal * 100)) : 0
  const remove = id => save(s => { s.wbFood = withFood(s.wbFood, id, null) })
  return <section className="card wb-card">
    <h2 className="wb-h"><Icon name="flame" />{t('Food')}
      <button className="iconbtn wb-h-btn" onClick={() => goalSheet()} aria-label={t('Daily calorie goal')}><Icon name="target" /></button>
    </h2>
    <div className="wb-kcal">
      <span className="wb-kcal-n">{tot.kcal.toLocaleString(dateLocale())}</span>
      <span className="dim">{goal ? t('of {0} kcal', goal.toLocaleString(dateLocale())) : 'kcal'}</span>
      {tot.protein != null && <span className="wb-prot">{t('{0} g protein', tot.protein)}</span>}
    </div>
    {goal && <div className={'wb-bar' + (tot.kcal > goal ? ' over' : '')}><span style={{ width: pct + '%' }} /></div>}
    {goal && <div className="small dim">{tot.kcal <= goal ? t('{0} kcal left', (goal - tot.kcal).toLocaleString(dateLocale())) : t('{0} kcal over', (tot.kcal - goal).toLocaleString(dateLocale()))}</div>}
    {MEALS.map(meal => {
      const xs = foods.filter(f => f.meal === meal)
      if (!xs.length) return null
      return <div key={meal} className="wb-meal">
        <div className="wb-meal-h"><span>{t(MEAL_LABEL[meal])}</span><span className="dim">{xs.reduce((a, f) => a + f.kcal, 0)} kcal</span></div>
        {xs.map(f => <div key={f.id} className="wb-food">
          <div className="wb-food-n"><div>{f.name}</div>{f.grams ? <div className="small dim">{f.grams} g</div> : null}</div>
          <div className="wb-food-k">{f.kcal} kcal</div>
          <button className="iconbtn" onClick={() => remove(f.id)} aria-label={t('Remove')}><Icon name="trash" /></button>
        </div>)}
      </div>
    })}
    <Button variant="primary" icon="plus" className="wb-add" onClick={() => foodSheet(day)}>{t('Add food')}</Button>
  </section>
}

/* ============================ sheets ============================ */

function promptSheet({ title, placeholder, max, initial = '', numeric = false, onSave, onClear }) {
  ui().openSheet(close => <PromptSheet {...{ title, placeholder, max, initial, numeric, onSave, onClear, close }} />)
}
function PromptSheet({ title, placeholder, max, initial, numeric, onSave, onClear, close }) {
  const [v, setV] = useState(initial)
  const ok = numeric ? Number(v) > 0 : String(v).trim().length > 0
  return <>
    <h3>{title}</h3>
    {numeric
      ? <NumberField value={v === '' ? null : Number(v)} nullable decimal={false} onChange={x => setV(x == null ? '' : x)} placeholder={placeholder} className="wb-prompt" />
      : <TextField autoFocus value={v} maxLength={max} placeholder={placeholder} onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && ok) { onSave(String(v).trim()); close() } }} />}
    <div style={{ height: 14 }} />
    <Button variant="primary" disabled={!ok} onClick={() => { onSave(numeric ? Number(v) : String(v).trim()); close() }}>{t('Save')}</Button>
    {onClear && <><div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={() => { onClear(); close() }}>{t('Remove')}</Button></>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

function goalSheet() {
  const S = store().S
  promptSheet({
    title: t('Daily calorie goal'), placeholder: '2000', numeric: true, initial: kcalGoalOf(S) ?? '',
    onSave: v => save(s => { s.kcalGoal = Math.max(500, Math.min(10000, Math.round(v))) }),
    onClear: kcalGoalOf(S) ? () => save(s => { s.kcalGoal = null }) : null,
  })
}

// One editor for the three lists: take items off, put suggested ones back, add your own.
function listSheet(kind) { ui().openSheet(close => <ListSheet kind={kind} close={close} />) }
function ListSheet({ kind, close }) {
  const S = useStore(s => s.S)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const isSupp = kind === 'supps'
  let title, items, ideas, remove, addOwn, addIdea, placeholder
  if (kind === 'reasons') {
    title = t('Reasons for your mood')
    placeholder = t('Like “studies” or “pets”')
    items = reasonList(S).map(x => ({ id: x.id, label: x.own ? x.label : t(x.label), own: x.own }))
    ideas = hiddenReasons(S).map(id => ({ id, label: t(REASON_LABEL[id]) }))
    remove = x => save(s => { s.wbReasonDefs = x.own ? withOwnReason(s.wbReasonDefs, x.id, '') : withReasonShown(s.wbReasonDefs, x.id, false) })
    addIdea = x => save(s => { s.wbReasonDefs = withReasonShown(s.wbReasonDefs, x.id, true) })
    addOwn = n => save(s => { s.wbReasonDefs = withOwnReason(s.wbReasonDefs, 'own-' + uid(), n) })
  } else if (kind === 'symptoms') {
    title = t('Your symptoms')
    placeholder = t('Like “tinnitus”')
    items = symptomList(S).map(x => ({ id: x.id, label: x.own ? x.label : t(x.label), own: x.own }))
    ideas = hiddenSymptoms(S).map(id => ({ id, label: t(SYMPTOM_LABEL[id]) }))
    remove = x => save(s => { s.wbSymptomDefs = x.own ? withOwnSymptom(s.wbSymptomDefs, x.id, '') : withSymptomShown(s.wbSymptomDefs, x.id, false) })
    addIdea = x => save(s => { s.wbSymptomDefs = withSymptomShown(s.wbSymptomDefs, x.id, true) })
    addOwn = n => save(s => { s.wbSymptomDefs = withOwnSymptom(s.wbSymptomDefs, 'own-' + uid(), n) })
  } else {
    const listFn = isSupp ? suppList : habitList
    const write = (s, id, n, d, order, std) => {
      if (isSupp) s.wbSuppDefs = withSuppDef(s.wbSuppDefs, id, n, d, order, Date.now(), std)
      else s.wbHabitDefs = withHabitDef(s.wbHabitDefs, id, n, order, Date.now(), std)
    }
    const all = isSupp ? SUPP_IDEAS : HABIT_DEFAULTS
    const list = listFn(S)
    title = isSupp ? t('Your supplements') : t('Your habits')
    placeholder = isSupp ? t('Name, like “Iron”') : t('New habit, like “Read 20 minutes”')
    items = list.map(x => ({ id: x.id, label: shown(x), dose: x.dose }))
    ideas = all.filter(x => !list.some(y => y.id === x.id)).map(x => ({ ...x, label: t(x.name) }))
    remove = x => save(s => write(s, x.id, '', '', 0, false))
    addIdea = x => save(s => write(s, x.id, x.name, x.dose, listFn(s).length, true))
    addOwn = (n, d) => save(s => write(s, (isSupp ? 's-' : 'h-') + uid(), n, d, listFn(s).length, false))
  }
  const add = () => { if (!name.trim()) return; addOwn(name.trim(), dose.trim()); setName(''); setDose('') }
  return <>
    <h3>{title}</h3>
    <div className="small dim" style={{ marginBottom: 10 }}>{t('Take off what you do not need and add your own. Days you already logged stay as they are.')}</div>
    <div className="chips wb-edit-list">
      {items.map(x => <button key={x.id} type="button" className="chip nocap on wb-rm" onClick={() => remove(x)} aria-label={t('Remove {0}', x.label)}>
        {x.label}{x.dose ? <span className="wb-dose-l">{x.dose}</span> : null}<Icon name="xmark" />
      </button>)}
      {!items.length && <span className="small dim">{t('The list is empty.')}</span>}
    </div>
    {ideas.length > 0 && <>
      <div className="small dim wb-sub">{t('Suggestions')}</div>
      <div className="chips wb-edit-list">
        {ideas.map(x => <button key={x.id} type="button" className="chip nocap add" onClick={() => addIdea(x)}><Icon name="plus" />{x.label}</button>)}
      </div>
    </>}
    <div className="wb-hadd">
      <TextField value={name} maxLength={NAME_MAX} placeholder={placeholder} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') add() }} />
      {isSupp && <TextField value={dose} maxLength={DOSE_MAX} placeholder={t('Dose')} className="wb-dose" onChange={e => setDose(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') add() }} />}
      <Button variant="tinted" icon="plus" disabled={!name.trim()} onClick={add} aria-label={t('Add')} />
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </>
}


const defaultMeal = () => {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

function foodSheet(day) { ui().openSheet(close => <FoodSheet day={day} close={close} />, { wide: true }) }

/** A food as the form takes it: per 100 g with grams, or a fixed portion in kcal. */
const asPick = (f, src) => ({
  name: f.brand ? `${f.name} (${f.brand})` : f.name,
  kcal100: f.kcal100 ?? null, protein100: f.protein100 ?? null,
  grams: f.grams || f.serving || (f.kcal100 != null ? 100 : null),
  kcal: f.kcal ?? null, protein: f.protein ?? null,
  code: f.code || null, src: src || f.src || 'manual',
})

/** The star on a food row: on when the food is a favourite; a tap stars it or takes the star off. */
function FavStar({ S, food }) {
  const name = food.brand ? `${food.name} (${food.brand})` : food.name
  const on = isFavFood(S, name)
  const toggle = e => {
    e.stopPropagation()
    const p = asPick(food)
    save(s => { s.wbFoodFavs = withFav(s.wbFoodFavs, name, on ? null : { ...p, protein100: p.protein100 ?? undefined }) })
  }
  return <button type="button" className={'iconbtn wb-star' + (on ? ' on' : '')} onClick={toggle} aria-pressed={on}
    aria-label={on ? t('Remove from favourites') : t('Add to favourites')}><Icon name={on ? 'starFill' : 'star'} /></button>
}

/** One food in a list: name, a line under it, its kcal, and the star. */
function FoodRow({ S, food, sub, kcal, onPick }) {
  return <div className="item wb-res" role="button" tabIndex={0} onClick={onPick} onKeyDown={e => { if (e.key === 'Enter') onPick() }}>
    <div className="wb-res-n"><div>{food.brand ? `${food.name} (${food.brand})` : food.name}</div>{sub && <div className="small dim">{sub}</div>}</div>
    <div className="wb-res-k">{kcal}</div>
    <FavStar S={S} food={food} />
  </div>
}

const kcalLine = f => (f.kcal100 != null ? <>{f.kcal100}<span className="small dim"> kcal/100 g</span></> : <>{f.kcal}<span className="small dim"> kcal</span></>)
const subLine = f => [f.grams ? `${f.grams} g` : '', f.protein100 != null ? t('{0} g protein', f.protein100) + ' /100 g' : f.protein != null ? t('{0} g protein', f.protein) : ''].filter(Boolean).join(' · ')

function FoodSheet({ day, close }) {
  const S = useStore(s => s.S)
  const [meal, setMeal] = useState(defaultMeal)
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // The food being put together: from a favourite, a recent one, a search hit, or typed in by hand.
  const [pick, setPick] = useState(null)
  const lang = baseLang(getLang())
  const typing = q.trim().length >= 2
  const favs = favFoods(S)
  const recents = useMemo(() => recentFoods(S).filter(f => !isFavFood(S, f.name)).slice(0, 8), [S.wbFood, S.wbFoodFavs]) // eslint-disable-line react-hooks/exhaustive-deps
  const mine = useMemo(() => (typing ? myFoodsMatching(S, q) : []), [S.wbFood, S.wbFoodFavs, q, typing]) // eslint-disable-line react-hooks/exhaustive-deps
  const basics = useMemo(() => searchBasic(q, lang).filter(b => !mine.some(m => m.name.toLowerCase() === b.name.toLowerCase())), [q, lang, mine])

  const search = async () => {
    if (!typing) return
    setBusy(true); setErr('')
    try { setResults(await searchFoods(q, lang)) } catch { setErr(t('The product search did not answer. Pick a basic food above or add it by hand.')); setResults(null) }
    setBusy(false)
  }
  const manual = () => setPick({ name: q.trim(), kcal100: null, grams: null, kcal: null, protein: null, src: 'manual', own: true })

  if (pick) return <FoodForm S={S} day={day} meal={meal} setMeal={setMeal} pick={pick} back={() => setPick(null)} close={close} />

  return <>
    <h3>{t('Add food')}</h3>
    <Segmented className="wb-meals" value={meal} onChange={setMeal} options={MEALS.map(m => ({ value: m, label: t(MEAL_LABEL[m]) }))} />
    <form className="wb-search" onSubmit={e => { e.preventDefault(); search() }}>
      <SearchField value={q} onChange={e => { setQ(e.target.value); setResults(null); setErr('') }} onClear={() => { setQ(''); setResults(null) }} placeholder={t('Search a food, like “oatmeal”')} aria-label={t('Search a food')} />
    </form>

    {!typing && <>
      {favs.length > 0 && <>
        <div className="small dim wb-sub wb-sec"><Icon name="starFill" />{t('Favourites')}</div>
        <div className="list wb-results">{favs.map(f => <FoodRow key={f.id} S={S} food={f} sub={subLine(f)} kcal={kcalLine(f)} onPick={() => setPick(asPick(f))} />)}</div>
      </>}
      {recents.length > 0 && <>
        <div className="small dim wb-sub wb-sec"><Icon name="history" />{t('Recent')}</div>
        <div className="list wb-results">{recents.map(f => <FoodRow key={f.name} S={S} food={f} sub={subLine(f)} kcal={<>{f.kcal}<span className="small dim"> kcal</span></>} onPick={() => setPick(asPick(f))} />)}</div>
      </>}
      {!favs.length && <div className="small dim wb-sub">{t('Tap the star on any food to keep it here for next time.')}</div>}
    </>}

    {typing && mine.length > 0 && <>
      <div className="small dim wb-sub wb-sec"><Icon name="person" />{t('My foods')}</div>
      <div className="list wb-results">{mine.map(f => <FoodRow key={f.name} S={S} food={f} sub={subLine(f)} kcal={f.kcal100 != null ? kcalLine(f) : <>{f.kcal}<span className="small dim"> kcal</span></>} onPick={() => setPick(asPick(f))} />)}</div>
    </>}
    {typing && basics.length > 0 && <>
      <div className="small dim wb-sub wb-sec"><Icon name="list" />{t('Basic foods')}</div>
      <div className="list wb-results">{basics.map(p => <FoodRow key={p.id} S={S} food={p} sub={`${t('{0} g protein', p.protein100)} · ${t('portion {0} g', p.serving)}`} kcal={kcalLine(p)} onPick={() => setPick(asPick(p, 'basic'))} />)}</div>
    </>}
    {typing && !results && <Button variant="tinted" icon="magnifier" className="wb-more" disabled={busy} onClick={search}>
      {busy ? t('Searching…') : t('Search packaged products for “{0}”', q.trim())}</Button>}
    {results && (results.length ? <>
      <div className="small dim wb-sub wb-sec"><Icon name="magnifier" />{t('Products')}</div>
      <div className="list wb-results">{results.map((p, i) => <FoodRow key={(p.code || '') + i} S={S} food={p}
        sub={[p.brand, p.protein100 != null ? t('{0} g protein', p.protein100) : ''].filter(Boolean).join(' · ')} kcal={kcalLine(p)} onPick={() => setPick(asPick(p, 'off'))} />)}</div>
      <div className="tiny dim wb-credit">{t('Food data from Open Food Facts, open and free.')}</div>
    </> : <div className="small dim wb-sub">{t('Nothing found. Try other words or enter it by hand.')}</div>)}
    {err && <div className="small wb-err">{err}</div>}

    <button type="button" className="chip nocap add wb-manual" onClick={manual}><Icon name="pencil" />{t('Enter calories by hand')}</button>
    <div style={{ height: 14 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

function FoodForm({ S, day, meal, setMeal, pick, back, close }) {
  const [name, setName] = useState(pick.name || '')
  const [grams, setGrams] = useState(pick.grams ?? null)
  const [kcal100, setKcal100] = useState(pick.kcal100 ?? null)
  const [kcalHand, setKcalHand] = useState(pick.kcal100 == null ? pick.kcal ?? null : null)
  const [protein, setProtein] = useState(pick.protein100 == null ? pick.protein ?? null : null)
  // Something typed in by hand is kept as a favourite unless you say no; anything else keeps its star.
  const [fav, setFav] = useState(pick.own ? true : isFavFood(S, pick.name))
  const per100 = kcal100 != null
  const kcal = per100 ? kcalFor(kcal100, grams) : kcalHand
  const prot = pick.protein100 != null && grams ? Math.round(pick.protein100 * grams / 10) / 10 : protein
  const ok = name.trim() && kcal != null && kcal >= 0
  const add = () => {
    const n = name.trim()
    save(s => {
      s.wbFood = withFood(s.wbFood, 'f-' + uid(), {
        d: day, name: n, kcal, meal, src: pick.src,
        ...(grams ? { grams } : {}), ...(per100 ? { kcal100 } : {}), ...(prot != null ? { protein: prot } : {}), ...(pick.code ? { code: pick.code } : {}),
      })
      const was = isFavFood(s, n)
      if (fav) s.wbFoodFavs = withFav(s.wbFoodFavs, n, per100
        ? { kcal100, grams, src: pick.src, ...(pick.protein100 != null ? { protein100: pick.protein100 } : protein != null && grams ? { protein100: Math.round(protein / grams * 1000) / 10 } : {}) }
        : { kcal, grams, src: pick.src, ...(prot != null ? { protein: prot } : {}) })
      else if (was) s.wbFoodFavs = withFav(s.wbFoodFavs, n, null)
    })
    ui().toast(t('{0} added', n))
    close()
  }
  return <>
    <h3>{t('Add food')}</h3>
    <Segmented className="wb-meals" value={meal} onChange={setMeal} options={MEALS.map(m => ({ value: m, label: t(MEAL_LABEL[m]) }))} />
    <div className="wb-form">
      <label><span>{t('Name')}</span><TextField value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)} placeholder={t('Like “Chicken with rice”')} /></label>
      <label><span>{t('Amount')}</span><span className="wb-in"><NumberField nullable value={grams} onChange={setGrams} /><i>g</i></span></label>
      {per100
        ? <label><span>{t('Per 100 g')}</span><span className="wb-in"><NumberField nullable decimal={false} value={kcal100} onChange={setKcal100} /><i>kcal</i></span></label>
        : <label><span>{t('Calories')}</span><span className="wb-in"><NumberField nullable decimal={false} value={kcalHand} onChange={setKcalHand} /><i>kcal</i></span></label>}
      {pick.protein100 == null && <label><span>{t('Protein (optional)')}</span><span className="wb-in"><NumberField nullable value={protein} onChange={setProtein} /><i>g</i></span></label>}
    </div>
    <div className="wb-total">{kcal != null ? `${kcal} kcal` : '–'}{prot != null ? ` · ${t('{0} g protein', prot)}` : ''}</div>
    <label className="wb-favrow"><Check checked={fav} onChange={setFav} label={t('Save to favourites')} /><span onClick={() => setFav(!fav)}>{t('Save to favourites')}</span></label>
    <Button variant="primary" disabled={!ok} onClick={add}>{t('Add')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={back}>{t('Back')}</Button>
  </>
}


/* ============================ the detail: a week, a month, a year or your own dates ============================ */

const WEEKDAYS = () => {
  // Monday first, in the reader's language.
  return Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(dateLocale(), { weekday: 'narrow' }))
}
const dayClass = (r, d, today) => 'wb-day' + (r?.mood ? ' m' + r.mood : '') + (d > today ? ' fut' : '') + (d === today ? ' today' : '')
const dayTitle = (r, d) => (r ? [fmtDate(d, true), r.mood ? t(MOOD_LABEL[r.mood]) : '', r.trained ? t('Trained') : '', r.worst ? t('Symptoms') : ''].filter(Boolean).join(' · ') : fmtDate(d, true))

function periodLabel(kind, from, to) {
  if (kind === 'month') return new Date(from + 'T12:00:00').toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })
  if (kind === 'year') return from.slice(0, 4)
  return fmtDateRange(from, to, true)
}

/** The days of the range laid out: a calendar with weekday rows for up to six weeks, a compact heat map beyond. */
function RangeCalendar({ from, to, byDay, today }) {
  const days = daysBetween(from, to)
  const lead = (new Date(from + 'T12:00:00').getDay() + 6) % 7
  if (days.length <= 42) {
    return <div className="wb-cal" role="grid">
      {WEEKDAYS().map((w, i) => <div key={'w' + i} className="wb-cal-wd" aria-hidden="true">{w}</div>)}
      {Array.from({ length: lead }, (_, i) => <div key={'e' + i} />)}
      {days.map(d => {
        const r = byDay[d]
        return <div key={d} className={dayClass(r, d, today)} title={dayTitle(r, d)}>
          <span className="wb-day-n">{Number(d.slice(8))}</span>
          <span className="wb-day-marks">{r?.trained && <span className="wb-dot tr" />}{r?.worst > 0 && <span className={'wb-dot sy s' + r.worst} />}</span>
        </div>
      })}
    </div>
  }
  // A year or a long range: one column per week, Monday at the top, a month's initial over the week it starts.
  // Drawn as one SVG that scales to the width, so 53 weeks fit a phone.
  const cells = [...Array(lead).fill(null), ...days]
  const weeks = Math.ceil(cells.length / 7)
  const C = 10, G = 2, TOP = 12
  return <svg className="wb-heat" viewBox={`0 0 ${weeks * (C + G)} ${TOP + 7 * (C + G)}`} role="img" aria-label={t('Calendar')}>
    {cells.map((d, i) => {
      if (!d) return null
      const x = Math.floor(i / 7) * (C + G), y = TOP + (i % 7) * (C + G)
      const r = byDay[d]
      return <g key={d}>
        {d.endsWith('-01') && <text x={x} y={8} className="wb-heat-m">{new Date(d + 'T12:00:00').toLocaleDateString(dateLocale(), { month: 'narrow' })}</text>}
        <rect x={x} y={y} width={C} height={C} rx={2} className={'wb-hc' + (r?.mood ? ' m' + r.mood : '') + (d > today ? ' fut' : '')}><title>{dayTitle(r, d)}</title></rect>
        {r?.trained && <rect x={x + 1} y={y + C - 2.5} width={C - 2} height={2} rx={1} className="wb-hc-tr" />}
        {r?.worst > 0 && <circle cx={x + C - 2.5} cy={y + 2.5} r={1.7} className="wb-hc-sy" />}
      </g>
    })}
  </svg>
}

function DetailView() {
  const S = useStore(s => s.S)
  const today = todayISO()
  const [kind, setKind] = useState('week')
  const [anchor, setAnchor] = useState(today)
  const [custom, setCustom] = useState({ from: shiftDay(today, -29), to: today })
  const range = kind === 'custom' ? (custom.from <= custom.to ? custom : { from: custom.to, to: custom.from }) : periodRange(kind, anchor)
  const rows = useMemo(() => rangeRows(S, range.from, range.to, today), [S, range.from, range.to, today])
  const sum = useMemo(() => monthSummary(S, rows), [S, rows])
  const insights = useMemo(() => monthInsights(S, rows), [S, rows])
  const byDay = Object.fromEntries(rows.map(r => [r.d, r]))
  const symLabel = id => { const x = symptomList(S).find(s => s.id === id); return x ? (x.own ? x.label : t(x.label)) : id }
  const reasonLabel = id => { const x = reasonList(S).find(r => r.id === id); return x ? (x.own ? x.label : t(x.label)) : id }
  const pct = n => Math.round(n / Math.max(1, sum.days) * 100) + '%'
  const named = x => (x.std ? t(x.name) : x.name)

  return <>
    <Segmented className="wb-seg wb-kinds" value={kind} onChange={k => { setKind(k); setAnchor(today) }}
      options={[{ value: 'week', label: t('Week') }, { value: 'month', label: t('Month') }, { value: 'year', label: t('Year') }, { value: 'custom', label: t('Custom') }]} />

    {kind === 'custom'
      ? <div className="wb-custom">
        <label><span>{t('From')}</span><DateField value={custom.from} max={today} onChange={v => setCustom(c => ({ ...c, from: v }))} label={t('From')} /></label>
        <label><span>{t('To')}</span><DateField value={custom.to} max={today} onChange={v => setCustom(c => ({ ...c, to: v }))} label={t('To')} /></label>
      </div>
      : <div className="wb-nav">
        <button className="iconbtn" onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))} aria-label={t('Previous')}><Icon name="chevronLeft" /></button>
        <div className="wb-nav-t wb-cap">{periodLabel(kind, range.from, range.to)}</div>
        <button className="iconbtn" disabled={range.to >= today} onClick={() => setAnchor(shiftPeriod(kind, anchor, 1))} aria-label={t('Next')}><Icon name="chevronRight" /></button>
      </div>}

    <section className="card wb-card">
      <RangeCalendar from={range.from} to={range.to} byDay={byDay} today={today} />
      <div className="wb-legend small dim">
        <span><span className="wb-sw m1" />{t('Rough')}</span><span><span className="wb-sw m5" />{t('Great')}</span>
        <span><span className="wb-dot tr" />{t('Trained')}</span><span><span className="wb-dot sy s2" />{t('Symptoms')}</span>
      </div>
    </section>

    <section className="card wb-card">
      <h2 className="wb-h"><Icon name="chart" />{t('Summary')}<span className="wb-count">{t('{0} of {1} days logged', sum.logged, sum.days)}</span></h2>
      <div className="wb-stats">
        <Stat v={sum.mood != null ? `${fmt1(sum.mood)} ${MOOD_FACE[Math.round(sum.mood)]}` : '–'} l={t('Average mood')} />
        <Stat v={`${sum.trained}`} l={t('Days trained')} />
        <Stat v={sum.kcal != null ? sum.kcal.toLocaleString(dateLocale()) : '–'} l={t('Average kcal a day')} />
        <Stat v={sum.protein != null ? `${sum.protein} g` : '–'} l={t('Average protein a day')} />
        <Stat v={sum.kcalTotal ? sum.kcalTotal.toLocaleString(dateLocale()) : '–'} l={t('Calories in total')} />
        <Stat v={sum.symptoms.reduce((a, s) => a + s.days, 0)} l={t('Symptom days')} />
      </div>
      {sum.moodDays > 0 && <div className="wb-dist" aria-label={t('Average mood')}>
        {sum.moodDist.map((n, i) => n > 0 && <span key={i} className={'m' + (i + 1)} style={{ flex: n }} title={`${t(MOOD_LABEL[i + 1])}: ${n}`} />)}
      </div>}
      {kcalGoalOf(S) && sum.kcalDays > 0 && <div className="small dim wb-sub">{t('Over your calorie goal on {0} of {1} days.', sum.overGoal, sum.kcalDays)}</div>}
    </section>

    {sum.reasons.length > 0 && <Bars icon="smile" title={t('What your mood had to do with')} items={sum.reasons.slice(0, 6).map(x => ({ id: x.id, label: reasonLabel(x.id), n: x.days }))} total={sum.moodDays} cls="mood" />}
    {sum.symptoms.length > 0 && <Bars icon="warning" title={t('Symptoms')} items={sum.symptoms.map(x => ({ id: x.id, label: symLabel(x.id), n: x.days, extra: x.severe ? t('{0} severe', x.severe) : '' }))} total={sum.days} />}
    {sum.supps.length > 0 && <Bars icon="plusCircle" title={t('Supplements')} items={sum.supps.map(x => ({ id: x.id, label: named(x), n: x.days }))} total={sum.days} cls="sup" pct={pct} />}
    {sum.habits.length > 0 && <Bars icon="checkCircle" title={t('Habits')} items={sum.habits.map(x => ({ id: x.id, label: named(x), n: x.days }))} total={sum.days} cls="ok" pct={pct} />}

    <section className="card wb-card">
      <h2 className="wb-h"><Icon name="lightbulb" />{t('Patterns')}</h2>
      {insights.length ? <ul className="wb-ins">
        {insights.slice(0, 10).map((x, i) => <li key={i}>{insightText(x, symLabel)}</li>)}
      </ul> : <div className="small dim">{t('Log a few more days (mood on at least 3 days of each kind) and the patterns of this period show up here.')}</div>}
      <div className="tiny dim wb-foot">{t('These are things that happened together, not proof that one causes the other.')}</div>
    </section>
  </>
}

function Bars({ icon, title, items, total, cls = '', pct }) {
  return <section className="card wb-card">
    <h2 className="wb-h"><Icon name={icon} />{title}</h2>
    <div className="wb-bars">
      {items.map(x => <div key={x.id} className="wb-brow">
        <span>{x.label}</span>
        <span className={'wb-bline ' + cls}><span style={{ width: Math.round(x.n / Math.max(1, total) * 100) + '%' }} /></span>
        <span className="dim small">{pct ? pct(x.n) : t('{0} days', x.n)}{x.extra ? ` · ${x.extra}` : ''}</span>
      </div>)}
    </div>
  </section>
}

function Stat({ v, l }) {
  return <div className="wb-stat"><div className="wb-stat-v">{v}</div><div className="small dim">{l}</div></div>
}

function insightText(x, symLabel) {
  const a = fmt1(x.with), b = fmt1(x.without)
  const name = x.std ? t(x.name) : x.name
  switch (x.kind) {
    case 'moodTraining': return t('Your mood averaged {0} on days you trained and {1} on days you did not.', a, b)
    case 'moodHabit': return t('On days with “{0}” your mood averaged {1}, without it {2}.', name, a, b)
    case 'moodSupp': return t('On days you took {0} your mood averaged {1}, on the others {2}.', name, a, b)
    case 'moodFood': return t('On days at or under your calorie goal your mood averaged {0}, over it {1}.', a, b)
    case 'moodSymptom': return t('On days with {0} your mood averaged {1}, without it {2}.', baseLang(getLang()) === 'de' ? symLabel(x.key) : symLabel(x.key).toLowerCase(), a, b)
    case 'symptomTraining': return t('{0} showed up on {1}% of the days you trained and {2}% of the days you did not.', symLabel(x.key), x.with, x.without)
    case 'symptomHabit': return t('{0} showed up on {1}% of the days with “{2}” and {3}% of the days without it.', symLabel(x.key), x.with, name, x.without)
    case 'symptomSupp': return t('{0} showed up on {1}% of the days you took {2} and {3}% of the days you did not.', symLabel(x.key), x.with, name, x.without)
    default: return ''
  }
}
