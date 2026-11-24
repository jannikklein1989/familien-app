import { useRef, useState } from 'react'
import { useApp, useTable } from '../lib/app'
import { APPLIANCES, guessCategory, ingredientToItem } from '../lib/quick'
import { importRecipe, toDraft, type RecipeDraft } from '../lib/recipeImport'
import type { Recipe } from '../lib/types'
import { Icon } from '../components/Icon'
import { Card, Empty, Field, IconChip, PageHeader, PersonPicker, PrimaryButton, Sheet, inputCls } from '../components/ui'

type Tab = 'wish' | 'fav' | 'all' | 'dev'
type RecipeApi = ReturnType<typeof useTable<'recipes'>>
const lines = (s?: string | null) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean)

export default function Essen() {
  const api = useTable('recipes')
  const shop = useTable('shopping_items')
  const [tab, setTab] = useState<Tab>('wish')
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const sorted = [...api.rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const list = sorted.filter((r) => (tab === 'wish' ? r.is_wish : tab === 'fav' ? r.is_favorite : !r.is_wish))

  // Geräte-Reiter: feste Reihenfolge, dann eigene Geräte, zum Schluss "Ohne Gerät"
  const used = [...new Set(sorted.flatMap((r) => r.appliances ?? []))]
  const groups = [...APPLIANCES.filter((a) => used.includes(a)), ...used.filter((a) => !(APPLIANCES as readonly string[]).includes(a)).sort()]
    .map((a) => ({ name: a, items: sorted.filter((r) => r.appliances?.includes(a)) }))
  const noDevice = sorted.filter((r) => !r.appliances?.length)

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2200) }
  const toShopping = async (r: Recipe) => {
    const items = lines(r.ingredients).map(ingredientToItem)
    for (const it of items) await shop.insert({ name: it.name, quantity: it.quantity, category: guessCategory(it.name), checked: false })
    flash(`${items.length} Zutaten auf der Einkaufsliste`)
  }
  const card = (r: Recipe) => <RecipeCard key={r.id} r={r} api={api} onEdit={setEditing} onShop={toShopping} />

  return (
    <div>
      <PageHeader eyebrow="Wünsche & Rezepte" title="Essen" right={
        <div className="flex gap-2">
          <button aria-label="Rezept importieren" onClick={() => setImporting(true)} className="w-12 h-12 rounded-full bg-lime text-lime-ink flex items-center justify-center border-0"><Icon name="sparkle" size={22} stroke={2.2} /></button>
          <button aria-label="Gericht hinzufügen" onClick={() => setEditing('new')} className="w-12 h-12 rounded-full bg-green text-lime flex items-center justify-center border-0"><Icon name="plus" size={24} stroke={2.4} /></button>
        </div>
      } />
      <div role="tablist" className="mt-4 p-[3px] rounded-[12px] bg-[#E3E8DD] grid grid-cols-4">
        {([['wish', 'Wünsche'], ['fav', 'Favoriten'], ['all', 'Rezepte'], ['dev', 'Geräte']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`h-10 rounded-[10px] border-0 text-[13px] ${tab === id ? 'bg-card font-semibold shadow-sm text-ink' : 'bg-transparent text-[#3F4450]'}`}>{label}</button>
        ))}
      </div>

      {toast && <div role="status" className="mt-3 text-center text-green font-semibold">✓ {toast}</div>}

      {tab !== 'dev' ? (
        <>
          {list.length === 0 && <Empty title="Noch leer" text={tab === 'wish' ? 'Worauf habt ihr Lust? Trag ein Wunschgericht ein.' : tab === 'fav' ? 'Hier landen eure Lieblingsgerichte.' : 'Importier ein Rezept aus Link, PDF, Foto oder Text.'} />}
          <div className="mt-4 flex flex-col gap-3">{list.map(card)}</div>
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {groups.length === 0 && <Empty title="Noch keine Geräte" text="Ordne Rezepten ein Gerät zu, z. B. Thermomix oder Heißluftfritteuse." />}
          {[...groups, ...(noDevice.length && groups.length ? [{ name: 'Ohne Gerät', items: noDevice }] : [])].map((g) => (
            <section key={g.name}>
              <h2 className="label m-0 mb-2">{g.name} · {g.items.length}</h2>
              <div className="flex flex-col gap-3">{g.items.map(card)}</div>
            </section>
          ))}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Neues Gericht' : 'Gericht bearbeiten'}>
        <RecipeForm key={editing === 'new' ? 'new' : editing?.id ?? 'x'} initial={editing === 'new' ? null : editing} api={api} onClose={() => setEditing(null)} />
      </Sheet>
      <Sheet open={importing} onClose={() => setImporting(false)} title="Rezept importieren">
        {importing && <ImportFlow api={api} onDone={(t) => { setImporting(false); setTab('all'); flash(`„${t}“ gespeichert`) }} />}
      </Sheet>
    </div>
  )
}

function RecipeCard({ r, api, onEdit, onShop }: { r: Recipe; api: RecipeApi; onEdit: (r: Recipe) => void; onShop: (r: Recipe) => void }) {
  const { person } = useApp()
  const n = lines(r.ingredients).length
  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        <IconChip name="bowl" color={r.is_wish ? 'violet' : 'coral'} size={40} />
        <button onClick={() => onEdit(r)} className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 text-ink">
          <div className="text-[17px] font-semibold">{r.title}</div>
          <div className="text-[13px] text-muted">
            {[r.is_wish ? `Wunsch von ${person(r.wished_by)?.display_name ?? 'euch'}` : 'Rezept', n ? `${n} Zutaten` : '', r.servings ? `${r.servings} Portionen` : ''].filter(Boolean).join(' · ')}
          </div>
          {!!r.appliances?.length && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {r.appliances.map((a) => <span key={a} className="px-2 py-0.5 rounded-full bg-bg border border-line text-[11px] font-mono uppercase tracking-wide">{a}</span>)}
            </div>
          )}
        </button>
        <button aria-label={r.is_favorite ? 'Kein Favorit mehr' : 'Als Favorit markieren'} aria-pressed={r.is_favorite}
          onClick={() => api.update(r.id, { is_favorite: !r.is_favorite })}
          className={`w-11 h-11 rounded-full border-0 flex items-center justify-center ${r.is_favorite ? 'bg-lime text-lime-ink' : 'bg-bg text-muted'}`}>
          <Icon name="star" size={20} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="min-h-10 px-3 rounded-[10px] border border-line text-[13px] text-ink no-underline flex items-center gap-1.5"><Icon name="link" size={16} /> Quelle</a>}
        {n > 0 && <button onClick={() => onShop(r)} className="min-h-10 px-3 rounded-[10px] border border-line bg-card text-[13px] flex items-center gap-1.5"><Icon name="cart" size={16} /> Zutaten auf die Liste</button>}
        {r.is_wish && <button onClick={() => api.update(r.id, { is_wish: false })} className="min-h-10 px-3 rounded-[10px] border-0 bg-green text-white text-[13px] flex items-center gap-1.5"><Icon name="check" size={16} /> Gekocht</button>}
      </div>
    </Card>
  )
}

function ImportFlow({ api, onDone }: { api: RecipeApi; onDone: (title: string) => void }) {
  const { backend } = useApp()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<RecipeDraft | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (draft) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[14px] text-muted flex items-start gap-1.5"><Icon name="sparkle" size={16} className="shrink-0 mt-0.5" /> Bitte kurz prüfen und bei Bedarf korrigieren.</p>
        <RecipeForm initial={null} draft={draft} api={api} onClose={() => onDone(draft.title)} />
      </div>
    )
  }

  const go = async () => {
    setBusy(true); setError(null)
    try { setDraft(toDraft(await importRecipe({ text, file: file ?? undefined }))) }
    catch (e) { setError(e instanceof Error ? e.message : 'Import hat nicht geklappt.') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (text.trim() || file) go() }} className="flex flex-col gap-3">
      <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Rezepttext oder Link"
        placeholder="Link einfügen (z. B. von Chefkoch oder Cookidoo) oder den Rezepttext reinkopieren" className={`${inputCls} py-3 resize-none`} />
      <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => fileRef.current?.click()}
        className="min-h-12 rounded-[14px] border border-dashed border-line bg-card text-[15px] flex items-center justify-center gap-2 px-3">
        <Icon name="doc" size={18} />
        <span className="truncate">{file ? file.name : 'PDF oder Foto wählen (Kochbuch, Screenshot)'}</span>
      </button>
      {file && <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="min-h-10 bg-transparent border-0 text-[13px] text-muted">Datei entfernen</button>}
      <p className="m-0 text-[13px] text-muted">
        {backend.mode === 'supabase'
          ? 'Claude liest das Rezept, sortiert Zutaten mit Mengen, kürzt die Schritte und erkennt das Gerät. Du prüfst vor dem Speichern.'
          : 'Demo ohne KI: Erste Zeile wird Titel, der Rest Zutaten. Mit Supabase übernimmt Claude.'}
      </p>
      {error && <p role="alert" className="m-0 text-[14px] text-alert">{error}</p>}
      <PrimaryButton type="submit" disabled={busy || (!text.trim() && !file)}>{busy ? 'Claude liest das Rezept … (10–30 Sek.)' : 'Mit KI umwandeln'}</PrimaryButton>
    </form>
  )
}

function RecipeForm({ initial, draft, api, onClose }: { initial: Recipe | null; draft?: RecipeDraft; api: RecipeApi; onClose: () => void }) {
  const { me } = useApp()
  const src = initial ?? draft
  const [title, setTitle] = useState(src?.title ?? '')
  const [url, setUrl] = useState(src?.url ?? '')
  const [by, setBy] = useState<string | null>(initial ? initial.wished_by : draft ? null : me.id)
  const [servings, setServings] = useState(src?.servings ? String(src.servings) : '')
  const [appliances, setAppliances] = useState<string[]>(src?.appliances ?? [])
  const [custom, setCustom] = useState('')
  const [ingredients, setIngredients] = useState(src?.ingredients ?? '')
  const [steps, setSteps] = useState(src?.steps ?? '')
  const [isWish, setIsWish] = useState(initial?.is_wish ?? !draft)

  const options = [...APPLIANCES, ...appliances.filter((a) => !(APPLIANCES as readonly string[]).includes(a))]
  const toggle = (a: string) => setAppliances((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]))
  const addCustom = () => { const a = custom.trim(); if (a && !appliances.includes(a)) setAppliances([...appliances, a]); setCustom('') }

  const save = async () => {
    const row = {
      title: title.trim(), url: url.trim() || null, wished_by: by, is_wish: isWish,
      ingredients: ingredients.trim() || null, steps: steps.trim() || null,
      servings: Number(servings) > 0 ? Math.round(Number(servings)) : null, appliances,
      ...(draft ? { notes: draft.notes ?? null } : {}),
    }
    if (initial) await api.update(initial.id, row)
    else await api.insert({ ...row, is_favorite: false })
    onClose()
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) save() }} className="flex flex-col gap-4">
      <Field label="Gericht"><input autoFocus={!draft} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="z. B. Ramen" /></Field>
      <div role="group" aria-labelledby="geraet-label" className="flex flex-col gap-1.5">
        <span id="geraet-label" className="label">Gerät</span>
        <div className="flex flex-wrap gap-1.5">
          {options.map((a) => (
            <button type="button" key={a} aria-pressed={appliances.includes(a)} onClick={() => toggle(a)}
              className={`min-h-10 px-3 rounded-full border text-[13px] ${appliances.includes(a) ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>{a}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} placeholder="Anderes Gerät" aria-label="Anderes Gerät" className={inputCls} />
          <button type="button" onClick={addCustom} disabled={!custom.trim()} aria-label="Gerät hinzufügen" className="w-12 h-12 shrink-0 rounded-[14px] bg-card border border-line flex items-center justify-center"><Icon name="plus" size={20} /></button>
        </div>
      </div>
      <Field label="Zutaten (eine pro Zeile, Menge zuerst)"><textarea rows={5} value={ingredients} onChange={(e) => setIngredients(e.target.value)} className={`${inputCls} py-3`} placeholder={'500 g Hackfleisch\n2 Dosen Kidneybohnen'} /></Field>
      <Field label="Zubereitung (ein Schritt pro Zeile)"><textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} className={`${inputCls} py-3`} /></Field>
      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <Field label="Portionen"><input inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, ''))} className={inputCls} placeholder="–" /></Field>
        <Field label="Link (optional)"><input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://…" /></Field>
      </div>
      <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={isWish} onChange={(e) => setIsWish(e.target.checked)} className="w-5 h-5 accent-green" /> Steht auf der Wunschliste</label>
      {isWish && <Field group label="Wer wünscht es sich?"><PersonPicker value={by} onChange={setBy} /></Field>}
      <PrimaryButton type="submit" disabled={!title.trim()}>Speichern</PrimaryButton>
      {initial && <button type="button" onClick={async () => { await api.remove(initial.id); onClose() }} className="min-h-11 bg-transparent border-0 text-alert font-medium flex items-center justify-center gap-2"><Icon name="trash" size={18} /> Löschen</button>}
    </form>
  )
}
