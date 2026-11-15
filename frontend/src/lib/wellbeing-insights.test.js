import { describe, it, expect } from 'vitest'
import { monthRows, monthSummary, monthInsights, trainedDays } from './wellbeing-insights.js'
import { withMood, withSymptoms, withHabitDef, withHabitToggled, withFood } from './wellbeing.js'

const day = n => `2026-11-${String(n).padStart(2, '0')}`

// Ten days: trained on 1-5 with good moods, rested on 6-10 with poor moods and a headache.
function sample() {
  const S = { workouts: [], wbMood: {}, wbSymptoms: {}, wbHabits: {}, wbHabitDefs: { water: { name: 'Water', order: 0, _ts: 1 } }, wbFood: {}, kcalGoal: 2000 }
  for (let n = 1; n <= 10; n++) {
    const trained = n <= 5
    if (trained) S.workouts.push({ id: 'w' + n, d: day(n), start: new Date(day(n) + 'T10:00:00').getTime() })
    S.wbMood = withMood(S.wbMood, day(n), { mood: trained ? 5 : 2 }, n)
    if (!trained) S.wbSymptoms = withSymptoms(S.wbSymptoms, day(n), { s: { headache: n === 10 ? 3 : 1 } }, n)
    if (trained) S.wbHabits = withHabitToggled(S.wbHabits, day(n), [], 'water', n)
    S.wbFood = withFood(S.wbFood, 'f' + n, { d: day(n), name: 'Meal', kcal: trained ? 1800 : 2600 }, n)
  }
  return S
}

describe('wellbeing month', () => {
  it('reads one row per day up to today', () => {
    const S = sample()
    expect(trainedDays(S).has(day(3))).toBe(true)
    const rows = monthRows(S, '2026-11', day(10))
    expect(rows).toHaveLength(10)
    expect(rows[0]).toMatchObject({ d: day(1), trained: true, mood: 5, habits: ['water'], kcal: 1800, worst: 0 })
    expect(rows[9]).toMatchObject({ trained: false, mood: 2, worst: 3 })
  })

  it('sums the month', () => {
    const S = sample()
    const sum = monthSummary(S, monthRows(S, '2026-11', day(10)))
    expect(sum).toMatchObject({ days: 10, logged: 10, trained: 5, mood: 3.5, kcal: 2200, overGoal: 5 })
    expect(sum.symptoms).toEqual([{ id: 'headache', days: 5, severe: 1 }])
    expect(sum.habits).toEqual([{ id: 'water', name: 'Water', std: false, days: 5 }])
  })

  it('finds the patterns on both sides of a comparison', () => {
    const S = sample()
    const ins = monthInsights(S, monthRows(S, '2026-11', day(10)))
    const kinds = ins.map(x => x.kind)
    expect(kinds).toContain('moodTraining')
    expect(kinds).toContain('moodHabit')
    expect(kinds).toContain('moodFood')
    expect(kinds).toContain('symptomTraining')
    expect(ins.find(x => x.kind === 'moodTraining')).toMatchObject({ with: 5, without: 2, nWith: 5, nWithout: 5 })
    expect(ins.find(x => x.kind === 'symptomTraining')).toMatchObject({ key: 'headache', with: 0, without: 100 })
  })

  it('says nothing with too few days on one side', () => {
    const S = sample()
    const rows = monthRows(S, '2026-11', day(10)).slice(0, 6) // five trained days, one rest day
    expect(monthInsights(S, rows).filter(x => x.kind === 'moodTraining')).toEqual([])
  })
})

describe('wellbeing ranges', () => {
  it('reads any range of days, and sums calories, protein, reasons and the mood spread', async () => {
    const { rangeRows, daysBetween } = await import('./wellbeing-insights.js')
    expect(daysBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
    const S = sample()
    S.wbMood = withMood(S.wbMood, day(1), { mood: 5, reasons: ['work', 'sleep'] }, 99)
    const rows = rangeRows(S, day(1), day(14), day(10))
    expect(rows).toHaveLength(10)
    const sum = monthSummary(S, rows)
    expect(sum.kcalTotal).toBe(5 * 1800 + 5 * 2600)
    expect(sum.moodDist).toEqual([0, 5, 0, 0, 5])
    expect(sum.reasons).toEqual([{ id: 'work', days: 1 }, { id: 'sleep', days: 1 }])
  })
})
