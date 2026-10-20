// Since Nuxt 4.5 the last useFetch overload takes `string | options` (the
// legacy positional key), so drop the string half before spreading it.
type PlannerFetchOptions<T> = Exclude<Parameters<typeof useFetch<T>>[1], string>

export function usePlannerFetch<T>(key: string, url: string, options: PlannerFetchOptions<T> = {}) {
  return useFetch<T>(url, {
    key,
    server: true,
    lazy: false,
    ...options
  })
}
