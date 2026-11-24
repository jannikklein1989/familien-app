export type PersonColor = 'jannik' | 'irene'

export interface Profile {
  id: string
  display_name: string
  color: PersonColor
}

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'
export interface Recurrence {
  freq: Freq
  interval: number
  mode: 'fixed' | 'after_done'
}

export interface Todo {
  id: string
  title: string
  notes?: string | null
  assignee_id: string | null
  due_date: string | null
  recurrence: Recurrence | null
  done_at: string | null
  done_by: string | null
  created_at: string
}

export interface ShoppingItem {
  id: string
  name: string
  quantity?: string | null
  category: string
  checked: boolean
  created_at: string
}

export type ContractInterval = 'monthly' | 'quarterly' | 'yearly'
export interface Contract {
  id: string
  name: string
  provider?: string | null
  category: string
  owner_id: string | null
  direction: 'expense' | 'income'
  amount: number
  interval: ContractInterval
  start_date: string | null
  min_term_months: number | null
  renewal_months: number | null
  notice_value: number | null
  notice_unit: 'days' | 'weeks' | 'months' | null
  monthly_cancellable_after_min_term: boolean
  cancel_url?: string | null
  customer_number?: string | null
  notes?: string | null
  status: 'active' | 'cancelled' | 'ended'
  end_date?: string | null
  created_at: string
}

export interface Recipe {
  id: string
  title: string
  url?: string | null
  wished_by: string | null
  is_wish: boolean
  is_favorite: boolean
  ingredients?: string | null // eine Zutat pro Zeile, z. B. "500 g Hackfleisch"
  steps?: string | null // ein Schritt pro Zeile
  servings?: number | null
  appliances?: string[]
  notes?: string | null
  created_at: string
}

export interface Tables {
  todos: Todo
  shopping_items: ShoppingItem
  contracts: Contract
  recipes: Recipe
}
export type TableName = keyof Tables
