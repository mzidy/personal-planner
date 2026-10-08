import type { FundamentalSnapshot, TechnicalSnapshot } from '~~/shared/types/ticker'
import {
  annualisedVolatility,
  changeOver,
  rangePosition,
  round,
  rsi,
  sma
} from '~~/shared/utils/indicators'

/**
 * Two free, key-less sources:
 *   - Yahoo's v8 chart endpoint for prices (its quote/quoteSummary endpoints are
 *     locked behind a crumb now, so fundamentals cannot come from there).
 *   - SEC EDGAR for fundamentals, which is authoritative but US filers only.
 */
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart'
const SEC_TICKERS = 'https://www.sec.gov/files/company_tickers.json'
const SEC_FACTS = 'https://data.sec.gov/api/xbrl/companyfacts'

// SEC asks for a contact address in the User-Agent and throttles hard without one.
const SEC_HEADERS = { 'User-Agent': 'SereneExecutive/1.0 (personal-planner; contact via app owner)' }
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; SereneExecutive/1.0)' }

const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000

// ---- Prices ---------------------------------------------------------------

interface YahooChart {
  chart?: {
    result?: {
      meta?: { currency?: string; longName?: string; shortName?: string; regularMarketPrice?: number }
      timestamp?: number[]
      indicators?: { quote?: { close?: (number | null)[] }[] }
    }[]
    error?: { description?: string } | null
  }
}

function technicalSignals(snapshot: Omit<TechnicalSnapshot, 'signals'>): string[] {
  const signals: string[] = []
  const { price, sma50, sma200, rsi14, rangePosition, volatility, return12m } = snapshot

  if (sma50 !== null && sma200 !== null) {
    if (sma50 > sma200) {
      signals.push('50-day average is above the 200-day — the longer-term trend is up.')
    } else {
      signals.push('50-day average is below the 200-day — the longer-term trend is down.')
    }
  }

  if (sma200 !== null) {
    const gap = round(((price - sma200) / sma200) * 100)
    signals.push(
      gap >= 0
        ? `Trading ${gap}% above its 200-day average.`
        : `Trading ${Math.abs(gap)}% below its 200-day average.`
    )
  }

  if (rsi14 !== null) {
    if (rsi14 >= 70) signals.push(`RSI ${rsi14} — overbought by the conventional threshold.`)
    else if (rsi14 <= 30) signals.push(`RSI ${rsi14} — oversold by the conventional threshold.`)
    else signals.push(`RSI ${rsi14} — neither overbought nor oversold.`)
  }

  if (rangePosition !== null) {
    if (rangePosition >= 90) signals.push('Sitting in the top 10% of its 52-week range.')
    else if (rangePosition <= 10) signals.push('Sitting in the bottom 10% of its 52-week range.')
    else signals.push(`${rangePosition}% of the way up its 52-week range.`)
  }

  if (volatility !== null) {
    if (volatility >= 45) signals.push(`Annualised volatility ${volatility}% — materially jumpier than the market.`)
    else if (volatility <= 18) signals.push(`Annualised volatility ${volatility}% — calm.`)
    else signals.push(`Annualised volatility ${volatility}%.`)
  }

  if (return12m !== null) {
    signals.push(`${return12m >= 0 ? 'Up' : 'Down'} ${Math.abs(return12m)}% over twelve months.`)
  }

  return signals
}

export async function fetchTechnical(symbol: string): Promise<{
  technical: TechnicalSnapshot
  companyName: string
}> {
  const response = await $fetch<YahooChart>(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`, {
    query: { range: '2y', interval: '1d' },
    headers: YAHOO_HEADERS,
    timeout: 10000,
    retry: 1
  }).catch(() => null)

  const result = response?.chart?.result?.[0]
  const timestamps = result?.timestamp || []
  const rawCloses = result?.indicators?.quote?.[0]?.close || []

  const closes: number[] = []
  let lastTimestamp = 0
  timestamps.forEach((timestamp, index) => {
    const close = rawCloses[index]
    if (close === null || close === undefined) {
      return
    }
    closes.push(close)
    lastTimestamp = timestamp
  })

  if (closes.length < 2) {
    throw createError({
      statusCode: 404,
      statusMessage: `No price history found for "${symbol}". Check the ticker.`
    })
  }

  const price = round(closes[closes.length - 1]!)
  const lastYear = closes.slice(-252)
  const high52w = round(Math.max(...lastYear))
  const low52w = round(Math.min(...lastYear))

  const base: Omit<TechnicalSnapshot, 'signals'> = {
    price,
    currency: result?.meta?.currency || 'USD',
    asOf: new Date(lastTimestamp * 1000).toISOString(),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    rsi14: rsi(closes),
    high52w,
    low52w,
    rangePosition: rangePosition(price, low52w, high52w),
    return1m: changeOver(closes, 21),
    return3m: changeOver(closes, 63),
    return6m: changeOver(closes, 126),
    return12m: changeOver(closes, 252),
    volatility: annualisedVolatility(closes.slice(-252))
  }

  return {
    technical: { ...base, signals: technicalSignals(base) },
    companyName: result?.meta?.longName || result?.meta?.shortName || symbol.toUpperCase()
  }
}

// ---- Fundamentals ---------------------------------------------------------

interface SecFact {
  end: string
  val: number
  form: string
  fy?: number
  fp?: string
  start?: string
  frame?: string
}

interface CompanyFacts {
  entityName?: string
  facts?: Record<string, Record<string, { units?: Record<string, SecFact[]> }>>
}

let tickerMap: { data: Map<string, { cik: string; title: string }>; expiresAt: number } | null = null

async function resolveCik(symbol: string) {
  if (!tickerMap || tickerMap.expiresAt < Date.now()) {
    const raw = await $fetch<Record<string, { cik_str: number; ticker: string; title: string }>>(SEC_TICKERS, {
      headers: SEC_HEADERS,
      timeout: 15000
    })

    const map = new Map<string, { cik: string; title: string }>()
    for (const entry of Object.values(raw)) {
      map.set(entry.ticker.toUpperCase(), {
        cik: String(entry.cik_str).padStart(10, '0'),
        title: entry.title
      })
    }
    tickerMap = { data: map, expiresAt: Date.now() + TICKER_MAP_TTL_MS }
  }

  return tickerMap.data.get(symbol.toUpperCase()) || null
}

/**
 * Annual report forms. 10-K is the domestic filing; foreign private issuers
 * (ASML, for one) file 20-F or 40-F instead, and excluding those silently
 * produced "available but every field null" reviews.
 */
const ANNUAL_FORMS = new Set(['10-K', '20-F', '40-F'])

function isFullYear(start: string, end: string) {
  const days = (Date.parse(end) - Date.parse(start)) / 86400000
  return days > 300 && days < 400
}

function annualFacts(facts: CompanyFacts, concepts: string[]) {
  const collected: SecFact[] = []

  for (const namespace of Object.values(facts.facts || {})) {
    for (const concept of concepts) {
      const units = namespace[concept]?.units?.USD
      if (!units?.length) {
        continue
      }
      for (const item of units) {
        if (!ANNUAL_FORMS.has(item.form)) continue
        if (item.start && !isFullYear(item.start, item.end)) continue
        collected.push(item)
      }
    }
  }

  return collected
}

/**
 * The single most recent annual figure across every candidate concept.
 *
 * Taking the first concept that has *any* data was wrong: companies migrate
 * between XBRL tags, so a retired tag holding stale years would win over the
 * current one and the review would quote figures from four years back.
 */
function latestAnnual(facts: CompanyFacts, concepts: string[]) {
  let best: SecFact | null = null
  for (const item of annualFacts(facts, concepts)) {
    if (!best || item.end > best.end) {
      best = item
    }
  }
  return best
}

/**
 * The annual figure for the period ending on `end`. Margins and ratios are only
 * meaningful when numerator and denominator come from the same fiscal year, so
 * callers pin every income-statement line to the revenue period.
 */
function annualAt(facts: CompanyFacts, concepts: string[], end: string) {
  const matches = annualFacts(facts, concepts).filter(item => item.end === end)
  return matches[0] || null
}

/** The annual figure roughly one year before `end`, for a like-for-like growth rate. */
function priorAnnual(facts: CompanyFacts, concepts: string[], end: string) {
  const target = Date.parse(end)
  let best: SecFact | null = null
  let bestGap = Infinity

  for (const item of annualFacts(facts, concepts)) {
    if (item.end >= end) {
      continue
    }
    // Accept 10-14 months back so a 52/53-week fiscal calendar still matches.
    const gap = Math.abs((target - Date.parse(item.end)) / 86400000 - 365)
    if (gap < 65 && gap < bestGap) {
      best = item
      bestGap = gap
    }
  }

  return best
}

/** Point-in-time balances have no start date; take the most recently reported. */
function latestInstant(facts: CompanyFacts, concepts: string[], unit = 'USD') {
  let best: SecFact | null = null

  for (const namespace of Object.values(facts.facts || {})) {
    for (const concept of concepts) {
      const units = namespace[concept]?.units?.[unit]
      if (!units?.length) {
        continue
      }
      for (const item of units) {
        if (!best || item.end > best.end) {
          best = item
        }
      }
    }
  }

  return best
}

const REVENUE_CONCEPTS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueNet',
  'RevenueFromContractWithCustomerExcludingAssessedTaxMember'
]

const NET_INCOME_CONCEPTS = ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic']

function fundamentalSignals(snapshot: Omit<FundamentalSnapshot, 'signals' | 'note'>): string[] {
  const signals: string[] = []

  if (snapshot.revenueGrowthPercent !== null) {
    const value = snapshot.revenueGrowthPercent
    if (value >= 15) signals.push(`Revenue grew ${value}% year over year — fast.`)
    else if (value >= 0) signals.push(`Revenue grew ${value}% year over year.`)
    else signals.push(`Revenue shrank ${Math.abs(value)}% year over year.`)
  }

  if (snapshot.netMarginPercent !== null) {
    const value = snapshot.netMarginPercent
    if (value >= 20) signals.push(`Net margin ${value}% — highly profitable.`)
    else if (value > 0) signals.push(`Net margin ${value}%.`)
    else signals.push(`Net margin ${value}% — lossmaking at the bottom line.`)
  }

  if (snapshot.returnOnEquityPercent !== null) {
    signals.push(`Return on equity ${snapshot.returnOnEquityPercent}%.`)
  }

  if (snapshot.debtToEquity !== null) {
    const value = snapshot.debtToEquity
    if (value >= 2) signals.push(`Liabilities are ${value}x equity — a leveraged balance sheet.`)
    else signals.push(`Liabilities are ${value}x equity.`)
  }

  if (snapshot.peRatio !== null) {
    const value = snapshot.peRatio
    if (value < 0) signals.push('No meaningful P/E — the company lost money over the period.')
    else if (value >= 40) signals.push(`P/E ${value} — the price already assumes a lot of growth.`)
    else signals.push(`P/E ${value}.`)
  }

  return signals
}

export async function fetchFundamental(symbol: string, price: number): Promise<FundamentalSnapshot> {
  const empty: FundamentalSnapshot = {
    available: false,
    source: 'SEC EDGAR',
    fiscalPeriod: null,
    revenue: null,
    revenueGrowthPercent: null,
    netIncome: null,
    operatingIncome: null,
    netMarginPercent: null,
    operatingMarginPercent: null,
    assets: null,
    liabilities: null,
    equity: null,
    debtToEquity: null,
    returnOnEquityPercent: null,
    sharesOutstanding: null,
    marketCap: null,
    peRatio: null,
    signals: [],
    note: ''
  }

  const match = await resolveCik(symbol).catch(() => null)
  if (!match) {
    return {
      ...empty,
      note: `${symbol.toUpperCase()} is not in the SEC's filer list — fundamentals are only available for US-listed filers. The technical read below still applies.`
    }
  }

  const facts = await $fetch<CompanyFacts>(`${SEC_FACTS}/CIK${match.cik}.json`, {
    headers: SEC_HEADERS,
    timeout: 20000,
    retry: 1
  }).catch(() => null)

  if (!facts) {
    return { ...empty, note: 'SEC EDGAR did not respond, so fundamentals are missing from this review.' }
  }

  // Anchor everything to the most recent annual period that actually has a
  // revenue or net-income figure, then pull the other income-statement lines
  // from that same period. Mixing periods produced nonsense like a 446% margin.
  const revenueFact = latestAnnual(facts, REVENUE_CONCEPTS)
  const netIncomeAnchor = latestAnnual(facts, NET_INCOME_CONCEPTS)
  const period =
    revenueFact && netIncomeAnchor
      ? revenueFact.end > netIncomeAnchor.end
        ? revenueFact.end
        : netIncomeAnchor.end
      : revenueFact?.end || netIncomeAnchor?.end || null

  if (!period) {
    return {
      ...empty,
      note: `No annual filing figures could be read for ${match.title}. The technical read below still applies.`
    }
  }

  const revenue = annualAt(facts, REVENUE_CONCEPTS, period)?.val ?? null
  const netIncome = annualAt(facts, NET_INCOME_CONCEPTS, period)?.val ?? null
  const operatingIncome = annualAt(facts, ['OperatingIncomeLoss'], period)?.val ?? null
  const priorRevenueFact = priorAnnual(facts, REVENUE_CONCEPTS, period)

  const assetsFact = latestInstant(facts, ['Assets'])
  const liabilitiesFact = latestInstant(facts, ['Liabilities'])
  const equityFact = latestInstant(facts, [
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'
  ])
  const sharesFact = latestInstant(
    facts,
    ['EntityCommonStockSharesOutstanding', 'CommonStockSharesOutstanding', 'CommonStockSharesIssued'],
    'shares'
  )

  const equity = equityFact?.val ?? null
  const liabilities = liabilitiesFact?.val ?? null
  const shares = sharesFact?.val ?? null

  const marketCap = shares !== null && shares > 0 ? round(shares * price, 0) : null
  const eps = shares !== null && shares > 0 && netIncome !== null ? netIncome / shares : null

  const snapshot: Omit<FundamentalSnapshot, 'signals' | 'note'> = {
    available: revenue !== null || netIncome !== null,
    source: 'SEC EDGAR',
    fiscalPeriod: period,
    revenue,
    revenueGrowthPercent:
      revenue !== null && priorRevenueFact && priorRevenueFact.val !== 0
        ? round(((revenue - priorRevenueFact.val) / Math.abs(priorRevenueFact.val)) * 100)
        : null,
    netIncome,
    operatingIncome,
    netMarginPercent: revenue && netIncome !== null ? round((netIncome / revenue) * 100) : null,
    operatingMarginPercent: revenue && operatingIncome !== null ? round((operatingIncome / revenue) * 100) : null,
    assets: assetsFact?.val ?? null,
    liabilities,
    equity,
    debtToEquity: equity && liabilities !== null && equity !== 0 ? round(liabilities / equity) : null,
    returnOnEquityPercent: equity && netIncome !== null && equity !== 0 ? round((netIncome / equity) * 100) : null,
    sharesOutstanding: shares,
    marketCap,
    peRatio: eps && eps !== 0 ? round(price / eps) : null
  }

  if (!snapshot.available) {
    return {
      ...snapshot,
      signals: [],
      note: `${match.title} files with the SEC, but no annual revenue or earnings figure could be read from its filings. The technical read below still applies.`
    }
  }

  const staleNote =
    snapshot.fiscalPeriod && Date.now() - Date.parse(snapshot.fiscalPeriod) > 400 * 86400000
      ? ' These are the most recent annual figures on file and are over a year old.'
      : ''

  return {
    ...snapshot,
    signals: fundamentalSignals(snapshot),
    note: `Annual figures from ${match.title}'s latest 10-K filing.${staleNote}`
  }
}
