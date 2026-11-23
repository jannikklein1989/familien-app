import type { Profile, TableName, Tables } from './types'

/** Gemeinsame Schnittstelle für Supabase und den Demo-Modus */
export interface Backend {
  mode: 'supabase' | 'demo'
  list<T extends TableName>(table: T): Promise<Tables[T][]>
  insert<T extends TableName>(table: T, row: Partial<Tables[T]>): Promise<void>
  update<T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>
  remove<T extends TableName>(table: T, id: string): Promise<void>
  removeWhere<T extends TableName>(table: T, field: keyof Tables[T], value: unknown): Promise<void>
  /** Meldet Änderungen (auch vom anderen Handy). Rückgabe: abmelden */
  subscribe(table: TableName, cb: () => void): () => void
  profiles(): Promise<Profile[]>
}
