import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { groupOf } from '../lib/group.js'
import { useGroups } from '../views/Group.jsx'
import Icon from './Icon.jsx'
import CardHead from './CardHead.jsx'
import '../views/Group.css'

// Home's Group card (fork module): your main group's top three this week and where you are, or an
// invitation to create or join a group. A tap opens the Group screen.
export default function GroupCard({ S }) {
  const nav = useNavigate()
  const g = groupOf(S)
  const { groups } = useGroups(S)
  const open = { onClick: () => nav('/group') }
  const chev = <Icon name="chevronRight" className="chev" />
  const group = groups && (groups.find(x => x.id === g.main) || groups[0])
  if (!group) {
    return <div className="card tap-host">
      <CardHead icon="trophy" tint="var(--yellow)" eyebrow={t('Group')} title={t('Train together with your group')} open={open} action={chev} />
    </div>
  }
  const members = group.members
  const meAt = members.findIndex(m => m.me)
  return <div className="card tap-host">
    <CardHead icon="trophy" tint="var(--yellow)" eyebrow={group.name} title={t('{0} workouts together this week', group.totals.week)} open={open} action={chev} />
    {members.length > 0 && <div className="grp-mini">
      {members.slice(0, 3).map((m, i) => <div key={i} className={'grp-mini-row' + (m.me ? ' me' : '')}>
        <span className={'grp-place p' + (i + 1)}><Icon name="medal" /></span>
        <span className="grp-name">{m.alias}{m.area ? <span className="small dim"> · {m.area}</span> : null}</span>
        <b>{m.week}</b>
      </div>)}
      {meAt > 2 && <div className="small dim">{t('You are number {0} this week.', meAt + 1)}</div>}
    </div>}
  </div>
}
