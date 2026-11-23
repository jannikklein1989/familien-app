import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icon } from '../components/Icon'
import { Field, PrimaryButton, inputCls } from '../components/ui'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="max-w-[440px] mx-auto px-6 pt-16 pb-10">
      <div className="w-14 h-14 rounded-[16px] bg-green text-lime flex items-center justify-center"><Icon name="check" size={30} stroke={2.4} /></div>
      {children}
    </main>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const redirectTo = location.origin + location.pathname
  return (
    <Frame>
      <h1 className="mt-6 mb-1 text-[34px] font-semibold tracking-[-1px]">KK Home</h1>
      <p className="m-0 text-muted">Euer Alltag an einem Ort.</p>
      <div className="mt-8 flex flex-col gap-3">
        <PrimaryButton onClick={() => supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })}>Mit Google anmelden</PrimaryButton>
        <div className="label text-center my-2">oder per Mail-Link</div>
        {sent ? <p className="text-green font-semibold">Schau in dein Postfach und tipp auf den Link.</p> : (
          <form className="flex flex-col gap-3" onSubmit={async (e) => {
            e.preventDefault()
            const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
            if (error) setErr(error.message); else setSent(true)
          }}>
            <Field label="E-Mail"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
            <button className="min-h-12 rounded-[14px] border border-line bg-card font-semibold">Link schicken</button>
            {err && <p className="text-alert text-[14px] m-0">{err}</p>}
          </form>
        )}
      </div>
    </Frame>
  )
}

export function Onboarding({ onDone, defaultName }: { onDone: () => void; defaultName: string }) {
  const [name, setName] = useState(defaultName)
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'new' | 'join'>('new')
  const [err, setErr] = useState<string | null>(null)
  const submit = async () => {
    setErr(null)
    const color = mode === 'new' ? 'jannik' : 'irene'
    const { error } = mode === 'new'
      ? await supabase!.rpc('create_household', { p_name: 'Unser Zuhause', p_display_name: name, p_color: color })
      : await supabase!.rpc('join_household', { p_code: code, p_display_name: name, p_color: color })
    if (error) setErr(error.message); else onDone()
  }
  return (
    <Frame>
      <h1 className="mt-6 mb-1 text-[30px] font-semibold tracking-[-1px]">Willkommen!</h1>
      <p className="m-0 text-muted">Einmal kurz einrichten.</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Field label="Dein Name"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')} className={`min-h-11 rounded-[12px] border ${mode === 'new' ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>Neuer Haushalt</button>
          <button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')} className={`min-h-11 rounded-[12px] border ${mode === 'join' ? 'bg-green text-white border-green' : 'bg-card border-line'}`}>Ich hab einen Code</button>
        </div>
        {mode === 'join' && <Field label="Einladungscode"><input required value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} font-mono uppercase`} /></Field>}
        <PrimaryButton type="submit">Los geht's</PrimaryButton>
        {err && <p className="text-alert text-[14px] m-0">{err}</p>}
      </form>
    </Frame>
  )
}
