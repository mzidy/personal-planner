import type { CurrencyTotals } from '~~/shared/types/trades'

/** What a trade dialog is for: a new entry, changing one, or closing an active one. */
export type TradeDialogMode = 'add' | 'edit' | 'close'

/** Display helpers for Active trades: prices in each stock's own currency, signed moves, short dates. */
export function useTradeFormat() {
  function money(value: number | null | undefined, currency = 'USD') {
    if (value === null || value === undefined) {
      return '—'
    }
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value)
    } catch {
      return `${value.toFixed(2)} ${currency}`
    }
  }

  function signedMoney(value: number | null | undefined, currency = 'USD') {
    if (value === null || value === undefined) {
      return '—'
    }
    return `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value), currency)}`
  }

  function signed(value: number | null | undefined, suffix = '%', digits = 2) {
    if (value === null || value === undefined) {
      return '—'
    }
    return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}${suffix}`
  }

  /** Percentage points: the gap between two returns. */
  function points(value: number | null | undefined) {
    return signed(value, ' pp', 1)
  }

  function tone(value: number | null | undefined) {
    if (!value) {
      return 'text-muted'
    }
    return value > 0 ? 'text-emerald-700' : 'text-rose-700'
  }

  function shares(quantity: number) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(quantity)
  }

  /** Oct 1, with the year only when it is not this one. */
  function day(date: string | null | undefined) {
    if (!date) {
      return '—'
    }
    const value = new Date(`${date}T12:00:00`)
    const sameYear = value.getFullYear() === new Date().getFullYear()
    return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' })
  }

  function totals(values: CurrencyTotals) {
    const entries = Object.entries(values)
    return entries.length ? entries.map(([currency, value]) => signedMoney(value, currency)).join(' · ') : '—'
  }

  /** Reads a typed amount; a decimal comma works as well as a point. */
  function parseAmount(text: string) {
    const cleaned = text.trim().replace(/\s/g, '').replace(',', '.')
    if (!cleaned) {
      return null
    }
    const value = Number(cleaned)
    return Number.isFinite(value) ? value : null
  }

  /** Today in the browser's own time zone, as YYYY-MM-DD. */
  function localToday() {
    return new Date().toLocaleDateString('en-CA')
  }

  return { money, signedMoney, signed, points, tone, shares, day, totals, parseAmount, localToday }
}
