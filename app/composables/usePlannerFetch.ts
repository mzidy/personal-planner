export function usePlannerFetch<T>(key: string, url: string, options: Parameters<typeof useFetch<T>>[1] = {}) {
  return useFetch<T>(url, {
    key,
    server: true,
    lazy: false,
    ...options
  })
}
