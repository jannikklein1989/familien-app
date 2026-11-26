import { addDays, daysBetween, iso, parse, today } from './dates'
import { formatQty, guessCategory, ingredientToItem, parseQty, type Unit } from './quick'
import type { MealPlanEntry, Recipe, ShoppingItem } from './types'

/* ───────────── Woche ───────────── */

/** Montag der Woche, in der d liegt */
export function weekStart(d: Date = today()): Date {
  return addDays(d, -((d.getDay() + 6) % 7))
}
export function weekDays(start: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => iso(addDays(start, i)))
}
/** ISO-Kalenderwoche */
export function weekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)
}
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
export const dayShort = (s: string) => WD_SHORT[parse(s).getDay()]
export const dayLong = (s: string) => WD_LONG[parse(s).getDay()]

/* ───────────── Zutaten zusammenfassen ───────────── */

/** Grobe Grundform für den Vergleich: "Zwiebeln" = "Zwiebel", "Tomaten" = "Tomate" */
export function ingredientKey(name: string): string {
  let k = name.toLowerCase().replace(/\(.*?\)/g, '').split(',')[0].replace(/\s+/g, ' ').trim()
  if (k.length > 4) k = k.replace(/(en|n|e|s)$/, '')
  return k
}

/** Was meist eh im Schrank steht: Haken ist in der Vorschau erstmal aus */
const STAPLE = /^(salz|pfeffer|wasser|zucker|mehl|essig|öl|olivenöl|rapsöl|sonnenblumenöl|speiseöl|brühe|gemüsebrühe|paprikapulver|oregano|zimt|muskat|chili|chiliflocken|currypulver|curry|kreuzkümmel|backpulver|natron|senf|sojasauce|honig|knoblauchpulver)$/i
const SPOON = /^\s*(\d+(?:[.,]\d+)?|½|¼)\s*(el|tl|prise|prisen|msp\.?|schuss|spritzer)\b/i

export interface MergedIngredient {
  key: string
  name: string
  quantity: string | null
  category: string
  recipes: string[] // Titel, für "für Lasagne, Chili"
  staple: boolean
}

type Base = 'g' | 'ml' | Unit
const toBase = (amount: number, unit: Unit): [number, Base] =>
  unit === 'kg' ? [amount * 1000, 'g'] : unit === 'l' ? [amount * 1000, 'ml'] : [amount, unit]
function fromBase(amount: number, unit: Base): string | null {
  if (unit === 'g' && amount >= 1000) return formatQty(amount / 1000, 'kg')
  if (unit === 'ml' && amount >= 1000) return formatQty(amount / 1000, 'l')
  return formatQty(amount, unit as Unit)
}

/** Zutaten mehrerer Gerichte zu einer Einkaufsliste zusammenfassen, gleiche Zutaten addiert */
export function mergeIngredients(recipes: Pick<Recipe, 'title' | 'ingredients'>[]): MergedIngredient[] {
  const map = new Map<string, { name: string; parts: Map<Base, number>; recipes: Set<string>; staple: boolean }>()
  for (const r of recipes) {
    for (const line of (r.ingredients ?? '').split('\n').map((l) => l.trim()).filter(Boolean)) {
      const it = ingredientToItem(line)
      const name = it.name.replace(/^[-•*]\s*/, '')
      if (!name) continue
      const key = ingredientKey(name)
      const e = map.get(key) ?? { name, parts: new Map(), recipes: new Set(), staple: true }
      e.recipes.add(r.title)
      // Staple nur, wenn jede Nennung nach Vorrat aussieht
      e.staple = e.staple && (STAPLE.test(name.trim()) || SPOON.test(line))
      const q = parseQty(it.quantity)
      if (it.quantity && q.amount != null) {
        const [a, u] = toBase(q.amount, q.unit)
        e.parts.set(u, (e.parts.get(u) ?? 0) + a)
      }
      map.set(key, e)
    }
  }
  return [...map.entries()].map(([key, e]) => ({
    key,
    name: e.name.charAt(0).toUpperCase() + e.name.slice(1),
    quantity: [...e.parts.entries()].map(([u, a]) => fromBase(a, u)).filter(Boolean).join(' + ') || null,
    category: guessCategory(e.name),
    recipes: [...e.recipes],
    staple: e.staple,
  }))
}

/** Zwei Mengen addieren ("500 g" + "1 kg" = "1,5 kg"), sonst aneinanderhängen */
export function addQuantities(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null
  if (!b) return a
  const qa = parseQty(a), qb = parseQty(b)
  if (qa.amount != null && qb.amount != null && !a.includes('+') && !b.includes('+')) {
    const [x, ux] = toBase(qa.amount, qa.unit)
    const [y, uy] = toBase(qb.amount, qb.unit)
    if (ux === uy) return fromBase(x + y, ux)
  }
  return `${a} + ${b}`
}

/** Plan für die Einkaufsliste: was neu angelegt, was bei bestehenden Einträgen ergänzt wird */
export function planShopping(items: MergedIngredient[], existing: ShoppingItem[]) {
  const inserts: Partial<ShoppingItem>[] = []
  const updates: { id: string; patch: Partial<ShoppingItem> }[] = []
  for (const it of items) {
    const ex = existing.find((s) => ingredientKey(s.name) === it.key)
    if (!ex) inserts.push({ name: it.name, quantity: it.quantity, category: it.category, checked: false })
    else if (ex.checked) updates.push({ id: ex.id, patch: { checked: false, quantity: it.quantity } })
    else updates.push({ id: ex.id, patch: { quantity: addQuantities(ex.quantity, it.quantity) } })
  }
  return { inserts, updates }
}

/* ───────────── "Was kochen wir heute?" ───────────── */

/** 3 Vorschläge aus der eigenen Bibliothek: lange nicht gekocht und Favoriten zuerst, mit etwas Zufall */
export function suggestRecipes(
  recipes: Recipe[], plan: MealPlanEntry[], opts: { appliance?: string | null; count?: number; exclude?: string[]; random?: () => number } = {},
): Recipe[] {
  const rnd = opts.random ?? Math.random
  const t = today()
  const ws = iso(weekStart(t)), we = iso(addDays(weekStart(t), 6))
  const plannedThisWeek = new Set(plan.filter((p) => p.day >= ws && p.day <= we).map((p) => p.recipe_id))
  const lastPlanned = new Map<string, string>()
  for (const p of plan) if (p.day <= iso(t) && (lastPlanned.get(p.recipe_id) ?? '') < p.day) lastPlanned.set(p.recipe_id, p.day)
  return recipes
    .filter((r) => !opts.appliance || r.appliances?.includes(opts.appliance))
    .filter((r) => !opts.exclude?.includes(r.id))
    .map((r) => {
      const last = [r.last_cooked_at, lastPlanned.get(r.id)].filter(Boolean).sort().at(-1)
      const days = last ? Math.min(daysBetween(parse(last), t), 90) : 45
      const score = days + (r.is_favorite ? 25 : 0) + (r.ingredients ? 5 : 0) - (plannedThisWeek.has(r.id) ? 200 : 0) + rnd() * 40
      return { r, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.count ?? 3)
    .map((x) => x.r)
}

/* ───────────── Fotos ───────────── */

/** Foto für die Bibliothek klein rechnen (max. 1280 px, JPEG) */
export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Bitte ein Foto wählen.')
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Foto konnte nicht verarbeitet werden.'))), 'image/jpeg', 0.8))
}
