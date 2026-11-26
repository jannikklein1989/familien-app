import { useApp } from '../lib/app'
import { eventTime, type CalEvent } from '../lib/calendar'

export function personDot(color?: string) {
  return color === 'irene' ? 'bg-irene' : color === 'jannik' ? 'bg-jannik' : 'bg-green'
}

export function EventRow({ e }: { e: CalEvent }) {
  const { person } = useApp()
  const p = person(e.owner_id)
  return (
    <div className="flex items-center gap-3 min-h-12 border-b border-line-soft last:border-b-0 py-1.5">
      <span className="font-mono text-[12px] w-[62px] shrink-0 text-muted">{eventTime(e)}</span>
      <span className={`w-1 self-stretch rounded-full shrink-0 ${personDot(p?.color)}`} aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] truncate">{e.title}</span>
        <span className="block text-[12px] text-muted truncate">{[p?.display_name ?? e.label, e.location].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  )
}
