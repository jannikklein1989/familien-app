import { useState } from 'react'
import { useApp, useTable } from '../lib/app'
import { iso, nextDue, parse, recurrenceLabel, relDay, shortDate, today } from '../lib/dates'
import type { Freq, Recurrence, Todo } from '../lib/types'
import { Icon } from '../components/Icon'
import { Card, Empty, Field, PageHeader, PersonPicker, PersonTag, PrimaryButton, Sheet, inputCls } from '../components/ui'

type TodoApi = ReturnType<typeof useTable<'todos'>>

export function TodoRow({ todo, api, compact, onEdit }: { todo: Todo; api: Pick<TodoApi, 'update'>; compact?: boolean; onEdit?: (t: Todo) => void }) {
  const { me } = useApp()
  const [flash, setFlash] = useState<string | null>(null)
  const overdue = !todo.done_at && todo.due_date && parse(todo.due_date) < today()

  const toggle = async () => {
    if (todo.done_at) return api.update(todo.id, { done_at: null, done_by: null })
    if (todo.recurrence) {
      const nd = nextDue(todo.recurrence, todo.due_date)
      setFlash(`Nächstes Mal: ${shortDate(nd)}`)
      setTimeout(() => setFlash(null), 2200)
      return api.update(todo.id, { due_date: nd })
    }
    return api.update(todo.id, { done_at: new Date().toISOString(), done_by: me.id })
  }

  return (
    <div className="flex items-center gap-3 min-h-12 border-b border-line-soft last:border-b-0 py-1">
      <input type="checkbox" checked={!!todo.done_at} onChange={toggle} aria-label={`${todo.title} erledigt`}
        className="w-5 h-5 m-0 accent-green shrink-0" />
      <button type="button" onClick={() => onEdit?.(todo)} disabled={!onEdit}
        className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 text-ink disabled:cursor-default">
        <span className={`text-[15px] flex items-center gap-1.5 ${todo.done_at ? 'line-through text-muted' : ''}`}>
          <span className="truncate">{todo.title}</span>
          {todo.recurrence && <Icon name="repeat" size={14} stroke={2.4} className="text-muted shrink-0" label="wiederkehrend" />}
        </span>
        {flash ? <span className="block text-[12px] text-green font-semibold">{flash}</span> : !compact && (todo.due_date || todo.recurrence) && (
          <span className={`block text-[12px] ${overdue ? 'text-alert font-semibold' : 'text-muted'}`}>
            {todo.due_date ? relDay(todo.due_date) : ''}{todo.due_date && todo.recurrence ? ' · ' : ''}{todo.recurrence ? recurrenceLabel(todo.recurrence) : ''}
          </span>
        )}
      </button>
      <PersonTag id={todo.assignee_id} />
    </div>
  )
}

type Filter = 'all' | 'me' | 'other' | 'both'

export default function Todos() {
  const api = useTable('todos')
  const { me, profiles } = useApp()
  const other = profiles.find((p) => p.id !== me.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Todo | 'new' | null>(null)
  const [showDone, setShowDone] = useState(false)
  const t = today()

  const match = (x: Todo) =>
    filter === 'all' ? true : filter === 'me' ? x.assignee_id === me.id : filter === 'other' ? x.assignee_id === other?.id : x.assignee_id === null
  const rows = api.rows.filter(match)
  const open = rows.filter((x) => !x.done_at)
  const groups: { title: string; items: Todo[] }[] = [
    { title: 'Überfällig', items: open.filter((x) => x.due_date && parse(x.due_date) < t) },
    { title: 'Heute', items: open.filter((x) => x.due_date === iso(t)) },
    { title: 'Demnächst', items: open.filter((x) => x.due_date && parse(x.due_date) > t).sort((a, b) => a.due_date!.localeCompare(b.due_date!)) },
    { title: 'Ohne Datum', items: open.filter((x) => !x.due_date) },
  ].filter((g) => g.items.length)
  const done = rows.filter((x) => x.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!))

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Alle' }, { id: 'me', label: 'Ich' },
    ...(other ? [{ id: 'other' as Filter, label: other.display_name }] : []), { id: 'both', label: 'Beide' },
  ]

  return (
    <div>
      <PageHeader eyebrow={`${open.length} offen`} title="To-dos" right={
        <button aria-label="To-do hinzufügen" onClick={() => setEditing('new')} className="w-12 h-12 rounded-full bg-green text-lime flex items-center justify-center border-0"><Icon name="plus" size={24} stroke={2.4} /></button>
      } />
      <div role="tablist" className="mt-4 p-[3px] rounded-[12px] bg-[#E3E8DD] grid" style={{ gridTemplateColumns: `repeat(${filters.length}, minmax(0,1fr))` }}>
        {filters.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={`h-10 rounded-[10px] border-0 text-[14px] ${filter === f.id ? 'bg-card font-semibold shadow-sm text-ink' : 'bg-transparent text-[#3F4450]'}`}>{f.label}</button>
        ))}
      </div>

      {groups.length === 0 && <Empty title="Inbox zero" text="Nichts offen. Genießt es." />}
      {groups.map((g) => (
        <section key={g.title} className="mt-5">
          <h2 className={`label m-0 mb-2 ${g.title === 'Überfällig' ? '!text-alert' : ''}`}>{g.title} · {g.items.length}</h2>
          <Card className="px-3.5">{g.items.map((x) => <TodoRow key={x.id} todo={x} api={api} onEdit={setEditing} />)}</Card>
        </section>
      ))}

      {done.length > 0 && (
        <section className="mt-5">
          <button onClick={() => setShowDone(!showDone)} className="label bg-transparent border-0 p-0 min-h-11 flex items-center gap-1">
            Erledigt · {done.length} <Icon name="chevron" size={14} className={showDone ? 'rotate-90' : ''} />
          </button>
          {showDone && <Card className="px-3.5">{done.slice(0, 30).map((x) => <TodoRow key={x.id} todo={x} api={api} onEdit={setEditing} />)}</Card>}
        </section>
      )}

      <TodoSheet todo={editing} onClose={() => setEditing(null)} api={api} />
    </div>
  )
}

const FREQS: { id: Freq | 'none'; label: string }[] = [
  { id: 'none', label: 'Einmalig' }, { id: 'daily', label: 'Tag' }, { id: 'weekly', label: 'Woche' }, { id: 'monthly', label: 'Monat' }, { id: 'yearly', label: 'Jahr' },
]

function TodoSheet({ todo, onClose, api }: { todo: Todo | 'new' | null; onClose: () => void; api: TodoApi }) {
  const { me } = useApp()
  const isNew = todo === 'new'
  const t = todo && todo !== 'new' ? todo : null
  const key = t?.id ?? (todo ? 'new' : 'closed')
  return (
    <Sheet open={!!todo} onClose={onClose} title={isNew ? 'Neues To-do' : 'To-do bearbeiten'}>
      <TodoForm key={key} initial={t} defaultAssignee={me.id} onClose={onClose} api={api} />
    </Sheet>
  )
}

function TodoForm({ initial, defaultAssignee, onClose, api }: { initial: Todo | null; defaultAssignee: string; onClose: () => void; api: TodoApi }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [assignee, setAssignee] = useState<string | null>(initial ? initial.assignee_id : defaultAssignee)
  const [due, setDue] = useState(initial?.due_date ?? '')
  const [freq, setFreq] = useState<Freq | 'none'>(initial?.recurrence?.freq ?? 'none')
  const [interval, setInterval] = useState(initial?.recurrence?.interval ?? 1)
  const [mode, setMode] = useState<Recurrence['mode']>(initial?.recurrence?.mode ?? 'fixed')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const save = async () => {
    const recurrence = freq === 'none' ? null : { freq, interval: Math.max(1, interval), mode }
    const row = { title: title.trim(), assignee_id: assignee, due_date: due || (recurrence ? iso(today()) : null), recurrence, notes: notes || null }
    if (initial) await api.update(initial.id, row)
    else await api.insert({ ...row, done_at: null, done_by: null })
    onClose()
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) save() }} className="flex flex-col gap-4">
      <Field label="Was?"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="z. B. Müll rausstellen" /></Field>
      <Field label="Wer?"><PersonPicker value={assignee} onChange={setAssignee} /></Field>
      <Field label="Fällig"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
      <Field label="Wiederholen">
        <div className="grid grid-cols-5 gap-1.5">
          {FREQS.map((f) => (
            <button type="button" key={f.id} onClick={() => setFreq(f.id)} aria-pressed={freq === f.id}
              className={`min-h-11 rounded-[12px] border text-[13px] ${freq === f.id ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>{f.label}</button>
          ))}
        </div>
      </Field>
      {freq !== 'none' && (
        <div className="flex flex-col gap-3 bg-card border border-line rounded-[14px] p-3">
          <label className="flex items-center gap-2 text-[15px]">alle
            <input type="number" min={1} max={99} value={interval} onChange={(e) => setInterval(Number(e.target.value))} className="w-16 min-h-11 px-2 rounded-[10px] border border-line text-center" />
            {FREQS.find((f) => f.id === freq)?.label}{interval > 1 ? (freq === 'weekly' ? 'n' : freq === 'daily' ? 'e' : 'e') : ''}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('fixed')} aria-pressed={mode === 'fixed'} className={`min-h-11 rounded-[12px] border text-[13px] ${mode === 'fixed' ? 'bg-green text-white border-green' : 'bg-bg border-line'}`}>Fester Rhythmus</button>
            <button type="button" onClick={() => setMode('after_done')} aria-pressed={mode === 'after_done'} className={`min-h-11 rounded-[12px] border text-[13px] ${mode === 'after_done' ? 'bg-green text-white border-green' : 'bg-bg border-line'}`}>Ab Erledigung</button>
          </div>
          <p className="m-0 text-[12px] text-muted">{mode === 'fixed' ? 'Z. B. Müll: immer derselbe Wochentag, egal wann abgehakt.' : 'Z. B. Filter: nächster Termin zählt ab dem Tag, an dem ihr abhakt.'}</p>
        </div>
      )}
      <Field label="Notiz"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} py-3`} /></Field>
      <PrimaryButton type="submit" disabled={!title.trim()}>Speichern</PrimaryButton>
      {initial && (
        <button type="button" onClick={async () => { await api.remove(initial.id); onClose() }} className="min-h-11 bg-transparent border-0 text-alert font-medium flex items-center justify-center gap-2">
          <Icon name="trash" size={18} /> Löschen
        </button>
      )}
    </form>
  )
}
