import { Link } from 'react-router-dom'
import { useApp, useTable } from '../lib/app'
import { cancellationDeadline, daysBetween, euro, longDate, monthly, parse, relDay, shortDate, today } from '../lib/dates'
import { Icon } from '../components/Icon'
import { Card, IconChip, PersonTag } from '../components/ui'
import { TodoRow } from './Todos'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Hallo'
  return 'Guten Abend'
}

export default function Heute() {
  const { me } = useApp()
  const todos = useTable('todos')
  const shop = useTable('shopping_items')
  const contracts = useTable('contracts')
  const recipes = useTable('recipes')
  const t = today()

  const open = todos.rows.filter((x) => !x.done_at)
  const dueNow = open
    .filter((x) => x.due_date && parse(x.due_date) <= t)
    .filter((x) => x.assignee_id === me.id || x.assignee_id === null)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const othersDue = open.filter((x) => x.due_date && parse(x.due_date) <= t && x.assignee_id && x.assignee_id !== me.id).length

  const active = contracts.rows.filter((c) => c.status === 'active')
  const fix = active.filter((c) => c.direction === 'expense').reduce((s, c) => s + monthly(c), 0)
  const next = active
    .filter((c) => c.direction === 'expense')
    .map((c) => ({ c, d: cancellationDeadline(c) }))
    .filter((x) => x.d.kind === 'deadline' && x.d.daysLeft <= 60)
    .sort((a, b) => (a.d.kind === 'deadline' && b.d.kind === 'deadline' ? a.d.daysLeft - b.d.daysLeft : 0))[0]

  const shopOpen = shop.rows.filter((s) => !s.checked)
  const wish = recipes.rows.filter((r) => r.is_wish).at(-1)

  const sub = dueNow.length === 0 ? 'Nichts fällig. Stark.' : dueNow.length === 1 ? '1 Sache offen heute. Machbar.' : `${dueNow.length} Sachen offen heute. Machbar.`

  return (
    <div>
      <div className="flex justify-between items-center pt-6">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[26px] font-bold tracking-[-0.5px]">KK</span>
          <span className="font-mono text-[11px] tracking-[0.28em] text-muted">HOME</span>
        </div>
        <Link to="/mehr" aria-label="Mehr und Profil"
          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-[15px] no-underline ${me.color === 'irene' ? 'bg-irene text-[#2A1405]' : 'bg-jannik text-white'}`}>
          {me.display_name.charAt(0)}
        </Link>
      </div>

      <div className="mt-6 label !text-green flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />{longDate(t)}</div>
      <h1 className="m-0 mt-2 text-[34px] leading-[1.05] font-semibold tracking-[-1px]">{greeting()}, {me.display_name}.</h1>
      <p className="m-0 mt-1.5 text-[15px] text-muted">{sub}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link to="/vertraege" className="no-underline text-ink">
          <Card className="p-3.5 flex flex-col gap-2.5 h-full">
            <div className="flex items-center gap-2"><IconChip name="wallet" color="lime" /><span className="label !text-[10px]">Fix / Monat</span></div>
            <span className="font-mono text-[22px] font-bold">{euro(fix)}</span>
            <span className="text-[13px] text-muted">{active.length} Verträge</span>
          </Card>
        </Link>
        {next && next.d.kind === 'deadline' ? (
          <Link to="/vertraege" className="no-underline">
            <div className="h-full rounded-[18px] bg-green p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2"><IconChip name="doc" color="lime" /><span className="font-mono text-[10px] tracking-[0.15em] text-[#D7F07A]">FRIST · {next.d.daysLeft === 0 ? 'HEUTE' : `${next.d.daysLeft} ${next.d.daysLeft === 1 ? 'TAG' : 'TAGE'}`}</span></div>
              <span lang="de" className="text-[19px] font-semibold leading-tight text-white hyphens-auto [overflow-wrap:anywhere]">{next.c.name} kündigen?</span>
              <span className="text-[13px] font-semibold text-lime">bis {shortDate(next.d.deadline)} →</span>
            </div>
          </Link>
        ) : (
          <Link to="/vertraege" className="no-underline text-ink">
            <Card className="p-3.5 flex flex-col gap-2.5 h-full">
              <div className="flex items-center gap-2"><IconChip name="doc" color="green" /><span className="label !text-[10px]">Fristen</span></div>
              <span className="text-[19px] font-semibold leading-tight">Alles ruhig</span>
              <span className="text-[13px] text-muted">keine in 60 Tagen</span>
            </Card>
          </Link>
        )}
        <Link to="/einkauf" className="no-underline text-ink">
          <Card className="p-3.5 flex flex-col gap-2.5 h-full">
            <div className="flex items-center gap-2"><IconChip name="cart" color="yellow" /><span className="label !text-[10px]">Einkauf</span></div>
            <span className="font-mono text-[22px] font-bold">{shopOpen.length} Artikel</span>
            <span className="text-[13px] text-muted truncate">{shopOpen.slice(0, 3).map((s) => s.name).join(', ') || 'Liste ist leer'}</span>
          </Card>
        </Link>
        <Link to="/essen" className="no-underline text-ink">
          <Card className="p-3.5 flex flex-col gap-2.5 h-full">
            <div className="flex items-center gap-2"><IconChip name="bowl" color="violet" /><span className="label !text-[10px]">Wunsch</span></div>
            <span className="text-[19px] font-semibold leading-tight truncate">{wish?.title ?? 'Noch nichts'}</span>
            <WishBy id={wish?.wished_by ?? null} has={!!wish} />
          </Card>
        </Link>
      </div>

      <Card className="mt-3 px-3.5 pt-3.5 pb-1">
        <div className="flex justify-between items-center">
          <span className="label">Heute fällig</span>
          <Link to="/todos" className="text-[13px] text-ink no-underline">Alle →</Link>
        </div>
        {dueNow.length === 0 ? (
          <div className="py-6 text-center">
            <div className="label">Inbox zero</div>
            <div className="mt-1.5 text-muted">Nichts offen für dich.</div>
          </div>
        ) : (
          <div className="mt-1">{dueNow.map((x) => <TodoRow key={x.id} todo={x} api={todos} compact />)}</div>
        )}
      </Card>
      {othersDue > 0 && (
        <p className="mt-3 text-[13px] text-muted flex items-center gap-1.5"><Icon name="users" size={16} /> Bei der anderen Person {othersDue === 1 ? 'ist 1 To-do' : `sind ${othersDue} To-dos`} fällig.</p>
      )}
      <Upcoming todos={open.filter((x) => x.due_date && parse(x.due_date) > t && daysBetween(t, parse(x.due_date)) <= 7)} />
    </div>
  )
}

function WishBy({ id, has }: { id: string | null; has: boolean }) {
  const { person } = useApp()
  if (!has) return <span className="text-[13px] text-muted">Trag was ein</span>
  return <span className="text-[13px] text-muted">von {person(id)?.display_name ?? 'euch'}</span>
}

function Upcoming({ todos }: { todos: { id: string; title: string; due_date: string | null; assignee_id: string | null }[] }) {
  if (!todos.length) return null
  return (
    <div className="mt-5">
      <div className="label mb-2">Diese Woche</div>
      <div className="flex flex-col gap-2">
        {todos.slice(0, 4).map((x) => (
          <div key={x.id} className="flex items-center gap-3 bg-card border border-line rounded-[14px] px-3.5 min-h-12">
            <Icon name="calendar" size={18} className="text-green" />
            <span className="flex-1 text-[15px] truncate">{x.title}</span>
            <span className="text-[13px] text-muted">{relDay(x.due_date!)}</span>
            <PersonTag id={x.assignee_id} />
          </div>
        ))}
      </div>
    </div>
  )
}
