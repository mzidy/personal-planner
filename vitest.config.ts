import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Server utilities import each other through Nuxt's `~~` root alias.
    alias: { '~~': fileURLToPath(new URL('.', import.meta.url)) }
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node'
  }
})
