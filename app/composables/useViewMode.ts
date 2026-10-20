export type ViewMode = 'basic' | 'extended'

const STORAGE_KEY = 'serene:view-mode'

/**
 * Basic hides the parts of the app that are not in daily use, so the sidebar
 * stays short. Extended shows everything.
 *
 * This is a view preference, not a permission: a hidden section is still
 * reachable by typing its URL, and nothing behind it is disabled.
 *
 * It resets to basic on each sign-in — see resetViewMode(), called from the
 * login flow — but survives a page reload in between, so the choice does not
 * have to be made again on every navigation.
 */
export function useViewMode() {
  const mode = useState<ViewMode>('view-mode', () => 'basic')

  // localStorage is only read on the client; SSR renders the basic sidebar and
  // hydration corrects it, which is the right way round — basic is the default.
  onMounted(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'basic' || stored === 'extended') {
      mode.value = stored
    }
  })

  function setMode(next: ViewMode) {
    mode.value = next
    if (import.meta.client) {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  return {
    mode,
    isBasic: computed(() => mode.value === 'basic'),
    setMode,
    toggle: () => setMode(mode.value === 'basic' ? 'extended' : 'basic')
  }
}

/** Called after a successful sign-in, so every session starts in basic. */
export function resetViewMode() {
  if (import.meta.client) {
    window.localStorage.removeItem(STORAGE_KEY)
  }
}
