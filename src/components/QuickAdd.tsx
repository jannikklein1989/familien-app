import { useState } from 'react'
import { useApp } from '../lib/app'
import { relDay, recurrenceLabel } from '../lib/dates'
import { formatQty } from '../lib/quick'
import { applyVoice, understand, type Selection, type VoiceResult } from '../lib/voice'
import { Icon } from './Icon'
import { PrimaryButton, Sheet, inputCls } from './ui'
import { useSpeech } from './useSpeech'

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profiles, backend, me } = useApp()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VoiceResult | null>(null)
  const [sel, setSel] = useState<Selection>({ todos: [], shopping: [], recipes: [] })
  const [done, setDone] = useState<string | null>(null)
  const speech = useSpeech((t) => setText((prev) => (prev ? `${prev} ${t}` : t)))

  const reset = () => { setText(''); setResult(null); setError(null) }
  const close = () => { speech.stop(); reset(); onClose() }

  const go = async () => {
    speech.stop()
    setBusy(true); setError(null)
    try {
      const r = await understand(text.trim(), profiles, me)
      setResult(r)
      setSel({ todos: r.todos.map(() => true), shopping: r.shopping.map(() => true), recipes: r.recipes.map(() => true) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.')
    } finally { setBusy(false) }
  }

  const save = async () => {
    if (!result) return
    setBusy(true)
    try {
      const n = await applyVoice(result, sel, backend, profiles, me)
      setDone(n === 1 ? '1 Eintrag gespeichert' : `${n} Einträge gespeichert`)
      reset()
      setTimeout(() => setDone(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern hat nicht geklappt.')
    } finally { setBusy(false) }
  }

  const toggle = (k: keyof Selection, i: number) => setSel((s) => ({ ...s, [k]: s[k].map((v, j) => (j === i ? !v : v)) }))
  const count = result ? [...sel.todos, ...sel.shopping, ...sel.recipes].filter(Boolean).length : 0
  const who = (name: string | null) => name ?? 'Beide'

  return (
    <Sheet open={open} onClose={close} title="Sag's mir">
      {!result ? (
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) go() }} className="flex flex-col gap-3">
          <div className="relative">
            <textarea rows={4} value={speech.interim ? `${text} ${speech.interim}`.trim() : text} onChange={(e) => setText(e.target.value)}
              placeholder="z. B. „Irene soll morgen beim Zahnarzt anrufen, wir brauchen 2 Liter Milch und Eier, und ich hätte mal Lust auf Ramen“"
              aria-label="Eingabe" className={`${inputCls} py-3 pr-16 resize-none`} />
            {speech.supported && (
              <button type="button" onClick={speech.listening ? speech.stop : speech.start}
                aria-label={speech.listening ? 'Aufnahme stoppen' : 'Einsprechen'} aria-pressed={speech.listening}
                className={`absolute right-2 top-2 w-12 h-12 rounded-full border-0 flex items-center justify-center ${speech.listening ? 'bg-alert text-white animate-pulse' : 'bg-lime text-lime-ink'}`}>
                <Icon name={speech.listening ? 'close' : 'mic'} size={22} stroke={2.2} />
              </button>
            )}
          </div>
          <p className="m-0 text-[13px] text-muted flex items-start gap-1.5">
            <Icon name="sparkle" size={16} className="shrink-0 mt-0.5" />
            {backend.mode === 'supabase'
              ? 'Sprich ruhig alles auf einmal. Claude sortiert es in To-dos, Einkauf und Rezepte, du bestätigst vor dem Speichern.'
              : 'Demo ohne KI: erkennt nur einfache Sätze. Mit Supabase übernimmt Claude.'}
            {!speech.supported && ' Tipp aufs Mikro deiner Tastatur zum Diktieren.'}
          </p>
          {(error || speech.error) && <p role="alert" className="m-0 text-[14px] text-alert">{error ?? speech.error}</p>}
          <PrimaryButton type="submit" disabled={!text.trim() || busy}>{busy ? 'Claude denkt nach …' : 'Verstehen'}</PrimaryButton>
          {done && <div role="status" className="text-center text-green font-semibold">✓ {done}</div>}
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          {result.summary && <p className="m-0 text-[15px]">{result.summary}</p>}
          {result.todos.length > 0 && (
            <Group icon="check" title="To-dos">
              {result.todos.map((t, i) => (
                <Item key={i} checked={sel.todos[i]} onToggle={() => toggle('todos', i)} title={t.title}
                  sub={[who(t.assignee), t.due_date && relDay(t.due_date), t.recurrence && recurrenceLabel({ ...t.recurrence, interval: Math.max(1, Math.round(t.recurrence.interval)) })].filter(Boolean).join(' · ')} />
              ))}
            </Group>
          )}
          {result.shopping.length > 0 && (
            <Group icon="cart" title="Einkauf">
              {result.shopping.map((s, i) => (
                <Item key={i} checked={sel.shopping[i]} onToggle={() => toggle('shopping', i)} title={s.name}
                  sub={[formatQty(s.amount, s.unit ?? 'Stück'), s.category].filter(Boolean).join(' · ')} />
              ))}
            </Group>
          )}
          {result.recipes.length > 0 && (
            <Group icon="bowl" title="Essen">
              {result.recipes.map((r, i) => (
                <Item key={i} checked={sel.recipes[i]} onToggle={() => toggle('recipes', i)} title={r.title}
                  sub={[r.wish ? `Wunsch von ${r.wished_by ?? 'euch'}` : 'Rezept', r.ingredients.length ? `${r.ingredients.length} Zutaten` : ''].filter(Boolean).join(' · ')} />
              ))}
            </Group>
          )}
          {count === 0 && result.todos.length + result.shopping.length + result.recipes.length === 0 && <p className="m-0 text-muted">Ich habe nichts zum Eintragen gefunden.</p>}
          {error && <p role="alert" className="m-0 text-[14px] text-alert">{error}</p>}
          <PrimaryButton onClick={save} disabled={busy || count === 0}>{count === 1 ? '1 Eintrag speichern' : `${count} Einträge speichern`}</PrimaryButton>
          <button onClick={() => setResult(null)} className="min-h-11 bg-transparent border-0 text-[14px] text-muted">Zurück und Text ändern</button>
        </div>
      )}
    </Sheet>
  )
}

function Group({ icon, title, children }: { icon: 'check' | 'cart' | 'bowl'; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="label m-0 mb-2 flex items-center gap-1.5"><Icon name={icon} size={14} /> {title}</h3>
      <div className="bg-card border border-line rounded-[16px] px-3">{children}</div>
    </section>
  )
}

function Item({ checked, onToggle, title, sub }: { checked: boolean; onToggle: () => void; title: string; sub: string }) {
  return (
    <label className="flex items-center gap-3 min-h-[52px] border-b border-line-soft last:border-b-0 py-1.5">
      <input type="checkbox" checked={checked} onChange={onToggle} className="w-5 h-5 m-0 accent-green shrink-0" />
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] ${checked ? '' : 'text-muted line-through'}`}>{title}</span>
        {sub && <span className="block text-[12px] text-muted">{sub}</span>}
      </span>
    </label>
  )
}
