export function useExecutiveFormat() {
  const currency = (value: number, currencyCode = 'USD') =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0
    }).format(value)

  const shortDate = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(new Date(value))

  const longDate = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(new Date(value))

  const shortTime = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))

  const percent = (value: number) => `${Math.round(value)}%`

  const toIso = (localDateTime: string) => new Date(localDateTime).toISOString()

  return {
    currency,
    shortDate,
    longDate,
    shortTime,
    percent,
    toIso
  }
}
