import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:4000'
  },
  webServer: {
    command: 'npm run dev -- --no-typecheck',
    url: 'http://localhost:4000',
    reuseExistingServer: !process.env.CI
  }
})
