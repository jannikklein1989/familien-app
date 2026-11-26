import { describe, expect, it, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: null }))
import { addMonths, iso, today } from './dates'
import type { Profile } from './types'
import { applyVoice, monthsFromNow, type VoiceResult } from './voice'

const P = [{ id: 'j', display_name: 'Jannik' }, { id: 'i', display_name: 'Irene' }] as Profile[]

describe('Sprachmodus speichern', () => {
  it('legt jeden Artikel einzeln an, Vertrag plus Kündigungs-To-do', async () => {
    const rows: [string, Record<string, unknown>][] = []
    const backend = { insert: async (t: string, r: Record<string, unknown>) => { rows.push([t, r]) } } as never
    const in11 = iso(addMonths(today(), 11))
    const r: VoiceResult = {
      todos: [{ title: 'Dachrinne reinigen', assignee: 'Jannik', due_date: null, recurrence: null }],
      shopping: [
        { name: 'Hackfleisch', amount: 500, unit: 'g', category: 'Fleisch & Fisch' },
        { name: 'Magerquark', amount: 2, unit: 'Pck.', category: 'Kühlregal' },
        { name: 'Brokkoli', amount: 1, unit: 'Stück', category: 'Obst & Gemüse' },
      ],
      recipes: [],
      contracts: [{ name: 'Higgsfield', provider: 'Higgsfield', category: 'Sonstiges', direction: 'expense', amount: 130, interval: 'yearly', start_date: iso(today()), min_term_months: 12, notice_months: null, owner: null, reminder_date: in11 }],
      summary: '',
    }
    const n = await applyVoice(r, { todos: [true], shopping: [true, true, true], recipes: [], contracts: [true] }, backend, P, P[0])
    expect(n).toBe(5)
    expect(rows.filter(([t]) => t === 'shopping_items').map(([, x]) => `${x.quantity} ${x.name}`)).toEqual(['500 g Hackfleisch', '2 Pck. Magerquark', '1× Brokkoli'])
    expect(rows.find(([t]) => t === 'contracts')?.[1]).toMatchObject({ amount: 130, interval: 'yearly', min_term_months: 12 })
    expect(rows.filter(([t]) => t === 'todos').map(([, x]) => [x.title, x.due_date, x.assignee_id])).toEqual([['Dachrinne reinigen', null, 'j'], ['Higgsfield kündigen?', in11, 'j']])
    expect(monthsFromNow(in11)).toBe(11)
  })
})
