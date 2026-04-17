// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
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
    appOrigin: 'http://localhost:3000',
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
    '/': { redirect: '/dashboard' }
  },
  typescript: {
    typeCheck: true
  }
})
