import { useState } from 'react'
import { useApp } from '../lib/app'
import { addFeed, newEventUrl, onDay, removeFeed, useCalendar } from '../lib/calendar'
import { addDays, iso, relDay, shortDate, today } from '../lib/dates'
import { Icon } from '../components/Icon'
import { EventRow, personDot } from '../components/CalendarList'
import { Card, Field, PageHeader, PersonPicker, PrimaryButton, Sheet, inputCls } from '../components/ui'

export default function Kalender() {
  const { person } = useApp()
  const cal = useCalendar(14)
  const [adding, setAdding] = useState(false)
  const days = Array.from({ length: 14 }, (_, i) => iso(addDays(today(), i)))

  return (
    <div>
      <PageHeader eyebrow="Google Kalender" title="Kalender" right={
        <a href={newEventUrl()} target="_blank" rel="noreferrer" aria-label="Termin in Google Kalender eintragen" className="w-12 h-12 rounded-full bg-green text-lime flex items-center justify-center no-underline"><Icon name="plus" size={24} stroke={2.4} /></a>
      } />

      {cal.error && <p role="alert" className="mt-4 text-[14px] text-alert">{cal.error}</p>}

      {cal.feeds && cal.feeds.length === 0 && (
        <Card className="mt-5 p-4 flex flex-col gap-3">
          <div className="text-[17px] font-semibold">Noch kein Kalender verbunden</div>
          <p className="m-0 text-[14px] text-muted">Jeder von euch verbindet einmal seinen Google Kalender über die geheime iCal-Adresse. Danach erscheinen eure Termine hier und auf der Startseite.</p>
          <PrimaryButton onClick={() => setAdding(true)}>Kalender verbinden</PrimaryButton>
        </Card>
      )}

      {!!cal.feeds?.length && (
        <div className="mt-5 flex flex-col gap-4">
          {days.map((d) => {
            const list = onDay(cal.events, d)
            if (!list.length && d !== days[0]) return null
            return (
              <section key={d}>
                <h2 className="label m-0 mb-2">{relDay(d)} · {shortDate(d)}</h2>
                <Card className="px-3.5">
                  {list.length ? list.map((e) => <EventRow key={e.id} e={e} />) : <div className="py-4 text-muted text-[14px]">Keine Termine</div>}
                </Card>
              </section>
            )
          })}
          {cal.loading && <p className="text-muted text-[14px]">Lade Termine …</p>}
        </div>
      )}

      {!!cal.feeds?.length && (
        <section className="mt-8">
          <h2 className="label m-0 mb-2">Verbundene Kalender</h2>
          <Card className="px-3.5">
            {cal.feeds.map((f) => (
              <div key={f.id} className="flex items-center gap-3 min-h-12 border-b border-line-soft last:border-b-0">
                <span className={`w-3 h-3 rounded-full ${personDot(person(f.owner_id)?.color)}`} />
                <span className="flex-1 text-[15px]">{f.label} <span className="text-muted text-[13px]">· {person(f.owner_id)?.display_name ?? 'gemeinsam'}</span></span>
                <button aria-label={`${f.label} entfernen`} onClick={async () => { await removeFeed(f.id); cal.reload() }} className="w-11 h-11 bg-transparent border-0 text-muted"><Icon name="trash" size={18} /></button>
              </div>
            ))}
          </Card>
          <button onClick={() => setAdding(true)} className="mt-2 min-h-11 w-full rounded-[12px] border border-line bg-card text-[14px]">+ Weiteren Kalender verbinden</button>
        </section>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Kalender verbinden">
        {adding && <FeedForm onDone={() => { setAdding(false); cal.reload() }} />}
      </Sheet>
    </div>
  )
}

function FeedForm({ onDone }: { onDone: () => void }) {
  const { me } = useApp()
  const [owner, setOwner] = useState<string | null>(me.id)
  const [label, setLabel] = useState('Google Kalender')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null)
      try { await addFeed({ owner_id: owner, label: label.trim() || 'Kalender', ics_url: url }); onDone() }
      catch (err) { setError(err instanceof Error ? err.message : 'Hat nicht geklappt.') }
      finally { setBusy(false) }
    }} className="flex flex-col gap-4">
      <ol className="m-0 pl-5 text-[14px] text-muted flex flex-col gap-1">
        <li>Am Computer calendar.google.com öffnen (in der Handy-App gibt es die Einstellung nicht).</li>
        <li>Links beim Kalender auf die drei Punkte → <b>Einstellungen und Freigabe</b>.</li>
        <li>Ganz nach unten: <b>Privatadresse im iCal-Format</b> → kopieren.</li>
        <li>Hier einfügen. Die Adresse ist wie ein Passwort: nirgends sonst teilen.</li>
      </ol>
      <Field group label="Wessen Kalender?"><PersonPicker value={owner} onChange={setOwner} /></Field>
      <Field label="Name"><input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} /></Field>
      <Field label="Privatadresse im iCal-Format"><input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className={inputCls} /></Field>
      {error && <p role="alert" className="m-0 text-[14px] text-alert">{error}</p>}
      <PrimaryButton type="submit" disabled={busy || !url.trim()}>{busy ? 'Speichere …' : 'Verbinden'}</PrimaryButton>
    </form>
  )
}
