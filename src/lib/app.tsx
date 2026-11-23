import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Backend } from './backend'
import { createDemoBackend, DEMO_PROFILES } from './demo'
import { createSupabaseBackend, supabase } from './supabase'
import type { Profile, TableName, Tables } from './types'

interface AppCtx {
  backend: Backend
  profiles: Profile[]
  me: Profile
  setMe: (id: string) => void // nur Demo: Perspektive wechseln
  person: (id: string | null | undefined) => Profile | undefined
}

const Ctx = createContext<AppCtx | null>(null)

export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp außerhalb von AppProvider')
  return c
}

export function AppProvider({ me: meProfile, children }: { me?: Profile; children: ReactNode }) {
  const backend = useMemo(() => (supabase ? createSupabaseBackend(supabase) : createDemoBackend()), [])
  const [profiles, setProfiles] = useState<Profile[]>(supabase ? [] : DEMO_PROFILES)
  const [meId, setMeId] = useState<string>(() => {
    if (meProfile) return meProfile.id
    try { return localStorage.getItem('kk-demo-me') ?? 'u-jannik' } catch { return 'u-jannik' }
  })

  useEffect(() => {
    backend.profiles().then(setProfiles).catch(() => {})
  }, [backend])

  const setMe = useCallback((id: string) => {
    setMeId(id)
    try { localStorage.setItem('kk-demo-me', id) } catch { /* ignorieren */ }
  }, [])

  const person = useCallback((id: string | null | undefined) => profiles.find((p) => p.id === id), [profiles])
  const me = profiles.find((p) => p.id === meId) ?? meProfile ?? DEMO_PROFILES[0]

  return <Ctx.Provider value={{ backend, profiles, me, setMe, person }}>{children}</Ctx.Provider>
}

/** Live-Daten einer Tabelle inklusive Aktualisierung bei Änderungen */
export function useTable<T extends TableName>(table: T) {
  const { backend } = useApp()
  const [rows, setRows] = useState<Tables[T][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    backend
      .list(table)
      .then((r) => { setRows(r); setError(null) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [backend, table])

  useEffect(() => {
    reload()
    return backend.subscribe(table, reload)
  }, [backend, table, reload])

  const api = useMemo(() => ({
    insert: (row: Partial<Tables[T]>) => backend.insert(table, row).then(reload),
    update: (id: string, patch: Partial<Tables[T]>) => backend.update(table, id, patch).then(reload),
    remove: (id: string) => backend.remove(table, id).then(reload),
    removeWhere: (field: keyof Tables[T], value: unknown) => backend.removeWhere(table, field, value).then(reload),
  }), [backend, table, reload])

  return { rows, loading, error, ...api }
}
