import { Link } from 'react-router-dom'
import { useApp, useTable } from '../lib/app'
import { addDays, daysBetween, iso, longDate, parse, relDay, today } from '../lib/dates'
import { newEventUrl, onDay, useCalendar } from '../lib/calendar'
import { EventRow } from '../components/CalendarList'
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
  const recipes = useTable('recipes')
  const t = today()

  const open = todos.rows.filter((x) => !x.done_at)
  const dueNow = open
    .filter((x) => x.due_date && parse(x.due_date) <= t)
    .filter((x) => x.assignee_id === me.id || x.assignee_id === null)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  const othersDue = open.filter((x) => x.due_date && parse(x.due_date) <= t && x.assignee_id && x.assignee_id !== me.id).length

  const cal = useCalendar(7)
  const todayEvents = onDay(cal.events, iso(t))
  const tomorrowEvents = onDay(cal.events, iso(addDays(t, 1)))

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

      <Card className="mt-5 px-3.5 pt-3.5 pb-1">
        <div className="flex justify-between items-center">
          <span className="label flex items-center gap-1.5"><Icon name="calendar" size={14} /> Termine heute</span>
          <div className="flex items-center gap-3">
            {!!cal.feeds?.length && <a href={newEventUrl()} target="_blank" rel="noreferrer" className="text-[13px] text-green font-semibold no-underline">+ Termin</a>}
            <Link to="/kalender" className="text-[13px] text-ink no-underline">Alle →</Link>
          </div>
        </div>
        {cal.feeds && cal.feeds.length === 0 ? (
          <Link to="/kalender" className="my-3 min-h-12 rounded-[12px] border border-dashed border-line flex items-center justify-center gap-2 text-[14px] text-ink no-underline">
            <Icon name="calendar" size={18} /> Google Kalender verbinden
          </Link>
        ) : cal.error && !cal.events.length ? (
          <p className="my-3 text-[13px] text-alert">{cal.error}</p>
        ) : todayEvents.length ? (
          <div className="mt-1">{todayEvents.map((e) => <EventRow key={e.id} e={e} />)}</div>
        ) : (
          <div className="py-4 text-[14px] text-muted">{cal.loading ? 'Lade …' : 'Heute keine Termine.'}</div>
        )}
        {tomorrowEvents.length > 0 && (
          <p className="m-0 mb-2.5 text-[13px] text-muted truncate">Morgen: {tomorrowEvents.slice(0, 3).map((e) => e.title).join(', ')}{tomorrowEvents.length > 3 ? ' …' : ''}</p>
        )}
      </Card>

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
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link to="/essen" className="no-underline text-ink">
          <Card className="p-3.5 flex flex-col gap-2.5 h-full">
            <div className="flex items-center gap-2"><IconChip name="bowl" color="violet" /><span className="label !text-[10px]">Essenswunsch</span></div>
            <span className="text-[19px] font-semibold leading-tight truncate">{wish?.title ?? 'Noch nichts'}</span>
            <WishBy id={wish?.wished_by ?? null} has={!!wish} />
          </Card>
        </Link>
        <Link to="/einkauf" className="no-underline text-ink">
          <Card className="p-3.5 flex flex-col gap-2.5 h-full">
            <div className="flex items-center gap-2"><IconChip name="cart" color="yellow" /><span className="label !text-[10px]">Einkauf</span></div>
            <span className="font-mono text-[22px] font-bold">{shopOpen.length} Artikel</span>
            <span className="text-[13px] text-muted truncate">{shopOpen.slice(0, 3).map((s) => s.name).join(', ') || 'Liste ist leer'}</span>
          </Card>
        </Link>
      </div>
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
