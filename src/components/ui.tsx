import { useEffect, type ReactNode } from 'react'
import { useApp } from '../lib/app'
import { Icon, type IconName } from './Icon'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-card border border-line rounded-[18px] ${className}`}>{children}</div>
}

const CHIP: Record<string, string> = {
  lime: 'bg-lime text-lime-ink',
  green: 'bg-green text-lime',
  yellow: 'bg-[#FFC632] text-[#2B2200]',
  violet: 'bg-[#8E6BFF] text-white',
  pink: 'bg-[#D1347A] text-white',
  blue: 'bg-jannik text-white',
  coral: 'bg-[#FF6B4A] text-[#2A0E06]',
}
export type ChipColor = keyof typeof CHIP

export function IconChip({ name, color, size = 32 }: { name: IconName; color: ChipColor; size?: number }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-[10px] shrink-0 ${CHIP[color]}`} style={{ width: size, height: size }}>
      <Icon name={name} size={Math.round(size * 0.56)} stroke={2.2} />
    </span>
  )
}

export function PersonTag({ id }: { id: string | null }) {
  const { person } = useApp()
  const p = person(id)
  if (!p) return <span className="font-mono text-[11px] px-2 py-1 rounded-[10px] bg-[#E9ECE4] text-[#45443F] uppercase">Beide</span>
  const cls = p.color === 'irene' ? 'bg-irene-soft text-irene-ink' : 'bg-jannik-soft text-jannik-ink'
  return <span className={`font-mono text-[11px] px-2 py-1 rounded-[10px] uppercase ${cls}`}>{p.display_name}</span>
}

export function PageHeader({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 pt-6">
      <div>
        {eyebrow && <div className="label !text-green flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />{eyebrow}</div>}
        <h1 className="m-0 mt-2 text-[32px] leading-[1.05] font-semibold tracking-[-1px]">{title}</h1>
      </div>
      {right}
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto bg-bg rounded-t-[26px] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="m-0 text-xl font-semibold">{title}</h2>
          <button aria-label="Schließen" onClick={onClose} className="w-11 h-11 rounded-full bg-card border border-line flex items-center justify-center"><Icon name="close" size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
export const inputCls = 'w-full min-h-12 px-3.5 rounded-[14px] bg-card border border-line text-[16px] outline-none focus:border-green'

export function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...rest} className={`min-h-12 px-5 rounded-[14px] bg-green text-white font-semibold disabled:opacity-50 ${rest.className ?? ''}`}>{children}</button>
}

export function PersonPicker({ value, onChange, allowBoth = true }: { value: string | null; onChange: (v: string | null) => void; allowBoth?: boolean }) {
  const { profiles } = useApp()
  const opts: { id: string | null; label: string }[] = [...profiles.map((p) => ({ id: p.id as string | null, label: p.display_name })), ...(allowBoth ? [{ id: null, label: 'Beide' }] : [])]
  return (
    <div role="radiogroup" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
      {opts.map((o) => (
        <button type="button" role="radio" aria-checked={value === o.id} key={o.id ?? 'both'} onClick={() => onChange(o.id)}
          className={`min-h-11 rounded-[12px] border text-[15px] font-medium ${value === o.id ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="py-8 text-center">
      <div className="label">{title}</div>
      <div className="mt-2 text-[17px] text-muted">{text}</div>
    </div>
  )
}
