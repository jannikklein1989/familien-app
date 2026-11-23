import { useMemo, useState } from 'react'
import { useApp } from '../lib/app'
import { guessCategory, parseQuick } from '../lib/quick'
import { relDay } from '../lib/dates'
import { Icon } from './Icon'
import { PrimaryButton, Sheet, inputCls } from './ui'

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profiles, backend, me } = useApp()
  const [text, setText] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const result = useMemo(() => parseQuick(text, profiles), [text, profiles])

  const save = async () => {
    if (!result) return
    if (result.kind === 'shopping') {
      for (const name of result.items) await backend.insert('shopping_items', { name, category: guessCategory(name), checked: false })
      setDone(`${result.items.length} × auf die Einkaufsliste`)
    } else {
      await backend.insert('todos', {
        title: result.title,
        assignee_id: result.assignee_id === undefined ? me.id : result.assignee_id,
        due_date: result.due_date, recurrence: null, done_at: null, done_by: null,
      })
      setDone('To-do angelegt')
    }
    setText('')
    setTimeout(() => setDone(null), 1800)
  }

  const who = result?.kind === 'todo'
    ? result.assignee_id === null ? 'Beide' : (profiles.find((p) => p.id === (result.assignee_id ?? me.id))?.display_name ?? '')
    : ''

  return (
    <Sheet open={open} onClose={onClose} title="Sag's mir">
      <form onSubmit={(e) => { e.preventDefault(); save() }} className="flex flex-col gap-3">
        <textarea autoFocus rows={2} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="z. B. „Milch und Eier kaufen“ oder „Irene morgen Zahnarzt anrufen“"
          className={`${inputCls} py-3 resize-none`} />
        <p className="m-0 text-[13px] text-muted flex items-center gap-1.5"><Icon name="mic" size={16} /> Tipp: Tipp auf das Mikro deiner Tastatur und sprich einfach.</p>
        {result && (
          <div className="bg-card border border-line rounded-[14px] p-3 flex items-center gap-3">
            <span className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${result.kind === 'shopping' ? 'bg-[#FFC632] text-[#2B2200]' : 'bg-green text-lime'}`}>
              <Icon name={result.kind === 'shopping' ? 'cart' : 'check'} size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="label">{result.kind === 'shopping' ? 'Einkaufsliste' : 'To-do'}</div>
              <div className="text-[15px] font-medium truncate">
                {result.kind === 'shopping' ? result.items.join(', ') : result.title}
              </div>
              {result.kind === 'todo' && <div className="text-[13px] text-muted">{who}{result.due_date ? ` · ${relDay(result.due_date)}` : ''}</div>}
            </div>
          </div>
        )}
        <PrimaryButton type="submit" disabled={!result}>Eintragen</PrimaryButton>
        {done && <div role="status" className="text-center text-green font-semibold">✓ {done}</div>}
      </form>
    </Sheet>
  )
}
