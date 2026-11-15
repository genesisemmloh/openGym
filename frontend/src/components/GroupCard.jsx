import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { groupOf } from '../lib/group.js'
import { useGroupBoard } from '../views/Group.jsx'
import Icon from './Icon.jsx'
import CardHead from './CardHead.jsx'
import '../views/Group.css'

// Home's Group card (fork module): this week's top three and where you are, or an invitation to
// share when you do not yet. A tap opens the Group screen.
export default function GroupCard({ S }) {
  const nav = useNavigate()
  const g = groupOf(S)
  const { board } = useGroupBoard(S)
  const open = { onClick: () => nav('/group') }
  if (!g.share) {
    return <div className="card tap-host">
      <CardHead icon="trophy" tint="var(--yellow)" eyebrow={t('Group')} title={t('Train together with your group')} open={open}
        action={<Icon name="chevronRight" className="chev" />} />
    </div>
  }
  const members = board?.joined ? board.members : []
  const meAt = members.findIndex(m => m.me)
  return <div className="card tap-host">
    <CardHead icon="trophy" tint="var(--yellow)" eyebrow={t('Group')}
      title={board?.joined ? t('{0} workouts together this week', board.totals.week) : t('Group')} open={open}
      action={<Icon name="chevronRight" className="chev" />} />
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
