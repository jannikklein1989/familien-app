import type { Backend } from './backend'
import { iso, today } from './dates'
import { formatQty, guessCategory, parseQuick, type Unit } from './quick'
import { supabase } from './supabase'
import type { Freq, Profile } from './types'

/** Spiegel des Schemas in supabase/functions/voice/interpret.ts */
export interface VoiceResult {
  todos: { title: string; assignee: string | null; due_date: string | null; recurrence: { freq: Freq; interval: number; mode: 'fixed' | 'after_done' } | null }[]
  shopping: { name: string; amount: number | null; unit: Unit | null; category: string }[]
  recipes: { title: string; url: string | null; ingredients: string[]; wish: boolean; wished_by: string | null }[]
  summary: string
}

/** Mit Supabase: Claude Sonnet über die Edge Function. Im Demo-Modus: einfacher lokaler Parser. */
export async function understand(text: string, profiles: Profile[], me: Profile): Promise<VoiceResult> {
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('voice', { body: { text, today: iso(today()) } })
    if (error) {
      const ctx = (error as { context?: Response }).context
      const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
      throw new Error(msg ?? error.message)
    }
    return data as VoiceResult
  }
  const r = parseQuick(text, profiles)
  const empty: VoiceResult = { todos: [], shopping: [], recipes: [], summary: '' }
  if (!r) return { ...empty, summary: 'Nichts erkannt.' }
  if (r.kind === 'shopping') {
    return { ...empty, shopping: r.items.map((name) => ({ name, amount: null, unit: null, category: guessCategory(name) })), summary: `${r.items.length} × Einkauf (Demo ohne KI)` }
  }
  const who = r.assignee_id === undefined ? me.display_name : r.assignee_id === null ? null : profiles.find((p) => p.id === r.assignee_id)?.display_name ?? me.display_name
  return { ...empty, todos: [{ title: r.title, assignee: who, due_date: r.due_date, recurrence: null }], summary: 'Ein To-do (Demo ohne KI)' }
}

function personId(name: string | null, profiles: Profile[], fallback: string | null): string | null {
  if (name == null) return fallback
  return profiles.find((p) => p.display_name.toLowerCase() === name.toLowerCase())?.id ?? fallback
}

export interface Selection { todos: boolean[]; shopping: boolean[]; recipes: boolean[] }

export async function applyVoice(r: VoiceResult, sel: Selection, backend: Backend, profiles: Profile[], me: Profile) {
  let n = 0
  for (const [i, t] of r.todos.entries()) {
    if (!sel.todos[i]) continue
    await backend.insert('todos', {
      title: t.title, assignee_id: t.assignee === null ? null : personId(t.assignee, profiles, me.id),
      due_date: t.due_date ?? (t.recurrence ? iso(today()) : null),
      recurrence: t.recurrence ? { ...t.recurrence, interval: Math.max(1, Math.round(t.recurrence.interval)) } : null,
      done_at: null, done_by: null,
    })
    n++
  }
  for (const [i, s] of r.shopping.entries()) {
    if (!sel.shopping[i]) continue
    await backend.insert('shopping_items', { name: s.name, quantity: formatQty(s.amount, s.unit ?? 'Stück'), category: s.category, checked: false })
    n++
  }
  for (const [i, x] of r.recipes.entries()) {
    if (!sel.recipes[i]) continue
    await backend.insert('recipes', {
      title: x.title, url: x.url, ingredients: x.ingredients.length ? x.ingredients.join('\n') : null,
      is_wish: x.wish, is_favorite: false, wished_by: personId(x.wished_by, profiles, me.id),
    })
    n++
  }
  return n
}
