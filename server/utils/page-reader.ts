import { isIP } from 'node:net'

/**
 * Fetches one researched page and keeps its readable text — Claudemy's
 * scrape.py, for a serverless host. A page that cannot be saved says why: an
 * HTTP error (usually a wrong url), a paywalled teaser, or a thin or
 * JavaScript-only page. The urls come from model output, so every hop of a
 * redirect is checked against private and local addresses before it is
 * requested.
 */

const TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5
const MAX_BYTES = 3_000_000
const MIN_WORDS = 250
/** Enough for a reader to take notes from; long pages are cut, not dropped. */
const MAX_CHARS = 40_000

export type PageReadResult =
  | { ok: true; url: string; title: string; text: string; words: number }
  | { ok: false; reason: string }

function isPrivateAddress(host: string) {
  const bare = host.replace(/^\[|\]$/g, '')
  const version = isIP(bare)
  if (version === 4) {
    const [a, b] = bare.split('.').map(Number) as [number, number]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }
  if (version === 6) {
    const lower = bare.toLowerCase()
    return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')
  }
  return false
}

function refuseUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'not a web address'
  }
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    isPrivateAddress(host)
  ) {
    return 'points at a private or local address'
  }
  return ''
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
  middot: '·',
  bull: '•'
}

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(value) && value > 0 && value < 0x110000 ? String.fromCodePoint(value) : ''
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

function largestMatch(html: string, tag: string) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  let best = ''
  for (const match of html.matchAll(pattern)) {
    if ((match[1] || '').length > best.length) {
      best = match[1] || ''
    }
  }
  return best
}

export function extractReadableText(html: string) {
  const titleMatch =
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const title = decodeEntities((titleMatch?.[1] || '').replace(/\s+/g, ' ').trim())

  let body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|canvas|select|button)\b[\s\S]*?<\/\1>/gi, ' ')

  // An article or main element is the page's own content; without one the
  // body is used, minus the chrome that every page of the site repeats.
  const article = largestMatch(body, 'article')
  const main = largestMatch(body, 'main')
  if (article.length > 1500) {
    body = article
  } else if (main.length > 1500) {
    body = main
  } else {
    body = (largestMatch(body, 'body') || body).replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
  }

  const text = decodeEntities(
    body
      .replace(/<(br|hr)\b[^>]*>/gi, '\n')
      .replace(/<\/?(p|div|section|h[1-6]|li|ul|ol|tr|table|blockquote|pre|dd|dt|figcaption)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .split('\n')
    .map(line => line.replace(/[ \t\f\v ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

  return { title, text }
}

const PAYWALL = /(subscribe to (continue|keep) reading|to continue reading|already a subscriber|this article is for (subscribers|members)|sign in to read|become a member to read)/i

export async function readWebPage(requested: string): Promise<PageReadResult> {
  let url: URL
  try {
    url = new URL(requested)
  } catch {
    return { ok: false, reason: 'not a valid url' }
  }

  let response: Response | null = null
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const refused = refuseUrl(url)
    if (refused) {
      return { ok: false, reason: refused }
    }
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; SereneExecutive-Claudemy/1.0; private study notes)',
          accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8'
        }
      })
    } catch (error) {
      const name = (error as Error)?.name
      return { ok: false, reason: name === 'TimeoutError' ? 'timed out' : 'could not connect' }
    }
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    break
  }

  if (!response || (response.status >= 300 && response.status < 400)) {
    return { ok: false, reason: 'too many redirects' }
  }
  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status}` }
  }

  // A deep link that lands on the site's front page was almost always a wrong url.
  const requestedPath = new URL(requested).pathname
  if (requestedPath.length > 1 && url.pathname === '/') {
    return { ok: false, reason: "redirected to the site's home page (likely a wrong url)" }
  }

  const type = response.headers.get('content-type') || ''
  if (!/text\/html|application\/xhtml|text\/plain/i.test(type)) {
    return { ok: false, reason: `not a web page (${type.split(';')[0] || 'unknown type'})` }
  }
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) {
    return { ok: false, reason: 'page is too large' }
  }

  const raw = (await response.text()).slice(0, MAX_BYTES)
  const { title, text } = /text\/plain/i.test(type) ? { title: '', text: raw.trim() } : extractReadableText(raw)
  const words = text.split(/\s+/).filter(Boolean).length

  if (PAYWALL.test(text) && words < 600) {
    return { ok: false, reason: 'paywalled teaser' }
  }
  if (words < MIN_WORDS) {
    return { ok: false, reason: `thin or JavaScript-only page (${words} words)` }
  }

  return { ok: true, url: url.toString(), title: title || url.hostname, text: text.slice(0, MAX_CHARS), words }
}
