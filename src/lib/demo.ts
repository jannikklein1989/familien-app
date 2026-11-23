import type { Backend } from './backend'
import type { Profile, TableName, Tables } from './types'
import { addDays, iso, today } from './dates'

/**
 * Demo-Modus: Daten liegen nur in diesem Browser (localStorage).
 * Änderungen werden zwischen Tabs live verteilt (BroadcastChannel),
 * damit sich die Einkaufsliste schon wie "live" anfühlt.
 */
const KEY = 'kk-demo-v1'
export const DEMO_PROFILES: Profile[] = [
  { id: 'u-jannik', display_name: 'Jannik', color: 'jannik' },
  { id: 'u-irene', display_name: 'Irene', color: 'irene' },
]

type Db = { [K in TableName]: Tables[K][] }

function uid() {
  return crypto.randomUUID()
}

function seed(): Db {
  const t = today()
  const now = new Date().toISOString()
  const d = (n: number) => iso(addDays(t, n))
  return {
    todos: [
      { id: uid(), title: 'Müll rausstellen', assignee_id: 'u-jannik', due_date: d(0), recurrence: { freq: 'weekly', interval: 2, mode: 'fixed' }, done_at: null, done_by: null, created_at: now },
      { id: uid(), title: 'Geschenk für Mama besorgen', assignee_id: 'u-irene', due_date: d(3), recurrence: null, done_at: null, done_by: null, created_at: now },
      { id: uid(), title: 'Wasserfilter wechseln', assignee_id: null, due_date: d(0), recurrence: { freq: 'monthly', interval: 2, mode: 'after_done' }, done_at: null, done_by: null, created_at: now },
      { id: uid(), title: 'Zahnarzt-Termin ausmachen', assignee_id: 'u-jannik', due_date: null, recurrence: null, done_at: null, done_by: null, created_at: now },
    ],
    shopping_items: [
      { id: uid(), name: 'Milch', quantity: '2', category: 'Kühlregal', checked: false, created_at: now },
      { id: uid(), name: 'Eier', quantity: '10', category: 'Kühlregal', checked: false, created_at: now },
      { id: uid(), name: 'Basilikum', quantity: null, category: 'Obst & Gemüse', checked: false, created_at: now },
      { id: uid(), name: 'Tomaten', quantity: '500 g', category: 'Obst & Gemüse', checked: false, created_at: now },
      { id: uid(), name: 'Spülmittel', quantity: null, category: 'Drogerie', checked: true, created_at: now },
    ],
    contracts: [
      { id: uid(), name: 'Netflix', provider: 'Netflix', category: 'Streaming', owner_id: null, direction: 'expense', amount: 13.99, interval: 'monthly', start_date: iso(addDays(t, -300)), min_term_months: 0, renewal_months: 1, notice_value: 0, notice_unit: 'days', monthly_cancellable_after_min_term: true, cancel_url: 'https://www.netflix.com/cancelplan', status: 'active', created_at: now },
      { id: uid(), name: 'Handyvertrag Jannik', provider: '[Anbieter]', category: 'Handy & Internet', owner_id: 'u-jannik', direction: 'expense', amount: 29.99, interval: 'monthly', start_date: iso(addDays(t, -700 + 40)), min_term_months: 24, renewal_months: 1, notice_value: 1, notice_unit: 'months', monthly_cancellable_after_min_term: true, cancel_url: null, status: 'active', created_at: now },
      { id: uid(), name: 'Hausratversicherung', provider: '[Versicherer]', category: 'Versicherung', owner_id: null, direction: 'expense', amount: 96, interval: 'yearly', start_date: iso(addDays(t, -335)), min_term_months: 12, renewal_months: 12, notice_value: 1, notice_unit: 'months', monthly_cancellable_after_min_term: false, cancel_url: null, status: 'active', created_at: now },
      { id: uid(), name: 'Gehalt Jannik', provider: null, category: 'Einkommen', owner_id: 'u-jannik', direction: 'income', amount: 0, interval: 'monthly', start_date: null, min_term_months: null, renewal_months: null, notice_value: null, notice_unit: null, monthly_cancellable_after_min_term: false, status: 'active', created_at: now },
    ],
    recipes: [
      { id: uid(), title: 'Ramen', url: null, wished_by: 'u-irene', is_wish: true, is_favorite: false, ingredients: null, created_at: now },
      { id: uid(), title: 'Lasagne', url: null, wished_by: 'u-jannik', is_wish: false, is_favorite: true, ingredients: 'Lasagneplatten\nHackfleisch\nTomaten\nMozzarella', created_at: now },
    ],
  }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* privater Modus o. ä. */ }
  const db = seed()
  save(db)
  return db
}
function save(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignorieren */ }
}

export function resetDemo() {
  try { localStorage.removeItem(KEY) } catch { /* ignorieren */ }
}

export function createDemoBackend(): Backend {
  let db = load()
  const listeners = new Map<TableName, Set<() => void>>()
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kk-demo') : null
  const emit = (table: TableName, remote = false) => {
    listeners.get(table)?.forEach((cb) => cb())
    if (!remote) channel?.postMessage(table)
  }
  channel?.addEventListener('message', (e) => {
    db = load()
    emit(e.data as TableName, true)
  })
  const commit = (table: TableName) => { save(db); emit(table) }

  return {
    mode: 'demo',
    async list(table) {
      return structuredClone(db[table]) as never
    },
    async insert(table, row) {
      (db[table] as unknown[]).push({ id: uid(), created_at: new Date().toISOString(), ...row })
      commit(table)
    },
    async update(table, id, patch) {
      db[table] = (db[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) as never
      commit(table)
    },
    async remove(table, id) {
      db[table] = (db[table] as { id: string }[]).filter((r) => r.id !== id) as never
      commit(table)
    },
    async removeWhere(table, field, value) {
      db[table] = (db[table] as unknown as Record<string, unknown>[]).filter((r) => r[field as string] !== value) as never
      commit(table)
    },
    subscribe(table, cb) {
      if (!listeners.has(table)) listeners.set(table, new Set())
      listeners.get(table)!.add(cb)
      return () => listeners.get(table)!.delete(cb)
    },
    async profiles() {
      return DEMO_PROFILES
    },
  }
}
