import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-low': 'rgb(var(--color-surface-low) / <alpha-value>)',
        'surface-high': 'rgb(var(--color-surface-high) / <alpha-value>)',
        'surface-bright': 'rgb(var(--color-surface-bright) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        outline: 'rgb(var(--color-outline) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        teal: 'rgb(var(--color-teal) / <alpha-value>)',
        navy: 'rgb(var(--color-navy) / <alpha-value>)',
        rosy: 'rgb(var(--color-rosy) / <alpha-value>)'
      },
      boxShadow: {
        ambient: '0 28px 80px rgba(27, 27, 29, 0.08)',
        glass: '0 18px 44px rgba(18, 23, 38, 0.08)'
      },
      borderRadius: {
        soft: '1.75rem',
        panel: '2rem',
        capsule: '999px'
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif']
      },
      backgroundImage: {
        'executive-glow':
          'radial-gradient(circle at top left, rgba(107, 216, 203, 0.22), transparent 34%), radial-gradient(circle at 80% 10%, rgba(19, 27, 46, 0.08), transparent 26%)',
        'executive-panel':
          'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(246,243,245,0.96))',
        'executive-dark':
          'linear-gradient(180deg, rgba(19,27,46,0.98), rgba(12,17,31,1))'
      }
    }
  }
}
