import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp, useTable } from '../lib/app'
import { cancellationDeadline, euro, monthly, shortDate, type Deadline } from '../lib/dates'
import type { Contract } from '../lib/types'
import { Icon } from '../components/Icon'
import { Card, Empty, Field, IconChip, PageHeader, PersonPicker, PersonTag, PrimaryButton, Sheet, inputCls } from '../components/ui'

const CATEGORIES = ['Wohnen', 'Strom & Gas', 'Handy & Internet', 'Versicherung', 'Streaming', 'Mobilität', 'Fitness', 'Sparen', 'Einkommen', 'Sonstiges']
const INTERVAL_LABEL = { monthly: 'mtl.', quarterly: 'quartalsw.', yearly: 'jährl.' }

function DeadlineBadge({ d }: { d: Deadline }) {
  if (d.kind === 'unknown') return <span className="text-[12px] text-muted">Laufzeit fehlt</span>
  if (d.kind === 'anytime') return <span className="text-[12px] text-muted">jederzeit kündbar · {d.noticeText}</span>
  const urgent = d.daysLeft <= 30
  return <span className={`text-[12px] ${urgent ? 'text-alert font-semibold' : 'text-muted'}`}>kündbar bis {d.daysLeft === 0 ? 'heute' : `${shortDate(d.deadline)} (${d.daysLeft} T.)`}</span>
}

export default function Vertraege() {
  const api = useTable('contracts')
  const [editing, setEditing] = useState<Contract | 'new' | null>(null)
  const active = api.rows.filter((c) => c.status === 'active')
  const out = active.filter((c) => c.direction === 'expense').reduce((s, c) => s + monthly(c), 0)
  const inc = active.filter((c) => c.direction === 'income').reduce((s, c) => s + monthly(c), 0)

  const withD = active.filter((c) => c.direction === 'expense').map((c) => ({ c, d: cancellationDeadline(c) }))
  const soon = withD.filter((x) => x.d.kind === 'deadline' && x.d.daysLeft <= 60)
    .sort((a, b) => (a.d.kind === 'deadline' && b.d.kind === 'deadline' ? a.d.daysLeft - b.d.daysLeft : 0))

  const byCat = new Map<string, Contract[]>()
  for (const c of api.rows) byCat.set(c.category, [...(byCat.get(c.category) ?? []), c])

  return (
    <div>
      <Link to="/mehr" className="mt-4 inline-flex items-center gap-1 min-h-11 text-[14px] text-ink no-underline"><Icon name="back" size={18} /> Mehr</Link>
      <PageHeader eyebrow="Fixkosten & Fristen" title="Verträge" right={
        <button aria-label="Vertrag hinzufügen" onClick={() => setEditing('new')} className="w-12 h-12 rounded-full bg-green text-lime flex items-center justify-center border-0"><Icon name="plus" size={24} stroke={2.4} /></button>
      } />

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <Card className="p-3"><div className="label !text-[10px]">Ausgaben</div><div className="font-mono font-bold text-[17px] mt-1.5">{euro(out)}</div></Card>
        <Card className="p-3"><div className="label !text-[10px]">Einnahmen</div><div className="font-mono font-bold text-[17px] mt-1.5">{euro(inc)}</div></Card>
        <div className="p-3 rounded-[18px] bg-green text-white"><div className="font-mono text-[10px] tracking-[0.15em] text-[#D7F07A]">SALDO</div><div className="font-mono font-bold text-[17px] mt-1.5">{euro(inc - out)}</div></div>
      </div>
      <p className="mt-2 text-[12px] text-muted">pro Monat, Jahresbeträge umgerechnet</p>

      {soon.length > 0 && (
        <section className="mt-5">
          <h2 className="label m-0 mb-2 !text-alert">Fristen in den nächsten 60 Tagen</h2>
          <div className="flex flex-col gap-2">
            {soon.map(({ c, d }) => d.kind === 'deadline' && (
              <div key={c.id} className="rounded-[16px] bg-green text-white p-3.5 flex items-center gap-3">
                <IconChip name="doc" color="lime" size={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-[13px] text-[#D7F07A]">{d.daysLeft === 0 ? 'heute letzter Tag zum Kündigen' : `kündbar bis ${shortDate(d.deadline)} · noch ${d.daysLeft} ${d.daysLeft === 1 ? 'Tag' : 'Tage'}`}</div>
                </div>
                {c.cancel_url && <a href={c.cancel_url} target="_blank" rel="noreferrer" aria-label={`${c.name} kündigen`} className="w-11 h-11 rounded-full bg-lime text-lime-ink flex items-center justify-center"><Icon name="arrow" size={20} /></a>}
              </div>
            ))}
          </div>
        </section>
      )}

      {api.rows.length === 0 && <Empty title="Noch leer" text="Trag eure Verträge und Abos ein." />}
      {[...byCat.entries()].map(([cat, list]) => (
        <section key={cat} className="mt-5">
          <h2 className="label m-0 mb-2">{cat}</h2>
          <Card className="px-3.5">
            {list.map((c) => (
              <button key={c.id} onClick={() => setEditing(c)} className={`w-full flex items-center gap-3 min-h-[60px] py-2 border-0 border-b border-line-soft last:border-b-0 bg-transparent text-left text-ink ${c.status !== 'active' ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium truncate">{c.name}{c.status === 'cancelled' ? ' · gekündigt' : ''}</div>
                  {c.direction === 'expense' ? <DeadlineBadge d={cancellationDeadline(c)} /> : <span className="text-[12px] text-muted">Einnahme</span>}
                </div>
                <div className="text-right">
                  <div className={`font-mono text-[14px] font-bold ${c.direction === 'income' ? 'text-green' : ''}`}>{c.direction === 'income' ? '+' : ''}{euro(c.amount)}</div>
                  <div className="text-[11px] text-muted">{INTERVAL_LABEL[c.interval]}</div>
                </div>
                <PersonTag id={c.owner_id} />
              </button>
            ))}
          </Card>
        </section>
      ))}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Neuer Vertrag' : 'Vertrag'}>
        <ContractForm key={editing === 'new' ? 'new' : editing?.id ?? 'x'} initial={editing === 'new' ? null : editing} api={api} onClose={() => setEditing(null)} />
      </Sheet>
    </div>
  )
}

function ContractForm({ initial, api, onClose }: { initial: Contract | null; api: ReturnType<typeof useTable<'contracts'>>; onClose: () => void }) {
  useApp()
  const [f, setF] = useState<Partial<Contract>>(initial ?? {
    name: '', category: 'Sonstiges', owner_id: null, direction: 'expense', amount: 0, interval: 'monthly',
    start_date: null, min_term_months: null, renewal_months: null, notice_value: null, notice_unit: 'months',
    monthly_cancellable_after_min_term: false, status: 'active',
  })
  const set = <K extends keyof Contract>(k: K, v: Contract[K]) => setF((p) => ({ ...p, [k]: v }))
  const num = (s: string) => (s === '' ? null : Number(s.replace(',', '.')))

  const save = async () => {
    const row = { ...f, name: f.name!.trim() }
    delete (row as Partial<Contract>).id
    delete (row as Partial<Contract>).created_at
    if (initial) await api.update(initial.id, row)
    else await api.insert(row)
    onClose()
  }

  const preview = f.start_date && f.notice_value != null ? cancellationDeadline({ ...(f as Contract) }) : null

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (f.name?.trim()) save() }} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {(['expense', 'income'] as const).map((d) => (
          <button type="button" key={d} aria-pressed={f.direction === d} onClick={() => set('direction', d)}
            className={`min-h-11 rounded-[12px] border text-[14px] ${f.direction === d ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>{d === 'expense' ? 'Ausgabe / Vertrag' : 'Einnahme'}</button>
        ))}
      </div>
      <Field label="Name"><input autoFocus value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="z. B. Netflix, Hausrat, Gehalt" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Betrag €"><input inputMode="decimal" value={f.amount ?? ''} onChange={(e) => set('amount', num(e.target.value) ?? 0)} className={inputCls} /></Field>
        <Field label="Rhythmus">
          <select value={f.interval} onChange={(e) => set('interval', e.target.value as Contract['interval'])} className={inputCls}>
            <option value="monthly">monatlich</option><option value="quarterly">quartalsweise</option><option value="yearly">jährlich</option>
          </select>
        </Field>
      </div>
      <Field label="Kategorie">
        <select value={f.category} onChange={(e) => set('category', e.target.value)} className={inputCls}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </Field>
      <Field label="Gehört zu"><PersonPicker value={f.owner_id ?? null} onChange={(v) => set('owner_id', v)} /></Field>

      {f.direction === 'expense' && (
        <>
          <div className="label mt-2">Laufzeit & Kündigung</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Beginn"><input type="date" value={f.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} className={inputCls} /></Field>
            <Field label="Mindestlaufzeit (Mon.)"><input inputMode="numeric" value={f.min_term_months ?? ''} onChange={(e) => set('min_term_months', num(e.target.value))} className={inputCls} placeholder="z. B. 24" /></Field>
            <Field label="Kündigungsfrist"><input inputMode="numeric" value={f.notice_value ?? ''} onChange={(e) => set('notice_value', num(e.target.value))} className={inputCls} placeholder="z. B. 1" /></Field>
            <Field label="Einheit">
              <select value={f.notice_unit ?? 'months'} onChange={(e) => set('notice_unit', e.target.value as Contract['notice_unit'])} className={inputCls}>
                <option value="days">Tage</option><option value="weeks">Wochen</option><option value="months">Monate</option>
              </select>
            </Field>
            <Field label="Verlängert um (Mon.)"><input inputMode="numeric" value={f.renewal_months ?? ''} onChange={(e) => set('renewal_months', num(e.target.value))} className={inputCls} placeholder="12" /></Field>
          </div>
          <label className="flex items-start gap-3 text-[14px]">
            <input type="checkbox" checked={!!f.monthly_cancellable_after_min_term} onChange={(e) => set('monthly_cancellable_after_min_term', e.target.checked)} className="w-5 h-5 mt-0.5 accent-green" />
            <span>Nach der Mindestlaufzeit jederzeit kündbar<br /><span className="text-[12px] text-muted">Gilt für viele Verträge ab März 2022 (z. B. Handy, Strom, Fitness). Versicherungen meist nicht.</span></span>
          </label>
          {preview && <div className="bg-card border border-line rounded-[12px] p-3 text-[14px]"><DeadlineBadge d={preview} /></div>}
          <Field label="Kündigungslink"><input type="url" inputMode="url" value={f.cancel_url ?? ''} onChange={(e) => set('cancel_url', e.target.value || null)} className={inputCls} placeholder="https://…" /></Field>
          <Field label="Kundennummer"><input value={f.customer_number ?? ''} onChange={(e) => set('customer_number', e.target.value || null)} className={inputCls} /></Field>
        </>
      )}
      <Field label="Notiz"><textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} className={`${inputCls} py-3`} /></Field>
      <PrimaryButton type="submit" disabled={!f.name?.trim()}>Speichern</PrimaryButton>
      {initial && (
        <div className="grid grid-cols-2 gap-2">
          {initial.status === 'active'
            ? <button type="button" onClick={async () => { await api.update(initial.id, { status: 'cancelled' }); onClose() }} className="min-h-11 rounded-[12px] border border-line bg-card text-[14px]">Als gekündigt markieren</button>
            : <button type="button" onClick={async () => { await api.update(initial.id, { status: 'active' }); onClose() }} className="min-h-11 rounded-[12px] border border-line bg-card text-[14px]">Wieder aktiv</button>}
          <button type="button" onClick={async () => { await api.remove(initial.id); onClose() }} className="min-h-11 rounded-[12px] border-0 bg-transparent text-alert text-[14px] flex items-center justify-center gap-1.5"><Icon name="trash" size={16} /> Löschen</button>
        </div>
      )}
    </form>
  )
}
