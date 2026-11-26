import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, useTable } from '../lib/app'
import { addDays, daysBetween, iso, parse, relDay, shortDate, today } from '../lib/dates'
import { APPLIANCES, normalizeAppliance } from '../lib/quick'
import { fetchIdeas, importRecipe, toDraft, type MealIdea, type RecipeDraft } from '../lib/recipeImport'
import { dayLong, dayShort, mergeIngredients, planShopping, shrinkPhoto, suggestRecipes, weekDays, weekNumber, weekStart } from '../lib/mealplan'
import type { MealPlanEntry, Recipe } from '../lib/types'
import { Icon } from '../components/Icon'
import { Card, Empty, Field, IconChip, PageHeader, PersonPicker, PrimaryButton, Sheet, inputCls } from '../components/ui'

type RecipeApi = ReturnType<typeof useTable<'recipes'>>
type PlanApi = ReturnType<typeof useTable<'meal_plan'>>
type View =
  | { kind: 'detail'; id: string }
  | { kind: 'edit'; recipe: Recipe | null }
  | { kind: 'import' }
  | { kind: 'pick'; day: string }
  | { kind: 'shop'; days: string[] }
  | { kind: 'suggest' }
  | null

const lines = (s?: string | null) => (s ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
const chipCls = (on: boolean) => `min-h-10 px-3 rounded-full border text-[13px] whitespace-nowrap ${on ? 'bg-green text-white border-green' : 'bg-card border-line text-ink'}`

/** Signierte Foto-URLs für alle Rezepte, die ein Foto haben */
function usePhotoUrls(recipes: Recipe[]) {
  const { backend } = useApp()
  const refs = recipes.map((r) => r.photo_path).filter((x): x is string => !!x)
  const key = refs.join('|')
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!refs.length) return
    backend.photoUrls(refs).then((u) => setUrls((old) => ({ ...old, ...u }))).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, key])
  return (r?: Recipe | null) => (r?.photo_path ? urls[r.photo_path] : undefined)
}

export default function Essen() {
  const api = useTable('recipes')
  const plan = useTable('meal_plan')
  const shop = useTable('shopping_items')
  const [tab, setTab] = useState<'week' | 'lib'>('week')
  const [view, setView] = useState<View>(null)
  const [toast, setToast] = useState<string | null>(null)
  const photo = usePhotoUrls(api.rows)
  const close = () => setView(null)

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2600) }
  const byId = (id: string) => api.rows.find((r) => r.id === id)
  const addToPlan = async (recipeId: string, day: string) => {
    await plan.insert({ recipe_id: recipeId, day, on_list: false })
    flash(`${byId(recipeId)?.title ?? 'Gericht'} für ${relDay(day) === 'heute' ? 'heute' : `${dayLong(day)}, ${shortDate(day)}`} geplant`)
  }

  const detail = view?.kind === 'detail' ? byId(view.id) : undefined
  const title = !view ? '' : view.kind === 'detail' ? (detail?.title ?? '') : view.kind === 'edit' ? (view.recipe ? 'Gericht bearbeiten' : 'Neues Gericht')
    : view.kind === 'import' ? 'Rezept importieren' : view.kind === 'pick' ? `${dayLong(view.day)}, ${shortDate(view.day)}`
    : view.kind === 'shop' ? 'Einkaufsliste für die Woche' : 'Was kochen wir heute?'

  return (
    <div>
      <PageHeader eyebrow="Planen & Kochen" title="Essen" right={
        <div className="flex gap-2">
          <button aria-label="Rezept importieren" onClick={() => setView({ kind: 'import' })} className="w-12 h-12 rounded-full bg-lime text-lime-ink flex items-center justify-center border-0"><Icon name="sparkle" size={22} stroke={2.2} /></button>
          <button aria-label="Gericht hinzufügen" onClick={() => setView({ kind: 'edit', recipe: null })} className="w-12 h-12 rounded-full bg-green text-lime flex items-center justify-center border-0"><Icon name="plus" size={24} stroke={2.4} /></button>
        </div>
      } />
      <div role="tablist" className="mt-4 p-[3px] rounded-[12px] bg-[#E3E8DD] grid grid-cols-2">
        {([['week', 'Wochenplan'], ['lib', `Gerichte · ${api.rows.length}`]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`h-10 rounded-[10px] border-0 text-[14px] ${tab === id ? 'bg-card font-semibold shadow-sm text-ink' : 'bg-transparent text-[#3F4450]'}`}>{label}</button>
        ))}
      </div>

      {toast && <div role="status" className="mt-3 text-center text-green font-semibold">✓ {toast}</div>}

      {tab === 'week'
        ? <WeekView recipes={api.rows} plan={plan} photo={photo} onOpen={(id) => setView({ kind: 'detail', id })}
            onPick={(day) => setView({ kind: 'pick', day })} onShop={(days) => setView({ kind: 'shop', days })} onSuggest={() => setView({ kind: 'suggest' })} />
        : <Library recipes={api.rows} api={api} photo={photo} onOpen={(id) => setView({ kind: 'detail', id })} onImport={() => setView({ kind: 'import' })} />}

      <Sheet open={!!view && !(view.kind === 'detail' && !detail)} onClose={close} title={title}>
        {view?.kind === 'detail' && detail && (
          <RecipeDetail key={detail.id} r={detail} api={api} photoUrl={photo(detail)} onPlan={addToPlan}
            onEdit={() => setView({ kind: 'edit', recipe: detail })} flash={flash} />
        )}
        {view?.kind === 'edit' && (
          <RecipeForm key={view.recipe?.id ?? 'new'} initial={view.recipe} api={api}
            onClose={() => (view.recipe ? setView({ kind: 'detail', id: view.recipe.id }) : close())} onDeleted={close} />
        )}
        {view?.kind === 'import' && <ImportFlow api={api} onDone={(t) => { close(); setTab('lib'); flash(`„${t}“ gespeichert`) }} />}
        {view?.kind === 'pick' && <RecipePicker recipes={api.rows} photo={photo} onPick={async (id) => { await addToPlan(id, view.day); close() }} />}
        {view?.kind === 'shop' && <ShopPreview days={view.days} recipes={api.rows} plan={plan} shop={shop} onDone={(n) => { close(); flash(`${n} Zutaten auf der Einkaufsliste`) }} />}
        {view?.kind === 'suggest' && <Suggest recipes={api.rows} plan={plan.rows} api={api} photo={photo}
          onCook={async (id) => { await addToPlan(id, iso(today())); close() }} onOpen={(id) => setView({ kind: 'detail', id })} />}
      </Sheet>
    </div>
  )
}

/* ───────────── Wochenplan ───────────── */

function WeekView({ recipes, plan, photo, onOpen, onPick, onShop, onSuggest }: {
  recipes: Recipe[]; plan: PlanApi; photo: (r?: Recipe | null) => string | undefined
  onOpen: (id: string) => void; onPick: (day: string) => void; onShop: (days: string[]) => void; onSuggest: () => void
}) {
  const [offset, setOffset] = useState(0)
  const start = addDays(weekStart(today()), offset * 7)
  const days = weekDays(start)
  const todayIso = iso(today())
  const entries = plan.rows.filter((p) => days.includes(p.day))
  // Offene Gerichte ab heute (vergangene Tage zählen nicht mehr für den Einkauf)
  const open = entries.filter((e) => !e.on_list && e.day >= todayIso && recipes.find((r) => r.id === e.recipe_id))
  const end = addDays(start, 6)

  return (
    <div className="mt-4 flex flex-col gap-3">
      <button onClick={onSuggest} className="min-h-14 rounded-[16px] border-0 bg-lime text-lime-ink text-[16px] font-semibold flex items-center justify-center gap-2">
        <Icon name="bowl" size={20} stroke={2.2} /> Was kochen wir heute?
      </button>

      <div className="flex items-center justify-between mt-1">
        <button aria-label="Vorige Woche" onClick={() => setOffset(offset - 1)} className="w-11 h-11 rounded-full bg-card border border-line flex items-center justify-center"><Icon name="back" size={20} /></button>
        <button onClick={() => setOffset(0)} className="bg-transparent border-0 text-center text-ink">
          <div className="label">{offset === 0 ? 'Diese Woche' : offset === 1 ? 'Nächste Woche' : offset === -1 ? 'Letzte Woche' : `KW ${weekNumber(start)}`}</div>
          <div className="text-[15px] font-semibold">{shortDate(start)} – {shortDate(end)}</div>
        </button>
        <button aria-label="Nächste Woche" onClick={() => setOffset(offset + 1)} className="w-11 h-11 rounded-full bg-card border border-line flex items-center justify-center"><Icon name="chevron" size={20} /></button>
      </div>

      <Card className="px-3.5">
        {days.map((d) => {
          const list = entries.filter((e) => e.day === d).sort((a, b) => a.created_at.localeCompare(b.created_at))
          const isToday = d === todayIso
          const past = d < todayIso
          return (
            <div key={d} className={`py-2.5 border-b border-line-soft last:border-b-0 flex gap-3 ${past ? 'opacity-60' : ''}`}>
              <div className={`w-11 shrink-0 pt-1 text-center ${isToday ? 'text-green' : ''}`}>
                <div className="font-mono text-[11px] uppercase tracking-wider">{dayShort(d)}</div>
                <div className={`text-[17px] font-semibold ${isToday ? 'bg-lime text-lime-ink rounded-full w-8 h-8 mx-auto flex items-center justify-center' : ''}`}>{parse(d).getDate()}</div>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {list.map((e) => <PlanEntry key={e.id} e={e} r={recipes.find((x) => x.id === e.recipe_id)} photo={photo} plan={plan} onOpen={onOpen} />)}
                <button onClick={() => onPick(d)} aria-label={`Gericht für ${dayLong(d)} wählen`}
                  className={`min-h-11 rounded-[12px] border border-dashed border-line bg-transparent text-[14px] text-muted flex items-center gap-1.5 px-3 ${list.length ? 'self-start' : ''}`}>
                  <Icon name="plus" size={16} /> {list.length ? 'Noch eins' : 'Gericht wählen'}
                </button>
              </div>
            </div>
          )
        })}
      </Card>

      {open.length > 0
        ? <PrimaryButton onClick={() => onShop(days)} className="flex items-center justify-center gap-2"><Icon name="cart" size={20} /> Einkaufsliste erstellen · {open.length} {open.length === 1 ? 'Gericht' : 'Gerichte'}</PrimaryButton>
        : entries.length > 0 && <p className="m-0 text-center text-[13px] text-muted">✓ Alle Zutaten dieser Woche sind auf der Einkaufsliste.</p>}
      {recipes.length < 10 && (
        <p className="m-0 text-[13px] text-muted text-center">Tipp: Je mehr Gerichte in eurer Sammlung sind, desto besser klappt das Planen. Wirf eure Klassiker per ✨ Import rein.</p>
      )}
    </div>
  )
}

function PlanEntry({ e, r, photo, plan, onOpen }: { e: MealPlanEntry; r?: Recipe; photo: (r?: Recipe | null) => string | undefined; plan: PlanApi; onOpen: (id: string) => void }) {
  if (!r) return null
  return (
    <div className="flex items-center gap-2.5">
      <button onClick={() => onOpen(r.id)} className="flex-1 min-w-0 flex items-center gap-2.5 bg-transparent border-0 p-0 text-left text-ink min-h-11">
        <Thumb url={photo(r)} size={44} wish={r.is_wish} />
        <div className="min-w-0">
          <div className="text-[16px] font-semibold truncate">{r.title}</div>
          <div className="text-[12px] text-muted truncate">{[r.appliances?.join(', '), e.on_list ? '✓ auf der Liste' : ''].filter(Boolean).join(' · ')}</div>
        </div>
      </button>
      <button aria-label={`${r.title} aus dem Plan nehmen`} onClick={() => plan.remove(e.id)} className="w-10 h-10 shrink-0 rounded-full bg-transparent border-0 text-muted flex items-center justify-center"><Icon name="close" size={18} /></button>
    </div>
  )
}

function Thumb({ url, size, wish }: { url?: string; size: number; wish?: boolean }) {
  if (url) return <img src={url} alt="" className="shrink-0 rounded-[12px] object-cover bg-line" style={{ width: size, height: size }} />
  return <IconChip name="bowl" color={wish ? 'violet' : 'coral'} size={size} />
}

function RecipePicker({ recipes, photo, onPick }: { recipes: Recipe[]; photo: (r?: Recipe | null) => string | undefined; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [dev, setDev] = useState<string | null>(null)
  const devices = usedAppliances(recipes)
  const list = recipes
    .filter((r) => (!dev || r.appliances?.includes(dev)) && r.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.title.localeCompare(b.title, 'de'))
  return (
    <div className="flex flex-col gap-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Gericht suchen" aria-label="Gericht suchen" className={inputCls} />
      {devices.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          <button className={chipCls(!dev)} onClick={() => setDev(null)}>Alle</button>
          {devices.map((d) => <button key={d} className={chipCls(dev === d)} onClick={() => setDev(dev === d ? null : d)}>{d}</button>)}
        </div>
      )}
      {list.length === 0 && <Empty title="Nichts gefunden" text="Leg das Gericht über + oder ✨ Import an." />}
      <div className="flex flex-col">
        {list.map((r) => (
          <button key={r.id} onClick={() => onPick(r.id)} className="flex items-center gap-3 min-h-14 py-1.5 bg-transparent border-0 border-b border-line-soft text-left text-ink">
            <Thumb url={photo(r)} size={44} wish={r.is_wish} />
            <span className="flex-1 min-w-0">
              <span className="block text-[16px] font-semibold truncate">{r.is_favorite ? '★ ' : ''}{r.title}</span>
              <span className="block text-[12px] text-muted truncate">{[r.appliances?.join(', '), lastCookedLabel(r)].filter(Boolean).join(' · ')}</span>
            </span>
            <Icon name="plus" size={20} className="text-green" />
          </button>
        ))}
      </div>
    </div>
  )
}

function ShopPreview({ days, recipes, plan, shop, onDone }: {
  days: string[]; recipes: Recipe[]; plan: PlanApi; shop: ReturnType<typeof useTable<'shopping_items'>>; onDone: (n: number) => void
}) {
  const todayIso = iso(today())
  const entries = plan.rows.filter((e) => days.includes(e.day) && !e.on_list && e.day >= todayIso)
  const chosen = entries.map((e) => recipes.find((r) => r.id === e.recipe_id)).filter((r): r is Recipe => !!r)
  // Beim Öffnen einmal berechnen, damit sich die Liste beim Abhaken nicht verschiebt
  const [merged] = useState(() => mergeIngredients(chosen))
  const [off, setOff] = useState<Set<string>>(() => new Set(merged.filter((m) => m.staple).map((m) => m.key)))
  const [busy, setBusy] = useState(false)
  const withoutIngredients = chosen.filter((r) => !lines(r.ingredients).length)

  const go = async () => {
    setBusy(true)
    const items = merged.filter((m) => !off.has(m.key))
    const { inserts, updates } = planShopping(items, shop.rows)
    for (const u of updates) await shop.update(u.id, u.patch)
    for (const i of inserts) await shop.insert(i)
    for (const e of entries) await plan.update(e.id, { on_list: true })
    onDone(items.length)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[14px] text-muted">
        Für {chosen.map((r) => r.title).join(', ')}. Gleiche Zutaten sind zusammengerechnet. Nimm den Haken raus bei allem, was ihr noch daheim habt.
      </p>
      {withoutIngredients.length > 0 && (
        <p className="m-0 text-[13px] text-alert">Ohne Zutatenliste: {withoutIngredients.map((r) => r.title).join(', ')}. Ergänz sie im Gericht, dann kommen sie mit.</p>
      )}
      {merged.length === 0 ? <Empty title="Keine Zutaten" text="Die geplanten Gerichte haben noch keine Zutaten." /> : (
        <Card className="px-3.5">
          {merged.map((m) => (
            <label key={m.key} className="flex items-center gap-3 min-h-[52px] border-b border-line-soft last:border-b-0 cursor-pointer">
              <input type="checkbox" checked={!off.has(m.key)} className="w-[22px] h-[22px] m-0 accent-green shrink-0"
                onChange={() => setOff((s) => { const n = new Set(s); if (n.has(m.key)) n.delete(m.key); else n.add(m.key); return n })} />
              <span className="flex-1 min-w-0">
                <span className={`block text-[16px] ${off.has(m.key) ? 'text-muted line-through' : ''}`}>{m.name}</span>
                {m.recipes.length > 1 && <span className="block text-[12px] text-muted truncate">für {m.recipes.join(', ')}</span>}
              </span>
              {m.quantity && <span className="font-mono text-[13px] px-2 py-1 rounded-[8px] bg-bg">{m.quantity}</span>}
            </label>
          ))}
        </Card>
      )}
      <PrimaryButton onClick={go} disabled={busy || (merged.length > 0 && off.size === merged.length)}>
        {busy ? 'Wird eingetragen …' : merged.length ? `${merged.length - off.size} Zutaten auf die Liste` : 'Als erledigt markieren'}
      </PrimaryButton>
    </div>
  )
}

/* ───────────── "Was kochen wir heute?" ───────────── */

function Suggest({ recipes, plan, api, photo, onCook, onOpen }: {
  recipes: Recipe[]; plan: MealPlanEntry[]; api: RecipeApi; photo: (r?: Recipe | null) => string | undefined
  onCook: (id: string) => void; onOpen: (id: string) => void
}) {
  const [dev, setDev] = useState<string | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  const [round, setRound] = useState(0)
  const devices = usedAppliances(recipes)
  const picks = useMemo(() => {
    const p = suggestRecipes(recipes, plan, { appliance: dev, exclude: seen })
    return p.length ? p : suggestRecipes(recipes, plan, { appliance: dev })
  }, [round, dev]) // eslint-disable-line react-hooks/exhaustive-deps
  const [showIdeas, setShowIdeas] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" role="group" aria-label="Gerät">
        <button className={chipCls(!dev)} onClick={() => { setDev(null); setSeen([]) }}>Egal</button>
        {[...new Set([...APPLIANCES.slice(0, 5), ...devices])].map((d) => (
          <button key={d} className={chipCls(dev === d)} onClick={() => { setDev(dev === d ? null : d); setSeen([]) }}>{d}</button>
        ))}
      </div>

      {recipes.length === 0 && <Empty title="Noch keine Gerichte" text="Importier ein paar Lieblingsgerichte, dann schlage ich daraus vor." />}
      {recipes.length > 0 && picks.length === 0 && <p className="m-0 text-[14px] text-muted">Mit diesem Gerät habt ihr noch nichts gespeichert. Hol dir unten neue Ideen.</p>}
      {picks.map((r) => (
        <Card key={r.id} className="p-3 flex items-center gap-3">
          <button onClick={() => onOpen(r.id)} className="flex-1 min-w-0 flex items-center gap-3 bg-transparent border-0 p-0 text-left text-ink">
            <Thumb url={photo(r)} size={56} wish={r.is_wish} />
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold">{r.is_favorite ? '★ ' : ''}{r.title}</span>
              <span className="block text-[12px] text-muted">{[r.appliances?.join(', '), lastCookedLabel(r) || 'noch nie gekocht'].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
          <button onClick={() => onCook(r.id)} className="min-h-11 px-3 rounded-[12px] border-0 bg-green text-white text-[14px] font-semibold shrink-0">Heute</button>
        </Card>
      ))}
      {picks.length > 0 && (
        <button onClick={() => { setSeen((s) => [...s, ...picks.map((p) => p.id)]); setRound(round + 1) }}
          className="min-h-11 rounded-[12px] bg-card border border-line text-[14px] flex items-center justify-center gap-2"><Icon name="shuffle" size={18} /> Andere Vorschläge</button>
      )}

      <div className="mt-2 pt-4 border-t border-line">
        {!showIdeas
          ? <button onClick={() => setShowIdeas(true)} className="w-full min-h-12 rounded-[14px] border-0 bg-lime text-lime-ink font-semibold flex items-center justify-center gap-2"><Icon name="sparkle" size={18} /> Neue Ideen von Claude</button>
          : <Ideas recipes={recipes} appliance={dev} api={api} onOpen={onOpen} onCook={onCook} />}
      </div>
    </div>
  )
}

function Ideas({ recipes, appliance, api, onOpen, onCook }: { recipes: Recipe[]; appliance: string | null; api: RecipeApi; onOpen: (id: string) => void; onCook: (id: string) => void }) {
  const { backend } = useApp()
  const [wish, setWish] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<MealIdea[]>([])
  const [saved, setSaved] = useState<Record<string, string>>({}) // Titel → Rezept-ID
  const [open, setOpen] = useState<string | null>(null)

  const load = async () => {
    setBusy(true); setError(null)
    try { setIdeas(await fetchIdeas({ wish, appliance, known: recipes.map((r) => r.title) })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Hat nicht geklappt.') }
    finally { setBusy(false) }
  }
  const save = async (i: MealIdea) => {
    await api.insert({ title: i.title, ingredients: i.ingredients.join('\n') || null, steps: i.steps.join('\n') || null, servings: i.servings, appliances: i.appliances, notes: i.teaser || null, is_wish: true, is_favorite: false, wished_by: null })
    // ID des neuen Rezepts über den Titel finden (insert liefert keine ID zurück)
    const rows = await backend.list('recipes')
    const id = rows.filter((r) => r.title === i.title).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.id
    if (id) setSaved((s) => ({ ...s, [i.title]: id }))
    return id
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={(e) => { e.preventDefault(); load() }} className="flex flex-col gap-2">
        <input value={wish} onChange={(e) => setWish(e.target.value)} className={inputCls} aria-label="Worauf habt ihr Lust?"
          placeholder={appliance ? `Was für den ${appliance}, z. B. „mit Hähnchen“` : 'Optional: „was mit Hähnchen“, „schnell“, „vegetarisch“'} />
        <PrimaryButton type="submit" disabled={busy}>{busy ? 'Claude überlegt … (15–40 Sek.)' : ideas.length ? 'Noch mal neue Ideen' : 'Ideen holen'}</PrimaryButton>
      </form>
      {backend.mode === 'demo' && !ideas.length && <p className="m-0 text-[13px] text-muted">Demo: feste Beispiele. Mit Supabase schlägt Claude passend zu eurer Sammlung vor.</p>}
      {error && <p role="alert" className="m-0 text-[14px] text-alert">{error}</p>}
      {ideas.map((i) => {
        const id = saved[i.title]
        return (
          <Card key={i.title} className="p-3.5">
            <button onClick={() => setOpen(open === i.title ? null : i.title)} aria-expanded={open === i.title} className="w-full bg-transparent border-0 p-0 text-left text-ink">
              <div className="text-[17px] font-semibold">{i.title}</div>
              <div className="text-[13px] text-muted">{[i.appliances.join(', '), i.minutes ? `${i.minutes} Min.` : ''].filter(Boolean).join(' · ')}</div>
              {i.teaser && <div className="mt-1 text-[14px]">{i.teaser}</div>}
            </button>
            {open === i.title && (
              <div className="mt-2 text-[14px]">
                <div className="label mt-2 mb-1">Zutaten</div>
                <ul className="m-0 pl-5">{i.ingredients.map((x) => <li key={x}>{x}</li>)}</ul>
                <div className="label mt-3 mb-1">Zubereitung</div>
                <ol className="m-0 pl-5">{i.steps.map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {id
                ? <button onClick={() => onOpen(id)} className="min-h-10 px-3 rounded-[10px] border border-line bg-card text-[13px]">✓ Gespeichert · ansehen</button>
                : <button onClick={() => save(i)} className="min-h-10 px-3 rounded-[10px] border border-line bg-card text-[13px] flex items-center gap-1.5"><Icon name="plus" size={16} /> In die Sammlung</button>}
              <button onClick={async () => { const nid = id ?? (await save(i)); if (nid) onCook(nid) }} className="min-h-10 px-3 rounded-[10px] border-0 bg-green text-white text-[13px]">Heute kochen</button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

/* ───────────── Sammlung ───────────── */

function usedAppliances(recipes: Recipe[]) {
  const used = [...new Set(recipes.flatMap((r) => r.appliances ?? []))]
  return [...APPLIANCES.filter((a) => used.includes(a)), ...used.filter((a) => !(APPLIANCES as readonly string[]).includes(a)).sort()]
}
function lastCookedLabel(r: Recipe) {
  if (!r.last_cooked_at) return ''
  const n = daysBetween(parse(r.last_cooked_at), today())
  return n <= 0 ? 'heute gekocht' : n === 1 ? 'gestern gekocht' : `vor ${n} Tagen gekocht`
}

function Library({ recipes, api, photo, onOpen, onImport }: { recipes: Recipe[]; api: RecipeApi; photo: (r?: Recipe | null) => string | undefined; onOpen: (id: string) => void; onImport: () => void }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string>('all') // all | fav | wish | Gerätename
  const devices = usedAppliances(recipes)
  const list = recipes
    .filter((r) => filter === 'all' || (filter === 'fav' ? r.is_favorite : filter === 'wish' ? r.is_wish : r.appliances?.includes(filter)))
    .filter((r) => !q.trim() || `${r.title} ${r.ingredients ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="mt-4 flex flex-col gap-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen: Gericht oder Zutat" aria-label="Gerichte durchsuchen" className={inputCls} />
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" role="group" aria-label="Filter">
        <button className={chipCls(filter === 'all')} onClick={() => setFilter('all')}>Alle</button>
        <button className={chipCls(filter === 'fav')} onClick={() => setFilter('fav')}>★ Favoriten</button>
        <button className={chipCls(filter === 'wish')} onClick={() => setFilter('wish')}>Wünsche</button>
        {devices.map((d) => <button key={d} className={chipCls(filter === d)} onClick={() => setFilter(filter === d ? 'all' : d)}>{d}</button>)}
      </div>
      {recipes.length === 0 && (
        <div className="py-6 text-center flex flex-col items-center gap-3">
          <div className="label">Noch leer</div>
          <p className="m-0 text-[16px] text-muted">Startet mit euren 15 bis 20 Klassikern. Link von Chefkoch, Cookidoo oder Instagram rein, Claude macht den Rest.</p>
          <PrimaryButton onClick={onImport} className="flex items-center gap-2"><Icon name="sparkle" size={18} /> Rezept importieren</PrimaryButton>
        </div>
      )}
      {recipes.length > 0 && list.length === 0 && <Empty title="Nichts gefunden" text="Probier einen anderen Filter." />}
      <div className="grid grid-cols-2 gap-3">
        {list.map((r) => (
          <Card key={r.id} className="overflow-hidden relative">
            <button onClick={() => onOpen(r.id)} className="w-full bg-transparent border-0 p-0 text-left text-ink flex flex-col">
              {photo(r)
                ? <img src={photo(r)} alt="" className="w-full aspect-[4/3] object-cover bg-line" />
                : <div className={`w-full aspect-[4/3] flex items-center justify-center ${r.is_wish ? 'bg-[#EEE8FF] text-[#8E6BFF]' : 'bg-[#FFEDE7] text-[#FF6B4A]'}`}><Icon name="bowl" size={36} /></div>}
              <div className="p-2.5">
                <div className="text-[15px] font-semibold leading-snug line-clamp-2">{r.title}</div>
                <div className="text-[11px] text-muted mt-0.5 truncate">{[r.is_wish ? 'Wunsch' : '', r.appliances?.[0]].filter(Boolean).join(' · ') || '\u00a0'}</div>
              </div>
            </button>
            <button aria-label={r.is_favorite ? `${r.title}: kein Favorit mehr` : `${r.title} als Favorit markieren`} aria-pressed={r.is_favorite}
              onClick={() => api.update(r.id, { is_favorite: !r.is_favorite })}
              className={`absolute top-1.5 right-1.5 w-10 h-10 rounded-full border-0 flex items-center justify-center shadow-sm ${r.is_favorite ? 'bg-lime text-lime-ink' : 'bg-white/90 text-muted'}`}>
              <Icon name="star" size={18} />
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}

function RecipeDetail({ r, api, photoUrl, onPlan, onEdit, flash }: {
  r: Recipe; api: RecipeApi; photoUrl?: string; onPlan: (id: string, day: string) => Promise<void>; onEdit: () => void; flash: (t: string) => void
}) {
  const { backend, person } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planning, setPlanning] = useState(false)
  const [justCooked, setJustCooked] = useState(false)
  const ing = lines(r.ingredients)
  const steps = lines(r.steps)
  const next14 = Array.from({ length: 14 }, (_, i) => iso(addDays(today(), i)))

  const upload = async (file: File) => {
    setBusy(true); setError(null)
    try {
      const ref = await backend.uploadPhoto(r.id, await shrinkPhoto(file))
      const old = r.photo_path
      await api.update(r.id, { photo_path: ref })
      if (old) await backend.removePhoto(old).catch(() => {})
      setJustCooked(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Foto-Upload hat nicht geklappt.') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const cooked = async () => {
    await api.update(r.id, { last_cooked_at: iso(today()), is_wish: false })
    setJustCooked(true)
    flash(`${r.title} als gekocht markiert`)
  }

  return (
    <div className="flex flex-col gap-4">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }} />
      {photoUrl ? (
        <div className="relative">
          <img src={photoUrl} alt={`So sah ${r.title} bei euch aus`} className="w-full aspect-[4/3] object-cover rounded-[18px] bg-line" />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="absolute right-2 bottom-2 min-h-10 px-3 rounded-full border-0 bg-black/60 text-white text-[13px] flex items-center gap-1.5">
            <Icon name="camera" size={16} /> {busy ? 'Lädt …' : 'Neues Foto'}
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className={`w-full aspect-[16/7] rounded-[18px] border border-dashed flex flex-col items-center justify-center gap-1.5 text-[14px] ${justCooked ? 'border-green bg-lime/30 text-green' : 'border-line bg-card text-muted'}`}>
          <Icon name="camera" size={26} />
          {busy ? 'Foto wird hochgeladen …' : justCooked ? 'Wie sah’s aus? Foto machen' : 'Foto hinzufügen'}
        </button>
      )}
      {error && <p role="alert" className="m-0 text-[14px] text-alert">{error}</p>}

      <div className="text-[13px] text-muted">
        {[r.is_wish ? `Wunsch von ${person(r.wished_by)?.display_name ?? 'euch'}` : '', r.servings ? `${r.servings} Portionen` : '', lastCookedLabel(r)].filter(Boolean).join(' · ')}
        {!!r.appliances?.length && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {r.appliances.map((a) => <span key={a} className="px-2 py-0.5 rounded-full bg-card border border-line text-[11px] font-mono uppercase tracking-wide text-ink">{a}</span>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setPlanning(!planning)} aria-expanded={planning} className="min-h-12 rounded-[14px] border-0 bg-green text-white font-semibold flex items-center justify-center gap-2"><Icon name="calendar" size={18} /> Einplanen</button>
        <button onClick={cooked} className="min-h-12 rounded-[14px] border border-line bg-card font-semibold flex items-center justify-center gap-2"><Icon name="check" size={18} /> Gekocht</button>
      </div>
      {planning && (
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Tag wählen">
          {next14.map((d, i) => (
            <button key={d} onClick={async () => { await onPlan(r.id, d); setPlanning(false) }}
              className={`min-h-12 rounded-[12px] border text-[13px] leading-tight ${i === 0 ? 'bg-lime border-lime text-lime-ink font-semibold' : 'bg-card border-line'}`}>
              {i === 0 ? 'Heute' : i === 1 ? 'Morgen' : dayShort(d)}<br /><span className="font-mono text-[11px]">{shortDate(d)}</span>
            </button>
          ))}
        </div>
      )}

      {ing.length > 0 && (
        <section>
          <h3 className="label m-0 mb-1.5">Zutaten</h3>
          <Card className="px-3.5 py-1">
            {ing.map((x, i) => <div key={i} className="py-2 border-b border-line-soft last:border-b-0 text-[15px]">{x}</div>)}
          </Card>
        </section>
      )}
      {steps.length > 0 && (
        <section>
          <h3 className="label m-0 mb-1.5">Zubereitung</h3>
          <ol className="m-0 pl-0 list-none flex flex-col gap-2">
            {steps.map((x, i) => (
              <li key={i} className="flex gap-3 text-[15px]"><span className="w-6 h-6 shrink-0 rounded-full bg-green text-lime text-[12px] font-mono flex items-center justify-center">{i + 1}</span><span>{x}</span></li>
            ))}
          </ol>
        </section>
      )}
      {r.notes && <p className="m-0 text-[14px] text-muted">{r.notes}</p>}
      {!ing.length && !steps.length && <p className="m-0 text-[14px] text-muted">Noch keine Zutaten. Ergänz sie, dann landen sie beim Wochenplan automatisch auf der Einkaufsliste.</p>}

      <div className="flex flex-wrap gap-2">
        <button onClick={onEdit} className="min-h-11 px-4 rounded-[12px] border border-line bg-card text-[14px]">Bearbeiten</button>
        <button onClick={() => api.update(r.id, { is_favorite: !r.is_favorite })} aria-pressed={r.is_favorite}
          className={`min-h-11 px-4 rounded-[12px] border text-[14px] flex items-center gap-1.5 ${r.is_favorite ? 'bg-lime border-lime text-lime-ink' : 'bg-card border-line'}`}><Icon name="star" size={16} /> Favorit</button>
        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="min-h-11 px-4 rounded-[12px] border border-line text-[14px] text-ink no-underline flex items-center gap-1.5"><Icon name="link" size={16} /> Original</a>}
      </div>
    </div>
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
        <p className="m-0 text-[14px] text-muted flex items-start gap-1.5"><Icon name="sparkle" size={16} className="shrink-0 mt-0.5" /> Bitte kurz prüfen, vor allem das Gerät. Ein eigenes Foto kannst du nach dem Speichern im Gericht hinzufügen.</p>
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
          ? 'Claude liest das Rezept, sortiert Zutaten mit Mengen, kürzt die Schritte und schlägt das Gerät vor (Thermomix, Airfryer, Ninja Creami …). Du prüfst vor dem Speichern.'
          : 'Demo ohne KI: Erste Zeile wird Titel, der Rest Zutaten. Mit Supabase übernimmt Claude.'}
      </p>
      {error && <p role="alert" className="m-0 text-[14px] text-alert">{error}</p>}
      <PrimaryButton type="submit" disabled={busy || (!text.trim() && !file)}>{busy ? 'Claude liest das Rezept … (10–30 Sek.)' : 'Mit KI umwandeln'}</PrimaryButton>
    </form>
  )
}

function RecipeForm({ initial, draft, api, onClose, onDeleted }: { initial: Recipe | null; draft?: RecipeDraft; api: RecipeApi; onClose: () => void; onDeleted?: () => void }) {
  const { me, backend } = useApp()
  const src = initial ?? draft
  const [title, setTitle] = useState(src?.title ?? '')
  const [url, setUrl] = useState(src?.url ?? '')
  const [by, setBy] = useState<string | null>(initial ? initial.wished_by : draft ? null : me.id)
  const [servings, setServings] = useState(src?.servings ? String(src.servings) : '')
  const [appliances, setAppliances] = useState<string[]>(() => [...new Set((src?.appliances ?? []).map(normalizeAppliance))])
  const [custom, setCustom] = useState('')
  const [ingredients, setIngredients] = useState(src?.ingredients ?? '')
  const [steps, setSteps] = useState(src?.steps ?? '')
  const [isWish, setIsWish] = useState(initial?.is_wish ?? false)

  const options = [...APPLIANCES, ...appliances.filter((a) => !(APPLIANCES as readonly string[]).includes(a))]
  const toggle = (a: string) => setAppliances((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]))
  const addCustom = () => { const a = normalizeAppliance(custom); if (a && !appliances.includes(a)) setAppliances([...appliances, a]); setCustom('') }

  const save = async () => {
    const row = {
      title: title.trim(), url: url.trim() || null, wished_by: isWish ? by : null, is_wish: isWish,
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
      <Field label="Gericht"><input autoFocus={!src} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="z. B. Ramen" /></Field>
      <div role="group" aria-labelledby="geraet-label" className="flex flex-col gap-1.5">
        <span id="geraet-label" className="label">Womit gekocht?</span>
        <div className="flex flex-wrap gap-1.5">
          {options.map((a) => (
            <button type="button" key={a} aria-pressed={appliances.includes(a)} onClick={() => toggle(a)} className={chipCls(appliances.includes(a))}>{a}</button>
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
      <label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={isWish} onChange={(e) => setIsWish(e.target.checked)} className="w-5 h-5 accent-green" /> Noch nie gekocht, steht auf der Wunschliste</label>
      {isWish && <Field group label="Wer wünscht es sich?"><PersonPicker value={by} onChange={setBy} /></Field>}
      <PrimaryButton type="submit" disabled={!title.trim()}>Speichern</PrimaryButton>
      {initial && (
        <button type="button" onClick={async () => {
          if (initial.photo_path) await backend.removePhoto(initial.photo_path).catch(() => {})
          await api.remove(initial.id); onDeleted?.()
        }} className="min-h-11 bg-transparent border-0 text-alert font-medium flex items-center justify-center gap-2"><Icon name="trash" size={18} /> Löschen</button>
      )}
    </form>
  )
}
