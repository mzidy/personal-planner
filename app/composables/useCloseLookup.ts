import type { CloseOnDate } from '~~/shared/types/trades'
import { WATCHLIST_SYMBOL } from '~~/shared/utils/watchlist'

/**
 * Looks up a stock's close on a day whenever its ticker or date changes, so a
 * form can offer the price instead of making the user look it up. Only the
 * latest answer is delivered; an unknown ticker or a failed lookup is silent.
 */
export function useCloseLookup() {
  function watchClose(symbol: () => string, date: () => string, onClose: (close: CloseOnDate) => void) {
    let timer: ReturnType<typeof setTimeout> | undefined
    let asked = 0

    watch(
      [symbol, date],
      ([rawSymbol, day]) => {
        clearTimeout(timer)
        const ticker = rawSymbol.trim().toUpperCase()
        if (!WATCHLIST_SYMBOL.test(ticker) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
          return
        }
        timer = setTimeout(async () => {
          const ask = ++asked
          const close = await $fetch<CloseOnDate>('/api/trades/close', { query: { symbol: ticker, date: day } }).catch(() => null)
          if (close && ask === asked) {
            onClose(close)
          }
        }, 450)
      },
      { immediate: true }
    )

    onBeforeUnmount(() => clearTimeout(timer))
  }

  return { watchClose }
}
