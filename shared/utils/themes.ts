import { ageOn, type Gender } from './profile'

/**
 * The app's looks. Executive is the original and the fallback; the others
 * follow the designs in ui-predlogi/, one per audience.
 */
export const THEMES = ['executive', 'lavender', 'graphite', 'chrome', 'skate'] as const
export type ThemeName = (typeof THEMES)[number]

/** What the user picked in the switch: a theme, or "auto" to follow the profile. */
export type ThemeChoice = ThemeName | 'auto'

export interface ThemeInfo {
  label: string
  /** Who the design was made for; shown in the switch. */
  audience: string
  /** Teen themes rename the menu (Homework, Pocket money…) and have their own home page. */
  teen: boolean
  dark: boolean
  /** Google Fonts stylesheet for the theme; executive's fonts are always loaded. */
  fontsHref: string | null
}

export const THEME_INFO: Record<ThemeName, ThemeInfo> = {
  executive: { label: 'Executive', audience: 'Default', teen: false, dark: false, fontsHref: null },
  lavender: {
    label: 'Lavender Glass',
    audience: 'Women 18+',
    teen: false,
    dark: false,
    fontsHref: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap'
  },
  graphite: {
    label: 'Graphite Pro',
    audience: 'Men 18+',
    teen: false,
    dark: true,
    fontsHref: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap'
  },
  chrome: {
    label: 'Y2K Chrome',
    audience: 'Girls under 18',
    teen: true,
    dark: false,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Syne:wght@600;700;800&display=swap'
  },
  skate: {
    label: 'Skate Teal',
    audience: 'Boys under 18',
    teen: true,
    dark: false,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,400;0,500;0,700;0,900;1,900&display=swap'
  }
}

export const ADULT_AGE = 18

/**
 * The theme a profile gets on its own: by gender, and by whether the person is
 * under 18. Without a gender (or with "other" / "prefer not to say") it stays
 * on executive; a gender without a date of birth counts as an adult.
 */
export function themeForProfile(gender: Gender | null | undefined, birthDate: string | null | undefined, today?: string): ThemeName {
  if (gender !== 'female' && gender !== 'male') {
    return 'executive'
  }
  const minor = birthDate ? ageOn(birthDate, today) < ADULT_AGE : false
  if (gender === 'female') {
    return minor ? 'chrome' : 'lavender'
  }
  return minor ? 'skate' : 'graphite'
}

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'auto' || (typeof value === 'string' && (THEMES as readonly string[]).includes(value))
}
