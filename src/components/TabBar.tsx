import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Heute', icon: 'pulse' },
  { to: '/todos', label: 'To-dos', icon: 'check' },
  { to: '/einkauf', label: 'Einkauf', icon: 'cart' },
  { to: '/essen', label: 'Essen', icon: 'bowl' },
]

function Tab({ t }: { t: (typeof tabs)[number] }) {
  return (
    <NavLink to={t.to} end={t.to === '/'} className={({ isActive }) => `h-[60px] flex flex-col items-center justify-center gap-1.5 no-underline ${isActive ? 'text-green' : 'text-muted'}`}>
      {({ isActive }) => (
        <>
          <Icon name={t.icon} size={24} stroke={isActive ? 2.2 : 2} />
          <span className={`font-mono text-[10px] tracking-[0.12em] uppercase ${isActive ? 'font-bold' : ''}`}>{t.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function TabBar({ onMic }: { onMic: () => void }) {
  return (
    <nav aria-label="Hauptnavigation" className="tabbar fixed bottom-0 inset-x-0 z-40 bg-card border-t border-line">
      <div className="max-w-[520px] mx-auto grid grid-cols-5 items-center h-[76px]">
        <Tab t={tabs[0]} />
        <Tab t={tabs[1]} />
        <div className="flex justify-center">
          <button aria-label="Schnell eintragen" onClick={onMic}
            className="w-[62px] h-[62px] -mt-8 rounded-full border-4 border-bg bg-lime text-lime-ink flex items-center justify-center shadow-[0_8px_22px_rgba(15,93,76,0.30)]">
            <Icon name="mic" size={26} stroke={2.2} />
          </button>
        </div>
        <Tab t={tabs[2]} />
        <Tab t={tabs[3]} />
      </div>
    </nav>
  )
}
