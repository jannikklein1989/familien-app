import { Link } from 'react-router-dom'
import { useApp } from '../lib/app'
import { resetDemo } from '../lib/demo'
import { supabase } from '../lib/supabase'
import { Icon, type IconName } from '../components/Icon'
import { Card, IconChip, PageHeader, type ChipColor } from '../components/ui'

const ITEMS: { to?: string; label: string; sub: string; icon: IconName; color: ChipColor; soon?: boolean }[] = [
  { to: '/vertraege', label: 'Verträge & Fixkosten', sub: 'Abos, Fristen, Kündigungslinks', icon: 'wallet', color: 'lime' },
  { label: 'Kalender', sub: 'Google Kalender von euch beiden', icon: 'calendar', color: 'blue', soon: true },
  { label: 'Ärzte', sub: 'Wer hat welchen Arzt, Vorsorge', icon: 'heart', color: 'pink', soon: true },
  { label: 'Geburtstage & Geschenke', sub: 'Erinnerung und Ideenliste', icon: 'gift', color: 'violet', soon: true },
  { label: 'Notfallkontakte', sub: 'Schnell anrufen', icon: 'phone', color: 'coral', soon: true },
]

export default function Mehr() {
  const { me, profiles, setMe, backend } = useApp()
  return (
    <div>
      <PageHeader eyebrow="Alles andere" title="Mehr" />
      <div className="mt-5 flex flex-col gap-2.5">
        {ITEMS.map((it) => {
          const inner = (
            <Card className={`p-3.5 flex items-center gap-3 ${it.soon ? 'opacity-60' : ''}`}>
              <IconChip name={it.icon} color={it.color} size={40} />
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-semibold">{it.label}</div>
                <div className="text-[13px] text-muted">{it.sub}</div>
              </div>
              {it.soon ? <span className="font-mono text-[10px] tracking-[0.12em] px-2 py-1 rounded-[8px] bg-[#E3E8DD] text-muted">BALD</span> : <Icon name="chevron" size={18} className="text-muted" />}
            </Card>
          )
          return it.to ? <Link key={it.label} to={it.to} className="no-underline text-ink">{inner}</Link> : <div key={it.label}>{inner}</div>
        })}
      </div>

      <section className="mt-8">
        <h2 className="label m-0 mb-2">Profil</h2>
        {backend.mode === 'demo' ? (
          <Card className="p-3.5 flex flex-col gap-3">
            <p className="m-0 text-[14px] text-muted">Demo-Modus: Daten liegen nur auf diesem Gerät. Zum Testen kannst du die Perspektive wechseln.</p>
            <div className="grid grid-cols-2 gap-2">
              {profiles.map((p) => (
                <button key={p.id} aria-pressed={me.id === p.id} onClick={() => setMe(p.id)}
                  className={`min-h-11 rounded-[12px] border text-[15px] ${me.id === p.id ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>Ich bin {p.display_name}</button>
              ))}
            </div>
            <button onClick={() => { resetDemo(); location.reload() }} className="min-h-11 rounded-[12px] border border-line bg-transparent text-[14px]">Demo-Daten zurücksetzen</button>
          </Card>
        ) : (
          <Card className="p-3.5 flex items-center gap-3">
            <span className={`w-11 h-11 rounded-full flex items-center justify-center font-bold ${me.color === 'irene' ? 'bg-irene' : 'bg-jannik text-white'}`}>{me.display_name.charAt(0)}</span>
            <div className="flex-1"><div className="font-semibold">{me.display_name}</div><div className="text-[13px] text-muted">angemeldet</div></div>
            <button aria-label="Abmelden" onClick={() => supabase?.auth.signOut()} className="w-11 h-11 rounded-full border border-line bg-card flex items-center justify-center"><Icon name="logout" size={20} /></button>
          </Card>
        )}
      </section>
    </div>
  )
}
