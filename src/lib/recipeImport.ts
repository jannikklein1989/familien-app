import { supabase } from './supabase'
import type { Recipe } from './types'

export interface ImportedRecipe {
  title: string
  servings: number | null
  ingredients: string[]
  steps: string[]
  appliances: string[]
  notes: string | null
  url: string | null
}

export type RecipeDraft = Pick<Recipe, 'title' | 'url' | 'ingredients' | 'steps' | 'servings' | 'appliances' | 'notes'>

export function toDraft(r: ImportedRecipe): RecipeDraft {
  return {
    title: r.title, url: r.url, servings: r.servings, appliances: r.appliances, notes: r.notes,
    ingredients: r.ingredients.join('\n') || null, steps: r.steps.join('\n') || null,
  }
}

/** Fotos verkleinern (max. 1600 px, JPEG), spart Upload und Tokens. PDFs bleiben unverändert. */
export async function fileToPayload(file: File): Promise<{ data: string; media_type: string }> {
  if (file.type.startsWith('image/')) {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale)
    c.height = Math.round(bmp.height * scale)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return { data: c.toDataURL('image/jpeg', 0.85).split(',')[1], media_type: 'image/jpeg' }
  }
  if (file.type !== 'application/pdf') throw new Error('Bitte ein PDF oder ein Foto wählen.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Das PDF ist zu groß (max. 10 MB).')
  const buf = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return { data: btoa(bin), media_type: 'application/pdf' }
}

export async function importRecipe(input: { text?: string; file?: File }): Promise<ImportedRecipe> {
  const text = input.text?.trim() ?? ''
  if (supabase) {
    const file = input.file ? await fileToPayload(input.file) : undefined
    const { data, error } = await supabase.functions.invoke('recipe-import', { body: { text, file } })
    if (error) {
      const ctx = (error as { context?: Response }).context
      const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
      throw new Error(msg ?? error.message)
    }
    return data as ImportedRecipe
  }
  // Demo ohne KI: erste Zeile = Titel, Rest = Zutaten
  if (input.file) throw new Error('Datei-Import geht nur mit Supabase und Claude.')
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
  const isUrl = /^https?:\/\//.test(lines[0] ?? '')
  return { title: isUrl ? 'Rezept aus Link' : lines[0] ?? 'Rezept', servings: null, ingredients: isUrl ? [] : lines.slice(1), steps: [], appliances: [], notes: null, url: isUrl ? lines[0] : null }
}
