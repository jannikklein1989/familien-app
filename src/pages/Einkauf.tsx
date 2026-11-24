import { useMemo, useState } from 'react'
import { useApp, useTable } from '../lib/app'
import { CATEGORY_ORDER, UNITS, formatQty, guessCategory, parseQty, qtyStep, type Unit } from '../lib/quick'
import type { ShoppingItem } from '../lib/types'
import { Icon } from '../components/Icon'
import { Card, Empty, Field, PageHeader, PrimaryButton, Sheet, inputCls } from '../components/ui'

type Api = ReturnType<typeof useTable<'shopping_items'>>

export default function Einkauf() {
  const api = useTable('shopping_items')
  const { backend } = useApp()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<ShoppingItem | null>(null)

  const checkedCount = api.rows.filter((s) => s.checked).length
  // Abgehakte bleiben in ihrer Gruppe (durchgestrichen) und rutschen nach unten
  const byCat = useMemo(() => {
    const m = new Map<string, ShoppingItem[]>()
    for (const s of api.rows) m.set(s.category, [...(m.get(s.category) ?? []), s])
    for (const list of m.values()) list.sort((a, b) => Number(a.checked) - Number(b.checked) || a.created_at.localeCompare(b.created_at))
    return [...m.entries()].sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
  }, [api.rows])
  const suggestions = useMemo(() => [...new Set(api.rows.map((s) => s.name))], [api.rows])

  const add = async () => {
    const parts = name.split(',').map((s) => s.trim()).filter(Boolean)
    for (const p of parts) {
      const m = p.match(/^(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|x|×|stk\.?|stück|pck\.?|packung)?)\s+(.+)$/i)
      const n = m ? m[2] : p
      const q = m ? parseQty(m[1]) : null
      const quantity = q ? formatQty(q.amount, q.unit) : null
      const existing = api.rows.find((c) => c.name.toLowerCase() === n.toLowerCase())
      if (existing) await api.update(existing.id, { checked: false, quantity: quantity ?? existing.quantity })
      else await api.insert({ name: n.charAt(0).toUpperCase() + n.slice(1), quantity, category: guessCategory(n), checked: false })
    }
    setName('')
  }

  return (
    <div>
      <PageHeader eyebrow={backend.mode === 'supabase' ? 'Live mit euch beiden' : 'Demo · nur dieses Gerät'} title="Einkauf" />
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add() }} className="mt-4 flex gap-2 sticky top-0 z-10 bg-bg py-2">
        <input value={name} onChange={(e) => setName(e.target.value)} list="shop-suggest" placeholder="z. B. 500 g Hack, Milch"
          aria-label="Artikel hinzufügen" className={inputCls} />
        <datalist id="shop-suggest">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <button aria-label="Hinzufügen" className="w-12 h-12 shrink-0 rounded-[14px] bg-green text-lime flex items-center justify-center border-0"><Icon name="plus" size={24} stroke={2.4} /></button>
      </form>
      <p className="m-0 text-[12px] text-muted">Tipp auf einen Artikel, um Menge und Einheit zu ändern.</p>

      {api.rows.length === 0 && <Empty title="Alles da" text="Die Liste ist leer." />}
      {byCat.map(([cat, items]) => (
        <section key={cat} className="mt-4">
          <h2 className="label m-0 mb-2">{cat}</h2>
          <Card className="px-3.5">
            {items.map((s) => <Row key={s.id} item={s} api={api} onEdit={() => setEditing(s)} />)}
          </Card>
        </section>
      ))}

      {checkedCount > 0 && (
        <div className="mt-5 flex justify-end">
          <button onClick={() => api.removeWhere('checked', true)} className="min-h-11 px-4 rounded-[12px] bg-card border border-line text-[14px] flex items-center gap-1.5">
            <Icon name="trash" size={16} /> {checkedCount} abgehakte entfernen
          </button>
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Artikel">
        {editing && <ItemForm key={editing.id} item={editing} api={api} onClose={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function Row({ item, api, onEdit }: { item: ShoppingItem; api: Api; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-1 min-h-[54px] border-b border-line-soft last:border-b-0">
      {/* Nur das Häkchen hakt ab, mit großer Trefffläche */}
      <label className="w-11 h-11 -ml-2 flex items-center justify-center shrink-0 cursor-pointer">
        <input type="checkbox" checked={item.checked} onChange={() => api.update(item.id, { checked: !item.checked })}
          aria-label={`${item.name} ${item.checked ? 'wieder offen' : 'abhaken'}`} className="w-[22px] h-[22px] m-0 accent-green" />
      </label>
      <button type="button" onClick={onEdit} className="flex-1 min-w-0 flex items-center gap-2 min-h-11 bg-transparent border-0 p-0 text-left text-ink">
        <span className={`flex-1 text-[16px] truncate ${item.checked ? 'line-through text-muted' : ''}`}>{item.name}</span>
        {item.quantity
          ? <span className={`font-mono text-[13px] px-2 py-1 rounded-[8px] ${item.checked ? 'text-muted' : 'bg-bg text-ink'}`}>{item.quantity}</span>
          : !item.checked && <span className="font-mono text-[12px] text-muted px-2">+ Menge</span>}
      </button>
    </div>
  )
}

function ItemForm({ item, api, onClose }: { item: ShoppingItem; api: Api; onClose: () => void }) {
  const init = parseQty(item.quantity)
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState<number | null>(init.amount)
  const [unit, setUnit] = useState<Unit>(init.unit)
  const [category, setCategory] = useState(item.category)

  const step = (dir: 1 | -1) => {
    const s = qtyStep(unit, amount)
    const next = Math.max(0, Math.round(((amount ?? 0) + dir * s) * 100) / 100)
    setAmount(next === 0 ? null : next)
  }
  const save = async () => {
    await api.update(item.id, { name: name.trim(), quantity: formatQty(amount, unit), category })
    onClose()
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) save() }} className="flex flex-col gap-4">
      <Field label="Artikel"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
      <Field label="Menge">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Weniger" onClick={() => step(-1)} className="w-12 h-12 shrink-0 rounded-[14px] bg-card border border-line text-[22px]">−</button>
          <input inputMode="decimal" value={amount ?? ''} placeholder="–" aria-label="Menge"
            onChange={(e) => { const v = e.target.value.replace(',', '.'); setAmount(v === '' ? null : Number(v)) }}
            className={`${inputCls} text-center font-mono`} />
          <button type="button" aria-label="Mehr" onClick={() => step(1)} className="w-12 h-12 shrink-0 rounded-[14px] bg-card border border-line text-[22px]">+</button>
        </div>
      </Field>
      <div role="radiogroup" aria-label="Einheit" className="grid grid-cols-4 gap-1.5">
        {UNITS.map((u) => (
          <button type="button" role="radio" aria-checked={unit === u} key={u} onClick={() => setUnit(u)}
            className={`min-h-11 rounded-[12px] border text-[14px] ${unit === u ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>{u}</button>
        ))}
      </div>
      <Field label="Bereich">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          {CATEGORY_ORDER.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      <PrimaryButton type="submit" disabled={!name.trim()}>Speichern</PrimaryButton>
      <button type="button" onClick={async () => { await api.remove(item.id); onClose() }} className="min-h-11 bg-transparent border-0 text-alert font-medium flex items-center justify-center gap-2">
        <Icon name="trash" size={18} /> Löschen
      </button>
    </form>
  )
}
