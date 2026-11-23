import { useState } from 'react'
import { useApp, useTable } from '../lib/app'
import { guessCategory } from '../lib/quick'
import type { Recipe } from '../lib/types'
import { Icon } from '../components/Icon'
import { Card, Empty, Field, IconChip, PageHeader, PersonPicker, PrimaryButton, Sheet, inputCls } from '../components/ui'

export default function Essen() {
  const api = useTable('recipes')
  const shop = useTable('shopping_items')
  const { person } = useApp()
  const [tab, setTab] = useState<'wish' | 'fav' | 'all'>('wish')
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const list = api.rows.filter((r) => (tab === 'wish' ? r.is_wish : tab === 'fav' ? r.is_favorite : !r.is_wish))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const toShopping = async (r: Recipe) => {
    const items = (r.ingredients ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    for (const name of items) await shop.insert({ name, category: guessCategory(name), checked: false })
    setToast(`${items.length} Zutaten auf der Einkaufsliste`)
    setTimeout(() => setToast(null), 2000)
  }

  return (
    <div>
      <PageHeader eyebrow="Wünsche & Rezepte" title="Essen" right={
        <button aria-label="Gericht hinzufügen" onClick={() => setEditing('new')} className="w-12 h-12 rounded-full bg-green text-lime flex items-center justify-center border-0"><Icon name="plus" size={24} stroke={2.4} /></button>
      } />
      <div role="tablist" className="mt-4 p-[3px] rounded-[12px] bg-[#E3E8DD] grid grid-cols-3">
        {([['wish', 'Wünsche'], ['fav', 'Favoriten'], ['all', 'Rezepte']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`h-10 rounded-[10px] border-0 text-[14px] ${tab === id ? 'bg-card font-semibold shadow-sm text-ink' : 'bg-transparent text-[#3F4450]'}`}>{label}</button>
        ))}
      </div>

      {toast && <div role="status" className="mt-3 text-center text-green font-semibold">✓ {toast}</div>}
      {list.length === 0 && <Empty title="Noch leer" text={tab === 'wish' ? 'Worauf habt ihr Lust? Trag ein Wunschgericht ein.' : 'Hier landen eure Lieblingsgerichte.'} />}
      <div className="mt-4 flex flex-col gap-3">
        {list.map((r) => (
          <Card key={r.id} className="p-3.5">
            <div className="flex items-start gap-3">
              <IconChip name="bowl" color={r.is_wish ? 'violet' : 'coral'} size={40} />
              <button onClick={() => setEditing(r)} className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 text-ink">
                <div className="text-[17px] font-semibold">{r.title}</div>
                <div className="text-[13px] text-muted">{r.is_wish ? `Wunsch von ${person(r.wished_by)?.display_name ?? 'euch'}` : 'Rezept'}{r.ingredients ? ` · ${r.ingredients.split('\n').filter(Boolean).length} Zutaten` : ''}</div>
              </button>
              <button aria-label={r.is_favorite ? 'Kein Favorit mehr' : 'Als Favorit markieren'} aria-pressed={r.is_favorite}
                onClick={() => api.update(r.id, { is_favorite: !r.is_favorite })}
                className={`w-11 h-11 rounded-full border-0 flex items-center justify-center ${r.is_favorite ? 'bg-lime text-lime-ink' : 'bg-bg text-muted'}`}>
                <Icon name="star" size={20} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="min-h-10 px-3 rounded-[10px] border border-line text-[13px] text-ink no-underline flex items-center gap-1.5"><Icon name="link" size={16} /> Rezept öffnen</a>}
              {r.ingredients && <button onClick={() => toShopping(r)} className="min-h-10 px-3 rounded-[10px] border border-line bg-card text-[13px] flex items-center gap-1.5"><Icon name="cart" size={16} /> Zutaten auf die Liste</button>}
              {r.is_wish && <button onClick={() => api.update(r.id, { is_wish: false })} className="min-h-10 px-3 rounded-[10px] border-0 bg-green text-white text-[13px] flex items-center gap-1.5"><Icon name="check" size={16} /> Gekocht</button>}
            </div>
          </Card>
        ))}
      </div>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Neues Gericht' : 'Gericht bearbeiten'}>
        <RecipeForm key={editing === 'new' ? 'new' : editing?.id ?? 'x'} initial={editing === 'new' ? null : editing} api={api} onClose={() => setEditing(null)} />
      </Sheet>
    </div>
  )
}

function RecipeForm({ initial, api, onClose }: { initial: Recipe | null; api: ReturnType<typeof useTable<'recipes'>>; onClose: () => void }) {
  const { me } = useApp()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [by, setBy] = useState<string | null>(initial ? initial.wished_by : me.id)
  const [ingredients, setIngredients] = useState(initial?.ingredients ?? '')
  const [isWish, setIsWish] = useState(initial?.is_wish ?? true)

  const save = async () => {
    const row = { title: title.trim(), url: url.trim() || null, wished_by: by, ingredients: ingredients.trim() || null, is_wish: isWish }
    if (initial) await api.update(initial.id, row)
    else await api.insert({ ...row, is_favorite: false })
    onClose()
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) save() }} className="flex flex-col gap-4">
      <Field label="Gericht"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="z. B. Ramen" /></Field>
      <Field label="Link (optional)"><input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://…" /></Field>
      <Field label="Wer wünscht es sich?"><PersonPicker value={by} onChange={setBy} /></Field>
      <Field label="Zutaten (eine pro Zeile, optional)"><textarea rows={4} value={ingredients} onChange={(e) => setIngredients(e.target.value)} className={`${inputCls} py-3`} /></Field>
      <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={isWish} onChange={(e) => setIsWish(e.target.checked)} className="w-5 h-5 accent-green" /> Steht auf der Wunschliste</label>
      <p className="m-0 text-[12px] text-muted flex items-center gap-1.5"><Icon name="sparkle" size={14} /> Später: Link einfügen und die KI zieht Zutaten und Schritte automatisch raus.</p>
      <PrimaryButton type="submit" disabled={!title.trim()}>Speichern</PrimaryButton>
      {initial && <button type="button" onClick={async () => { await api.remove(initial.id); onClose() }} className="min-h-11 bg-transparent border-0 text-alert font-medium flex items-center justify-center gap-2"><Icon name="trash" size={18} /> Löschen</button>}
    </form>
  )
}
