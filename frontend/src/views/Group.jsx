import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { copyText } from '../lib/clipboard.js'
import Icon from '../components/Icon.jsx'
import { Button, Segmented, Switch, TextField } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'
import { groupOf, fetchGroup, fetchGroups, groupAction, joinLink, showCode, placeOf, ALIAS_MAX, AREA_MAX, NAME_MAX } from '../lib/group.js'
import './Group.css'

// The Group screen (fork module, lib/group.js): your groups, each with its board, a way to create
// one or join one with a code, and for the one who runs a group: rename, a new code, remove someone,
// delete. "Whole server" is the optional board of everyone on the server who shares.

const ui = () => useUI.getState()
const SERVER = '__server'

/** Your groups and, when you share, the whole server's board. Reload with `reload()`. */
export function useGroups(S) {
  const [groups, setGroups] = useState(null)
  const [server, setServer] = useState(null)
  const [err, setErr] = useState(false)
  const share = groupOf(S).share
  const reload = useCallback(() => {
    const today = todayISO()
    fetchGroups(today).then(g => { setGroups(g); setErr(false) }).catch(() => setErr(true))
    if (share) fetchGroup(today).then(setServer).catch(() => setServer(null)); else setServer(null)
  }, [share])
  useEffect(() => { reload() }, [reload, (S.workouts || []).length, S.group?.alias, S.group?.area]) // eslint-disable-line react-hooks/exhaustive-deps
  return { groups, server, err, reload }
}

const errorText = r => (r.status === 404 ? t('No group has that code. Check it and try again.')
  : r.status === 409 ? t('That did not work: the group is full, or you are in too many groups.')
    : r.status === 403 ? t('Only the one who runs the group can do that.')
      : t('That did not work. Check your connection and try again.'))

function promptSheet({ title, label, initial = '', max, placeholder, confirm, onSave, upper }) {
  ui().openSheet(close => <PromptSheet {...{ title, label, initial, max, placeholder, confirm, onSave, upper, close }} />)
}
function PromptSheet({ title, label, initial, max, placeholder, confirm, onSave, upper, close }) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const go = async () => {
    if (!v.trim() || busy) return
    setBusy(true); setMsg('')
    const r = await onSave(v.trim())
    setBusy(false)
    if (r === true) close(); else setMsg(r || '')
  }
  return <>
    <h3>{title}</h3>
    {label && <div className="small dim" style={{ marginBottom: 10 }}>{label}</div>}
    <TextField autoFocus value={v} maxLength={max} placeholder={placeholder} className={upper ? 'grp-code-in' : ''}
      onChange={e => setV(upper ? e.target.value.toUpperCase() : e.target.value)} onKeyDown={e => { if (e.key === 'Enter') go() }} />
    {msg && <div className="small grp-err">{msg}</div>}
    <div style={{ height: 14 }} />
    <Button variant="primary" disabled={!v.trim() || busy} onClick={go}>{confirm}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

export default function Group() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const g = groupOf(S)
  const { groups, server, err, reload } = useGroups(S)
  const [sel, setSel] = useState('')
  const [period, setPeriod] = useState('week')
  const set = patch => update(s => { s.group = { ...groupOf(s), ...patch } })

  const act = async (action, body, done) => {
    const r = await groupAction(action, body)
    if (!r.ok) return errorText(r)
    reload()
    done && done(r.body)
    return true
  }
  const create = () => promptSheet({
    title: t('Create a group'), label: t('Give it a name your people will recognise. You get a code to invite them.'),
    max: NAME_MAX, placeholder: t('Like “Office IT” or “Gym friends”'), confirm: t('Create'),
    onSave: name => act('create', { name }, b => { setSel(b.id); ui().toast(t('Group created')) }),
  })
  const join = (initial = '') => promptSheet({
    title: t('Join a group'), label: t('Type the code someone in the group gave you. The group will see how often you train: workouts, minutes and your streak.'),
    max: 12, placeholder: 'ABCD-EFGH', confirm: t('Join'), upper: true, initial,
    onSave: code => act('join', { code }, b => { setSel(b.id); ui().toast(t('You joined {0}', b.name || t('the group'))) }),
  })

  // A join link (#/group?join=CODE) opens the join prompt with the code filled in.
  useEffect(() => {
    const code = params.get('join')
    if (!code) return
    setParams({}, { replace: true })
    join(code)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const list = groups || []
  const current = sel === SERVER ? null : list.find(x => x.id === sel) || list.find(x => x.id === g.main) || list[0] || null
  const showServer = sel === SERVER || (!current && g.share)
  const board = showServer ? (server?.joined ? { name: t('Whole server'), members: server.members, totals: server.totals } : null) : current

  return <>
    <div className="hdr"><button className="iconbtn" data-back="/home" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginInlineStart: 12 }}><h1>{t('Group')}</h1>
        <div className="sub">{t('Train together: create a group or join one with its code.')}</div></div></div>

    {(list.length > 0 || g.share) && <div className="chips grp-tabs">
      {list.map(x => <button key={x.id} type="button" className={'chip nocap' + (!showServer && current?.id === x.id ? ' on' : '')} onClick={() => setSel(x.id)}>{x.name}</button>)}
      {g.share && <button type="button" className={'chip nocap' + (showServer ? ' on' : '')} onClick={() => setSel(SERVER)}><Icon name="globe" />{t('Whole server')}</button>}
    </div>}

    <div className="grp-actions">
      <Button variant="tinted" icon="plus" onClick={create}>{t('Create a group')}</Button>
      <Button variant="tinted" icon="link" onClick={() => join()}>{t('Join with a code')}</Button>
    </div>

    {err && <div className="card grp-card small dim">{t('The board could not be loaded. Check your connection and try again.')}</div>}
    {groups && !list.length && !g.share && <div className="card grp-card grp-empty"><Icon name="trophy" />
      <div>{t('You are not in a group yet. Create one and invite your friends or colleagues with its code, or join one with a code you got.')}</div></div>}

    {board && <Board board={board} period={period} setPeriod={setPeriod} isOwner={!showServer && current?.isOwner}
      onRemove={m => confirmSheet({ title: t('Remove {0}?', m.alias), message: t('They leave the group and stop seeing its board. They can join again with the code.'), confirmText: t('Remove'), danger: true,
        onConfirm: () => act('remove', { id: current.id, key: m.key }) })} />}

    {!showServer && current && <GroupAdmin group={current} g={g} set={set} act={act} onGone={() => setSel('')} />}

    <section className="card grp-card">
      <h2 className="grp-h">{t('How you appear on the boards')}</h2>
      <div className="grp-fields">
        <label><span>{t('Name on the board')}</span>
          <TextField value={g.alias} maxLength={ALIAS_MAX} placeholder={user?.name || t('Your name')} onChange={e => set({ alias: e.target.value })} /></label>
        <label><span>{t('Team or area (optional)')}</span>
          <TextField value={g.area} maxLength={AREA_MAX} placeholder={t('Like “IT”')} onChange={e => set({ area: e.target.value })} /></label>
      </div>
      <div className="grp-switch">
        <span><b>{t('Also show me on the whole server’s board')}</b>
          <span className="small dim">{t('Everyone on this server who switches this on sees each other, group or not.')}</span></span>
        <Switch checked={g.share} onChange={v => set({ share: !!v })} aria-label={t('Also show me on the whole server’s board')} />
      </div>
      <div className="small dim grp-privacy">{t('Only how often you train is shared: workouts, minutes and your streak. Never weights, routines, body weight or Wellbeing.')}</div>
    </section>
  </>
}

function Board({ board, period, setPeriod, isOwner, onRemove }) {
  const count = m => (period === 'week' ? m.week : m.month)
  const min = m => (period === 'week' ? m.minWeek : m.minMonth)
  const members = [...board.members].sort((a, b) => count(b) - count(a) || b.streak - a.streak || a.alias.localeCompare(b.alias))
  return <>
    <section className="card grp-card grp-totals">
      <div><div className="grp-big">{board.totals.week}</div><div className="small dim">{t('Workouts this week, together')}</div></div>
      <div><div className="grp-big">{board.totals.month}</div><div className="small dim">{t('This month, together')}</div></div>
      <div><div className="grp-big">{Math.round(board.totals.minMonth / 60).toLocaleString(dateLocale())}</div><div className="small dim">{t('Hours this month')}</div></div>
    </section>
    <Segmented className="grp-seg" value={period} onChange={setPeriod} options={[{ value: 'week', label: t('This week') }, { value: 'month', label: t('This month') }]} />
    <section className="card grp-card">
      <ol className="grp-list">
        {members.map((m, i) => {
          const place = placeOf(members, i, count)
          return <li key={i} className={'grp-row' + (m.me ? ' me' : '')}>
            <span className={'grp-place p' + place}>{place <= 3 && count(m) > 0 ? <Icon name="medal" /> : place}</span>
            <span className="grp-who"><span className="grp-name">{m.alias}{m.me && <span className="grp-you">{t('You')}</span>}{m.owner && <Icon name="crown" className="grp-crown" />}</span>
              <span className="small dim">{[m.area, m.streak > 0 ? t('{0} week streak', m.streak) : ''].filter(Boolean).join(' · ')}</span></span>
            <span className="grp-n"><b>{count(m)}</b><span className="small dim">{t('{0} min', min(m))}</span></span>
            {isOwner && !m.me && m.key && <button className="iconbtn grp-rm" onClick={() => onRemove(m)} aria-label={t('Remove {0}', m.alias)}><Icon name="xmark" /></button>}
          </li>
        })}
      </ol>
      {members.length === 1 && <div className="small dim grp-alone">{t('For now it is only you. Share the code below with your friends or colleagues.')}</div>}
    </section>
  </>
}

function GroupAdmin({ group, g, set, act, onGone }) {
  const link = joinLink(group.code)
  const share = async () => {
    const text = t('Join my group “{0}” on openGym: {1} (code {2})', group.name, link, showCode(group.code))
    try { if (navigator.share) { await navigator.share({ title: group.name, text }); return } } catch { /* cancelled */ }
    await copyText(text)
    ui().toast(t('Invitation copied'))
  }
  return <section className="card grp-card">
    <h2 className="grp-h">{group.name} <span className="small dim">· {group.count === 1 ? t('1 person') : t('{0} people', group.count)}</span></h2>
    <div className="grp-code-row">
      <div><div className="small dim">{t('Join code')}</div><div className="grp-code">{showCode(group.code)}</div></div>
      <Button variant="tinted" icon="share" onClick={share}>{t('Invite')}</Button>
    </div>
    <div className="grp-admin">
      {g.main !== group.id && <Button variant="ghost" icon="house" onClick={() => set({ main: group.id })}>{t('Show this group on Home')}</Button>}
      {group.isOwner && <>
        <Button variant="ghost" icon="pencil" onClick={() => promptSheet({ title: t('Rename group'), initial: group.name, max: NAME_MAX, confirm: t('Save'), onSave: name => act('rename', { id: group.id, name }) })}>{t('Rename group')}</Button>
        <Button variant="ghost" icon="reset" onClick={() => confirmSheet({ title: t('New join code?'), message: t('The old code stops working. Everyone already in the group stays.'), confirmText: t('New code'),
          onConfirm: () => act('code', { id: group.id }) })}>{t('New join code')}</Button>
        <Button variant="ghost" icon="trash" className="danger" onClick={() => confirmSheet({ title: t('Delete {0}?', group.name), message: t('The group and its board are gone for everyone in it. Nobody’s training is touched.'), confirmText: t('Delete'), danger: true,
          onConfirm: () => act('delete', { id: group.id }, onGone) })}>{t('Delete group')}</Button>
      </>}
      <Button variant="ghost" icon="signOut" className="dim" onClick={() => confirmSheet({ title: t('Leave {0}?', group.name), message: group.isOwner && group.count > 1 ? t('Someone else in the group will run it from now on. You can join again with the code.') : t('You can join again with the code.'), confirmText: t('Leave'),
        onConfirm: () => act('leave', { id: group.id }, onGone) })}>{t('Leave group')}</Button>
    </div>
  </section>
}
