// Supabase Edge Function "calendar" (eine Datei, damit sie sich im Dashboard einfügen lässt).
// Liest die geheimen iCal-Adressen des Haushalts (Tabelle calendar_feeds) und liefert die Termine
// der nächsten Tage, inklusive Serienterminen. POST { days?: number } mit dem Login-Token.
// Der User wird unten selbst geprüft, "Verify JWT" darf daher aus sein. Kein API-Key nötig.
import ICAL from 'npm:ical.js@2.2.1'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface Feed { id: string; owner_id: string | null; label: string; ics_url: string }
interface Out { id: string; feed_id: string; owner_id: string | null; label: string; title: string; start: string; end: string; all_day: boolean; location: string | null }

function toIso(t: ICAL.Time): string {
  // Ganztägig: Datum ohne Zeitzone, sonst echter Zeitpunkt (UTC)
  return t.isDate ? t.toString().slice(0, 10) : t.toJSDate().toISOString()
}

function expand(feed: Feed, ics: string, from: Date, to: Date): Out[] {
  const root = new ICAL.Component(ICAL.parse(ics))
  for (const tz of root.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(tz)
  const vevents = root.getAllSubcomponents('vevent')
  const masters = new Map<string, ICAL.Event>()
  const exceptions: ICAL.Event[] = []
  for (const v of vevents) {
    const ev = new ICAL.Event(v)
    if (v.hasProperty('recurrence-id')) exceptions.push(ev)
    else masters.set(ev.uid, ev)
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.uid)
    if (m) m.relateException(ex)
  }
  const out: Out[] = []
  const push = (ev: ICAL.Event, s: ICAL.Time, e: ICAL.Time, key: string) => {
    const sd = s.toJSDate(), ed = e.toJSDate()
    if (ed < from || sd > to) return
    if (String(ev.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') return
    out.push({ id: `${feed.id}:${key}`, feed_id: feed.id, owner_id: feed.owner_id, label: feed.label, title: ev.summary || '(ohne Titel)', start: toIso(s), end: toIso(e), all_day: s.isDate, location: ev.location || null })
  }
  for (const ev of masters.values()) {
    if (!ev.startDate) continue
    if (!ev.isRecurring()) { push(ev, ev.startDate, ev.endDate ?? ev.startDate, ev.uid); continue }
    const it = ev.iterator()
    for (let i = 0, next = it.next(); next && i < 2000; i++, next = it.next()) {
      if (next.toJSDate() > to) break
      const occ = ev.getOccurrenceDetails(next)
      push(occ.item, occ.startDate, occ.endDate, `${ev.uid}:${next.toString()}`)
    }
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return json({ error: 'Nicht angemeldet' }, 401)

  const body = await req.json().catch(() => ({})) as { days?: unknown }
  const days = typeof body.days === 'number' ? Math.min(Math.max(1, Math.round(body.days)), 60) : 14
  const from = new Date(); from.setUTCHours(0, 0, 0, 0); from.setUTCDate(from.getUTCDate() - 1)
  const to = new Date(from.getTime() + (days + 1) * 86_400_000)

  // Dank Row-Level-Security nur die Kalender des eigenen Haushalts
  const { data: feeds, error } = await supabase.from('calendar_feeds').select('id, owner_id, label, ics_url')
  if (error) return json({ error: error.message }, 500)

  const errors: { feed_id: string; label: string; error: string }[] = []
  const lists = await Promise.all((feeds ?? []).map(async (f: Feed) => {
    try {
      const res = await fetch(f.ics_url.replace(/^webcal:/i, 'https:'), { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`Kalender nicht erreichbar (${res.status})`)
      return expand(f, await res.text(), from, to)
    } catch (e) {
      errors.push({ feed_id: f.id, label: f.label, error: e instanceof Error ? e.message : 'Fehler' })
      return []
    }
  }))
  const events = lists.flat().sort((a, b) => a.start.localeCompare(b.start))
  return json({ events, errors })
})
