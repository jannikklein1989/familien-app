import { useMemo, useState } from 'react'
import { useApp, useTable } from '../lib/app'
import { CATEGORY_ORDER, guessCategory } from '../lib/quick'
import { Icon } from '../components/Icon'
import { Card, Empty, PageHeader, inputCls } from '../components/ui'

export default function Einkauf() {
  const api = useTable('shopping_items')
  const { backend } = useApp()
  const [name, setName] = useState('')

  const open = api.rows.filter((s) => !s.checked)
  const checked = api.rows.filter((s) => s.checked)
  const byCat = useMemo(() => {
    const m = new Map<string, typeof open>()
    for (const s of open) m.set(s.category, [...(m.get(s.category) ?? []), s])
    return [...m.entries()].sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
  }, [open])
  const suggestions = useMemo(() => [...new Set(api.rows.map((s) => s.name))], [api.rows])

  const add = async () => {
    const parts = name.split(',').map((s) => s.trim()).filter(Boolean)
    for (const p of parts) {
      const m = p.match(/^(\d+\s*(?:g|kg|ml|l|x|×|stk\.?)?)\s+(.+)$/i)
      const n = m ? m[2] : p
      const existing = checked.find((c) => c.name.toLowerCase() === n.toLowerCase())
      if (existing) await api.update(existing.id, { checked: false, quantity: m?.[1] ?? existing.quantity })
      else await api.insert({ name: n.charAt(0).toUpperCase() + n.slice(1), quantity: m?.[1] ?? null, category: guessCategory(n), checked: false })
    }
    setName('')
  }

  return (
    <div>
      <PageHeader eyebrow={backend.mode === 'supabase' ? 'Live mit euch beiden' : 'Demo · nur dieses Gerät'} title="Einkauf" />
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) add() }} className="mt-4 flex gap-2 sticky top-0 z-10 bg-bg py-2">
        <input value={name} onChange={(e) => setName(e.target.value)} list="shop-suggest" placeholder="Was fehlt? (Komma für mehrere)"
          aria-label="Artikel hinzufügen" className={inputCls} />
        <datalist id="shop-suggest">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <button aria-label="Hinzufügen" className="w-12 h-12 shrink-0 rounded-[14px] bg-green text-lime flex items-center justify-center border-0"><Icon name="plus" size={24} stroke={2.4} /></button>
      </form>

      {open.length === 0 && <Empty title="Alles da" text="Die Liste ist leer." />}
      {byCat.map(([cat, items]) => (
        <section key={cat} className="mt-4">
          <h2 className="label m-0 mb-2">{cat}</h2>
          <Card className="px-3.5">
            {items.map((s) => (
              <label key={s.id} className="flex items-center gap-3 min-h-[52px] border-b border-line-soft last:border-b-0">
                <input type="checkbox" checked={false} onChange={() => api.update(s.id, { checked: true })} className="w-[22px] h-[22px] m-0 accent-green" />
                <span className="flex-1 text-[16px]">{s.name}</span>
                {s.quantity && <span className="font-mono text-[13px] text-muted">{s.quantity}</span>}
              </label>
            ))}
          </Card>
        </section>
      ))}

      {checked.length > 0 && (
        <section className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="label m-0">Im Wagen · {checked.length}</h2>
            <button onClick={() => api.removeWhere('checked', true)} className="min-h-11 px-3 rounded-[12px] bg-transparent border border-line text-[13px] flex items-center gap-1.5">
              <Icon name="trash" size={16} /> Leeren
            </button>
          </div>
          <Card className="px-3.5 opacity-70">
            {checked.map((s) => (
              <label key={s.id} className="flex items-center gap-3 min-h-12 border-b border-line-soft last:border-b-0">
                <input type="checkbox" checked onChange={() => api.update(s.id, { checked: false })} className="w-5 h-5 m-0 accent-green" />
                <span className="flex-1 text-[15px] line-through text-muted">{s.name}</span>
              </label>
            ))}
          </Card>
        </section>
      )}
    </div>
  )
}
