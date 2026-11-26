import { useTable } from './app'
import { iso, today } from './dates'

/** Gericht(e) aus dem Wochenplan für heute, für die Startseite ("Heute gibt's …"). null = nichts geplant. */
export function useTodaysMeal(): { title: string; recipe_id: string; photoRef: string | null; more: number } | null {
  const plan = useTable('meal_plan')
  const recipes = useTable('recipes')
  const day = iso(today())
  const entries = plan.rows.filter((p) => p.day === day).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const first = entries.map((e) => recipes.rows.find((r) => r.id === e.recipe_id)).find(Boolean)
  if (!first) return null
  return { title: first.title, recipe_id: first.id, photoRef: first.photo_path ?? null, more: entries.length - 1 }
}
