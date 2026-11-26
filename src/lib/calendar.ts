import { useCallback, useEffect, useState } from 'react'
import { addDays, iso, today } from './dates'
import { supabase } from './supabase'

export interface CalFeed { id: string; owner_id: string | null; label: string; ics_url: string }
export interface CalEvent { id: string; feed_id: string; owner_id: string | null; label: string; title: string; start: string; end: string; all_day: boolean; location: string | null }

// Bewusst ohne useTable: eigene kleine Datei, damit sie anderen Umbauten nicht in die Quere kommt
const DEMO_KEY = 'kk-demo-calendar-feeds'
const demoFeeds = (): CalFeed[] => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) ?? '[]') } catch { return [] } }
const saveDemo = (f: CalFeed[]) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(f)) } catch { /* egal */ } }

export async function listFeeds(): Promise<CalFeed[]> {
  if (!supabase) return demoFeeds()
  const { data, error } = await supabase.from('calendar_feeds').select('id, owner_id, label, ics_url').order('created_at')
  if (error) throw new Error(error.message.includes('calendar_feeds') ? 'Tabelle fehlt: bitte 0003_calendar.sql in Supabase ausführen.' : error.message)
  return data as CalFeed[]
}

export async function addFeed(f: Omit<CalFeed, 'id'>) {
  const url = f.ics_url.trim().replace(/^webcal:/i, 'https:')
  if (!/^https:\/\//i.test(url)) throw new Error('Das ist keine gültige Adresse. Sie beginnt mit https://')
  if (!supabase) { saveDemo([...demoFeeds(), { ...f, ics_url: url, id: crypto.randomUUID() }]); return }
  const { error } = await supabase.from('calendar_feeds').insert({ ...f, ics_url: url })
  if (error) throw new Error(error.message)
}

export async function removeFeed(id: string) {
  if (!supabase) { saveDemo(demoFeeds().filter((f) => f.id !== id)); return }
  await supabase.from('calendar_feeds').delete().eq('id', id)
}

function demoEvents(feeds: CalFeed[]): CalEvent[] {
  if (!feeds.length) return []
  const f = feeds[0]
  const at = (d: number, h: number, m = 0) => { const x = addDays(today(), d); x.setHours(h, m); return x.toISOString() }
  const ev = (id: string, title: string, s: string, e: string, all = false): CalEvent => ({ id, feed_id: f.id, owner_id: f.owner_id, label: f.label, title, start: s, end: e, all_day: all, location: null })
  return [
    ev('1', 'Zahnarzt Irene', at(0, 16, 30), at(0, 17, 15)),
    ev('2', 'Training', at(1, 18), at(1, 19, 30)),
    ev('3', 'Geburtstag Mama', iso(addDays(today(), 2)), iso(addDays(today(), 3)), true),
  ]
}

export async function fetchEvents(days = 14): Promise<{ events: CalEvent[]; errors: { label: string; error: string }[] }> {
  if (!supabase) return { events: demoEvents(demoFeeds()), errors: [] }
  const { data, error } = await supabase.functions.invoke('calendar', { body: { days } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    throw new Error(msg ?? 'Kalender-Funktion nicht erreichbar. Ist „calendar“ in Supabase deployt?')
  }
  return data
}

/** Termine laden, alle 10 Minuten und beim Zurückkehren in die App aktualisieren */
export function useCalendar(days = 14) {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [feeds, setFeeds] = useState<CalFeed[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    try {
      const f = await listFeeds()
      setFeeds(f)
      if (!f.length) { setEvents([]); setError(null); return }
      const r = await fetchEvents(days)
      setEvents(r.events)
      setError(r.errors.length ? r.errors.map((e) => `${e.label}: ${e.error}`).join(' · ') : null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Kalender konnte nicht geladen werden.') }
    finally { setLoading(false) }
  }, [days])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
    const t = setInterval(reload, 10 * 60_000)
    const vis = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [reload])
  return { events, feeds, error, loading, reload }
}

/** Lokaler Tag eines Termins (YYYY-MM-DD) */
export const eventDay = (e: CalEvent) => (e.all_day ? e.start.slice(0, 10) : iso(new Date(e.start)))
export const eventTime = (e: CalEvent) => (e.all_day ? 'ganztägig' : new Date(e.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))

/** Mehrtägige ganztägige Termine (z. B. Urlaub) an jedem Tag zeigen, an dem sie laufen */
export function onDay(events: CalEvent[], day: string): CalEvent[] {
  return events.filter((e) => (e.all_day ? e.start.slice(0, 10) <= day && day < e.end.slice(0, 10) : eventDay(e) === day))
}

/** Öffnet Google Kalender mit einem vorausgefüllten neuen Termin (kein Login in der App nötig) */
export function newEventUrl(title = '', date?: string): string {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title })
  if (date) { const d = date.replaceAll('-', ''); p.set('dates', `${d}/${iso(addDays(new Date(`${date}T12:00:00`), 1)).replaceAll('-', '')}`) }
  return `https://calendar.google.com/calendar/render?${p}`
}
