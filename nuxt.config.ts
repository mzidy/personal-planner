// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: { port: 4000 },
  modules: ['@nuxtjs/tailwindcss', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  components: [
    // Templates use <PanelCard> / <StatusPill>, so the ui directory must not be
    // path-prefixed. Everything else keeps the default prefix (AppPageHero,
    // FinanceSectionView, StatsWeightTrendChart, ...).
    { path: '~/components/ui', pathPrefix: false },
    '~/components'
  ],
  app: {
    head: {
      title: 'The Serene Executive',
      titleTemplate: '%s · The Serene Executive',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Single-user personal planner for focus, time, diary, yearly goals, and manual money tracking.'
        }
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com'
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: ''
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap'
        }
      ]
    }
  },
  runtimeConfig: {
    databaseUrl: '',
    // Set these (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) to run against hosted
    // libSQL instead of a local file — required on serverless hosts.
    tursoDatabaseUrl: process.env.TURSO_DATABASE_URL || '',
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN || '',
    anthropicApiKey: '',
    appOrigin: 'http://localhost:4000',
    singleUserMode: true,
    demoUserEmail: 'founder@serene-executive.app',
    demoUserPassword: 'ConciergeDemo123!',
    oauth: {
      google: {
        clientId: '',
        clientSecret: ''
      }
    },
    public: {
      appName: 'The Serene Executive',
      appTagline: 'Digital concierge for focus, time, and money.'
    }
  },
  auth: {
    hash: {
      scrypt: {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 32 * 1024 * 1024
      }
    }
  },
  routeRules: {
    '/': { redirect: '/dashboard' },
    // Daily routine moved from Goals to Tasks; keep old links working.
    '/goals/routine': { redirect: { to: '/priorities/routine', statusCode: 301 } }
  },
  typescript: {
    typeCheck: true
  }
})
