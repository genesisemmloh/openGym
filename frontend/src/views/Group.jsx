import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import Icon from '../components/Icon.jsx'
import { Segmented, Switch, TextField } from '../components/ui.jsx'
import { groupOf, fetchGroup, placeOf, ALIAS_MAX, AREA_MAX } from '../lib/group.js'
import './Group.css'

// The Group screen (fork module, lib/group.js): who on this server trains how often, for the people
// who chose to share. Your own switch, name and area sit on top; the board below.

export function useGroupBoard(S) {
  const [board, setBoard] = useState(null)
  const [err, setErr] = useState(false)
  const share = groupOf(S).share
  // Asked again when the switch or what you trained changes, so the board follows your own log.
  useEffect(() => {
    let live = true
    fetchGroup(todayISO()).then(b => { if (live) { setBoard(b); setErr(false) } }).catch(() => { if (live) setErr(true) })
    return () => { live = false }
  }, [share, (S.workouts || []).length, S.group?.alias, S.group?.area]) // eslint-disable-line react-hooks/exhaustive-deps
  return { board, err }
}

export default function Group() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const g = groupOf(S)
  const [period, setPeriod] = useState('week')
  const { board, err } = useGroupBoard(S)
  const set = patch => update(s => { s.group = { ...groupOf(s), ...patch } })
  const members = board?.joined ? [...board.members].sort((a, b) => (period === 'week' ? b.week - a.week || b.month - a.month : b.month - a.month || b.week - a.week) || b.streak - a.streak) : []
  const n = m => (period === 'week' ? m.week : m.month)
  const min = m => (period === 'week' ? m.minWeek : m.minMonth)

  return <>
    <div className="hdr"><button className="iconbtn" data-back="/home" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Group')}</h1>
        <div className="sub">{t('How often the people on this server train, for those who share it.')}</div></div></div>

    <section className="card grp-card">
      <div className="grp-switch">
        <span><b>{t('Share my progress')}</b><span className="small dim">{t('Only how often you train: workouts, minutes and your streak. Never weights, routines, body weight or Wellbeing.')}</span></span>
        <Switch checked={g.share} onChange={v => set({ share: !!v })} aria-label={t('Share my progress')} />
      </div>
      {g.share && <div className="grp-fields">
        <label><span>{t('Name on the board')}</span>
          <TextField value={g.alias} maxLength={ALIAS_MAX} placeholder={user?.name || t('Your name')} onChange={e => set({ alias: e.target.value })} /></label>
        <label><span>{t('Team or area (optional)')}</span>
          <TextField value={g.area} maxLength={AREA_MAX} placeholder={t('Like “IT”')} onChange={e => set({ area: e.target.value })} /></label>
      </div>}
    </section>

    {!g.share && <div className="card grp-card grp-empty">
      <Icon name="trophy" />
      <div>{board && board.count > 0 ? t('{0} people share their progress here. Switch it on to see the board and appear on it.', board.count) : t('Switch it on to see who trains how often, and to appear on the board yourself.')}</div>
    </div>}

    {g.share && err && <div className="card grp-card small dim">{t('The board could not be loaded. Check your connection and try again.')}</div>}

    {g.share && board?.joined && <>
      <section className="card grp-card grp-totals">
        <div><div className="grp-big">{board.totals.week}</div><div className="small dim">{t('Workouts this week, together')}</div></div>
        <div><div className="grp-big">{board.totals.month}</div><div className="small dim">{t('This month, together')}</div></div>
        <div><div className="grp-big">{Math.round(board.totals.minMonth / 60).toLocaleString(dateLocale())}</div><div className="small dim">{t('Hours this month')}</div></div>
      </section>

      <Segmented className="grp-seg" value={period} onChange={setPeriod} options={[{ value: 'week', label: t('This week') }, { value: 'month', label: t('This month') }]} />

      <section className="card grp-card">
        <ol className="grp-list">
          {members.map((m, i) => {
            const place = placeOf(members.map(x => ({ week: n(x) })), i)
            return <li key={i} className={'grp-row' + (m.me ? ' me' : '')}>
              <span className={'grp-place p' + place}>{place <= 3 && n(m) > 0 ? <Icon name="medal" /> : place}</span>
              <span className="grp-who"><span className="grp-name">{m.alias}{m.me && <span className="grp-you">{t('You')}</span>}</span>
                <span className="small dim">{[m.area, m.streak > 0 ? t('{0} week streak', m.streak) : ''].filter(Boolean).join(' · ')}</span></span>
              <span className="grp-n"><b>{n(m)}</b><span className="small dim">{t('{0} min', min(m))}</span></span>
            </li>
          })}
        </ol>
        {members.length === 1 && <div className="small dim grp-alone">{t('For now it is only you. Invite your friends and colleagues to the server and ask them to switch it on.')}</div>}
      </section>
    </>}
  </>
}
