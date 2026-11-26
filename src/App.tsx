import { useEffect, useState } from 'react'
import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AppProvider } from './lib/app'
import { supabase } from './lib/supabase'
import type { Profile } from './lib/types'
import Kalender from './pages/Kalender'
import { TabBar } from './components/TabBar'
import { QuickAdd } from './components/QuickAdd'
import Heute from './pages/Heute'
import Todos from './pages/Todos'
import Einkauf from './pages/Einkauf'
import Essen from './pages/Essen'
import Mehr from './pages/Mehr'
import Vertraege from './pages/Vertraege'
import { Login, Onboarding } from './pages/Auth'

// In der Vorschau (eingebettet) ohne URL-Hash navigieren
const Router = import.meta.env.VITE_PREVIEW === '1' ? MemoryRouter : HashRouter

function Shell() {
  const [quick, setQuick] = useState(false)
  return (
    <Router>
      <main className="max-w-[520px] mx-auto px-[18px] pb-safe">
        <Routes>
          <Route path="/" element={<Heute />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/einkauf" element={<Einkauf />} />
          <Route path="/essen" element={<Essen />} />
          <Route path="/mehr" element={<Mehr />} />
          <Route path="/vertraege" element={<Vertraege />} />
          <Route path="/kalender" element={<Kalender />} />
        </Routes>
      </main>
      <TabBar onMic={() => setQuick(true)} />
      <QuickAdd open={quick} onClose={() => setQuick(false)} />
    </Router>
  )
}

export default function App() {
  if (!supabase) {
    return <AppProvider><Shell /></AppProvider>
  }
  return <AuthGate />
}

function AuthGate() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profile, setProfile] = useState<(Profile & { household_id: string | null }) | null | undefined>(undefined)

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase!.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const loadProfile = () => {
    if (!session) return
    supabase!.from('profiles').select('id, display_name, color, household_id').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data))
  }
  useEffect(loadProfile, [session])

  if (session === undefined) return null
  if (!session) return <Login />
  if (profile === undefined) return null
  if (!profile?.household_id) return <Onboarding onDone={loadProfile} defaultName={session.user.user_metadata?.full_name?.split(' ')[0] ?? ''} />
  return <AppProvider me={profile}><Shell /></AppProvider>
}
