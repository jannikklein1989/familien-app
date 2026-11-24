import { addDays, iso, today } from './dates'
import type { Profile } from './types'

/**
 * Einfacher, lokaler Parser für die Schnell-Eingabe (Phase 1, ohne KI).
 * "Milch und Eier kaufen" → Einkauf, "Irene morgen Zahnarzt anrufen" → To-do für Irene, fällig morgen.
 * In Phase 3 übernimmt das Claude Haiku mit echtem Sprachverständnis.
 */
export type QuickResult =
  | { kind: 'shopping'; items: string[] }
  | { kind: 'todo'; title: string; assignee_id: string | null | undefined; due_date: string | null }

const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']

export function parseQuick(input: string, profiles: Profile[]): QuickResult | null {
  let text = input.trim().replace(/[.!]+$/, '')
  if (!text) return null
  const lower = text.toLowerCase()

  const shop = /^(einkauf(sliste)?|einkaufen)\s*:?\s*/i
  if (shop.test(text) || /\b(kaufen|besorgen|auf die (einkaufs)?liste)\b/i.test(lower) && !/\bgeschenk/i.test(lower)) {
    const body = text
      .replace(shop, '')
      .replace(/\b(bitte|noch|wir brauchen|brauchen|kaufen|besorgen|auf die (einkaufs)?liste( setzen| packen)?|setz(e|en)?|pack(e|en)?)\b/gi, ' ')
    const items = body.split(/,|\bund\b|\+/i).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    if (items.length) return { kind: 'shopping', items }
  }

  let due: string | null = null
  const t = today()
  const take = (re: RegExp, d: Date) => {
    if (re.test(text)) { due = iso(d); text = text.replace(re, ' ') }
  }
  const word = (w: string) => new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, 'iu')
  take(word('übermorgen'), addDays(t, 2))
  take(word('morgen'), addDays(t, 1))
  take(word('heute'), t)
  if (!due) {
    WEEKDAYS.forEach((w, i) => {
      const re = new RegExp(`\\b(am |bis )?${w}\\b`, 'i')
      if (!due && re.test(text)) {
        let diff = (i - t.getDay() + 7) % 7
        if (diff === 0) diff = 7
        due = iso(addDays(t, diff)); text = text.replace(re, ' ')
      }
    })
  }

  let assignee: string | null | undefined = undefined
  if (/\b(wir|beide|zusammen)\b/i.test(text)) { assignee = null; text = text.replace(/\b(wir beide|beide|zusammen)\b/i, ' ') }
  for (const p of profiles) {
    const re = new RegExp(`\\b(erinner(e)?\\s+)?${p.display_name}\\b(\\s+(soll|muss|an))?`, 'i')
    if (re.test(text)) { assignee = p.id; text = text.replace(re, ' ') }
  }
  text = text.replace(/\b(erinner(e)? (mich )?(an|daran)?|ich muss|bitte)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return { kind: 'todo', title: text.charAt(0).toUpperCase() + text.slice(1), assignee_id: assignee, due_date: due }
}

const CATS: [RegExp, string][] = [
  [/milch|käse|joghurt|quark|butter|sahne|eier|ei\b|schmand|frischkäse|mozzarella/i, 'Kühlregal'],
  [/apfel|äpfel|banane|tomate|gurke|salat|zwiebel|knoblauch|kartoffel|paprika|zitrone|basilikum|petersilie|obst|gemüse|möhre|karotte|avocado|beeren/i, 'Obst & Gemüse'],
  [/brot|brötchen|toast|baguette/i, 'Brot & Backwaren'],
  [/hack|hähnchen|fleisch|wurst|schinken|lachs|fisch|salami/i, 'Fleisch & Fisch'],
  [/nudel|pasta|reis|mehl|zucker|öl|essig|konserve|dose|linsen|bohnen|lasagne|ramen|brühe|gewürz|salz|pfeffer/i, 'Vorrat'],
  [/wasser|saft|bier|wein|cola|kaffee|tee|sprudel/i, 'Getränke'],
  [/tiefkühl|tk |pizza|eis\b/i, 'Tiefkühl'],
  [/spül|wasch|zahnpasta|shampoo|duschgel|klopapier|toilettenpapier|küchenrolle|deo|seife|müllbeutel/i, 'Drogerie'],
]
export function guessCategory(name: string): string {
  return CATS.find(([re]) => re.test(name))?.[1] ?? 'Sonstiges'
}
export const CATEGORY_ORDER = ['Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal', 'Fleisch & Fisch', 'Vorrat', 'Tiefkühl', 'Getränke', 'Drogerie', 'Sonstiges']

export const UNITS = ['Stück', 'g', 'kg', 'ml', 'l', 'Pck.', 'Dose', 'Flasche', 'Glas', 'Becher', 'Bund', 'Kiste'] as const
export type Unit = (typeof UNITS)[number]
const PLURAL: Partial<Record<Unit, string>> = { Dose: 'Dosen', Flasche: 'Flaschen', Glas: 'Gläser', Kiste: 'Kisten' }

/** "500 g" → { amount: 500, unit: 'g' }, "2" → { amount: 2, unit: 'Stück' } */
export function parseQty(q: string | null | undefined): { amount: number | null; unit: Unit } {
  if (!q) return { amount: null, unit: 'Stück' }
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  if (!m) return { amount: null, unit: 'Stück' }
  const raw = m[2].toLowerCase().replace('.', '')
  const unit = (UNITS.find((u) => u.toLowerCase().replace('.', '') === raw || PLURAL[u]?.toLowerCase() === raw) ??
    (raw === 'x' || raw === '×' || raw === 'stk' ? 'Stück' : raw === 'pck' || raw === 'packung' ? 'Pck.' : 'Stück')) as Unit
  return { amount: Number(m[1].replace(',', '.')), unit }
}

export function formatQty(amount: number | null, unit: Unit): string | null {
  if (amount == null || Number.isNaN(amount) || amount <= 0) return null
  const n = amount.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  if (unit === 'Stück') return `${n}×`
  return `${n} ${amount !== 1 && PLURAL[unit] ? PLURAL[unit] : unit}`
}

/** Sinnvolle Schrittweite für +/- je Einheit */
export function qtyStep(unit: Unit, amount: number | null): number {
  if (unit === 'g' || unit === 'ml') return (amount ?? 0) >= 500 ? 250 : 50
  if (unit === 'kg' || unit === 'l') return 0.5
  return 1
}

/** Geräte für den Geräte-Reiter; eigene lassen sich ergänzen */
export const APPLIANCES = ['Thermomix', 'Heißluftfritteuse', 'Backofen', 'Herd', 'Grill', 'Slow Cooker', 'Schnellkochtopf', 'Mikrowelle'] as const

const ING_UNITS: Record<string, Unit> = {
  g: 'g', gr: 'g', gramm: 'g', kg: 'kg', ml: 'ml', l: 'l', liter: 'l',
  stück: 'Stück', stk: 'Stück', x: 'Stück', pck: 'Pck.', 'pck.': 'Pck.', packung: 'Pck.', päckchen: 'Pck.',
  dose: 'Dose', dosen: 'Dose', flasche: 'Flasche', flaschen: 'Flasche', glas: 'Glas', gläser: 'Glas',
  becher: 'Becher', bund: 'Bund', kiste: 'Kiste', kisten: 'Kiste',
}

/** Zutatenzeile → Einkaufsartikel. "500 g Hackfleisch" → { name: 'Hackfleisch', quantity: '500 g' }.
 *  Küchenmaße (EL, TL, Prise) sind fürs Einkaufen egal und fallen weg. */
export function ingredientToItem(line: string): { name: string; quantity: string | null } {
  const m = line.trim().match(/^(\d+(?:[.,]\d+)?|½|¼)\s*(\S+\.?)?\s+(.+)$/)
  if (!m) return { name: line.trim(), quantity: null }
  const amount = m[1] === '½' ? 0.5 : m[1] === '¼' ? 0.25 : Number(m[1].replace(',', '.'))
  const word = (m[2] ?? '').toLowerCase()
  if (ING_UNITS[word]) return { name: m[3].trim(), quantity: formatQty(amount, ING_UNITS[word]) }
  if (/^(el|tl|prise|prisen|msp\.?|zehe|zehen|scheibe|scheiben|handvoll|schuss|spritzer)$/.test(word)) return { name: m[3].trim(), quantity: null }
  // keine Einheit: "2 Zwiebeln"
  const rest = `${m[2] ?? ''} ${m[3]}`.trim()
  return { name: rest, quantity: formatQty(amount, 'Stück') }
}
