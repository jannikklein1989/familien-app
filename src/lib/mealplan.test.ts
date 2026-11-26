import { describe, expect, it } from 'vitest'
import { addQuantities, ingredientKey, mergeIngredients, planShopping, suggestRecipes, weekStart } from './mealplan'
import { iso, parse } from './dates'
import { normalizeAppliance } from './quick'
import type { Recipe, ShoppingItem } from './types'

const R = (title: string, ingredients: string, o: Partial<Recipe> = {}) =>
  ({ id: title, title, ingredients, is_wish: false, is_favorite: false, wished_by: null, created_at: '', ...o }) as Recipe

describe('Wochenplan: Zutaten zusammenfassen', () => {
  const m = mergeIngredients([
    R('Lasagne', '500 g Hackfleisch\n2 Dosen Tomaten\n2 Zwiebeln\n1 TL Salz'),
    R('Chili', '600 g Hackfleisch\n1 Dose Tomaten\n1 Zwiebel\n1 Dose Kidneybohnen\n2 EL Olivenöl'),
  ])
  const get = (n: string) => m.find((x) => x.name.toLowerCase().startsWith(n))
  it('addiert Gramm und rechnet in kg um', () => expect(get('hack')?.quantity).toBe('1,1 kg'))
  it('addiert Dosen', () => expect(get('tomat')?.quantity).toBe('3 Dosen'))
  it('erkennt Singular/Plural als gleiche Zutat', () => expect(get('zwiebel')?.quantity).toBe('3×'))
  it('merkt sich, für welche Gerichte', () => expect(get('hack')?.recipes).toEqual(['Lasagne', 'Chili']))
  it('Salz und Öl sind Vorrat', () => {
    expect(get('salz')?.staple).toBe(true)
    expect(get('olivenöl')?.staple).toBe(true)
    expect(get('kidney')?.staple).toBe(false)
  })
})

describe('Mengen addieren', () => {
  it('g + kg', () => expect(addQuantities('500 g', '1 kg')).toBe('1,5 kg'))
  it('unverträglich', () => expect(addQuantities('1 Dose', '400 g')).toBe('1 Dose + 400 g'))
  it('leer', () => expect(addQuantities(null, '2×')).toBe('2×'))
})

describe('Einkaufsliste befüllen', () => {
  const ex = [
    { id: 'a', name: 'Zwiebel', quantity: '1×', checked: false, category: '', created_at: '' },
    { id: 'b', name: 'Milch', quantity: null, checked: true, category: '', created_at: '' },
  ] as ShoppingItem[]
  const { inserts, updates } = planShopping(mergeIngredients([R('X', '2 Zwiebeln\n1 l Milch\n200 g Feta')]), ex)
  it('ergänzt offene Einträge', () => expect(updates.find((u) => u.id === 'a')?.patch.quantity).toBe('3×'))
  it('holt abgehakte zurück', () => expect(updates.find((u) => u.id === 'b')?.patch).toEqual({ checked: false, quantity: '1 l' }))
  it('legt Neues an', () => expect(inserts.map((i) => i.name)).toEqual(['Feta']))
})

describe('Vorschläge', () => {
  const rs = [R('A', '', { appliances: ['Airfryer'] }), R('B', ''), R('C', '', { appliances: ['Airfryer'] })]
  it('filtert nach Gerät', () => expect(suggestRecipes(rs, [], { appliance: 'Airfryer', random: () => 0 }).map((r) => r.id).sort()).toEqual(['A', 'C']))
  it('lässt diese Woche Geplantes weg (nach hinten)', () => {
    const plan = [{ id: '1', day: iso(new Date()), recipe_id: 'B', on_list: false, created_at: '' }]
    expect(suggestRecipes(rs, plan, { count: 2, random: () => 0 }).map((r) => r.id)).not.toContain('B')
  })
})

describe('Kleinkram', () => {
  it('Woche beginnt Montag', () => expect(iso(weekStart(parse('2026-11-29')))).toBe('2026-11-23'))
  it('Schlüssel', () => expect(ingredientKey('Tomaten')).toBe(ingredientKey('Tomate')))
  it('Gerätenamen', () => {
    expect(normalizeAppliance('Heißluftfritteuse')).toBe('Airfryer')
    expect(normalizeAppliance('ninja creami')).toBe('Ninja Creami')
  })
})
