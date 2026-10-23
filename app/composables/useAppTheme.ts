import { THEME_INFO, isThemeChoice, type ThemeChoice, type ThemeName } from '~~/shared/utils/themes'

export interface Appearance {
  /** The theme the profile calls for. */
  theme: ThemeName
  firstName: string
}

/** Fetched once by the default layout, under this key. */
export const APPEARANCE_KEY = 'app-appearance'

/**
 * The look in use: the one the profile calls for (gender and age, from
 * Personal stats), unless the switch has picked another. The pick is a
 * cookie, so the server renders the right theme straight away.
 */
export function useAppTheme() {
  // Separate useCookie refs do not see each other's writes, so the pick lives
  // in shared state and the cookie only carries it to the next page load.
  const cookie = useCookie<ThemeChoice>('serene-theme', {
    default: () => 'auto',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  })
  const choice = useState<ThemeChoice>('theme-choice', () => (isThemeChoice(cookie.value) ? cookie.value : 'auto'))
  const { data: appearance } = useNuxtData<Appearance>(APPEARANCE_KEY)

  const detected = computed<ThemeName>(() => appearance.value?.theme ?? 'executive')
  const theme = computed<ThemeName>(() => {
    return choice.value === 'auto' ? detected.value : choice.value
  })

  return {
    choice,
    detected,
    theme,
    info: computed(() => THEME_INFO[theme.value]),
    isTeen: computed(() => THEME_INFO[theme.value].teen),
    firstName: computed(() => appearance.value?.firstName ?? ''),
    setChoice(next: ThemeChoice) {
      choice.value = next
      cookie.value = next
    }
  }
}
