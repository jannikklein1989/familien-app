import { describe, expect, it } from 'vitest'
import { addDays, addMonths, cancellationDeadline, iso, nextDue, parse, today } from './dates'
import { formatQty, guessCategory, ingredientToItem, parseQty, parseQuick } from './quick'
import type { Contract, Profile } from './types'

const now = parse('2026-11-23')
const P: Profile[] = [{ id: 'j', display_name: 'Jannik', color: 'jannik' }, { id: 'i', display_name: 'Irene', color: 'irene' }]
const c = (o: Partial<Contract>) => ({ amount: 10, interval: 'monthly', renewal_months: null, monthly_cancellable_after_min_term: false, notice_unit: 'months', notice_value: 1, min_term_months: 12, ...o }) as Contract

describe('Datumslogik', () => {
  it('klemmt Monatsenden', () => expect(iso(addMonths(parse('2026-01-31'), 1))).toBe('2026-02-28'))
})

describe('Kündigungsfrist', () => {
  it('Mindestlaufzeit läuft noch', () => {
    const d = cancellationDeadline(c({ start_date: '2025-01-15', min_term_months: 24 }), now)
    expect(d.kind === 'deadline' && iso(d.deadline)).toBe('2026-12-15')
  })
  it('nach Mindestlaufzeit monatlich kündbar', () => {
    expect(cancellationDeadline(c({ start_date: '2024-01-15', min_term_months: 24, monthly_cancellable_after_min_term: true }), now).kind).toBe('anytime')
  })
  it('Versicherung: Frist dieses Jahr noch offen', () => {
    const d = cancellationDeadline(c({ start_date: '2025-12-28', renewal_months: 12 }), now)
    expect(d.kind === 'deadline' && iso(d.deadline)).toBe('2026-11-28')
  })
  it('Versicherung: Frist verpasst, nächstes Jahr', () => {
    const d = cancellationDeadline(c({ start_date: '2025-12-10', renewal_months: 12 }), now)
    expect(d.kind === 'deadline' && iso(d.deadline)).toBe('2027-11-10')
  })
  it('ohne Startdatum unbekannt', () => expect(cancellationDeadline(c({ start_date: null }), now).kind).toBe('unknown'))
})

describe('Wiederkehrende To-dos', () => {
  it('fester Rhythmus überspringt Verpasstes', () =>
    expect(nextDue({ freq: 'weekly', interval: 2, mode: 'fixed' }, '2026-11-03', now)).toBe('2026-12-01'))
  it('ab Erledigung', () =>
    expect(nextDue({ freq: 'monthly', interval: 2, mode: 'after_done' }, '2026-10-01', now)).toBe('2027-01-23'))
})

describe('Schnell-Eingabe', () => {
  it('Einkauf', () => expect(parseQuick('Milch und Eier kaufen', P)).toEqual({ kind: 'shopping', items: ['Milch', 'Eier'] }))
  it('Einkauf mit Präfix', () => expect(parseQuick('Einkauf: Tomaten, Basilikum', P)).toEqual({ kind: 'shopping', items: ['Tomaten', 'Basilikum'] }))
  it('To-do für Irene morgen', () => expect(parseQuick('Irene morgen Zahnarzt anrufen', P)).toEqual({ kind: 'todo', title: 'Zahnarzt anrufen', assignee_id: 'i', due_date: iso(addDays(today(), 1)) }))
  it('übermorgen schlägt morgen', () => expect(parseQuick('Erinnere Jannik übermorgen an den Müll', P)).toMatchObject({ assignee_id: 'j', due_date: iso(addDays(today(), 2)) }))
  it('Geschenk ist kein Einkauf', () => expect(parseQuick('Geschenk für Mama besorgen', P)?.kind).toBe('todo'))
  it('Kategorien', () => expect([guessCategory('Mozzarella'), guessCategory('Reis'), guessCategory('Klopapier')]).toEqual(['Kühlregal', 'Vorrat', 'Drogerie']))
})

describe('Mengen', () => {
  it('liest Einheiten', () => {
    expect(parseQty('500 g')).toEqual({ amount: 500, unit: 'g' })
    expect(parseQty('2×')).toEqual({ amount: 2, unit: 'Stück' })
    expect(parseQty('1,5 l')).toEqual({ amount: 1.5, unit: 'l' })
  })
  it('formatiert', () => {
    expect(formatQty(3, 'Stück')).toBe('3×')
    expect(formatQty(1.5, 'kg')).toBe('1,5 kg')
    expect(formatQty(0, 'g')).toBeNull()
  })
})

describe('Verpackungseinheiten', () => {
  it('formatiert Plural und liest ihn zurück', () => {
    expect(formatQty(2, 'Dose')).toBe('2 Dosen')
    expect(formatQty(1, 'Dose')).toBe('1 Dose')
    expect(formatQty(4, 'Flasche')).toBe('4 Flaschen')
    expect(formatQty(500, 'g')).toBe('500 g')
    expect(parseQty('2 Dosen')).toEqual({ amount: 2, unit: 'Dose' })
    expect(parseQty('3 Gläser')).toEqual({ amount: 3, unit: 'Glas' })
  })
})

describe('Zutat → Einkauf', () => {
  it('trennt Menge und Name', () => {
    expect(ingredientToItem('500 g Hackfleisch')).toEqual({ name: 'Hackfleisch', quantity: '500 g' })
    expect(ingredientToItem('2 Dosen Tomaten')).toEqual({ name: 'Tomaten', quantity: '2 Dosen' })
    expect(ingredientToItem('2 Zwiebeln')).toEqual({ name: 'Zwiebeln', quantity: '2×' })
    expect(ingredientToItem('2 EL Olivenöl')).toEqual({ name: 'Olivenöl', quantity: null })
    expect(ingredientToItem('Rosmarin')).toEqual({ name: 'Rosmarin', quantity: null })
  })
})
