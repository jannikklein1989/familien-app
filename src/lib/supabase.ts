import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend } from './backend'
import type { Profile } from './types'

// Leerzeichen/Zeilenumbrüche beim Einfügen in Vercel abfangen, beide Key-Namen erlauben
const env = import.meta.env as Record<string, string | undefined>
const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
const key = (env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim()
/** Welche Variablen beim Bauen gefehlt haben (für den Warnhinweis) */
export const missingEnv = [!url && 'VITE_SUPABASE_URL', !key && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean) as string[]

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

const PHOTO_BUCKET = 'recipe-photos'
const urlCache = new Map<string, string>()

export function createSupabaseBackend(sb: SupabaseClient): Backend {
  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message)
  }
  return {
    mode: 'supabase',
    async list(table) {
      const { data, error } = await sb.from(table).select('*').order('created_at')
      fail(error)
      return (data ?? []) as never
    },
    async insert(table, row) {
      const { error } = await sb.from(table).insert(row as never)
      fail(error)
    },
    async update(table, id, patch) {
      const { error } = await sb.from(table).update(patch as never).eq('id', id)
      fail(error)
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq('id', id)
      fail(error)
    },
    async removeWhere(table, field, value) {
      const { error } = await sb.from(table).delete().eq(field as string, value)
      fail(error)
    },
    subscribe(table, cb) {
      const ch = sb
        .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => cb())
        .subscribe()
      return () => { sb.removeChannel(ch) }
    },
    async profiles() {
      const { data, error } = await sb.from('profiles').select('id, display_name, color')
      fail(error)
      return (data ?? []) as Profile[]
    },
    async uploadPhoto(recipeId, blob) {
      const { data: { user } } = await sb.auth.getUser()
      const { data: prof, error: e1 } = await sb.from('profiles').select('household_id').eq('id', user?.id ?? '').single()
      fail(e1)
      const path = `${prof!.household_id}/${recipeId}-${Date.now()}.jpg`
      const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      fail(error)
      return path
    },
    async removePhoto(ref) {
      await sb.storage.from(PHOTO_BUCKET).remove([ref])
    },
    async photoUrls(refs) {
      const missing = refs.filter((r) => !urlCache.has(r))
      if (missing.length) {
        const { data } = await sb.storage.from(PHOTO_BUCKET).createSignedUrls(missing, 60 * 60 * 24 * 7)
        for (const d of data ?? []) if (d.path && d.signedUrl) urlCache.set(d.path, d.signedUrl)
      }
      return Object.fromEntries(refs.filter((r) => urlCache.has(r)).map((r) => [r, urlCache.get(r)!]))
    },
  }
}
