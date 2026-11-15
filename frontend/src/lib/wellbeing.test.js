import { describe, it, expect } from 'vitest'
import {
  readMood, withMood, moodOf, readSymptoms, withSymptoms, nextSeverity, symptomList, withOwnSymptom,
  habitList, withHabitDef, habitsDoneOn, withHabitToggled, readFood, withFood, foodsOn, dayTotals,
  kcalFor, recentFoods, kcalGoalOf, monthDays, shiftMonth, shiftDay,
  suppList, withSuppDef, suppsTakenOn, suppCountsOn, withSuppTap, nextIntake, timesOf, HABIT_DEFAULTS, SUPP_DEFAULTS, withSymptomShown, hiddenSymptoms,
  favFoods, isFavFood, withFav, myFoodsMatching,
  reasonList, hiddenReasons, withReasonShown, withOwnReason, periodRange, shiftPeriod,
} from './wellbeing.js'

describe('mood reasons', () => {
  it('keeps your own reasons on a day and lets a built-in one go', () => {
    let defs = withOwnReason({}, 'own-pets', 'Pets', 1)
    defs = withReasonShown(defs, 'weather', false, 2)
    const S = { wbReasonDefs: defs }
    const ids = reasonList(S).map(r => r.id)
    expect(ids).toContain('own-pets')
    expect(ids).not.toContain('weather')
    expect(hiddenReasons(S)).toEqual(['weather'])
    expect(readMood({ mood: 3, reasons: ['work', 'own-pets', 'bogus id'] }).reasons).toEqual(['work', 'own-pets'])
  })
})

describe('symptom list', () => {
  it('takes a built-in symptom off the list and puts it back', () => {
    let defs = withSymptomShown({}, 'headache', false, 1)
    expect(symptomList({ wbSymptomDefs: defs }).some(x => x.id === 'headache')).toBe(false)
    expect(hiddenSymptoms({ wbSymptomDefs: defs })).toEqual(['headache'])
    defs = withSymptomShown(defs, 'headache', true, 2)
    expect(symptomList({ wbSymptomDefs: defs })[0].id).toBe('headache')
  })
})
import { mergeStampedMap, STAMPED_MAPS } from './sync-merge.js'

const D = '2026-11-10'

describe('mood', () => {
  it('keeps a valid mood with known reasons and drops the rest', () => {
    expect(readMood({ mood: 4, reasons: ['work', 'nope', 'work'], note: '  long day  ' })).toEqual({ mood: 4, reasons: ['work'], note: 'long day' })
    expect(readMood({ mood: 9 })).toBeNull()
    expect(readMood(null)).toBeNull()
  })
  it('stamps a day and clears it with a stamped empty entry', () => {
    let m = withMood({}, D, { mood: 2, reasons: ['sleep'] }, 100)
    expect(m[D]).toEqual({ mood: 2, reasons: ['sleep'], _ts: 100 })
    expect(moodOf({ wbMood: m }, D).mood).toBe(2)
    m = withMood(m, D, null, 200)
    expect(m[D]).toEqual({ _ts: 200 })
    expect(moodOf({ wbMood: m }, D)).toBeNull()
  })
})

describe('symptoms', () => {
  it('cycles none, mild, moderate, severe, none', () => {
    expect([0, 1, 2, 3].map(nextSeverity)).toEqual([1, 2, 3, 0])
    expect(nextSeverity(undefined)).toBe(1)
  })
  it('keeps severities 1 to 3 only and clears an empty day', () => {
    expect(readSymptoms({ s: { headache: 2, back: 7 } })).toEqual({ s: { headache: 2 }, note: '' })
    expect(withSymptoms({}, D, { s: {} }, 5)[D]).toEqual({ _ts: 5 })
  })
  it('lists the built-in symptoms, then your own, without removed ones', () => {
    let defs = withOwnSymptom({}, 'own-a', 'Knee pain', 1)
    defs = withOwnSymptom(defs, 'own-b', 'Gone', 2)
    defs = withOwnSymptom(defs, 'own-b', '', 3)
    const list = symptomList({ wbSymptomDefs: defs })
    expect(list[0].id).toBe('headache')
    expect(list.filter(x => x.own)).toEqual([{ id: 'own-a', label: 'Knee pain', own: true }])
  })
})

describe('habits', () => {
  it('shows the defaults until the list is edited, and keeps them when you add one', () => {
    expect(habitList({}).map(h => h.id)).toEqual(HABIT_DEFAULTS.map(h => h.id))
    expect(habitList({})[0]).toMatchObject({ std: true })
    const S = { wbHabits: {} }
    S.wbHabits = withHabitToggled(S.wbHabits, D, habitsDoneOn(S, D), 'water', 1)
    expect(habitsDoneOn(S, D)).toEqual(['water'])
    S.wbHabitDefs = withHabitDef(undefined, 'h-own', 'Read', 99, 2)
    expect(habitList(S).map(h => h.id)).toEqual([...HABIT_DEFAULTS.map(h => h.id), 'h-own'])
    S.wbHabitDefs = withHabitDef(S.wbHabitDefs, 'water', '', 0, 3)
    expect(habitList(S).some(h => h.id === 'water')).toBe(false)
    expect(habitsDoneOn(S, D)).toEqual([])
  })
  it('orders habits and ticks them per day, ignoring removed ones', () => {
    let defs = { h1: { name: 'Water', order: 1, _ts: 1 } }
    defs = withHabitDef(defs, 'h2', 'Sleep', 0, 2)
    let S = { wbHabitDefs: defs, wbHabits: {} }
    expect(habitList(S).map(h => h.id)).toEqual(['h2', 'h1'])
    S.wbHabits = withHabitToggled(S.wbHabits, D, habitsDoneOn(S, D), 'h1', 3)
    S.wbHabits = withHabitToggled(S.wbHabits, D, habitsDoneOn(S, D), 'h2', 4)
    expect(habitsDoneOn(S, D).sort()).toEqual(['h1', 'h2'])
    S.wbHabitDefs = withHabitDef(S.wbHabitDefs, 'h2', '', 0, 5)
    expect(habitsDoneOn(S, D)).toEqual(['h1'])
    S.wbHabits = withHabitToggled(S.wbHabits, D, habitsDoneOn(S, D), 'h1', 6)
    expect(S.wbHabits[D]).toEqual({ _ts: 6 })
  })
})

describe('supplements', () => {
  it('keeps a dose, ticks per day and forgets removed ones', () => {
    expect(suppList({}).map(x => x.id)).toEqual(SUPP_DEFAULTS.map(x => x.id))
    let defs = { s1: { name: 'Vitamin D', dose: '2000 IU', order: 0, _ts: 1 } }
    defs = withSuppDef(defs, 's2', 'Creatine', '', 1, 2)
    const S = { wbSuppDefs: defs, wbSupps: {} }
    expect(suppList(S)).toEqual([{ id: 's1', name: 'Vitamin D', dose: '2000 IU', times: 1, std: false, order: 0 }, { id: 's2', name: 'Creatine', dose: '', times: 1, std: false, order: 1 }])
    S.wbSupps = withSuppTap(S.wbSupps, D, suppCountsOn(S, D), 's2', 1, 3)
    expect(suppsTakenOn(S, D)).toEqual(['s2'])
    S.wbSuppDefs = withSuppDef(S.wbSuppDefs, 's2', '', '', 0, 4)
    expect(suppsTakenOn(S, D)).toEqual([])
    expect(STAMPED_MAPS).toEqual(expect.arrayContaining(['wbSupps', 'wbSuppDefs']))
  })

  it('counts intakes up to the times a day, completes, and a further tap starts over', () => {
    const S = { wbSuppDefs: withSuppDef({ x: { name: 'X', order: 9, _ts: 0 } }, 'tooth', 'Pain pill', '1 tablet', 0, 1, false, 3), wbSupps: {} }
    expect(suppList(S).find(x => x.id === 'tooth')).toMatchObject({ dose: '1 tablet', times: 3 })
    const tap = ts => { S.wbSupps = withSuppTap(S.wbSupps, D, suppCountsOn(S, D), 'tooth', 3, ts) }
    tap(2); expect(suppCountsOn(S, D)).toEqual({ tooth: 1 }); expect(suppsTakenOn(S, D)).toEqual([])
    tap(3); expect(suppCountsOn(S, D)).toEqual({ tooth: 2 })
    tap(4); expect(suppsTakenOn(S, D)).toEqual(['tooth'])
    tap(5); expect(suppCountsOn(S, D)).toEqual({}); expect(S.wbSupps[D]).toEqual({ _ts: 5 })
    expect([0, 1, 2, 3].map(n => nextIntake(n, 3))).toEqual([1, 2, 3, 0])
    expect(timesOf(99)).toBe(6)
    expect(timesOf('x')).toBe(1)
  })

  it('reads a day logged before intakes as taken in full', () => {
    const S = { wbSuppDefs: { p: { name: 'Protein', times: 2, order: 0, _ts: 1 } }, wbSupps: { [D]: { taken: ['p'], _ts: 1 } } }
    expect(suppCountsOn(S, D)).toEqual({ p: 2 })
    expect(suppsTakenOn(S, D)).toEqual(['p'])
  })
})

describe('food', () => {
  it('needs a date, a name and calories', () => {
    expect(readFood({ d: D, name: 'Oats', kcal: 389.4, grams: 50, meal: 'breakfast' })).toMatchObject({ kcal: 389, grams: 50, meal: 'breakfast' })
    expect(readFood({ d: D, name: '', kcal: 10 })).toBeNull()
    expect(readFood({ d: 'x', name: 'A', kcal: 10 })).toBeNull()
    expect(readFood({ d: D, name: 'A', kcal: 10, meal: 'brunch' }).meal).toBe('snack')
  })
  it('totals a day and leaves protein null when nothing has it', () => {
    let m = withFood({}, 'a', { d: D, name: 'Rice', kcal: 200, meal: 'lunch' }, 1)
    m = withFood(m, 'b', { d: D, name: 'Chicken', kcal: 300, protein: 40.4, meal: 'lunch' }, 2)
    m = withFood(m, 'c', { d: '2026-11-11', name: 'Other day', kcal: 999 }, 3)
    expect(dayTotals({ wbFood: m }, D)).toEqual({ kcal: 500, protein: 40, count: 2 })
    m = withFood(m, 'b', null, 4)
    expect(foodsOn({ wbFood: m }, D).map(f => f.id)).toEqual(['a'])
    expect(dayTotals({ wbFood: m }, D).protein).toBeNull()
  })
  it('works out kcal from grams and keeps recent foods one per name, most used first', () => {
    expect(kcalFor(389, 50)).toBe(195)
    expect(kcalFor(389, 0)).toBeNull()
    let m = {}
    m = withFood(m, '1', { d: D, name: 'Banana', kcal: 90 }, 1)
    m = withFood(m, '2', { d: D, name: 'banana', kcal: 100 }, 5)
    m = withFood(m, '3', { d: D, name: 'Egg', kcal: 70 }, 3)
    const r = recentFoods({ wbFood: m })
    expect(r.map(f => f.name)).toEqual(['banana', 'Egg'])
    expect(r[0].kcal).toBe(100)
  })
  it('reads a calorie goal only in range', () => {
    expect(kcalGoalOf({ kcalGoal: 2150 })).toBe(2150)
    expect(kcalGoalOf({ kcalGoal: 10 })).toBeNull()
    expect(kcalGoalOf({})).toBeNull()
  })
})

describe('favourite foods', () => {
  it('stars a food by name, finds it with recent ones, and takes the star off', () => {
    let favs = withFav({}, 'Mi licuado', { kcal: 320, protein: 30, src: 'manual' }, 1)
    favs = withFav(favs, 'Avena', { kcal100: 379, grams: 50, protein100: 13 }, 2)
    const S = { wbFoodFavs: favs, wbFood: withFood({}, 'x', { d: D, name: 'Arroz', kcal: 200 }, 3) }
    expect(favFoods(S).map(f => f.name)).toEqual(['Mi licuado', 'Avena'])
    expect(isFavFood(S, 'mi  LICUADO')).toBe(true)
    expect(myFoodsMatching(S, 'a').map(f => [f.name, f.fav])).toEqual([['Mi licuado', true], ['Avena', true], ['Arroz', false]])
    expect(myFoodsMatching(S, 'arr').map(f => f.name)).toEqual(['Arroz'])
    S.wbFoodFavs = withFav(S.wbFoodFavs, 'Avena', null, 4)
    expect(isFavFood(S, 'Avena')).toBe(false)
    expect(STAMPED_MAPS).toContain('wbFoodFavs')
  })
})

describe('periods', () => {
  it('covers a Monday-first week, a calendar month and year, and moves by one', () => {
    expect(periodRange('week', '2026-11-18')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(periodRange('week', '2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
    expect(periodRange('week', '2026-11-18', 0)).toEqual({ from: '2026-11-15', to: '2026-11-21' })
    expect(periodRange('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodRange('year', '2026-06-01')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(shiftPeriod('week', '2026-11-18', -1)).toBe('2026-11-11')
    expect(shiftPeriod('month', '2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftPeriod('year', '2026-06-01', -1)).toBe('2025-01-01')
  })
})

describe('dates', () => {
  it('lists a month and moves months and days across year ends', () => {
    expect(monthDays('2026-02')).toHaveLength(28)
    expect(monthDays('2028-02')).toHaveLength(29)
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('sync', () => {
  it('merges each day and each food on its own stamp', () => {
    for (const k of ['wbFood', 'wbMood', 'wbSymptoms', 'wbHabits', 'wbHabitDefs', 'wbSymptomDefs']) expect(STAMPED_MAPS).toContain(k)
    const phone = withMood(withMood({}, '2026-11-01', { mood: 2 }, 10), '2026-11-02', { mood: 5 }, 30)
    const laptop = withMood({}, '2026-11-01', { mood: 4 }, 20)
    const merged = mergeStampedMap(phone, laptop)
    expect(merged['2026-11-01'].mood).toBe(4)
    expect(merged['2026-11-02'].mood).toBe(5)
  })
})
