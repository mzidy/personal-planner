/**
 * Pure price-series math. Kept free of any Nitro/Nuxt globals so it can be unit
 * tested directly and reused on either side of the wire.
 *
 * Every function takes closes in chronological order (oldest first) and returns
 * null when there is not enough history rather than a misleading partial figure.
 */

export function round(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Simple moving average of the last `period` closes. */
export function sma(closes: number[], period: number) {
  if (period <= 0 || closes.length < period) {
    return null
  }
  const window = closes.slice(-period)
  return round(window.reduce((sum, value) => sum + value, 0) / period)
}

/**
 * Relative Strength Index using Wilder's smoothing — the standard definition,
 * where the first average is a simple mean of the opening `period` deltas and
 * every later step decays the previous average by (period - 1) / period.
 */
export function rsi(closes: number[], period = 14) {
  if (period <= 0 || closes.length < period + 1) {
    return null
  }

  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i]! - closes[i - 1]!
    if (delta >= 0) gain += delta
    else loss -= delta
  }

  let avgGain = gain / period
  let avgLoss = loss / period

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i]! - closes[i - 1]!
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period
  }

  if (avgLoss === 0) {
    return avgGain === 0 ? 50 : 100
  }

  return round(100 - 100 / (1 + avgGain / avgLoss))
}

/** Percent change over the last `sessions` trading sessions. */
export function changeOver(closes: number[], sessions: number) {
  if (sessions <= 0 || closes.length <= sessions) {
    return null
  }
  const past = closes[closes.length - 1 - sessions]!
  const now = closes[closes.length - 1]!
  if (past === 0) {
    return null
  }
  return round(((now - past) / past) * 100)
}

/** Standard deviation of daily returns, annualised over 252 sessions, in percent. */
export function annualisedVolatility(closes: number[], minimumSessions = 30) {
  if (closes.length < minimumSessions) {
    return null
  }

  const returns: number[] = []
  for (let i = 1; i < closes.length; i += 1) {
    const previous = closes[i - 1]!
    if (previous === 0) {
      continue
    }
    returns.push((closes[i]! - previous) / previous)
  }

  if (returns.length < 2) {
    return null
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
  return round(Math.sqrt(variance) * Math.sqrt(252) * 100)
}

/** Where `price` sits between the low (0%) and high (100%) of a range. */
export function rangePosition(price: number, low: number, high: number) {
  if (high === low) {
    return null
  }
  return round(((price - low) / (high - low)) * 100)
}
