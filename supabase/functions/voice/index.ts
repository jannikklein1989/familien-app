// Supabase Edge Function "voice": POST { text, today } mit dem Login-Token des Users.
// Secret setzen: supabase secrets set ANTHROPIC_API_KEY=...
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { interpret } from './interpret.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY fehlt in den Supabase-Secrets.' }, 500)

  // Mit dem Token des Users arbeiten, damit die Datenbank-Regeln greifen
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Nicht angemeldet' }, 401)

  const { text, today } = await req.json().catch(() => ({}))
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'Kein Text' }, 400)
  if (text.length > 2000) return json({ error: 'Bitte kürzer fassen (max. 2000 Zeichen).' }, 400)
  const day = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10)

  const { data: profiles } = await supabase.from('profiles').select('id, display_name')
  const me = profiles?.find((p) => p.id === user.id)
  if (!me) return json({ error: 'Kein Profil' }, 403)

  try {
    const result = await interpret(text.trim(), { today: day, speaker: me.display_name, members: (profiles ?? []).map((p) => p.display_name) }, apiKey)
    return json(result)
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Unbekannter Fehler' }, 502)
  }
})
