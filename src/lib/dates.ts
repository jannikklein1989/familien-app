import type { Contract, Recurrence } from './types'

/** ISO-Datum (YYYY-MM-DD) in lokaler Zeit */
export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function today(): Date {
  const t = new Date()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate())
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
/** Monate addieren, Monatsende wird geklemmt (31.1. + 1 Monat = 28./29.2.) */
export function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(d.getDate(), last))
  return r
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** Nächstes Fälligkeitsdatum einer wiederkehrenden Aufgabe */
export function nextDue(r: Recurrence, dueDate: string | null, doneOn: Date = today()): string {
  let base = r.mode === 'fixed' && dueDate ? parse(dueDate) : doneOn
  const step = (d: Date) => {
    switch (r.freq) {
      case 'daily': return addDays(d, r.interval)
      case 'weekly': return addDays(d, 7 * r.interval)
      case 'monthly': return addMonths(d, r.interval)
      case 'yearly': return addMonths(d, 12 * r.interval)
    }
  }
  base = step(base)
  // Bei festem Rhythmus überfällige Termine überspringen
  if (r.mode === 'fixed') while (base <= doneOn) base = step(base)
  return iso(base)
}

export function recurrenceLabel(r: Recurrence): string {
  const n = r.interval
  const map = {
    daily: n === 1 ? 'täglich' : `alle ${n} Tage`,
    weekly: n === 1 ? 'wöchentlich' : `alle ${n} Wochen`,
    monthly: n === 1 ? 'monatlich' : `alle ${n} Monate`,
    yearly: n === 1 ? 'jährlich' : `alle ${n} Jahre`,
  }
  return map[r.freq] + (r.mode === 'after_done' ? ' nach Erledigung' : '')
}

function subNotice(d: Date, value: number, unit: Contract['notice_unit']): Date {
  if (unit === 'days') return addDays(d, -value)
  if (unit === 'weeks') return addDays(d, -7 * value)
  return addMonths(d, -value)
}

export type Deadline =
  | { kind: 'deadline'; deadline: Date; termEnd: Date; daysLeft: number }
  | { kind: 'anytime'; noticeText: string }
  | { kind: 'unknown' }

/**
 * Nächste Kündigungsfrist.
 * - Mindestlaufzeit noch nicht vorbei: Fristende = Laufzeitende − Kündigungsfrist
 * - danach, wenn "monatlich kündbar" (Faire-Verbraucherverträge-Regel): jederzeit kündbar
 * - sonst Verlängerung um renewal_months (Standard 12) bis die Frist in der Zukunft liegt
 */
export function cancellationDeadline(c: Contract, now: Date = today()): Deadline {
  if (!c.start_date || c.notice_value == null) return { kind: 'unknown' }
  const start = parse(c.start_date)
  const minTerm = c.min_term_months ?? 0
  let termEnd = addMonths(start, minTerm)
  const noticeText = c.notice_value === 0 ? 'ohne Frist' : `Frist ${c.notice_value} ${unitLabel(c.notice_value, c.notice_unit)}`
  if (subNotice(termEnd, c.notice_value, c.notice_unit) >= now) {
    const deadline = subNotice(termEnd, c.notice_value, c.notice_unit)
    return { kind: 'deadline', deadline, termEnd, daysLeft: daysBetween(now, deadline) }
  }
  if (c.monthly_cancellable_after_min_term || minTerm === 0 && !c.renewal_months) {
    return { kind: 'anytime', noticeText }
  }
  const renewal = c.renewal_months || 12
  while (subNotice(termEnd, c.notice_value, c.notice_unit) < now) termEnd = addMonths(termEnd, renewal)
  const deadline = subNotice(termEnd, c.notice_value, c.notice_unit)
  return { kind: 'deadline', deadline, termEnd, daysLeft: daysBetween(now, deadline) }
}

function unitLabel(n: number, u: Contract['notice_unit']): string {
  if (u === 'days') return n === 1 ? 'Tag' : 'Tage'
  if (u === 'weeks') return n === 1 ? 'Woche' : 'Wochen'
  return n === 1 ? 'Monat' : 'Monate'
}

export function monthly(c: Pick<Contract, 'amount' | 'interval'>): number {
  if (c.interval === 'quarterly') return c.amount / 3
  if (c.interval === 'yearly') return c.amount / 12
  return c.amount
}

const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MO = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export function longDate(d: Date): string {
  return `${WD[d.getDay()]}, ${d.getDate()}. ${MO[d.getMonth()]}`
}
export function shortDate(s: string | Date): string {
  const d = typeof s === 'string' ? parse(s) : s
  return `${d.getDate()}.${d.getMonth() + 1}.`
}
export function relDay(s: string): string {
  const n = daysBetween(today(), parse(s))
  if (n === 0) return 'heute'
  if (n === 1) return 'morgen'
  if (n === -1) return 'gestern'
  if (n < 0) return `seit ${-n} Tagen`
  if (n < 7) return `in ${n} Tagen`
  return shortDate(s)
}
export const euro = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 === 0 ? 0 : 2 })
